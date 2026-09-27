import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BookingService } from "../services/booking.service.js";
import { NegotiationService } from "../services/negotiation.service.js";
import { PaymentService } from "../services/payment.service.js";
import { RazorpayService } from "../services/razorpay.service.js";
import { prisma } from "../config/database.js";
import { summarizeLedger } from "../services/booking-rules.js";
import { handoverSchema, renterReceivingInspectionSchema, returnInitiationSchema } from "../schemas/booking.schema.js";

vi.mock("../config/database.js", async () => {
  const { createFakePrisma } = await import("./helpers/fake-prisma.js");
  return { prisma: createFakePrisma() };
});

vi.mock("../services/business.service.js", async () => {
  const { prisma } = await import("../config/database.js");
  const store = () => (prisma as any).__store;
  return {
    BusinessService: {
      getBusinessByUserId: async (userId: string) => store().business.find((b: any) => b.ownerId === userId) ?? null,
      verifyOwnership: async (businessId: string, userId: string) =>
        store().business.find((b: any) => b.id === businessId)?.ownerId === userId,
    },
  };
});

vi.mock("../services/razorpay.service.js", () => ({
  RazorpayService: {
    keyId: () => "rzp_test_key",
    createOrder: vi.fn(),
    fetchPayment: vi.fn(),
    fetchOrderPayments: vi.fn(),
    capturePayment: vi.fn(),
    verifySignature: vi.fn(() => true),
    refund: vi.fn(),
    findRefundByLedgerRef: vi.fn(async () => null),
  },
}));

const db = prisma as any;
const rz = RazorpayService as unknown as Record<string, ReturnType<typeof vi.fn>>;

const OWNER = "user-owner";
const RENTER = "user-renter";
const OUTSIDER = "user-outsider";
const DAY = 24 * 60 * 60 * 1000;

// 10:00 IST on 1 Oct 2026
const T0 = new Date("2026-10-01T04:30:00.000Z");
const at = (iso: string) => vi.setSystemTime(new Date(iso));

const RENT_PER_DAY = 200_000;   // ₹2,000
const DEPOSIT      = 500_000;   // ₹5,000

/** Razorpay's view of payments made in the test */
const payments = new Map<string, { id: string; order_id: string; amount: number; currency: string; status: string }>();

function seed(resourceOverrides: Record<string, unknown> = {}) {
  db.__reset();
  for (const [id, email] of [[OWNER, "o@x.in"], [RENTER, "r@x.in"], [OUTSIDER, "z@x.in"]]) {
    db.__seed("user", { id, email, verificationStatus: "VERIFIED" });
  }
  db.__seed("business", { id: "biz-owner", name: "Owner LLC", ownerId: OWNER });
  db.__seed("business", { id: "biz-renter", name: "Renter Corp", ownerId: RENTER });
  db.__seed("business", { id: "biz-outsider", name: "Nosy Ltd", ownerId: OUTSIDER });
  db.__seed("admin", { id: "admin-1", name: "Asha", email: "admin@hostnexus.in" });
  db.__seed("resource", {
    id: "res-1", businessId: "biz-owner", name: "Generator", resourceType: "Generator/Power",
    quantity: 1, location: "Pune", rentAmountPaise: RENT_PER_DAY, securityDepositPaise: DEPOSIT,
    photos: ["gen.jpg"], hasPreExistingDamage: true, damageDescription: "Scratch", damagePhotos: ["s.jpg"],
    ...resourceOverrides,
  });
}

const booking = (id: string) => db.__store.bookingRequest.find((b: any) => b.id === id);

let uploadSeq = 0;
/** A photo `userId` uploaded through /api/upload — evidence must reference one of these. */
function media(userId: string) {
  const id = `00000000-0000-4000-8000-${String(++uploadSeq).padStart(12, "0")}.jpg`;
  db.__seed("upload", { id, ownerId: userId, purpose: "MEDIA", mimeType: "image/jpeg", sizeBytes: 100, sha256: `hash-${id}` });
  return `/uploads/${id}`;
}
const ledgerOf = (id: string) => summarizeLedger(db.__store.paymentTransaction.filter((t: any) => t.bookingId === id));
const txns = (id: string, type?: string) =>
  db.__store.paymentTransaction.filter((t: any) => t.bookingId === id && (!type || t.type === type));

async function request(overrides: Record<string, unknown> = {}) {
  const b = await BookingService.createBookingRequest(RENTER, {
    resourceId: "res-1", quantity: 1, startDate: "2026-10-03", endDate: "2026-10-05", ...overrides,
  } as any);
  return b.id as string;
}

async function accept(id: string) {
  return BookingService.updateBookingStatus(id, OWNER, { status: "accepted" });
}

async function pay(id: string, paymentId = `pay_${id}`) {
  const order = await BookingService.createPaymentOrder(id, RENTER);
  payments.set(paymentId, { id: paymentId, order_id: order.orderId, amount: order.amount, currency: "INR", status: "captured" });
  return BookingService.verifyAndFundEscrow(id, RENTER, order.orderId, paymentId, "sig");
}

async function handover(id: string) {
  at("2026-10-03T03:30:00.000Z"); // 09:00 IST on the start day
  const code = booking(id).handoverCode;
  return BookingService.markHandover(id, OWNER, { handoverCode: code, evidenceUrls: [media(OWNER)] });
}

async function activeBooking() {
  const id = await request();
  await accept(id);
  await pay(id);
  await handover(id);
  await BookingService.renterReceivingInspection(id, RENTER, { status: "ACCEPTED", evidenceUrls: [] });
  return id;
}

async function inOwnerInspection() {
  const id = await activeBooking();
  at("2026-10-05T12:30:00.000Z");
  await BookingService.initiateReturn(id, RENTER, { returnEvidenceUrls: [media(RENTER)] });
  await BookingService.ownerConfirmReceipt(id, OWNER, { received: true });
  return id;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
  vi.clearAllMocks();
  payments.clear();
  rz.createOrder.mockImplementation(async (amount: number, bookingId: string) => ({
    orderId: `order_${bookingId}_${amount}`, amount, currency: "INR", keyId: "rzp_test_key",
  }));
  rz.fetchPayment.mockImplementation(async (paymentId: string) => payments.get(paymentId));
  rz.fetchOrderPayments.mockImplementation(async (orderId: string) =>
    [...payments.values()].filter((p) => p.order_id === orderId)
  );
  rz.capturePayment.mockImplementation(async (paymentId: string) => ({ ...payments.get(paymentId)!, status: "captured" }));
  rz.refund.mockImplementation(async (_p: string, _a: number, ref: string) => ({ id: `rfnd_${ref}` }));
  seed();
});

afterEach(() => {
  vi.useRealTimers();
});

// ─────────────────────────────────────────────────────────────────────────

describe("booking request dates (#19, #20)", () => {
  it("counts days inclusively: start = end is a one-day booking", async () => {
    const id = await request({ startDate: "2026-10-03", endDate: "2026-10-03" });
    expect(booking(id).totalDays).toBe(1);
    expect(booking(id).rentAmountPaise).toBe(RENT_PER_DAY);
  });

  it("prices a 3rd–5th booking as 3 days with the full snapshot", async () => {
    const id = await request();
    const b = booking(id);
    expect(b.totalDays).toBe(3);
    expect(b.rentAmountPaise).toBe(3 * RENT_PER_DAY);
    expect(b.totalAmountPaise).toBe(3 * RENT_PER_DAY + DEPOSIT);
    expect(b.damageDisclosureSnapshot).toEqual({ hasPreExistingDamage: true, damageDescription: "Scratch", damagePhotos: ["s.jpg"] });
  });

  it("charges the listed rent per unit per day", async () => {
    seed({ quantity: 50 });
    const id = await request({ quantity: 20 });
    expect(booking(id).rentAmountPaise).toBe(RENT_PER_DAY * 3 * 20);
    expect(booking(id).totalAmountPaise).toBe(RENT_PER_DAY * 3 * 20 + DEPOSIT);

    // A negotiated rate is per unit per day too
    await NegotiationService.makeOffer(RENTER, id, 150_000);
    await NegotiationService.acceptOffer(OWNER, id);
    expect(booking(id).rentAmountPaise).toBe(150_000 * 3 * 20);
  });

  it("rejects a start date in the past (422) and an end before the start", async () => {
    await expect(request({ startDate: "2026-09-30", endDate: "2026-10-02" })).rejects.toMatchObject({ statusCode: 422, code: "INVALID_DATES" });
    await expect(request({ startDate: "2026-10-05", endDate: "2026-10-03" })).rejects.toMatchObject({ statusCode: 422, code: "INVALID_DATES" });
  });

  it("accepts a start date of today", async () => {
    const id = await request({ startDate: "2026-10-01", endDate: "2026-10-01" });
    expect(booking(id).totalDays).toBe(1);
  });

  it("treats back-to-back bookings sharing a day as a conflict (inclusive dates)", async () => {
    const first = await request({ startDate: "2026-10-03", endDate: "2026-10-05" });
    await accept(first);
    await expect(request({ startDate: "2026-10-05", endDate: "2026-10-06" })).rejects.toMatchObject({ statusCode: 409 });
    await expect(request({ startDate: "2026-10-06", endDate: "2026-10-07" })).resolves.toBeDefined();
  });

  it("an availability window must cover every booked day, inclusive of its last day", async () => {
    db.__seed("availabilityWindow", { id: "w1", resourceId: "res-1", fromDate: new Date("2026-10-01"), toDate: new Date("2026-10-05") });
    await expect(request({ startDate: "2026-10-03", endDate: "2026-10-05" })).resolves.toBeDefined();
    await expect(request({ startDate: "2026-10-04", endDate: "2026-10-06" })).rejects.toMatchObject({ statusCode: 422, code: "NOT_AVAILABLE" });
  });
});

describe("pricing basis (per hour / day / event)", () => {
  it("hourly listings charge rate × hours per day × days × quantity and snapshot the basis", async () => {
    seed({ pricingBasis: "HOUR", quantity: 2 });
    const id = await request({ quantity: 2, hoursPerDay: 5 }); // 3rd–5th = 3 days
    const b = booking(id);
    expect(b.pricingBasis).toBe("HOUR");
    expect(b.hoursPerDay).toBe(5);
    expect(b.rentAmountPaise).toBe(RENT_PER_DAY * 5 * 3 * 2);
    expect(b.totalAmountPaise).toBe(RENT_PER_DAY * 5 * 3 * 2 + DEPOSIT);
  });

  it("hourly listings require the hours per day", async () => {
    seed({ pricingBasis: "HOUR" });
    await expect(request()).rejects.toMatchObject({ statusCode: 422, code: "HOURS_REQUIRED" });
  });

  it("per-event listings charge a flat rate per unit, however many days", async () => {
    seed({ pricingBasis: "EVENT", quantity: 10 });
    const id = await request({ quantity: 4, hoursPerDay: 6 }); // hours are ignored for non-hourly listings
    const b = booking(id);
    expect(b.pricingBasis).toBe("EVENT");
    expect(b.hoursPerDay).toBeNull();
    expect(b.rentAmountPaise).toBe(RENT_PER_DAY * 4);
  });

  it("a negotiated rate uses the booking's basis", async () => {
    seed({ pricingBasis: "HOUR" });
    const id = await request({ hoursPerDay: 4 });
    await NegotiationService.makeOffer(RENTER, id, 150_000);
    await NegotiationService.acceptOffer(OWNER, id);
    expect(booking(id).rentAmountPaise).toBe(150_000 * 4 * 3);
    expect(booking(id).totalAmountPaise).toBe(150_000 * 4 * 3 + DEPOSIT);
  });

  it("the owner changing the basis later doesn't re-price an existing request", async () => {
    const id = await request();
    db.__store.resource[0].pricingBasis = "EVENT";
    await accept(id);
    expect(booking(id).rentAmountPaise).toBe(3 * RENT_PER_DAY);
  });
});

describe("hidden and suspended listings (#8, #17)", () => {
  it("cannot book a soft-deleted listing", async () => {
    db.__store.resource[0].deletedAt = new Date();
    await expect(request()).rejects.toMatchObject({ statusCode: 404 });
  });

  it("cannot book from a suspended owner", async () => {
    db.__store.user.find((u: any) => u.id === OWNER).verificationStatus = "SUSPENDED";
    await expect(request()).rejects.toMatchObject({ statusCode: 422, code: "RESOURCE_INACTIVE" });
  });
});

describe("negotiation (#3, #4)", () => {
  it("is closed once the owner accepts, so the price can't change after an order exists", async () => {
    const id = await request();
    await accept(id);
    await expect(NegotiationService.makeOffer(OWNER, id, 300_000)).rejects.toMatchObject({ statusCode: 409 });
  });

  it("accepting an offer re-prices the booking and re-checks capacity", async () => {
    const a = await request();
    const b = await request(); // overlapping; pending requests don't hold stock
    await NegotiationService.makeOffer(RENTER, a, 150_000);
    await NegotiationService.acceptOffer(OWNER, a);
    expect(booking(a).bookingStatus).toBe("BOOKING_ACCEPTED");
    expect(booking(a).rentAmountPaise).toBe(3 * 150_000);
    expect(booking(a).totalAmountPaise).toBe(3 * 150_000 + DEPOSIT);

    // The only unit is now held by `a`, so a negotiated accept of `b` must fail
    await NegotiationService.makeOffer(RENTER, b, 150_000);
    await expect(NegotiationService.acceptOffer(OWNER, b)).rejects.toMatchObject({ statusCode: 409 });
    expect(booking(b).bookingStatus).toBe("BOOKING_REQUESTED");
  });

  it("owner accepting at the listed price closes an open negotiation", async () => {
    const id = await request();
    await NegotiationService.makeOffer(RENTER, id, 150_000);
    await accept(id);
    expect(db.__store.negotiation[0].status).toBe("CANCELLED");
    expect(db.__store.negotiationOffer[0].status).toBe("REJECTED");
  });

  it("only the two parties can read a negotiation (#16)", async () => {
    const id = await request();
    await expect(NegotiationService.getByBookingId(id, OUTSIDER)).rejects.toMatchObject({ statusCode: 404 });
    await expect(NegotiationService.getByBookingId(id, OWNER)).resolves.toBeNull();
  });
});

describe("payment binding (#2)", () => {
  it("funds escrow only from a captured payment of this booking's order and amount", async () => {
    const id = await request();
    await accept(id);
    const funded = await pay(id);
    expect(funded.financialStatus).toBe("FUNDS_HELD");
    expect(booking(id).razorpayPaymentId).toBe(`pay_${id}`);
    expect(booking(id).handoverCode).toMatch(/^\d{6}$/);
    expect(ledgerOf(id).heldPaise).toBe(booking(id).totalAmountPaise);
  });

  it("rejects a payment made against a different order", async () => {
    const id = await request();
    await accept(id);
    await BookingService.createPaymentOrder(id, RENTER);
    payments.set("pay_x", { id: "pay_x", order_id: "order_other", amount: 100, currency: "INR", status: "captured" });
    await expect(BookingService.verifyAndFundEscrow(id, RENTER, "order_other", "pay_x", "sig"))
      .rejects.toMatchObject({ statusCode: 400, code: "PAYMENT_ORDER_MISMATCH" });
  });

  it("rejects a payment whose amount doesn't match the order", async () => {
    const id = await request();
    await accept(id);
    const order = await BookingService.createPaymentOrder(id, RENTER);
    payments.set("pay_cheap", { id: "pay_cheap", order_id: order.orderId, amount: 100, currency: "INR", status: "captured" });
    await expect(BookingService.verifyAndFundEscrow(id, RENTER, order.orderId, "pay_cheap", "sig"))
      .rejects.toMatchObject({ code: "PAYMENT_MISMATCH" });
    expect(booking(id).financialStatus).toBe("PENDING_PAYMENT");
  });

  it("captures an authorized payment before funding", async () => {
    const id = await request();
    await accept(id);
    const order = await BookingService.createPaymentOrder(id, RENTER);
    payments.set("pay_auth", { id: "pay_auth", order_id: order.orderId, amount: order.amount, currency: "INR", status: "authorized" });
    await BookingService.verifyAndFundEscrow(id, RENTER, order.orderId, "pay_auth", "sig");
    expect(rz.capturePayment).toHaveBeenCalledWith("pay_auth", order.amount);
    expect(booking(id).financialStatus).toBe("FUNDS_HELD");
  });

  it("rejects a bad signature", async () => {
    const id = await request();
    await accept(id);
    const order = await BookingService.createPaymentOrder(id, RENTER);
    rz.verifySignature.mockReturnValueOnce(false);
    await expect(BookingService.verifyAndFundEscrow(id, RENTER, order.orderId, "pay_1", "bad"))
      .rejects.toMatchObject({ code: "PAYMENT_SIGNATURE_INVALID" });
  });

  it("reuses the stored order when the renter clicks Pay again", async () => {
    const id = await request();
    await accept(id);
    const first = await BookingService.createPaymentOrder(id, RENTER);
    const second = await BookingService.createPaymentOrder(id, RENTER);
    expect(second.orderId).toBe(first.orderId);
    expect(rz.createOrder).toHaveBeenCalledTimes(1);
  });

  it("refunds a payment that lands after the booking was cancelled", async () => {
    const id = await request();
    await accept(id);
    const order = await BookingService.createPaymentOrder(id, RENTER);
    await BookingService.updateBookingStatus(id, RENTER, { status: "cancelled" });
    payments.set("pay_late", { id: "pay_late", order_id: order.orderId, amount: order.amount, currency: "INR", status: "captured" });

    await expect(BookingService.verifyAndFundEscrow(id, RENTER, order.orderId, "pay_late", "sig"))
      .rejects.toMatchObject({ statusCode: 409, code: "BOOKING_NOT_PAYABLE" });
    expect(txns(id, "FULL_REFUND")[0]).toMatchObject({ amountPaise: order.amount, status: "COMPLETED" });
    expect(ledgerOf(id).heldPaise).toBe(0);
  });
});

describe("payments whose verify call never arrived (#2, #10)", () => {
  async function paidButUnverified() {
    const id = await request();
    await accept(id);
    const order = await BookingService.createPaymentOrder(id, RENTER);
    payments.set("pay_lost", { id: "pay_lost", order_id: order.orderId, amount: order.amount, currency: "INR", status: "captured" });
    return id; // renter closed the tab before /verify
  }

  it("the payment-deadline sweep funds the booking instead of cancelling it", async () => {
    const id = await paidButUnverified();
    at("2026-10-02T05:00:00.000Z");
    await BookingService.processDeadlines();
    expect(booking(id)).toMatchObject({ bookingStatus: "BOOKING_ACCEPTED", financialStatus: "FUNDS_HELD", razorpayPaymentId: "pay_lost" });
  });

  it("clicking Pay again finds the earlier payment instead of charging twice", async () => {
    const id = await paidButUnverified();
    await expect(BookingService.createPaymentOrder(id, RENTER)).rejects.toMatchObject({ code: "ALREADY_PAID" });
    expect(booking(id).financialStatus).toBe("FUNDS_HELD");
  });

  it("cancelling refunds a payment that was never verified", async () => {
    const id = await paidButUnverified();
    const b = await BookingService.updateBookingStatus(id, RENTER, { status: "cancelled" });
    expect(b.financialStatus).toBe("FULLY_REFUNDED");
    expect(rz.refund).toHaveBeenCalledWith("pay_lost", booking(id).totalAmountPaise, `FULL_REFUND_${id}`);
    expect(ledgerOf(id).heldPaise).toBe(0);
  });
});

describe("cancellation rules (#1, #24)", () => {
  it("renter can cancel a funded booking before handover and gets everything back", async () => {
    const id = await request();
    await accept(id);
    await pay(id);
    const b = await BookingService.updateBookingStatus(id, RENTER, { status: "cancelled" });
    expect(b.bookingStatus).toBe("CANCELLED");
    expect(b.financialStatus).toBe("FULLY_REFUNDED");
    expect(txns(id, "FULL_REFUND")[0]).toMatchObject({ amountPaise: booking(id).totalAmountPaise, status: "COMPLETED" });
    expect(rz.refund).toHaveBeenCalledWith(`pay_${id}`, booking(id).totalAmountPaise, `FULL_REFUND_${id}`);
    expect(ledgerOf(id).heldPaise).toBe(0);
  });

  it("renter cannot cancel once the item is handed over", async () => {
    const id = await request();
    await accept(id);
    await pay(id);
    await handover(id);
    await expect(BookingService.updateBookingStatus(id, RENTER, { status: "cancelled" })).rejects.toMatchObject({ statusCode: 409 });
    expect(txns(id, "FULL_REFUND")).toHaveLength(0);
  });

  it("renter cannot cancel an active rental", async () => {
    const id = await activeBooking();
    await expect(BookingService.updateBookingStatus(id, RENTER, { status: "cancelled" })).rejects.toMatchObject({ statusCode: 409 });
  });

  it("owner can cancel after accepting; renter refunded and it counts against the owner", async () => {
    const id = await request();
    await accept(id);
    await pay(id);
    const b = await BookingService.updateBookingStatus(id, OWNER, { status: "cancelled", rejectionReason: "Generator broke" });
    expect(b).toMatchObject({ bookingStatus: "CANCELLED", financialStatus: "FULLY_REFUNDED", cancelledBy: "OWNER" });
    expect(ledgerOf(id).heldPaise).toBe(0);
  });

  it("owner must reject (not cancel) a pending request", async () => {
    const id = await request();
    await expect(BookingService.updateBookingStatus(id, OWNER, { status: "cancelled" })).rejects.toMatchObject({ statusCode: 409 });
  });

  it("an unpaid cancellation is marked NO_PAYMENT", async () => {
    const id = await request();
    const b = await BookingService.updateBookingStatus(id, RENTER, { status: "cancelled" });
    expect(b.financialStatus).toBe("NO_PAYMENT");
  });
});

describe("handover with the renter's code (#11, #15)", () => {
  async function funded() {
    const id = await request();
    await accept(id);
    await pay(id);
    return id;
  }

  it("requires condition photos and a 6-digit code", () => {
    expect(handoverSchema.safeParse({ handoverCode: "123456", evidenceUrls: [] }).success).toBe(false);
    expect(handoverSchema.safeParse({ handoverCode: "12ab", evidenceUrls: ["a.jpg"] }).success).toBe(false);
    expect(handoverSchema.safeParse({ handoverCode: "123456", evidenceUrls: ["a.jpg"] }).success).toBe(true);
  });

  it("starts the 1-hour window only with the right code, and records the owner's photos", async () => {
    const id = await funded();
    const b = await handover(id);
    expect(b.bookingStatus).toBe("HANDOVER_INSPECTION");
    expect(b.renterInspectionDeadline!.getTime() - b.handoverInitiatedAt!.getTime()).toBe(60 * 60 * 1000);
    expect(db.__store.evidence.find((e: any) => e.bookingId === id && e.stage === "HANDOVER")).toBeDefined();
    expect(booking(id).handoverCode).toBeNull();
  });

  it("counts wrong codes and locks after 5 attempts", async () => {
    const id = await funded();
    at("2026-10-03T03:30:00.000Z");
    const wrong = booking(id).handoverCode === "000000" ? "111111" : "000000";
    for (let i = 1; i <= 5; i++) {
      await expect(BookingService.markHandover(id, OWNER, { handoverCode: wrong, evidenceUrls: [media(OWNER)] }))
        .rejects.toMatchObject({ code: "HANDOVER_CODE_INVALID" });
      expect(booking(id).handoverCodeAttempts).toBe(i);
    }
    await expect(BookingService.markHandover(id, OWNER, { handoverCode: booking(id).handoverCode, evidenceUrls: [media(OWNER)] }))
      .rejects.toMatchObject({ statusCode: 423 });
  });

  it("only accepts photos the owner uploaded themselves", async () => {
    const id = await funded();
    at("2026-10-03T03:30:00.000Z");
    const code = booking(id).handoverCode;
    for (const evidenceUrls of [[media(RENTER)], ["https://evil.example/photo.jpg"]]) {
      await expect(BookingService.markHandover(id, OWNER, { handoverCode: code, evidenceUrls }))
        .rejects.toMatchObject({ statusCode: 422, code: "INVALID_MEDIA_REFERENCE" });
    }
    expect(booking(id).bookingStatus).toBe("BOOKING_ACCEPTED");
    expect(db.__store.evidence).toHaveLength(0);
  });

  it("can't start more than a day before the start date", async () => {
    const id = await request({ startDate: "2026-10-10", endDate: "2026-10-12" });
    await accept(id);
    await pay(id);
    await expect(BookingService.markHandover(id, OWNER, { handoverCode: booking(id).handoverCode, evidenceUrls: [media(OWNER)] }))
      .rejects.toMatchObject({ statusCode: 409 });
  });

  it("hides the code from the owner but shows it to the renter (#16)", async () => {
    const id = await funded();
    const asOwner = await BookingService.getBookingRequestById(id, OWNER);
    const asRenter = await BookingService.getBookingRequestById(id, RENTER);
    expect(asOwner).not.toHaveProperty("handoverCode");
    expect(asRenter!.handoverCode).toMatch(/^\d{6}$/);
    expect(await BookingService.getBookingRequestById(id, OUTSIDER)).toBeNull();
  });
});

describe("receiving inspection and handover issues (#5, #6, #14)", () => {
  async function inInspection() {
    const id = await request();
    await accept(id);
    await pay(id);
    await handover(id);
    return id;
  }

  it("accepting releases rent + transport to the owner and keeps the deposit", async () => {
    seed({ transportAvailable: true, transportRatePerKmPaise: 2_000 });
    const id = await request({ transportMode: "PROVIDER", transportDistanceKm: 10 });
    await accept(id);
    await pay(id);
    await handover(id);
    const b = await BookingService.renterReceivingInspection(id, RENTER, { status: "ACCEPTED", evidenceUrls: [] });
    expect(b).toMatchObject({ bookingStatus: "ACTIVE", financialStatus: "RENT_RELEASED" });
    expect(txns(id, "RENT_PAYOUT")[0]).toMatchObject({ amountPaise: 3 * RENT_PER_DAY + 20_000, direction: "TO_OWNER", status: "PENDING" });
    expect(ledgerOf(id).heldPaise).toBe(DEPOSIT);
  });

  it("can't accept a short delivery", async () => {
    seed({ quantity: 10 });
    const id = await request({ quantity: 10 });
    await accept(id);
    await pay(id);
    await handover(id);
    await expect(
      BookingService.renterReceivingInspection(id, RENTER, { status: "ACCEPTED", receivedQuantity: 8, evidenceUrls: [] })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("reporting an issue needs photos and a description", () => {
    expect(renterReceivingInspectionSchema.safeParse({ status: "REPORTED_ISSUE", issueDescription: "Broken handle", evidenceUrls: [] }).success).toBe(false);
    expect(renterReceivingInspectionSchema.safeParse({ status: "REPORTED_ISSUE", issueDescription: "bad", evidenceUrls: ["a.jpg"] }).success).toBe(false);
  });

  it("an issue goes to the owner, not the renter; the renter can't 'accept' their own complaint", async () => {
    const id = await inInspection();
    await BookingService.renterReceivingInspection(id, RENTER, {
      status: "REPORTED_ISSUE", issueDescription: "Starter motor is broken", evidenceUrls: [media(RENTER)],
    });
    const dispute = db.__store.dispute.find((d: any) => d.bookingId === id);
    expect(dispute).toMatchObject({ kind: "HANDOVER_ISSUE", raisedByRole: "RENTER", status: "OPEN" });
    await expect(BookingService.renterRespondClaim(id, RENTER, { action: "ACCEPT", rebuttalEvidenceUrls: [] }))
      .rejects.toMatchObject({ statusCode: 409 });
    expect(txns(id, "DAMAGE_PAYOUT")).toHaveLength(0);
  });

  it("owner accepting the issue refunds the renter in full", async () => {
    const id = await inInspection();
    await BookingService.renterReceivingInspection(id, RENTER, {
      status: "REPORTED_ISSUE", issueDescription: "Starter motor is broken", evidenceUrls: [media(RENTER)],
    });
    const b = await BookingService.ownerRespondHandoverIssue(id, OWNER, { action: "ACCEPT" });
    expect(b).toMatchObject({ bookingStatus: "CANCELLED", financialStatus: "FULLY_REFUNDED" });
    expect(txns(id, "FULL_REFUND")[0].amountPaise).toBe(booking(id).totalAmountPaise);
    expect(ledgerOf(id).heldPaise).toBe(0);
  });

  it("a contested issue goes to admin, who can settle the whole payment", async () => {
    const id = await inInspection();
    await BookingService.renterReceivingInspection(id, RENTER, {
      status: "REPORTED_ISSUE", issueDescription: "Starter motor is broken", evidenceUrls: [media(RENTER)],
    });
    await BookingService.ownerRespondHandoverIssue(id, OWNER, { action: "CONTEST", notes: "It worked when delivered, see video" });
    expect(db.__store.dispute[0].status).toBe("ESCALATED");

    // A return-claim decision is not valid for a handover issue
    await expect(BookingService.adminResolveDispute(id, "admin-1", { decision: "PAY_OWNER", resolutionNotes: "nope" }))
      .rejects.toMatchObject({ statusCode: 400 });

    const b = await BookingService.adminResolveDispute(id, "admin-1", {
      decision: "PARTIAL_REFUND", resolutionAmountPaise: 100_000, resolutionNotes: "Minor defect, partial refund",
    });
    expect(b).toMatchObject({ bookingStatus: "ACTIVE", financialStatus: "RENT_RELEASED" });
    expect(txns(id, "RENT_REFUND")[0].amountPaise).toBe(100_000);
    expect(txns(id, "RENT_PAYOUT")[0].amountPaise).toBe(3 * RENT_PER_DAY - 100_000);
    expect(ledgerOf(id).heldPaise).toBe(DEPOSIT); // deposit still protects the return
  });

  it("admin REJECT_ISSUE releases rent and the rental continues", async () => {
    const id = await inInspection();
    await BookingService.renterReceivingInspection(id, RENTER, {
      status: "REPORTED_ISSUE", issueDescription: "Starter motor is broken", evidenceUrls: [media(RENTER)],
    });
    const b = await BookingService.adminResolveDispute(id, "admin-1", { decision: "REJECT_ISSUE", resolutionNotes: "Works per video" });
    expect(b.bookingStatus).toBe("ACTIVE");
    expect(txns(id, "RENT_PAYOUT")[0].amountPaise).toBe(3 * RENT_PER_DAY);
  });
});

describe("return and claims (#7, #14, #15)", () => {
  it("return needs at least one photo", () => {
    expect(returnInitiationSchema.safeParse({ returnEvidenceUrls: [] }).success).toBe(false);
  });

  it("happy path completes with the deposit refunded and nothing left in escrow", async () => {
    const id = await inOwnerInspection();
    const b = await BookingService.ownerAcceptReturn(id, OWNER);
    expect(b).toMatchObject({ bookingStatus: "COMPLETED", financialStatus: "DEPOSIT_REFUNDED" });
    expect(txns(id, "DEPOSIT_REFUND")[0]).toMatchObject({ amountPaise: DEPOSIT, status: "COMPLETED" });
    expect(ledgerOf(id)).toMatchObject({ heldPaise: 0, toOwnerPaise: 3 * RENT_PER_DAY, toRenterPaise: DEPOSIT });
  });

  it("renter accepting a claim pays the owner the claimed amount and refunds the rest", async () => {
    const id = await inOwnerInspection();
    await BookingService.ownerSubmitDamageClaim(id, OWNER, {
      claimType: "DAMAGE", description: "Dent on the fuel tank", claimedAmountPaise: 50_000, evidenceUrls: [media(OWNER)],
    });
    const b = await BookingService.renterRespondClaim(id, RENTER, { action: "ACCEPT", rebuttalEvidenceUrls: [] });
    expect(b).toMatchObject({ bookingStatus: "COMPLETED", financialStatus: "PARTIAL_SETTLEMENT" });
    expect(txns(id, "DAMAGE_PAYOUT")[0].amountPaise).toBe(50_000);
    expect(txns(id, "DEPOSIT_REFUND")[0].amountPaise).toBe(DEPOSIT - 50_000);
    expect(ledgerOf(id).heldPaise).toBe(0);
  });

  it("admin PAY_OWNER pays only what was claimed, not the whole deposit", async () => {
    const id = await inOwnerInspection();
    await BookingService.ownerSubmitDamageClaim(id, OWNER, {
      claimType: "DAMAGE", description: "Dent on the fuel tank", claimedAmountPaise: 50_000, evidenceUrls: [media(OWNER)],
    });
    await BookingService.renterRespondClaim(id, RENTER, { action: "DISPUTE", reason: "PRE_EXISTING_DAMAGE", rebuttalEvidenceUrls: [] });
    const b = await BookingService.adminResolveDispute(id, "admin-1", { decision: "PAY_OWNER", resolutionNotes: "Dent is new" });
    expect(b.bookingStatus).toBe("COMPLETED");
    expect(txns(id, "DAMAGE_PAYOUT")[0].amountPaise).toBe(50_000);
    expect(txns(id, "DEPOSIT_REFUND")[0].amountPaise).toBe(DEPOSIT - 50_000);
    expect(ledgerOf(id).heldPaise).toBe(0);
  });

  it("admin partial settlement can't exceed the deposit", async () => {
    const id = await inOwnerInspection();
    await BookingService.ownerSubmitDamageClaim(id, OWNER, {
      claimType: "DAMAGE", description: "Dent on the fuel tank", claimedAmountPaise: 50_000, evidenceUrls: [media(OWNER)],
    });
    await expect(BookingService.adminResolveDispute(id, "admin-1", {
      decision: "PARTIAL_SETTLEMENT", resolutionAmountPaise: DEPOSIT + 1, resolutionNotes: "too much",
    })).rejects.toMatchObject({ statusCode: 400 });
  });

  it("a missing-quantity claim is only allowed when fewer units came back", async () => {
    seed({ quantity: 10 });
    const id = await request({ quantity: 10 });
    await accept(id);
    await pay(id);
    await handover(id);
    await BookingService.renterReceivingInspection(id, RENTER, { status: "ACCEPTED", evidenceUrls: [] });
    at("2026-10-05T12:30:00.000Z");
    await BookingService.initiateReturn(id, RENTER, { returnedQuantity: 9, returnEvidenceUrls: [media(RENTER)] });
    await BookingService.ownerConfirmReceipt(id, OWNER, { received: true });
    expect(booking(id).ownerReceivedQuantity).toBe(9);
    await expect(BookingService.ownerSubmitDamageClaim(id, OWNER, {
      claimType: "MISSING_QUANTITY", description: "One chair missing", claimedAmountPaise: 10_000, evidenceUrls: [media(OWNER)],
    })).resolves.toMatchObject({ bookingStatus: "DISPUTED" });
  });

  it("rejects a missing-quantity claim when everything was received", async () => {
    const id = await inOwnerInspection();
    await expect(BookingService.ownerSubmitDamageClaim(id, OWNER, {
      claimType: "MISSING_QUANTITY", description: "One chair missing", claimedAmountPaise: 10_000, evidenceUrls: [media(OWNER)],
    })).rejects.toMatchObject({ statusCode: 400 });
  });

  it("disputes can only be resolved by a real admin", async () => {
    const id = await inOwnerInspection();
    await BookingService.ownerSubmitDamageClaim(id, OWNER, {
      claimType: "DAMAGE", description: "Dent on the fuel tank", claimedAmountPaise: 50_000, evidenceUrls: [media(OWNER)],
    });
    await expect(BookingService.adminResolveDispute(id, OWNER, { decision: "PAY_OWNER", resolutionNotes: "mine!" }))
      .rejects.toMatchObject({ statusCode: 403 });
  });
});

describe("deadlines (#12)", () => {
  it("expires a request nobody accepted once its start day is over", async () => {
    const id = await request();
    at("2026-10-03T17:00:00.000Z"); // 22:30 IST on the start day: still open
    await BookingService.processDeadlines();
    expect(booking(id).bookingStatus).toBe("BOOKING_REQUESTED");
    at("2026-10-03T19:00:00.000Z"); // 00:30 IST next day
    await BookingService.processDeadlines();
    expect(booking(id)).toMatchObject({ bookingStatus: "CANCELLED", cancelledBy: "SYSTEM", financialStatus: "NO_PAYMENT" });
  });

  it("cancels an accepted booking that is never paid, freeing the unit", async () => {
    const id = await request();
    await accept(id);
    expect(booking(id).paymentDeadline.getTime()).toBe(T0.getTime() + DAY);
    at("2026-10-02T04:31:00.000Z");
    await BookingService.processDeadlines();
    expect(booking(id).bookingStatus).toBe("CANCELLED");
    await expect(request()).resolves.toBeDefined(); // unit free again
  });

  it("treats a missed handover as an owner no-show and refunds the renter", async () => {
    const id = await request();
    await accept(id);
    await pay(id);
    at("2026-10-03T19:00:00.000Z"); // start day over
    await BookingService.processDeadlines();
    expect(booking(id)).toMatchObject({ bookingStatus: "CANCELLED", cancelledBy: "OWNER", financialStatus: "FULLY_REFUNDED" });
    expect(ledgerOf(id).heldPaise).toBe(0);
  });

  it("auto-accepts the handover after the renter's hour and pays rent to the owner", async () => {
    const id = await request();
    await accept(id);
    await pay(id);
    await handover(id);
    at("2026-10-03T04:31:00.000Z");
    await BookingService.processDeadlines();
    expect(booking(id)).toMatchObject({ bookingStatus: "ACTIVE", financialStatus: "RENT_RELEASED" });
    expect(txns(id, "RENT_PAYOUT")).toHaveLength(1);
    await BookingService.processDeadlines(); // idempotent
    expect(txns(id, "RENT_PAYOUT")).toHaveLength(1);
  });

  it("refunds the renter when the owner ignores a handover issue for 24h", async () => {
    const id = await request();
    await accept(id);
    await pay(id);
    await handover(id);
    await BookingService.renterReceivingInspection(id, RENTER, {
      status: "REPORTED_ISSUE", issueDescription: "Starter motor is broken", evidenceUrls: [media(RENTER)],
    });
    at("2026-10-04T03:31:00.000Z");
    await BookingService.processDeadlines();
    expect(booking(id)).toMatchObject({ bookingStatus: "CANCELLED", financialStatus: "FULLY_REFUNDED" });
    expect(ledgerOf(id).heldPaise).toBe(0);
  });

  it("escalates a missing return to admin a day after the last rental day", async () => {
    const id = await activeBooking();
    at("2026-10-06T17:00:00.000Z"); // 22:30 IST on the 6th — within grace
    await BookingService.processDeadlines();
    expect(booking(id).bookingStatus).toBe("ACTIVE");
    at("2026-10-06T19:00:00.000Z"); // 00:30 IST on the 7th
    await BookingService.processDeadlines();
    expect(booking(id).bookingStatus).toBe("DISPUTED");
    expect(db.__store.dispute[0]).toMatchObject({ raisedByRole: "SYSTEM", status: "ESCALATED" });
  });

  it("confirms receipt automatically when the owner doesn't respond to a return", async () => {
    const id = await activeBooking();
    at("2026-10-05T12:30:00.000Z");
    await BookingService.initiateReturn(id, RENTER, { returnEvidenceUrls: [media(RENTER)] });
    at("2026-10-06T12:31:00.000Z");
    await BookingService.processDeadlines();
    expect(booking(id).bookingStatus).toBe("OWNER_INSPECTION");
    at("2026-10-06T14:32:00.000Z");
    await BookingService.processDeadlines();
    expect(booking(id)).toMatchObject({ bookingStatus: "COMPLETED", financialStatus: "DEPOSIT_REFUNDED" });
    expect(ledgerOf(id).heldPaise).toBe(0);
  });

  it("settles an owner's claim when the renter doesn't respond within 48h", async () => {
    const id = await inOwnerInspection();
    await BookingService.ownerSubmitDamageClaim(id, OWNER, {
      claimType: "DAMAGE", description: "Dent on the fuel tank", claimedAmountPaise: 50_000, evidenceUrls: [media(OWNER)],
    });
    at("2026-10-07T13:00:00.000Z");
    await BookingService.processDeadlines();
    expect(booking(id).bookingStatus).toBe("COMPLETED");
    expect(txns(id, "DAMAGE_PAYOUT")[0].amountPaise).toBe(50_000);
    expect(ledgerOf(id).heldPaise).toBe(0);
  });

  it("does not auto-settle a claim the renter disputed (waits for admin)", async () => {
    const id = await inOwnerInspection();
    await BookingService.ownerSubmitDamageClaim(id, OWNER, {
      claimType: "DAMAGE", description: "Dent on the fuel tank", claimedAmountPaise: 50_000, evidenceUrls: [media(OWNER)],
    });
    await BookingService.renterRespondClaim(id, RENTER, { action: "DISPUTE", rebuttalEvidenceUrls: [] });
    at("2026-10-09T13:00:00.000Z");
    await BookingService.processDeadlines();
    expect(booking(id).bookingStatus).toBe("DISPUTED");
  });
});

describe("real refunds and owner payouts (#23, #30)", () => {
  it("never writes the same payout twice", async () => {
    const id = await inOwnerInspection();
    await expect(
      db.$transaction((tx: any) => PaymentService.queuePayout(tx, id, "RENT_PAYOUT", 1))
    ).rejects.toThrow(/Unique constraint/);
  });

  it("marks a failed Razorpay refund FAILED and retries it later without double-refunding", async () => {
    const id = await request();
    await accept(id);
    await pay(id);
    rz.refund.mockRejectedValueOnce({ error: { description: "Gateway timeout" } });
    await BookingService.updateBookingStatus(id, RENTER, { status: "cancelled" });
    expect(txns(id, "FULL_REFUND")[0]).toMatchObject({ status: "FAILED", failureReason: "Gateway timeout", attempts: 1 });

    // The first call actually went through on Razorpay's side
    rz.findRefundByLedgerRef.mockResolvedValueOnce({ id: "rfnd_existing" });
    await PaymentService.processRefunds();
    expect(txns(id, "FULL_REFUND")[0]).toMatchObject({ status: "COMPLETED", razorpayRefundId: "rfnd_existing" });
    expect(rz.refund).toHaveBeenCalledTimes(1);
  });

  it("owner payouts wait for an admin to record the bank UTR", async () => {
    const id = await activeBooking();
    const payout = txns(id, "RENT_PAYOUT")[0];
    expect(payout.status).toBe("PENDING");
    await PaymentService.markPayoutPaid(payout.id, "admin-1", "UTR123456789");
    expect(txns(id, "RENT_PAYOUT")[0]).toMatchObject({ status: "COMPLETED", utrReference: "UTR123456789", processedById: "admin-1" });
    await expect(PaymentService.markPayoutPaid(payout.id, "admin-1", "UTR123456789")).rejects.toMatchObject({ statusCode: 409 });
  });
});
