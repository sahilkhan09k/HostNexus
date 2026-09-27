/**
 * Booking & negotiation notifications: correct recipient for every event,
 * realtime refresh signals, failure isolation, and that the real service
 * transitions trigger the right events.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../config/database.js", () => {
  const prisma: any = {
    resource: { findUnique: vi.fn() },
    bookingRequest: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      updateMany: vi.fn(),
    },
    negotiation: { findUnique: vi.fn().mockResolvedValue(null), update: vi.fn(), create: vi.fn() },
    negotiationOffer: { updateMany: vi.fn(), create: vi.fn() },
    bookingTimelineEvent: { create: vi.fn() },
    $queryRaw: vi.fn().mockResolvedValue([]),
    $transaction: vi.fn(async (cb: any) => cb(prisma)),
  };
  return { prisma };
});

vi.mock("../services/business.service.js", () => ({
  BusinessService: { getBusinessByUserId: vi.fn() },
}));

vi.mock("../services/capacity.js", () => ({
  lockResource: vi.fn(),
  assertCapacity: vi.fn(),
}));

vi.mock("../services/notifications/notification.service.js", () => ({
  NotificationService: { notifyMany: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock("../services/notifications/realtime.service.js", () => ({
  emitToUser: vi.fn(),
  REALTIME_EVENTS: {
    NOTIFICATION_NEW: "notification:new",
    NOTIFICATION_READ: "notification:read",
    BOOKING_UPDATED: "booking:updated",
    NEGOTIATION_UPDATED: "negotiation:updated",
  },
}));

import { prisma } from "../config/database.js";
import { BusinessService } from "../services/business.service.js";
import { NotificationService } from "../services/notifications/notification.service.js";
import { emitToUser } from "../services/notifications/realtime.service.js";
import {
  buildBookingNotifications,
  notifyBookingEvent,
  bookingLink,
  type BookingContext,
  type BookingEvent,
} from "../services/notifications/booking-notifications.js";
import { BookingService } from "../services/booking.service.js";
import { NegotiationService } from "../services/negotiation.service.js";

const p = prisma as any;
const emit = emitToUser as unknown as ReturnType<typeof vi.fn>;
const notifyMany = NotificationService.notifyMany as unknown as ReturnType<typeof vi.fn>;

const ctx: BookingContext = {
  id: "book-1",
  resourceId: "res-1",
  resourceName: "Banquet Chairs",
  quantity: 40,
  startDate: new Date("2026-10-28T00:00:00Z"),
  endDate: new Date("2026-10-30T00:00:00Z"),
  totalAmountPaise: 900000,
  securityDepositPaise: 500000,
  rejectionReason: null,
  owner: { businessId: "biz-owner", businessName: "Grand Hotel", userId: "user-owner", email: "owner@x.com", ownerName: "Asha" },
  renter: { businessId: "biz-renter", businessName: "Event Co", userId: "user-renter", email: "renter@x.com", ownerName: null },
};

/** DB row shape loadContext() selects */
const dbBooking = {
  id: "book-1",
  quantity: 40,
  startDate: ctx.startDate,
  endDate: ctx.endDate,
  totalAmountPaise: 900000,
  securityDepositPaise: 500000,
  rejectionReason: null,
  resource: { id: "res-1", name: "Banquet Chairs" },
  seeker: { id: "biz-renter", name: "Event Co", owner: { id: "user-renter", email: "renter@x.com", ownerName: null } },
  provider: { id: "biz-owner", name: "Grand Hotel", owner: { id: "user-owner", email: "owner@x.com", ownerName: "Asha" } },
};

beforeEach(() => {
  vi.clearAllMocks();
  notifyMany.mockResolvedValue(undefined);
});

describe("buildBookingNotifications — recipients", () => {
  const cases: Array<[BookingEvent, Array<[string, string]>]> = [
    [{ kind: "REQUESTED" }, [["user-owner", "BOOKING_REQUESTED"]]],
    [{ kind: "ACCEPTED" }, [["user-renter", "BOOKING_ACCEPTED"]]],
    [{ kind: "REJECTED" }, [["user-renter", "BOOKING_REJECTED"]]],
    [{ kind: "CANCELLED", refundedPaise: 0 }, [["user-owner", "BOOKING_CANCELLED"]]],
    [{ kind: "PAYMENT_RECEIVED" }, [["user-owner", "PAYMENT_RECEIVED"], ["user-renter", "PAYMENT_CONFIRMED"]]],
    [{ kind: "HANDOVER_STARTED", deadline: new Date() }, [["user-renter", "HANDOVER_STARTED"]]],
    [{ kind: "RENT_RELEASED", auto: false }, [["user-owner", "RENT_RELEASED"]]],
    [{ kind: "RENT_RELEASED", auto: true }, [["user-owner", "RENT_RELEASED"], ["user-renter", "INSPECTION_AUTO_ACCEPTED"]]],
    [{ kind: "HANDOVER_ISSUE" }, [["user-owner", "HANDOVER_ISSUE_REPORTED"]]],
    [{ kind: "RETURN_INITIATED", early: false }, [["user-owner", "RETURN_INITIATED"]]],
    [{ kind: "RETURN_RECEIVED", deadline: new Date() }, [["user-renter", "RETURN_RECEIVED"]]],
    [{ kind: "RETURN_NOT_RECEIVED" }, [["user-renter", "RETURN_NOT_RECEIVED"]]],
    [{ kind: "RETURN_ACCEPTED", auto: false }, [["user-renter", "DEPOSIT_REFUNDED"]]],
    [{ kind: "RETURN_ACCEPTED", auto: true }, [["user-renter", "DEPOSIT_REFUNDED"], ["user-owner", "BOOKING_COMPLETED"]]],
    [{ kind: "DAMAGE_CLAIMED", amountPaise: 20000 }, [["user-renter", "DAMAGE_CLAIM_FILED"]]],
    [{ kind: "CLAIM_ACCEPTED", payoutPaise: 20000, refundPaise: 480000 }, [["user-owner", "DAMAGE_CLAIM_ACCEPTED"]]],
    [{ kind: "CLAIM_DISPUTED" }, [["user-owner", "DAMAGE_CLAIM_DISPUTED"]]],
    [{ kind: "DISPUTE_RESOLVED", decision: "PAY_OWNER" }, [["user-owner", "DISPUTE_RESOLVED"], ["user-renter", "DISPUTE_RESOLVED"]]],
    [{ kind: "NON_RETURN_REPORTED" }, [["user-renter", "NON_RETURN_REPORTED"]]],
    [{ kind: "NEGOTIATION_OFFER", by: "RENTER", amountPaise: 150000 }, [["user-owner", "NEGOTIATION_OFFER"]]],
    [{ kind: "NEGOTIATION_OFFER", by: "OWNER", amountPaise: 180000 }, [["user-renter", "NEGOTIATION_OFFER"]]],
    [{ kind: "NEGOTIATION_ACCEPTED", by: "OWNER", amountPaise: 180000 }, [["user-renter", "NEGOTIATION_ACCEPTED"]]],
    [{ kind: "NEGOTIATION_REJECTED", by: "RENTER" }, [["user-owner", "NEGOTIATION_REJECTED"]]],
  ];

  it.each(cases)("%o → %o", (event, expected) => {
    const out = buildBookingNotifications(ctx, event);
    expect(out.map((n) => [n.userId, n.type])).toEqual(expected);
  });

  it("never notifies the actor about their own action (offer goes to the other side only)", () => {
    const out = buildBookingNotifications(ctx, { kind: "NEGOTIATION_OFFER", by: "OWNER", amountPaise: 1 });
    expect(out.every((n) => n.userId !== "user-owner")).toBe(true);
  });

  it("links each party to the booking on their own tab", () => {
    const [toOwner] = buildBookingNotifications(ctx, { kind: "REQUESTED" });
    const [toRenter] = buildBookingNotifications(ctx, { kind: "ACCEPTED" });
    expect(toOwner.data?.link).toBe(bookingLink("book-1", "OWNER"));
    expect(toOwner.data?.link).toContain("tab=incoming");
    expect(toRenter.data?.link).toContain("tab=outgoing");
    expect(toOwner.data).toMatchObject({ bookingId: "book-1", resourceId: "res-1", businessId: "biz-renter" });
  });

  it("writes human messages with names, quantities and rupee amounts", () => {
    const [n] = buildBookingNotifications(ctx, { kind: "ACCEPTED" });
    expect(n.message).toContain("Grand Hotel accepted your request for 40 × Banquet Chairs");
    expect(n.message).toContain("₹9,000");
    expect(n.email?.to).toBe("renter@x.com");
    expect(n.email?.recipientName).toBe("Event Co"); // falls back to business name
  });

  it("does not leak contact details of the other party", () => {
    for (const [event] of cases) {
      for (const n of buildBookingNotifications(ctx, event)) {
        const otherEmail = n.userId === "user-owner" ? "renter@x.com" : "owner@x.com";
        expect(`${n.title} ${n.message} ${JSON.stringify(n.data)}`).not.toContain(otherEmail);
      }
    }
  });

  it("includes the owner's rejection reason, clipped", () => {
    const [n] = buildBookingNotifications({ ...ctx, rejectionReason: "x".repeat(1000) }, { kind: "REJECTED" });
    expect(n.message).toContain("Reason:");
    expect(n.message.length).toBeLessThan(500);
  });
});

describe("notifyBookingEvent()", () => {
  it("loads recipients from the booking and pushes a refresh to both parties", async () => {
    p.bookingRequest.findUnique.mockResolvedValue(dbBooking);
    await notifyBookingEvent("book-1", { kind: "ACCEPTED" });

    expect(emit).toHaveBeenCalledWith("user-owner", "booking:updated", { bookingId: "book-1", event: "ACCEPTED" });
    expect(emit).toHaveBeenCalledWith("user-renter", "booking:updated", { bookingId: "book-1", event: "ACCEPTED" });
    expect(emit).not.toHaveBeenCalledWith(expect.anything(), "negotiation:updated", expect.anything());
    expect(notifyMany).toHaveBeenCalledWith([expect.objectContaining({ userId: "user-renter", type: "BOOKING_ACCEPTED" })]);
  });

  it("also signals negotiation screens for negotiation events", async () => {
    p.bookingRequest.findUnique.mockResolvedValue(dbBooking);
    await notifyBookingEvent("book-1", { kind: "NEGOTIATION_OFFER", by: "RENTER", amountPaise: 150000 });
    expect(emit).toHaveBeenCalledWith("user-owner", "negotiation:updated", expect.objectContaining({ bookingId: "book-1" }));
    expect(emit).toHaveBeenCalledWith("user-renter", "negotiation:updated", expect.objectContaining({ bookingId: "book-1" }));
  });

  it("swallows database errors so the business operation is unaffected", async () => {
    p.bookingRequest.findUnique.mockRejectedValue(new Error("db down"));
    await expect(notifyBookingEvent("book-1", { kind: "REQUESTED" })).resolves.toBeUndefined();
    expect(notifyMany).not.toHaveBeenCalled();
  });

  it("does nothing for a booking that no longer exists", async () => {
    p.bookingRequest.findUnique.mockResolvedValue(null);
    await notifyBookingEvent("gone", { kind: "REQUESTED" });
    expect(emit).not.toHaveBeenCalled();
    expect(notifyMany).not.toHaveBeenCalled();
  });
});

describe("service transitions trigger notifications", () => {
  const owner = { id: "biz-owner", name: "Grand Hotel", ownerId: "user-owner" };
  const renter = { id: "biz-renter", name: "Event Co", ownerId: "user-renter" };
  const businesses: Record<string, unknown> = { "user-owner": owner, "user-renter": renter };

  const booking = {
    id: "book-1",
    seekerId: renter.id,
    providerId: owner.id,
    resourceId: "res-1",
    quantity: 1,
    startDate: new Date(Date.now() + 86400000),
    endDate: new Date(Date.now() + 3 * 86400000),
    totalDays: 2,
    bookingStatus: "BOOKING_REQUESTED",
    financialStatus: "PENDING_PAYMENT",
    rentAmountPaise: 400000,
    securityDepositPaise: 500000,
    transportFeePaise: 0,
    totalAmountPaise: 900000,
  };

  beforeEach(() => {
    (BusinessService.getBusinessByUserId as any).mockImplementation(async (uid: string) => businesses[uid] ?? null);
  });

  it("owner accepting a request notifies the renter, after the state change", async () => {
    p.bookingRequest.findUnique
      .mockResolvedValueOnce(booking) // loadForParty
      .mockResolvedValueOnce(dbBooking); // notifier context
    p.resource.findUnique.mockResolvedValue({ id: "res-1", quantity: 10 });
    p.bookingRequest.updateMany.mockResolvedValue({ count: 1 });
    p.bookingRequest.findUniqueOrThrow.mockResolvedValue({ ...booking, bookingStatus: "BOOKING_ACCEPTED" });

    await BookingService.updateBookingStatus("book-1", "user-owner", { status: "accepted" });
    await new Promise((r) => setTimeout(r, 0));

    expect(p.bookingRequest.updateMany).toHaveBeenCalled();
    expect(notifyMany).toHaveBeenCalledWith([expect.objectContaining({ userId: "user-renter", type: "BOOKING_ACCEPTED" })]);
    expect(p.bookingRequest.updateMany.mock.invocationCallOrder[0]).toBeLessThan(notifyMany.mock.invocationCallOrder[0]);
  });

  it("renter cancelling notifies the owner", async () => {
    p.bookingRequest.findUnique
      .mockResolvedValueOnce(booking)
      .mockResolvedValueOnce(dbBooking);
    p.bookingRequest.updateMany.mockResolvedValue({ count: 1 });
    p.bookingRequest.findUniqueOrThrow.mockResolvedValue({ ...booking, bookingStatus: "CANCELLED" });

    await BookingService.updateBookingStatus("book-1", "user-renter", { status: "cancelled" });
    await new Promise((r) => setTimeout(r, 0));

    expect(notifyMany).toHaveBeenCalledWith([expect.objectContaining({ userId: "user-owner", type: "BOOKING_CANCELLED" })]);
  });

  it("a failed transition sends nothing", async () => {
    p.bookingRequest.findUnique.mockResolvedValue({ ...booking, bookingStatus: "COMPLETED" });
    await expect(BookingService.updateBookingStatus("book-1", "user-owner", { status: "accepted" })).rejects.toMatchObject({ statusCode: 409 });
    await new Promise((r) => setTimeout(r, 0));
    expect(emit).not.toHaveBeenCalled();
    expect(notifyMany).not.toHaveBeenCalled();
  });

  it("a renter's counter-offer notifies the owner", async () => {
    p.bookingRequest.findUnique
      .mockResolvedValueOnce({ ...booking, resource: { rentAmountPaise: 200000 }, negotiation: null }) // makeOffer
      .mockResolvedValueOnce(dbBooking); // notifier context
    p.negotiation.create.mockResolvedValue({ id: "neg-1", status: "OPEN", offers: [] });
    p.negotiationOffer.create.mockResolvedValue({ id: "off-1" });

    await NegotiationService.makeOffer("user-renter", "book-1", 150000, "Can you do 1500?");
    await new Promise((r) => setTimeout(r, 0));

    expect(notifyMany).toHaveBeenCalledWith([
      expect.objectContaining({ userId: "user-owner", type: "NEGOTIATION_OFFER", message: expect.stringContaining("Can you do 1500?") }),
    ]);
  });
});
