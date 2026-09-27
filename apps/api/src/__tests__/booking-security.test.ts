/**
 * Regression tests for the booking / payment findings in SECURITY_AUDIT.md:
 * C-01 payment replay, H-01 booking IDOR, H-02 cancel-after-handover refund,
 * H-03 renegotiation after payment, H-08 escrow races, H-09 ledger deletion,
 * L-04 booking input limits. Runs against the in-memory Prisma stand-in so the
 * real booking service, ledger and state machine are exercised.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { prisma } from "../config/database.js";
import { BookingService } from "../services/booking.service.js";
import { NegotiationService } from "../services/negotiation.service.js";
import { ResourceService } from "../services/resource.service.js";
import { RazorpayService } from "../services/razorpay.service.js";
import { BookingController } from "../controllers/booking.controller.js";

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

vi.mock("../services/rag/vector-store.js", () => ({
  VectorStoreService: { indexSingleResource: vi.fn(), deleteResource: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock("../services/razorpay.service.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/razorpay.service.js")>();
  return {
    ...actual,
    RazorpayService: {
      keyId: () => "rzp_test_key",
      createOrder: vi.fn(),
      fetchPayment: vi.fn(),
      fetchOrderPayments: vi.fn(async () => []),
      capturePayment: vi.fn(),
      verifySignature: vi.fn(),
      refund: vi.fn(async (_p: string, _a: number, ref: string) => ({ id: `rfnd_${ref}` })),
      findRefundByLedgerRef: vi.fn(async () => null),
    },
  };
});

const db = prisma as any;
const rz = RazorpayService as unknown as Record<string, ReturnType<typeof vi.fn>>;

const OWNER = "user-owner";
const RENTER = "user-renter";
const STRANGER = "user-stranger";
const RENT = 200_000;
const DEPOSIT = 500_000;
const VALID_SIG = "a".repeat(64);

// 10:00 IST on 1 Oct 2026
const T0 = new Date("2026-10-01T04:30:00.000Z");
const at = (iso: string) => vi.setSystemTime(new Date(iso));

const payments = new Map<string, { id: string; order_id: string; amount: number; currency: string; status: string }>();
const booking = (id: string) => db.__store.bookingRequest.find((b: any) => b.id === id);
const txns = (id: string, type?: string) =>
  db.__store.paymentTransaction.filter((t: any) => t.bookingId === id && (!type || t.type === type));

let uploadSeq = 0;
function media(userId: string) {
  const id = `00000000-0000-4000-8000-${String(++uploadSeq).padStart(12, "0")}.jpg`;
  db.__seed("upload", { id, ownerId: userId, purpose: "MEDIA", mimeType: "image/jpeg", sizeBytes: 100, sha256: `hash-${id}` });
  return `/uploads/${id}`;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
  vi.clearAllMocks();
  payments.clear();
  rz.createOrder.mockImplementation(async (amount: number, bookingId: string) => ({
    orderId: `order_${bookingId}`, amount, currency: "INR", keyId: "rzp_test_key",
  }));
  rz.fetchPayment.mockImplementation(async (id: string) => payments.get(id));
  rz.capturePayment.mockImplementation(async (id: string) => ({ ...payments.get(id)!, status: "captured" }));
  rz.verifySignature.mockImplementation((_o: string, _p: string, sig: string) => sig === VALID_SIG);

  db.__reset();
  for (const [id, email] of [[OWNER, "o@x.in"], [RENTER, "r@x.in"], [STRANGER, "s@x.in"]]) {
    db.__seed("user", { id, email, verificationStatus: "VERIFIED" });
  }
  db.__seed("business", { id: "biz-owner", name: "Owner LLC", ownerId: OWNER });
  db.__seed("business", { id: "biz-renter", name: "Renter Co", ownerId: RENTER });
  db.__seed("business", { id: "biz-stranger", name: "Nosy Ltd", ownerId: STRANGER });
  db.__seed("resource", {
    id: "res-1", businessId: "biz-owner", name: "Banquet Hall", resourceType: "Banquet Hall", quantity: 1,
    location: "Pune", rentAmountPaise: RENT, securityDepositPaise: DEPOSIT, photos: [], damagePhotos: [],
    hasPreExistingDamage: false,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

async function requested() {
  const b = await BookingService.createBookingRequest(RENTER, {
    resourceId: "res-1", quantity: 1, startDate: "2026-10-03", endDate: "2026-10-04",
  } as any);
  return b.id as string;
}

async function accepted() {
  const id = await requested();
  await BookingService.updateBookingStatus(id, OWNER, { status: "accepted" });
  return id;
}

/** Accepted booking with a Razorpay order and a captured payment of `amount` waiting to be verified. */
async function withPayment(amount?: number, paymentId = "pay_OK") {
  const id = await accepted();
  const order = await BookingService.createPaymentOrder(id, RENTER);
  payments.set(paymentId, { id: paymentId, order_id: order.orderId, amount: amount ?? order.amount, currency: "INR", status: "captured" });
  return { id, orderId: order.orderId as string };
}

async function funded() {
  const { id, orderId } = await withPayment();
  await BookingService.verifyAndFundEscrow(id, RENTER, orderId, "pay_OK", VALID_SIG);
  return id;
}

async function handedOver() {
  const id = await funded();
  at("2026-10-03T03:30:00.000Z");
  await BookingService.markHandover(id, OWNER, { handoverCode: booking(id).handoverCode, evidenceUrls: [media(OWNER)] });
  return id;
}

// ─────────────────────────────────────────────────────────────────────────────
describe("C-01 — Razorpay payment is bound to the booking's order and amount", () => {
  it("rejects a valid signature from a different (cheap) order", async () => {
    const { id } = await withPayment();
    await expect(BookingService.verifyAndFundEscrow(id, RENTER, "order_CHEAP", "pay_CHEAP", VALID_SIG))
      .rejects.toMatchObject({ statusCode: 400, code: "PAYMENT_ORDER_MISMATCH" });
    expect(rz.fetchPayment).not.toHaveBeenCalled();
    expect(txns(id)).toHaveLength(0);
  });

  it("rejects a payment whose captured amount is less than the booking total", async () => {
    const { id, orderId } = await withPayment(100);
    await expect(BookingService.verifyAndFundEscrow(id, RENTER, orderId, "pay_OK", VALID_SIG))
      .rejects.toMatchObject({ code: "PAYMENT_MISMATCH" });
    expect(txns(id)).toHaveLength(0);
    expect(booking(id).financialStatus).toBe("PENDING_PAYMENT");
  });

  it("rejects a forged signature", async () => {
    const { id, orderId } = await withPayment();
    await expect(BookingService.verifyAndFundEscrow(id, RENTER, orderId, "pay_OK", "0".repeat(64)))
      .rejects.toMatchObject({ code: "PAYMENT_SIGNATURE_INVALID" });
  });

  it("funds escrow for the right order, captured for the full amount, recording the Razorpay amount", async () => {
    const { id, orderId } = await withPayment();
    const updated = await BookingService.verifyAndFundEscrow(id, RENTER, orderId, "pay_OK", VALID_SIG);
    expect(updated.financialStatus).toBe("FUNDS_HELD");
    expect(booking(id).razorpayPaymentId).toBe("pay_OK");
    expect(txns(id, "ESCROW_DEPOSIT")).toEqual([
      expect.objectContaining({ amountPaise: booking(id).totalAmountPaise, providerReference: "pay_OK" }),
    ]);
  });

  it("a second verify with the same payment does not create a second ledger entry", async () => {
    const { id, orderId } = await withPayment();
    await BookingService.verifyAndFundEscrow(id, RENTER, orderId, "pay_OK", VALID_SIG);
    const again = await BookingService.verifyAndFundEscrow(id, RENTER, orderId, "pay_OK", VALID_SIG);
    expect(again.financialStatus).toBe("FUNDS_HELD");
    expect(txns(id, "ESCROW_DEPOSIT")).toHaveLength(1);
  });

  it("the webhook funds the booking from Razorpay's own record, once", async () => {
    const { id, orderId } = await withPayment();
    expect(await BookingService.fundEscrowFromWebhook(orderId, "pay_OK")).toBe(true);
    expect(await BookingService.fundEscrowFromWebhook(orderId, "pay_OK")).toBe(false);
    expect(booking(id).financialStatus).toBe("FUNDS_HELD");
    expect(txns(id, "ESCROW_DEPOSIT")).toHaveLength(1);
  });

  it("the webhook refuses a payment for less than the order", async () => {
    const { id, orderId } = await withPayment(100);
    await expect(BookingService.fundEscrowFromWebhook(orderId, "pay_OK")).rejects.toMatchObject({ code: "PAYMENT_MISMATCH" });
    expect(booking(id).financialStatus).toBe("PENDING_PAYMENT");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("H-01 — bookings are only visible to their renter and owner", () => {
  it("returns nothing to a non-party", async () => {
    const id = await requested();
    expect(await BookingService.getBookingRequestById(id, STRANGER)).toBeNull();
    const { items } = await BookingService.getBookingRequests(STRANGER, {} as any);
    expect(items).toHaveLength(0);
  });

  it("controller returns 404 to a non-party (user C on user A's booking)", async () => {
    const id = await requested();
    const res: any = { status: vi.fn(), json: vi.fn() };
    res.status.mockReturnValue(res);
    await BookingController.getBookingRequestById({ userId: STRANGER, params: { id } } as any, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("state-changing actions by a non-party look like a missing booking (404)", async () => {
    const id = await accepted();
    await expect(BookingService.updateBookingStatus(id, STRANGER, { status: "cancelled" })).rejects.toMatchObject({ statusCode: 404 });
    await expect(BookingService.createPaymentOrder(id, STRANGER)).rejects.toMatchObject({ statusCode: 404 });
    await expect(BookingService.ownerAcceptReturn(id, STRANGER)).rejects.toMatchObject({ statusCode: 404 });
    await expect(BookingService.reportNonReturn(id, STRANGER)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("negotiation thread is not readable by a non-party", async () => {
    const id = await requested();
    await expect(NegotiationService.getByBookingId(id, STRANGER)).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("H-02 — renter cancellation", () => {
  it("is refused once the item is handed over (no refund written)", async () => {
    const id = await handedOver();
    await expect(BookingService.updateBookingStatus(id, RENTER, { status: "cancelled" }))
      .rejects.toMatchObject({ statusCode: 409 });
    expect(txns(id).filter((t: any) => t.direction === "TO_RENTER")).toHaveLength(0);
  });

  it("before handover, refunds exactly what was paid — not a recomputed total", async () => {
    const id = await funded();
    const paid = booking(id).totalAmountPaise;
    booking(id).totalAmountPaise = 9_000_000; // tampered after payment; refund must follow the ledger
    const res = await BookingService.updateBookingStatus(id, RENTER, { status: "cancelled" });
    expect(res.bookingStatus).toBe("CANCELLED");
    expect(txns(id, "FULL_REFUND")).toEqual([expect.objectContaining({ amountPaise: paid, direction: "TO_RENTER" })]);
  });

  it("a second cancel refunds nothing more", async () => {
    const id = await funded();
    await BookingService.updateBookingStatus(id, RENTER, { status: "cancelled" });
    await expect(BookingService.updateBookingStatus(id, RENTER, { status: "cancelled" })).rejects.toMatchObject({ statusCode: 409 });
    expect(txns(id, "FULL_REFUND")).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("H-03 — prices can't change after the owner accepts / renter pays", () => {
  it("refuses new offers once the booking is accepted", async () => {
    const id = await accepted();
    await expect(NegotiationService.makeOffer(RENTER, id, 150_000)).rejects.toMatchObject({ code: "NOT_NEGOTIABLE" });
  });

  it("refuses to accept a stale offer once the booking was accepted", async () => {
    const id = await requested();
    await NegotiationService.makeOffer(RENTER, id, 150_000);
    await BookingService.updateBookingStatus(id, OWNER, { status: "accepted" });
    await expect(NegotiationService.acceptOffer(OWNER, id)).rejects.toMatchObject({ statusCode: 409 });
    expect(booking(id).rentAmountPaise).toBe(RENT * 2);
  });

  it("refuses to revive a cancelled booking via acceptOffer", async () => {
    const id = await requested();
    await NegotiationService.makeOffer(RENTER, id, 150_000);
    await BookingService.updateBookingStatus(id, RENTER, { status: "cancelled" });
    await expect(NegotiationService.acceptOffer(OWNER, id)).rejects.toMatchObject({ code: "NOT_NEGOTIABLE" });
    expect(booking(id).bookingStatus).toBe("CANCELLED");
  });

  it("refuses lowball offers below the floor", async () => {
    const id = await requested();
    await expect(NegotiationService.makeOffer(RENTER, id, 1)).rejects.toMatchObject({ code: "OFFER_TOO_LOW" });
  });

  it("keeps the floor at the rate the booking was priced with after the listing changes", async () => {
    const id = await requested(); // per day at RENT
    // Owner switches the listing to a cheap hourly rate while the request is open
    await prisma.resource.update({ where: { id: "res-1" }, data: { pricingBasis: "HOUR", rentAmountPaise: 10_000 } });
    // 30% of the new hourly rate would be ₹30 — the floor must stay 30% of the booked daily rate
    await expect(NegotiationService.makeOffer(RENTER, id, 5_000)).rejects.toMatchObject({ code: "OFFER_TOO_LOW" });
    await expect(NegotiationService.makeOffer(RENTER, id, Math.ceil(RENT * 0.3))).resolves.toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("H-08 — escrow transitions are atomic", () => {
  it("renter accept after the worker auto-accepted: no second rent payout", async () => {
    const id = await handedOver();
    at("2026-10-03T05:00:00.000Z"); // past the 1-hour inspection window
    await BookingService.processDeadlines();
    await expect(
      BookingService.renterReceivingInspection(id, RENTER, { status: "ACCEPTED", evidenceUrls: [] } as any)
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(txns(id, "RENT_PAYOUT")).toHaveLength(1);
  });

  it("uses one stable ledger reference per booking+event so the DB unique index blocks duplicates", async () => {
    const id = await handedOver();
    at("2026-10-03T05:00:00.000Z");
    await BookingService.processDeadlines();
    await BookingService.processDeadlines();
    expect(txns(id, "RENT_PAYOUT")).toEqual([expect.objectContaining({ providerReference: `RENT_PAYOUT_${id}` })]);
  });

  it("booking reads never run the deadline job (no money moves on a GET)", async () => {
    const spy = vi.spyOn(BookingService, "processDeadlines");
    const id = await requested();
    await BookingService.getBookingRequestById(id, RENTER);
    await BookingService.getBookingRequests(RENTER, {} as any);
    expect(spy).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("H-09 — resource deletion can't erase bookings or the ledger", () => {
  it("refuses while any booking is still in progress", async () => {
    await accepted();
    await expect(ResourceService.deleteResource("res-1", OWNER))
      .rejects.toMatchObject({ statusCode: 409, code: "LISTING_HAS_OPEN_BOOKINGS" });
    expect(db.__store.resource[0].deletedAt).toBeNull();
  });

  it("otherwise soft-deletes instead of hard-deleting", async () => {
    await ResourceService.deleteResource("res-1", OWNER);
    expect(db.__store.resource).toHaveLength(1);
    expect(db.__store.resource[0]).toMatchObject({ isActive: false, deletedAt: expect.any(Date) });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("L-04 — booking input limits", () => {
  it("rejects bookings that start in the past", async () => {
    await expect(BookingService.createBookingRequest(RENTER, {
      resourceId: "res-1", quantity: 1, startDate: "2026-09-20", endDate: "2026-09-22",
    } as any)).rejects.toMatchObject({ statusCode: 422, code: "INVALID_DATES" });
  });

  it("rejects absurdly long bookings (and the INT overflow they would cause)", async () => {
    await expect(BookingService.createBookingRequest(RENTER, {
      resourceId: "res-1", quantity: 1, startDate: "2026-10-03", endDate: "2040-10-03",
    } as any)).rejects.toMatchObject({ statusCode: 422, code: "INVALID_DATES" });
    expect(db.__store.bookingRequest).toHaveLength(0);
  });
});
