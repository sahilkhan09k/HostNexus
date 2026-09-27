/**
 * Regression tests for the booking / payment findings in SECURITY_AUDIT.md:
 * C-01 payment replay, H-01 booking IDOR, H-02 cancel-after-handover refund,
 * H-03 renegotiation after payment, H-08 escrow races, H-09 ledger deletion.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";

vi.mock("../config/database.js", () => {
  const prisma: any = {
    resource: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    bookingRequest: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      aggregate: vi.fn().mockResolvedValue({ _sum: { quantity: null } }),
      count: vi.fn(),
    },
    negotiation: { findUnique: vi.fn().mockResolvedValue(null), update: vi.fn(), create: vi.fn() },
    negotiationOffer: { updateMany: vi.fn(), create: vi.fn() },
    paymentTransaction: { create: vi.fn(), aggregate: vi.fn() },
    inspection: { create: vi.fn().mockResolvedValue({ id: "insp" }) },
    evidence: { create: vi.fn() },
    damageClaim: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    dispute: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    bookingTimelineEvent: { create: vi.fn() },
    upload: { findMany: vi.fn().mockResolvedValue([]) },
    $queryRaw: vi.fn().mockResolvedValue([]),
    $transaction: vi.fn(async (cb: any) => cb(prisma)),
  };
  return { prisma };
});

vi.mock("../services/business.service.js", () => ({
  BusinessService: { getBusinessByUserId: vi.fn(), verifyOwnership: vi.fn() },
}));

vi.mock("../services/rag/vector-store.js", () => ({
  VectorStoreService: { indexSingleResource: vi.fn(), deleteResource: vi.fn().mockResolvedValue(undefined) },
}));

import { prisma } from "../config/database.js";
import { env } from "../config/env.js";
import { BusinessService } from "../services/business.service.js";
import { BookingService } from "../services/booking.service.js";
import { NegotiationService } from "../services/negotiation.service.js";
import { ResourceService } from "../services/resource.service.js";
import { RazorpayService, safeEqual } from "../services/razorpay.service.js";
import { BookingController } from "../controllers/booking.controller.js";

const p = prisma as any;
const fn = (f: unknown) => f as ReturnType<typeof vi.fn>;

const owner = { id: "biz-owner", name: "Owner LLC", ownerId: "user-owner" };
const renter = { id: "biz-renter", name: "Renter Co", ownerId: "user-renter" };
const stranger = { id: "biz-stranger", name: "Nosy Ltd", ownerId: "user-stranger" };
const businesses: Record<string, any> = { "user-owner": owner, "user-renter": renter, "user-stranger": stranger };

const TEST_SECRET = "rzp_test_secret_for_unit_tests_1234";

function baseBooking(overrides: Record<string, any> = {}) {
  return {
    id: "book-1",
    seekerId: renter.id,
    providerId: owner.id,
    resourceId: "res-1",
    quantity: 1,
    startDate: new Date(Date.now() + 86400000),
    endDate: new Date(Date.now() + 3 * 86400000),
    totalDays: 2,
    bookingStatus: "BOOKING_ACCEPTED",
    financialStatus: "PENDING_PAYMENT",
    rentAmountPaise: 400000,
    securityDepositPaise: 500000,
    transportFeePaise: 0,
    totalAmountPaise: 900000,
    razorpayOrderId: "order_BOOKING1",
    razorpayPaymentId: null,
    renterInspectionDeadline: null,
    ...overrides,
  };
}

/** Stateful single-row stand-in: conditional updateMany only succeeds when `where` matches. */
function useBooking(initial: Record<string, any>) {
  const row: Record<string, any> = { ...initial };
  const matches = (where: Record<string, any>) =>
    Object.entries(where).every(([k, v]) => {
      if (k === "id") return row.id === v;
      if (v && typeof v === "object" && "in" in v) return (v as any).in.includes(row[k]);
      if (v && typeof v === "object") return true; // date ranges etc. — not modelled
      return row[k] === v;
    });
  fn(p.bookingRequest.findUnique).mockImplementation(async ({ where }: any) =>
    where.id === row.id || where.razorpayOrderId === row.razorpayOrderId ? { ...row } : null
  );
  fn(p.bookingRequest.updateMany).mockImplementation(async ({ where, data }: any) => {
    if (!matches(where)) return { count: 0 };
    Object.assign(row, data);
    return { count: 1 };
  });
  fn(p.bookingRequest.findUniqueOrThrow).mockImplementation(async () => ({ ...row }));
  return row;
}

function sign(orderId: string, paymentId: string) {
  return crypto.createHmac("sha256", TEST_SECRET).update(`${orderId}|${paymentId}`).digest("hex");
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  (env as any).RAZORPAY_KEY_SECRET = TEST_SECRET;
  (env as any).RAZORPAY_KEY_ID = "rzp_test_unit";
  fn(BusinessService.getBusinessByUserId).mockImplementation(async (uid: string) => businesses[uid] ?? null);
  fn(p.bookingRequest.aggregate).mockResolvedValue({ _sum: { quantity: null } });
  fn(p.negotiation.findUnique).mockResolvedValue(null);
  fn(p.upload.findMany).mockResolvedValue([]);
  fn(p.$transaction).mockImplementation(async (cb: any) => cb(p));
});

// ─────────────────────────────────────────────────────────────────────────────
describe("C-01 — Razorpay payment is bound to the booking's order and amount", () => {
  it("rejects a valid signature from a different (cheap) order", async () => {
    useBooking(baseBooking());
    const fetchPayment = vi.spyOn(RazorpayService, "fetchPayment");

    await expect(
      BookingService.verifyAndFundEscrow("book-1", "user-renter", "order_CHEAP", "pay_CHEAP", sign("order_CHEAP", "pay_CHEAP"))
    ).rejects.toMatchObject({ statusCode: 400, code: "ORDER_MISMATCH" });
    expect(fetchPayment).not.toHaveBeenCalled();
    expect(p.paymentTransaction.create).not.toHaveBeenCalled();
  });

  it("rejects a payment whose captured amount is less than the booking total", async () => {
    useBooking(baseBooking());
    vi.spyOn(RazorpayService, "fetchPayment").mockResolvedValue({
      id: "pay_X", order_id: "order_BOOKING1", status: "captured", amount: 100, currency: "INR",
    });

    await expect(
      BookingService.verifyAndFundEscrow("book-1", "user-renter", "order_BOOKING1", "pay_X", sign("order_BOOKING1", "pay_X"))
    ).rejects.toMatchObject({ code: "PAYMENT_MISMATCH" });
    expect(p.paymentTransaction.create).not.toHaveBeenCalled();
  });

  it("rejects a forged signature", async () => {
    useBooking(baseBooking());
    await expect(
      BookingService.verifyAndFundEscrow("book-1", "user-renter", "order_BOOKING1", "pay_X", "0".repeat(64))
    ).rejects.toMatchObject({ code: "INVALID_SIGNATURE" });
  });

  it("funds escrow for the right order, captured for the full amount, recording the Razorpay amount", async () => {
    const row = useBooking(baseBooking());
    vi.spyOn(RazorpayService, "fetchPayment").mockResolvedValue({
      id: "pay_OK", order_id: "order_BOOKING1", status: "captured", amount: 900000, currency: "INR",
    });

    const updated = await BookingService.verifyAndFundEscrow(
      "book-1", "user-renter", "order_BOOKING1", "pay_OK", sign("order_BOOKING1", "pay_OK")
    );

    expect(updated.financialStatus).toBe("FUNDS_HELD");
    expect(row.razorpayPaymentId).toBe("pay_OK");
    expect(p.paymentTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: "ESCROW_DEPOSIT", amountPaise: 900000, providerReference: "pay_OK" }),
    });
  });

  it("a second verify with the same payment does not create a second ledger entry", async () => {
    useBooking(baseBooking({ financialStatus: "FUNDS_HELD", razorpayPaymentId: "pay_OK" }));
    const res = await BookingService.verifyAndFundEscrow(
      "book-1", "user-renter", "order_BOOKING1", "pay_OK", sign("order_BOOKING1", "pay_OK")
    );
    expect(res.financialStatus).toBe("FUNDS_HELD");
    expect(p.paymentTransaction.create).not.toHaveBeenCalled();
  });

  it("safeEqual is length-safe and exact", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("H-01 — bookings are only visible to their renter and owner", () => {
  it("scopes the lookup to the caller's businesses", async () => {
    fn(p.bookingRequest.findFirst).mockResolvedValue(null);
    await BookingService.getBookingRequestById("book-1", "user-stranger");
    const where = fn(p.bookingRequest.findFirst).mock.calls[0][0].where;
    expect(where).toEqual({
      id: "book-1",
      OR: [{ seeker: { ownerId: "user-stranger" } }, { provider: { ownerId: "user-stranger" } }],
    });
  });

  it("controller returns 404 to a non-party (user C on user A's booking)", async () => {
    fn(p.bookingRequest.findFirst).mockResolvedValue(null);
    const res: any = { status: vi.fn(), json: vi.fn() };
    res.status.mockReturnValue(res);
    await BookingController.getBookingRequestById({ userId: "user-stranger", params: { id: "book-1" } } as any, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("state-changing actions by a non-party look like a missing booking (404)", async () => {
    useBooking(baseBooking({ bookingStatus: "OWNER_INSPECTION" }));
    await expect(BookingService.ownerAcceptReturn("book-1", "user-stranger")).rejects.toMatchObject({ statusCode: 404 });
    await expect(
      BookingService.updateBookingStatus("book-1", "user-stranger", { status: "cancelled" } as any)
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("negotiation thread is not readable by a non-party", async () => {
    fn(p.bookingRequest.findFirst).mockResolvedValue(null);
    await expect(NegotiationService.getByBookingId("book-1", "user-stranger")).rejects.toMatchObject({ statusCode: 404 });
    expect(p.negotiation.findUnique).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("H-02 — renter cancellation", () => {
  it.each(["HANDOVER_INSPECTION", "ACTIVE", "RETURN_INITIATED", "DISPUTED", "COMPLETED"])(
    "is refused once the booking is %s (no refund written)",
    async (status) => {
      useBooking(baseBooking({ bookingStatus: status, financialStatus: "FUNDS_HELD" }));
      await expect(
        BookingService.updateBookingStatus("book-1", "user-renter", { status: "cancelled" } as any)
      ).rejects.toMatchObject({ statusCode: 409, code: "NOT_CANCELLABLE" });
      expect(p.paymentTransaction.create).not.toHaveBeenCalled();
    }
  );

  it("before handover, refunds exactly what was paid — not a recomputed total", async () => {
    // total was inflated after payment somehow; refund must follow the escrow ledger
    useBooking(baseBooking({ financialStatus: "FUNDS_HELD", totalAmountPaise: 9_000_000 }));
    fn(p.paymentTransaction.aggregate).mockResolvedValue({ _sum: { amountPaise: 900000 } });

    const res = await BookingService.updateBookingStatus("book-1", "user-renter", { status: "cancelled" } as any);

    expect(res.bookingStatus).toBe("CANCELLED");
    expect(p.paymentTransaction.create).toHaveBeenCalledTimes(1);
    expect(p.paymentTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: "DEPOSIT_REFUND", amountPaise: 900000, providerReference: "CANCEL_REFUND_book-1" }),
    });
  });

  it("a double-click cancel refunds only once", async () => {
    useBooking(baseBooking({ financialStatus: "FUNDS_HELD" }));
    fn(p.paymentTransaction.aggregate).mockResolvedValue({ _sum: { amountPaise: 900000 } });
    const first = BookingService.updateBookingStatus("book-1", "user-renter", { status: "cancelled" } as any);
    const second = BookingService.updateBookingStatus("book-1", "user-renter", { status: "cancelled" } as any);
    const results = await Promise.allSettled([first, second]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(p.paymentTransaction.create).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("H-03 — prices can't change after the owner accepts / renter pays", () => {
  function withNegotiation(bookingOverrides: Record<string, any>, offerFrom: "SEEKER" | "PROVIDER") {
    const booking = baseBooking(bookingOverrides);
    fn(p.bookingRequest.findUnique).mockResolvedValue({
      ...booking,
      resource: { rentAmountPaise: 200000 },
      negotiation: {
        id: "neg-1",
        status: "OPEN",
        offers: [{ id: "off-1", proposerRole: offerFrom, status: "PENDING", offeredAmountPaise: 5_000_000 }],
      },
    });
  }

  it("refuses to accept a stale offer once escrow is funded", async () => {
    withNegotiation({ bookingStatus: "BOOKING_ACCEPTED", financialStatus: "FUNDS_HELD" }, "SEEKER");
    await expect(NegotiationService.acceptOffer("user-owner", "book-1")).rejects.toMatchObject({ code: "NOT_NEGOTIABLE" });
    expect(p.bookingRequest.updateMany).not.toHaveBeenCalled();
  });

  it.each(["CANCELLED", "ACTIVE", "DISPUTED", "COMPLETED"])("refuses to revive a %s booking via acceptOffer", async (status) => {
    withNegotiation({ bookingStatus: status }, "PROVIDER");
    await expect(NegotiationService.acceptOffer("user-renter", "book-1")).rejects.toMatchObject({ code: "NOT_NEGOTIABLE" });
  });

  it("refuses new offers once the booking is accepted", async () => {
    withNegotiation({ bookingStatus: "BOOKING_ACCEPTED" }, "PROVIDER");
    await expect(NegotiationService.makeOffer("user-renter", "book-1", 150000)).rejects.toMatchObject({ code: "NOT_NEGOTIABLE" });
  });

  it("refuses lowball offers below the floor", async () => {
    withNegotiation({ bookingStatus: "BOOKING_REQUESTED" }, "PROVIDER");
    await expect(NegotiationService.makeOffer("user-renter", "book-1", 1)).rejects.toMatchObject({ code: "OFFER_TOO_LOW" });
  });

  it("accepting an offer runs the same capacity lock/check as a normal accept", async () => {
    withNegotiation({ bookingStatus: "BOOKING_REQUESTED" }, "SEEKER");
    fn(p.resource.findUnique).mockResolvedValue({ id: "res-1", quantity: 1 });
    fn(p.bookingRequest.aggregate).mockResolvedValue({ _sum: { quantity: 1 } }); // already fully booked
    await expect(NegotiationService.acceptOffer("user-owner", "book-1")).rejects.toMatchObject({ code: "CAPACITY_EXCEEDED" });
    expect(p.$queryRaw).toHaveBeenCalled(); // row lock taken
    expect(p.bookingRequest.updateMany).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("H-08 — escrow transitions are atomic", () => {
  it("renter accept loses the race to the worker: no second rent payout", async () => {
    fn(p.bookingRequest.findUnique).mockResolvedValue(baseBooking({ bookingStatus: "HANDOVER_INSPECTION", financialStatus: "FUNDS_HELD" }));
    fn(p.bookingRequest.updateMany).mockResolvedValue({ count: 0 }); // the worker already moved it

    await expect(
      BookingService.renterReceivingInspection("book-1", "user-renter", { status: "ACCEPTED", evidenceUrls: [] } as any)
    ).rejects.toMatchObject({ statusCode: 409, code: "STATE_CHANGED" });
    expect(p.paymentTransaction.create).not.toHaveBeenCalled();
  });

  it("worker skips bookings another process already released", async () => {
    fn(p.bookingRequest.findMany).mockImplementation(async ({ where }: any) =>
      where.bookingStatus === "HANDOVER_INSPECTION" ? [baseBooking({ bookingStatus: "HANDOVER_INSPECTION" })] : []
    );
    fn(p.bookingRequest.updateMany).mockResolvedValue({ count: 0 });

    await BookingService.processExpiredInspections();
    expect(p.paymentTransaction.create).not.toHaveBeenCalled();
  });

  it("uses one stable ledger reference per booking+event so the DB unique index blocks duplicates", async () => {
    fn(p.bookingRequest.findMany).mockImplementation(async ({ where }: any) =>
      where.bookingStatus === "HANDOVER_INSPECTION" ? [baseBooking({ bookingStatus: "HANDOVER_INSPECTION" })] : []
    );
    fn(p.bookingRequest.updateMany).mockResolvedValue({ count: 1 });
    await BookingService.processExpiredInspections();
    expect(p.paymentTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: "RENT_PAYOUT", providerReference: "RENT_PAYOUT_book-1" }),
    });
  });

  it("booking reads no longer run the payout job", async () => {
    const spy = vi.spyOn(BookingService, "processExpiredInspections");
    fn(p.bookingRequest.findFirst).mockResolvedValue(null);
    fn(p.bookingRequest.findMany).mockResolvedValue([]);
    await BookingService.getBookingRequestById("book-1", "user-renter");
    await BookingService.getBookingRequests("user-renter", {} as any);
    expect(spy).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("H-09 — resource deletion can't erase bookings or the ledger", () => {
  beforeEach(() => {
    fn(p.resource.findUnique).mockResolvedValue({ id: "res-1", businessId: owner.id, deletedAt: null, photos: [], damagePhotos: [] });
    fn(BusinessService.verifyOwnership).mockResolvedValue(true);
  });

  it("refuses while any booking is still in progress", async () => {
    fn(p.bookingRequest.count).mockResolvedValue(1);
    await expect(ResourceService.deleteResource("res-1", "user-owner")).rejects.toMatchObject({ statusCode: 409, code: "HAS_OPEN_BOOKINGS" });
    expect(p.resource.delete).not.toHaveBeenCalled();
    expect(p.resource.update).not.toHaveBeenCalled();
  });

  it("otherwise soft-deletes instead of hard-deleting", async () => {
    fn(p.bookingRequest.count).mockResolvedValue(0);
    await ResourceService.deleteResource("res-1", "user-owner");
    expect(p.resource.delete).not.toHaveBeenCalled();
    expect(p.resource.update).toHaveBeenCalledWith({
      where: { id: "res-1" },
      data: expect.objectContaining({ isActive: false, deletedAt: expect.any(Date) }),
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("L-04 — booking input limits", () => {
  const resource = {
    id: "res-1", businessId: owner.id, isActive: true, deletedAt: null, quantity: 5,
    rentAmountPaise: 200000, securityDepositPaise: 0, transportAvailable: false, transportRatePerKmPaise: 0,
    availabilityWindows: [], photos: [], damagePhotos: [], hasPreExistingDamage: false,
    name: "Hall", resourceType: "Banquet Hall", location: "Pune",
  };
  beforeEach(() => fn(p.resource.findUnique).mockResolvedValue(resource));

  it("rejects bookings that start in the past", async () => {
    const start = new Date(Date.now() - 5 * 86400000).toISOString();
    const end = new Date(Date.now() - 3 * 86400000).toISOString();
    await expect(
      BookingService.createBookingRequest("user-renter", { resourceId: "res-1", quantity: 1, startDate: start, endDate: end } as any)
    ).rejects.toMatchObject({ statusCode: 422, code: "INVALID_DATES" });
  });

  it("rejects absurdly long bookings (and the INT overflow they would cause)", async () => {
    const start = new Date(Date.now() + 86400000).toISOString();
    const end = new Date(Date.now() + 5000 * 86400000).toISOString();
    await expect(
      BookingService.createBookingRequest("user-renter", { resourceId: "res-1", quantity: 1, startDate: start, endDate: end } as any)
    ).rejects.toMatchObject({ statusCode: 422 });
    expect(p.bookingRequest.create).not.toHaveBeenCalled();
  });
});
