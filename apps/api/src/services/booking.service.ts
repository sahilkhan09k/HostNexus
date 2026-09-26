import type { Prisma } from "@prisma/client";
import { prisma } from "../config/database.js";
import { env } from "../config/env.js";
import { BusinessService } from "./business.service.js";
import { RazorpayService, type RazorpayPaymentSummary } from "./razorpay.service.js";
import { assertCapacity, lockResource } from "./capacity.js";
import { resolveOwnedMedia } from "./evidence.js";
import { badRequest, conflict, forbidden, notFound, unprocessable } from "../utils/http-error.js";
import { pageArgs, toPage, type Pagination } from "../utils/pagination.js";
import type {
  CreateBookingRequestInput,
  UpdateBookingStatusInput,
  BookingQuery,
  RenterReceivingInspectionInput,
  ReturnInitiationInput,
  OwnerReceiptInput,
  OwnerDamageClaimInput,
  RenterClaimResponseInput,
  AdminResolveDisputeInput,
} from "../schemas/booking.schema.js";

type Tx = Prisma.TransactionClient;

// ── Limits ─────────────────────────────────────────────────────────────
const DAY_MS = 24 * 60 * 60 * 1000;
export const MAX_BOOKING_DAYS = 365;
/** Razorpay's minimum order is ₹1 */
export const MIN_ORDER_PAISE = 100;
/** Money columns are Postgres INT — keep totals well clear of 2^31 */
export const MAX_ORDER_PAISE = 2_000_000_000;

/** Statuses from which the renter may still cancel (nothing has been handed over yet) */
export const RENTER_CANCELLABLE_STATUSES = ["BOOKING_REQUESTED", "BOOKING_ACCEPTED"];

/**
 * Stable ledger references. PaymentTransaction.providerReference is UNIQUE, so the
 * database itself refuses a second payout/refund of the same kind for a booking.
 */
export const ledgerRef = {
  rentPayout: (id: string) => `RENT_PAYOUT_${id}`,
  depositRefund: (id: string) => `DEPOSIT_REFUND_${id}`,
  damagePayout: (id: string) => `DAMAGE_PAYOUT_${id}`,
  cancelRefund: (id: string) => `CANCEL_REFUND_${id}`,
};

/** Only these business fields are exposed to the other party of a booking */
const PARTY_SELECT = { select: { id: true, name: true, businessType: true, city: true, state: true } } as const;

/**
 * Atomically moves a booking between states. Returns false if the booking was
 * not in the expected state (another request got there first), so callers never
 * act twice on the same transition.
 */
async function claimTransition(
  tx: Tx,
  bookingId: string,
  expected: Prisma.BookingRequestWhereInput,
  data: Prisma.BookingRequestUpdateManyMutationInput
): Promise<boolean> {
  const res = await tx.bookingRequest.updateMany({ where: { id: bookingId, ...expected }, data });
  return res.count === 1;
}

const stateChanged = () => conflict("This booking was updated by someone else. Please refresh and try again.", "STATE_CHANGED");

export class BookingService {
  // ─────────────────────────────────────────────────────────────────────
  // TIMELINE HELPER
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Record a chronological audit timeline event (fire-and-forget safe).
   */
  static async recordTimelineEvent(
    bookingId: string,
    eventType: string,
    actorId: string | null,
    actorRole: "OWNER" | "RENTER" | "ADMIN" | "SYSTEM",
    title: string,
    description: string,
    metadata: Record<string, unknown> | null = null
  ) {
    try {
      await prisma.bookingTimelineEvent.create({
        data: {
          bookingId,
          eventType,
          actorId,
          actorRole,
          title,
          description,
          metadata: metadata ? (metadata as any) : undefined,
        },
      });
    } catch (e) {
      console.error("Failed to record timeline event:", e);
    }
  }

  /** Loads a booking and resolves which side of it the caller is on. */
  private static async loadForParty(bookingId: string, userId: string) {
    const booking = await prisma.bookingRequest.findUnique({ where: { id: bookingId } });
    const business = await BusinessService.getBusinessByUserId(userId);
    // 404 (not 403) for non-parties so booking ids can't be probed
    if (!booking || !business || (booking.seekerId !== business.id && booking.providerId !== business.id)) {
      throw notFound("Booking not found");
    }
    return { booking, business, isSeeker: booking.seekerId === business.id, isProvider: booking.providerId === business.id };
  }

  // ─────────────────────────────────────────────────────────────────────
  // EXPIRED INSPECTION PROCESSING (background worker only)
  // Each booking is claimed with a conditional update, so concurrent runs
  // (several API instances, or a renter clicking at the deadline) can never
  // release rent or refund a deposit twice.
  // ─────────────────────────────────────────────────────────────────────

  static async processExpiredInspections(): Promise<void> {
    const now = new Date();

    // 1. Renter inspection timeouts (1 hour expired without reporting an issue)
    const expiredRenterInspections = await prisma.bookingRequest.findMany({
      where: { bookingStatus: "HANDOVER_INSPECTION", renterInspectionDeadline: { lte: now } },
      take: 200,
    });

    for (const booking of expiredRenterInspections) {
      const released = await prisma.$transaction(async (tx) => {
        const claimed = await claimTransition(
          tx,
          booking.id,
          { bookingStatus: "HANDOVER_INSPECTION", financialStatus: "FUNDS_HELD", renterInspectionDeadline: { lte: now } },
          { bookingStatus: "ACTIVE", financialStatus: "RENT_RELEASED", status: "active" }
        );
        if (!claimed) return false;

        await tx.paymentTransaction.create({
          data: {
            bookingId: booking.id,
            type: "RENT_PAYOUT",
            amountPaise: booking.rentAmountPaise + booking.transportFeePaise, // transport fee is paid out with rent
            status: "COMPLETED",
            providerReference: ledgerRef.rentPayout(booking.id),
          },
        });
        return true;
      });

      if (released) {
        await this.recordTimelineEvent(
          booking.id,
          "AUTO_TIMEOUT_RELEASE",
          null,
          "SYSTEM",
          "Renter Inspection Window Expired (Auto-Accepted)",
          "The 1-hour inspection window elapsed without reported defects. Resource marked active and rent released to owner; deposit remains safely in escrow."
        );
      }
    }

    // 2. Owner return inspection timeouts (2 hours expired without damage claim)
    const expiredOwnerInspections = await prisma.bookingRequest.findMany({
      where: { bookingStatus: "OWNER_INSPECTION", ownerInspectionDeadline: { lte: now }, damageClaims: { none: {} } },
      take: 200,
    });

    for (const booking of expiredOwnerInspections) {
      const refunded = await prisma.$transaction(async (tx) => {
        const claimed = await claimTransition(
          tx,
          booking.id,
          { bookingStatus: "OWNER_INSPECTION", ownerInspectionDeadline: { lte: now }, damageClaims: { none: {} } },
          { bookingStatus: "COMPLETED", financialStatus: "DEPOSIT_REFUNDED", completedAt: now, status: "completed" }
        );
        if (!claimed) return false;

        await tx.paymentTransaction.create({
          data: {
            bookingId: booking.id,
            type: "DEPOSIT_REFUND",
            amountPaise: booking.securityDepositPaise,
            status: "COMPLETED",
            providerReference: ledgerRef.depositRefund(booking.id),
          },
        });
        return true;
      });

      if (refunded) {
        await this.recordTimelineEvent(
          booking.id,
          "AUTO_TIMEOUT_RELEASE",
          null,
          "SYSTEM",
          "Owner Inspection Window Expired (Deposit Auto-Refunded)",
          "The 2-hour owner return inspection window elapsed without damage claims. Full security deposit has been automatically refunded to the renter."
        );
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // CREATE BOOKING REQUEST
  // ─────────────────────────────────────────────────────────────────────

  static async createBookingRequest(
    userId: string,
    input: CreateBookingRequestInput
  ) {
    const seekerBusiness = await BusinessService.getBusinessByUserId(userId);
    if (!seekerBusiness) {
      throw forbidden("You must have a business to create booking requests", "NO_BUSINESS");
    }

    const resource = await prisma.resource.findUnique({
      where: { id: input.resourceId },
      include: {
        business: true,
        availabilityWindows: true,
      },
    });

    if (!resource || resource.deletedAt) throw notFound("Resource not found");
    if (!resource.isActive) throw unprocessable("This resource is not available for booking", "RESOURCE_INACTIVE");
    if (resource.businessId === seekerBusiness.id) {
      throw unprocessable("You cannot book your own resource", "OWN_RESOURCE");
    }

    const startDate = new Date(input.startDate);
    const endDate   = new Date(input.endDate);

    if (endDate <= startDate) {
      throw unprocessable("End date must be strictly after start date", "INVALID_DATES");
    }
    // One day of slack for time zones (clients send local midnight as UTC)
    if (startDate.getTime() < Date.now() - DAY_MS) {
      throw unprocessable("Start date cannot be in the past", "INVALID_DATES");
    }

    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / DAY_MS);
    if (totalDays > MAX_BOOKING_DAYS) {
      throw unprocessable(`Bookings can be at most ${MAX_BOOKING_DAYS} days long`, "INVALID_DATES");
    }

    if (input.quantity > resource.quantity) {
      throw unprocessable(
        `Requested quantity (${input.quantity}) exceeds available quantity (${resource.quantity})`,
        "QUANTITY_EXCEEDED"
      );
    }

    const hasAvailability =
      !resource.availabilityWindows ||
      resource.availabilityWindows.length === 0 ||
      resource.availabilityWindows.some(
        (w) => w.fromDate <= startDate && w.toDate >= endDate
      );
    if (!hasAvailability) {
      throw unprocessable(
        "The resource is not available for the requested date range. Please check the owner's availability calendar.",
        "NOT_AVAILABLE"
      );
    }

    // Transport: renter may only pick the owner's transport if the listing offers it.
    const useProviderTransport = input.transportMode === "PROVIDER";
    if (useProviderTransport && !resource.transportAvailable) {
      throw unprocessable("The owner does not provide transport for this resource", "NO_TRANSPORT");
    }
    const transportDistanceKm     = useProviderTransport ? input.transportDistanceKm! : null;
    const transportRatePerKmPaise = useProviderTransport ? resource.transportRatePerKmPaise : 0;
    const transportFeePaise       = useProviderTransport
      ? Math.round(transportRatePerKmPaise * transportDistanceKm!)
      : 0;

    // Financial calculation in paise — always from DB prices, never from the client
    const rentAmountPaise      = resource.rentAmountPaise * totalDays;
    const securityDepositPaise = resource.securityDepositPaise;
    const totalAmountPaise     = rentAmountPaise + securityDepositPaise + transportFeePaise;

    if (totalAmountPaise < MIN_ORDER_PAISE) {
      throw unprocessable("The booking total must be at least ₹1", "AMOUNT_TOO_LOW");
    }
    if (!Number.isSafeInteger(totalAmountPaise) || totalAmountPaise > MAX_ORDER_PAISE) {
      throw unprocessable("The booking total is too large. Please book a shorter period or fewer units.", "AMOUNT_TOO_HIGH");
    }

    const conditionSnapshot = {
      resourceName: resource.name,
      resourceType: resource.resourceType,
      quantity:     input.quantity,
      location:     resource.location,
    };

    const listingPhotosSnapshot    = resource.photos || [];
    const damageDisclosureSnapshot = {
      hasPreExistingDamage: resource.hasPreExistingDamage,
      damageDescription:    resource.damageDescription,
      damagePhotos:         resource.damagePhotos || [],
    };

    // Quantity-aware conflict check, atomic with the insert.
    // The resource row lock serialises concurrent creates/accepts for this resource.
    const bookingRequest = await prisma.$transaction(async (tx) => {
      await lockResource(tx, resource.id);
      await assertCapacity(tx, resource, input.quantity, startDate, endDate);

      return tx.bookingRequest.create({
        data: {
          seekerId:   seekerBusiness.id,
          providerId: resource.businessId,
          resourceId: input.resourceId,
          quantity:   input.quantity,
          startDate,
          endDate,
          totalDays,
          specialRequests: input.specialRequests || null,
          bookingStatus:   "BOOKING_REQUESTED",
          financialStatus: "PENDING_PAYMENT",
          status:          "pending",
          rentAmountPaise,
          securityDepositPaise,
          totalAmountPaise,
          transportMode: useProviderTransport ? "PROVIDER" : "SELF",
          transportDistanceKm,
          transportRatePerKmPaise,
          transportFeePaise,
          proposedPrice: totalAmountPaise / 100,
          conditionSnapshot:        conditionSnapshot as any,
          listingPhotosSnapshot,
          damageDisclosureSnapshot: damageDisclosureSnapshot as any,
          termsVersion: "v2.0",
        },
        include: {
          resource: true,
          seeker:   PARTY_SELECT,
          provider: PARTY_SELECT,
        },
      });
    });

    await this.recordTimelineEvent(
      bookingRequest.id,
      "BOOKING_CREATED",
      seekerBusiness.id,
      "RENTER",
      "Booking Requested",
      `Requested by ${seekerBusiness.name} for ${totalDays} day(s). Rent: ₹${(rentAmountPaise / 100).toLocaleString()}, Deposit: ₹${(securityDepositPaise / 100).toLocaleString()}. ${
        useProviderTransport
          ? `Owner transport: ${transportDistanceKm} km × ₹${(transportRatePerKmPaise / 100).toLocaleString()}/km = ₹${(transportFeePaise / 100).toLocaleString()} (distance declared by renter).`
          : "Renter arranges own transport."
      }`
    );

    return bookingRequest;
  }

  // ─────────────────────────────────────────────────────────────────────
  // READ OPERATIONS — always scoped to the caller's business
  // ─────────────────────────────────────────────────────────────────────

  static async getBookingRequests(userId: string, query: BookingQuery, page: Pagination = { limit: 50 }) {
    const business = await BusinessService.getBusinessByUserId(userId);
    if (!business) throw forbidden("You must have a business to view booking requests", "NO_BUSINESS");

    const where: Prisma.BookingRequestWhereInput = {};
    if (query.type === "incoming") {
      where.providerId = business.id;
    } else if (query.type === "outgoing") {
      where.seekerId = business.id;
    } else {
      where.OR = [{ providerId: business.id }, { seekerId: business.id }];
    }

    if (query.bookingStatus)  where.bookingStatus  = query.bookingStatus;
    if (query.financialStatus) where.financialStatus = query.financialStatus;
    if (query.status)          where.status          = query.status;

    const rows = await prisma.bookingRequest.findMany({
      where,
      include: {
        resource: {
          select: { id: true, name: true, resourceType: true, location: true, photos: true },
        },
        seeker:   { select: { id: true, name: true } },
        provider: { select: { id: true, name: true } },
        damageClaims: { orderBy: { createdAt: "desc" } },
        disputes:     { orderBy: { createdAt: "desc" } },
        negotiation: {
          include: {
            offers: {
              orderBy: { createdAt: "desc" },
              take: 1,
              include: { proposer: { select: { id: true, name: true } } },
            },
          },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...pageArgs(page),
    });
    return toPage(rows, page);
  }

  /** Returns null unless the caller is the renter or the owner of this booking. */
  static async getBookingRequestById(bookingId: string, userId: string) {
    return prisma.bookingRequest.findFirst({
      where: {
        id: bookingId,
        OR: [{ seeker: { ownerId: userId } }, { provider: { ownerId: userId } }],
      },
      include: {
        resource: true,
        seeker:   PARTY_SELECT,
        provider: PARTY_SELECT,
        inspections: {
          include: { evidence: true },
          orderBy: { createdAt: "asc" },
        },
        evidence:    { orderBy: { createdAt: "asc" } },
        damageClaims: {
          include: { disputes: true },
          orderBy: { createdAt: "desc" },
        },
        disputes:           { orderBy: { createdAt: "desc" } },
        paymentTransactions:{ orderBy: { createdAt: "asc" } },
        timelineEvents:     { orderBy: { createdAt: "asc" } },
        negotiation: {
          include: {
            offers: {
              include: { proposer: { select: { id: true, name: true } } },
              orderBy: { createdAt: "asc" },
            },
          },
        },
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────
  // STATUS TRANSITIONS
  // ─────────────────────────────────────────────────────────────────────

  /** Closes any open price negotiation on a booking (accepted at list price, rejected or cancelled). */
  private static async closeNegotiation(tx: Tx, bookingId: string) {
    const neg = await tx.negotiation.findUnique({ where: { bookingId }, select: { id: true, status: true } });
    if (!neg || neg.status !== "OPEN") return;
    await tx.negotiationOffer.updateMany({ where: { negotiationId: neg.id, status: "PENDING" }, data: { status: "REJECTED" } });
    await tx.negotiation.update({ where: { id: neg.id }, data: { status: "CANCELLED" } });
  }

  /**
   * Owner accepts / rejects a booking request; renter can cancel before handover.
   */
  static async updateBookingStatus(
    bookingId: string,
    userId: string,
    input: UpdateBookingStatusInput
  ) {
    const { booking, business, isProvider, isSeeker } = await this.loadForParty(bookingId, userId);

    // ── ACCEPT ────────────────────────────────────────────────────────
    if (input.status === "accepted") {
      if (!isProvider) throw forbidden("Only the owner can accept bookings");
      if (booking.bookingStatus !== "BOOKING_REQUESTED") {
        throw conflict("Booking can only be accepted when in BOOKING_REQUESTED status", "INVALID_STATE");
      }

      // Re-check capacity at accept time: several pending requests may overlap,
      // and only the ones that still fit may be accepted.
      const updated = await prisma.$transaction(async (tx) => {
        await lockResource(tx, booking.resourceId);
        const resource = await tx.resource.findUnique({ where: { id: booking.resourceId } });
        if (!resource) throw notFound("Resource not found");

        await assertCapacity(tx, resource, booking.quantity, booking.startDate, booking.endDate, bookingId);

        const ok = await claimTransition(
          tx,
          bookingId,
          { bookingStatus: "BOOKING_REQUESTED" },
          { status: "accepted", bookingStatus: "BOOKING_ACCEPTED" }
        );
        if (!ok) throw stateChanged();
        await this.closeNegotiation(tx, bookingId);
        return tx.bookingRequest.findUniqueOrThrow({ where: { id: bookingId } });
      });

      await this.recordTimelineEvent(
        bookingId, "BOOKING_ACCEPTED", business.id, "OWNER",
        "Booking Accepted",
        `Owner ${business.name} accepted the booking request. Awaiting renter escrow payment.`
      );
      return updated;
    }

    // ── REJECT ────────────────────────────────────────────────────────
    if (input.status === "rejected") {
      if (!isProvider) throw forbidden("Only the owner can reject bookings");

      const updated = await prisma.$transaction(async (tx) => {
        const ok = await claimTransition(
          tx,
          bookingId,
          { bookingStatus: "BOOKING_REQUESTED" },
          { status: "rejected", bookingStatus: "CANCELLED", rejectionReason: input.rejectionReason || null }
        );
        if (!ok) throw conflict("Booking can only be rejected when in BOOKING_REQUESTED status", "INVALID_STATE");
        await this.closeNegotiation(tx, bookingId);
        return tx.bookingRequest.findUniqueOrThrow({ where: { id: bookingId } });
      });

      await this.recordTimelineEvent(
        bookingId, "BOOKING_REJECTED", business.id, "OWNER",
        "Booking Rejected",
        input.rejectionReason || "Owner declined the booking request."
      );
      return updated;
    }

    // ── CANCEL (by renter, only before anything was handed over) ─────
    if (input.status === "cancelled") {
      if (!isSeeker) throw forbidden("Only the requester can cancel bookings");
      if (!RENTER_CANCELLABLE_STATUSES.includes(booking.bookingStatus)) {
        throw conflict(
          "This booking can no longer be cancelled. Use the return or dispute flow instead.",
          "NOT_CANCELLABLE"
        );
      }

      const wasFunded = booking.financialStatus === "FUNDS_HELD";

      const { updated, refundedPaise } = await prisma.$transaction(async (tx) => {
        const ok = await claimTransition(
          tx,
          bookingId,
          { bookingStatus: { in: RENTER_CANCELLABLE_STATUSES }, financialStatus: booking.financialStatus },
          {
            status: "cancelled",
            bookingStatus: "CANCELLED",
            ...(wasFunded ? { financialStatus: "DEPOSIT_REFUNDED" } : {}),
            rejectionReason: input.rejectionReason || "Cancelled by renter",
          }
        );
        if (!ok) throw stateChanged();
        await this.closeNegotiation(tx, bookingId);

        let refunded = 0;
        if (wasFunded) {
          // Refund exactly what was paid into escrow — never a recomputed total
          const paid = await tx.paymentTransaction.aggregate({
            where: { bookingId, type: "ESCROW_DEPOSIT", status: "COMPLETED" },
            _sum: { amountPaise: true },
          });
          refunded = paid._sum.amountPaise ?? 0;
          await tx.paymentTransaction.create({
            data: {
              bookingId,
              type: "DEPOSIT_REFUND",
              amountPaise: refunded,
              status: "COMPLETED",
              providerReference: ledgerRef.cancelRefund(bookingId),
            },
          });
        }
        return { updated: await tx.bookingRequest.findUniqueOrThrow({ where: { id: bookingId } }), refundedPaise: refunded };
      });

      await this.recordTimelineEvent(
        bookingId, "BOOKING_CANCELLED", business.id, "RENTER",
        wasFunded ? "Booking Cancelled (Escrow Refunded)" : "Booking Cancelled",
        wasFunded
          ? `Renter cancelled before handover. Escrow payment of ₹${(refundedPaise / 100).toLocaleString()} refunded.`
          : input.rejectionReason || "Renter cancelled the booking."
      );
      return updated;
    }

    return booking;
  }

  // ─────────────────────────────────────────────────────────────────────
  // RAZORPAY PAYMENT — CREATE ORDER
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Step 1 of payment: creates (or re-uses) the Razorpay order for this booking
   * and binds its id to the booking so only a payment for THIS order can fund it.
   */
  static async createPaymentOrder(bookingId: string, userId: string) {
    const { booking, isSeeker } = await this.loadForParty(bookingId, userId);
    if (!isSeeker) throw forbidden("Only the renter can initiate payment");

    if (booking.bookingStatus !== "BOOKING_ACCEPTED") {
      throw conflict("Booking must be accepted by the owner before payment", "INVALID_STATE");
    }
    if (booking.financialStatus !== "PENDING_PAYMENT") {
      throw conflict("Escrow has already been funded for this booking", "ALREADY_FUNDED");
    }
    if (booking.totalAmountPaise < MIN_ORDER_PAISE) {
      throw unprocessable("The booking total must be at least ₹1", "AMOUNT_TOO_LOW");
    }

    let orderDetails: { orderId: string; amount: number; currency: string; keyId: string };
    if (booking.razorpayOrderId) {
      // The amount can't change after acceptance, so the existing order is still valid
      orderDetails = {
        orderId: booking.razorpayOrderId,
        amount: booking.totalAmountPaise,
        currency: "INR",
        keyId: env.RAZORPAY_KEY_ID ?? "",
      };
    } else {
      orderDetails = await RazorpayService.createOrder(booking.totalAmountPaise, bookingId);
      const bound = await prisma.bookingRequest.updateMany({
        where: { id: bookingId, razorpayOrderId: null, financialStatus: "PENDING_PAYMENT" },
        data: { razorpayOrderId: orderDetails.orderId },
      });
      if (bound.count !== 1) throw stateChanged();
    }

    return {
      ...orderDetails,
      bookingId,
      totalAmountPaise: booking.totalAmountPaise,
      rentAmountPaise:  booking.rentAmountPaise,
      securityDepositPaise: booking.securityDepositPaise,
      transportFeePaise: booking.transportFeePaise,
    };
  }

  /**
   * Marks escrow funded after the payment has been independently confirmed with
   * Razorpay. Shared by the browser verify call and the webhook; idempotent.
   */
  private static async fundEscrow(bookingId: string, payment: RazorpayPaymentSummary) {
    if (!payment.order_id) return null;
    return prisma.$transaction(async (tx) => {
      const ok = await claimTransition(
        tx,
        bookingId,
        {
          bookingStatus: "BOOKING_ACCEPTED",
          financialStatus: "PENDING_PAYMENT",
          razorpayOrderId: payment.order_id,
        },
        { financialStatus: "FUNDS_HELD", razorpayPaymentId: payment.id }
      );
      if (!ok) return null;

      await tx.paymentTransaction.create({
        data: {
          bookingId,
          type: "ESCROW_DEPOSIT",
          amountPaise: payment.amount,
          status: "COMPLETED",
          providerReference: payment.id, // UNIQUE — a payment id can fund only one booking
        },
      });
      return tx.bookingRequest.findUniqueOrThrow({ where: { id: bookingId } });
    });
  }

  /** Confirms with Razorpay that the payment belongs to the booking's order and is captured for the full amount. */
  private static async confirmPayment(
    booking: { id: string; razorpayOrderId: string | null; totalAmountPaise: number },
    razorpayPaymentId: string
  ): Promise<RazorpayPaymentSummary> {
    let payment = await RazorpayService.fetchPayment(razorpayPaymentId);
    if (payment.order_id !== booking.razorpayOrderId || payment.currency !== "INR" || payment.amount !== booking.totalAmountPaise) {
      throw badRequest("Payment does not match this booking", "PAYMENT_MISMATCH");
    }
    if (payment.status === "authorized") {
      payment = await RazorpayService.capturePayment(payment.id, booking.totalAmountPaise);
    }
    if (payment.status !== "captured") {
      throw badRequest("Payment has not been completed", "PAYMENT_NOT_CAPTURED");
    }
    return payment;
  }

  // ─────────────────────────────────────────────────────────────────────
  // RAZORPAY PAYMENT — VERIFY & FUND ESCROW
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Step 2 of payment: the checkout signature must be valid AND be for this
   * booking's order, and Razorpay must confirm the payment was captured for the
   * full booking amount. Only then is escrow marked funded.
   */
  static async verifyAndFundEscrow(
    bookingId: string,
    userId: string,
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string
  ) {
    const { booking, business, isSeeker } = await this.loadForParty(bookingId, userId);
    if (!isSeeker) throw forbidden("Only the renter can verify payment");

    if (booking.bookingStatus !== "BOOKING_ACCEPTED") {
      throw conflict("Booking must be in BOOKING_ACCEPTED status to verify payment", "INVALID_STATE");
    }
    if (booking.financialStatus !== "PENDING_PAYMENT") {
      // Idempotent success if this exact payment already funded it (e.g. webhook got there first)
      if (booking.razorpayPaymentId === razorpayPaymentId) return booking;
      throw conflict("Escrow has already been funded for this booking", "ALREADY_FUNDED");
    }
    if (!booking.razorpayOrderId || booking.razorpayOrderId !== razorpayOrderId) {
      throw badRequest("Payment does not belong to this booking", "ORDER_MISMATCH");
    }
    if (!RazorpayService.verifySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature)) {
      throw badRequest("Payment verification failed: invalid signature", "INVALID_SIGNATURE");
    }

    const payment = await this.confirmPayment(booking, razorpayPaymentId);
    const updated = await this.fundEscrow(bookingId, payment);
    if (!updated) {
      const fresh = await prisma.bookingRequest.findUnique({ where: { id: bookingId } });
      if (fresh?.razorpayPaymentId === razorpayPaymentId) return fresh;
      throw conflict("Escrow has already been funded for this booking", "ALREADY_FUNDED");
    }

    await this.recordTimelineEvent(
      bookingId,
      "ESCROW_FUNDED",
      business.id,
      "RENTER",
      "Escrow Funded via Razorpay",
      `₹${(payment.amount / 100).toLocaleString()} (Rent: ₹${(booking.rentAmountPaise / 100).toLocaleString()} + Deposit: ₹${(booking.securityDepositPaise / 100).toLocaleString()}${booking.transportFeePaise > 0 ? ` + Transport: ₹${(booking.transportFeePaise / 100).toLocaleString()}` : ""}) safely held in platform escrow. Razorpay Payment ID: ${payment.id}`,
      { razorpayOrderId, razorpayPaymentId: payment.id }
    );

    return updated;
  }

  /**
   * Server-to-server confirmation from the Razorpay webhook (payment.captured /
   * order.paid). Funds the booking even if the renter closed the browser before
   * the verify call. Returns true when this call funded the booking.
   */
  static async fundEscrowFromWebhook(razorpayOrderId: string, razorpayPaymentId: string): Promise<boolean> {
    const booking = await prisma.bookingRequest.findUnique({ where: { razorpayOrderId } });
    if (!booking) return false;
    if (booking.razorpayPaymentId === razorpayPaymentId) return false; // already funded by this payment
    if (booking.bookingStatus !== "BOOKING_ACCEPTED" || booking.financialStatus !== "PENDING_PAYMENT") return false;

    const payment = await this.confirmPayment(booking, razorpayPaymentId);
    const updated = await this.fundEscrow(booking.id, payment);
    if (!updated) return false;

    await this.recordTimelineEvent(
      booking.id,
      "ESCROW_FUNDED",
      null,
      "SYSTEM",
      "Escrow Funded via Razorpay",
      `₹${(payment.amount / 100).toLocaleString()} confirmed by Razorpay and held in platform escrow. Razorpay Payment ID: ${payment.id}`,
      { razorpayOrderId, razorpayPaymentId: payment.id, source: "webhook" }
    );
    return true;
  }

  // ─────────────────────────────────────────────────────────────────────
  // HANDOVER — Owner marks resource handed over
  // ─────────────────────────────────────────────────────────────────────

  static async markHandover(bookingId: string, userId: string) {
    const { booking, business, isProvider } = await this.loadForParty(bookingId, userId);
    if (!isProvider) throw forbidden("Only the resource owner can mark handover");

    if (booking.bookingStatus !== "BOOKING_ACCEPTED") {
      throw conflict("Booking must be in BOOKING_ACCEPTED status before handover", "INVALID_STATE");
    }
    if (booking.financialStatus !== "FUNDS_HELD") {
      throw conflict("Escrow must be funded before the resource can be handed over", "NOT_FUNDED");
    }

    const now      = new Date();
    const deadline = new Date(now.getTime() + 60 * 60 * 1000); // +1 hour

    const updated = await prisma.$transaction(async (tx) => {
      const ok = await claimTransition(
        tx,
        bookingId,
        { bookingStatus: "BOOKING_ACCEPTED", financialStatus: "FUNDS_HELD" },
        { handoverInitiatedAt: now, renterInspectionDeadline: deadline, bookingStatus: "HANDOVER_INSPECTION", status: "active" }
      );
      if (!ok) throw stateChanged();
      return tx.bookingRequest.findUniqueOrThrow({ where: { id: bookingId } });
    });

    await this.recordTimelineEvent(
      bookingId,
      "HANDOVER_MARKED",
      business.id,
      "OWNER",
      "Resource Handed Over (Inspection Window Started)",
      `Physical transfer initiated. Renter has 1 hour (until ${deadline.toLocaleTimeString()}) to inspect condition and accept or report critical discrepancies.`
    );

    return updated;
  }

  // ─────────────────────────────────────────────────────────────────────
  // RENTER RECEIVING INSPECTION
  // ─────────────────────────────────────────────────────────────────────

  static async renterReceivingInspection(
    bookingId: string,
    userId: string,
    input: RenterReceivingInspectionInput
  ) {
    const { booking, business, isSeeker } = await this.loadForParty(bookingId, userId);
    if (!isSeeker) throw forbidden("Only the renter can perform receiving inspection");

    if (booking.bookingStatus !== "HANDOVER_INSPECTION") {
      throw conflict("Booking is not in HANDOVER_INSPECTION status", "INVALID_STATE");
    }

    const now = new Date();
    if (booking.renterInspectionDeadline && now > booking.renterInspectionDeadline) {
      throw conflict(
        "Renter inspection window has expired. The booking was auto-accepted by the system.",
        "DEADLINE_PASSED"
      );
    }

    const media = await resolveOwnedMedia(userId, input.evidenceUrls ?? [], { field: "evidence" });
    const inWindow = { bookingStatus: "HANDOVER_INSPECTION", renterInspectionDeadline: { gte: now } };

    if (input.status === "ACCEPTED") {
      const updated = await prisma.$transaction(async (tx) => {
        const ok = await claimTransition(tx, bookingId, { ...inWindow, financialStatus: "FUNDS_HELD" }, {
          bookingStatus:   "ACTIVE",
          financialStatus: "RENT_RELEASED",
          status:          "active",
        });
        if (!ok) throw stateChanged();

        const inspection = await tx.inspection.create({
          data: {
            bookingId,
            type: "RECEIVING",
            performedById: business.id,
            status: "ACCEPTED",
            quantity: booking.quantity,
            notes: input.notes || "Condition accepted by renter.",
          },
        });

        for (const m of media) {
          await tx.evidence.create({
            data: {
              bookingId,
              inspectionId: inspection.id,
              uploadedById: business.id,
              stage: "RECEIVING",
              type: m.type,
              fileUrl: m.fileUrl,
              fileHash: m.fileHash,
            },
          });
        }

        await tx.paymentTransaction.create({
          data: {
            bookingId,
            type: "RENT_PAYOUT",
            amountPaise: booking.rentAmountPaise + booking.transportFeePaise, // transport fee is paid out with rent
            status: "COMPLETED",
            providerReference: ledgerRef.rentPayout(bookingId),
          },
        });

        return tx.bookingRequest.findUniqueOrThrow({ where: { id: bookingId } });
      });

      await this.recordTimelineEvent(
        bookingId, "RECEIVING_ACCEPTED", business.id, "RENTER",
        "Resource Accepted by Renter",
        `Renter confirmed physical receipt and acceptable condition. Rent (₹${(booking.rentAmountPaise / 100).toLocaleString()})${booking.transportFeePaise > 0 ? ` and transport fee (₹${(booking.transportFeePaise / 100).toLocaleString()})` : ""} disbursed to owner; Security Deposit (₹${(booking.securityDepositPaise / 100).toLocaleString()}) remains safely held in escrow.`
      );

      return updated;

    } else {
      // REPORTED_ISSUE → DISPUTED
      const updated = await prisma.$transaction(async (tx) => {
        const ok = await claimTransition(tx, bookingId, inWindow, { bookingStatus: "DISPUTED", status: "disputed" });
        if (!ok) throw stateChanged();

        const inspection = await tx.inspection.create({
          data: {
            bookingId,
            type: "RECEIVING",
            performedById: business.id,
            status: "REPORTED_ISSUE",
            quantity: booking.quantity,
            notes: input.issueDescription || input.notes || "Defect reported during handover.",
          },
        });

        for (const m of media) {
          await tx.evidence.create({
            data: {
              bookingId,
              inspectionId: inspection.id,
              uploadedById: business.id,
              stage: "RECEIVING",
              type: m.type,
              fileUrl: m.fileUrl,
              fileHash: m.fileHash,
              notes: input.issueDescription,
            },
          });
        }

        const claim = await tx.damageClaim.create({
          data: {
            bookingId,
            claimantId: business.id,
            claimType: "DAMAGE",
            description: input.issueDescription || "Disclosed condition mismatch during receiving inspection",
            claimedAmountPaise: booking.totalAmountPaise,
            status: "DISPUTED",
          },
        });

        await tx.dispute.create({
          data: {
            bookingId,
            damageClaimId: claim.id,
            status: "OPEN",
            renterReason: "PRE_EXISTING_DAMAGE",
            renterResponse: input.issueDescription,
          },
        });

        return tx.bookingRequest.findUniqueOrThrow({ where: { id: bookingId } });
      });

      await this.recordTimelineEvent(
        bookingId, "RECEIVING_ISSUE", business.id, "RENTER",
        "Critical Handover Issue Reported",
        `Renter reported severe discrepancy or defects during receiving inspection: "${input.issueDescription}". Booking entered dispute; platform escrow frozen.`
      );

      return updated;
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // RETURN — Renter initiates return
  // ─────────────────────────────────────────────────────────────────────

  static async initiateReturn(
    bookingId: string,
    userId: string,
    input: ReturnInitiationInput
  ) {
    const { booking, business, isSeeker } = await this.loadForParty(bookingId, userId);
    if (!isSeeker) throw forbidden("Only the renter can mark resource returned");

    if (booking.bookingStatus !== "ACTIVE") {
      throw conflict("Booking must be in ACTIVE status to initiate return", "INVALID_STATE");
    }

    const media = await resolveOwnedMedia(userId, input.returnEvidenceUrls ?? [], { field: "return evidence" });
    const now = new Date();
    const isEarlyReturn = now < booking.endDate;

    const updated = await prisma.$transaction(async (tx) => {
      const ok = await claimTransition(tx, bookingId, { bookingStatus: "ACTIVE" }, {
        returnInitiatedAt: now,
        bookingStatus: "RETURN_INITIATED",
        status: "return_initiated",
      });
      if (!ok) throw stateChanged();

      const inspection = await tx.inspection.create({
        data: {
          bookingId,
          type: "RETURN",
          performedById: business.id,
          status: "ACCEPTED",
          quantity: booking.quantity,
          notes: input.notes || "Return evidence submitted by renter.",
        },
      });

      for (const m of media) {
        await tx.evidence.create({
          data: {
            bookingId,
            inspectionId: inspection.id,
            uploadedById: business.id,
            stage: "RETURN",
            type: m.type,
            fileUrl: m.fileUrl,
            fileHash: m.fileHash,
          },
        });
      }

      return tx.bookingRequest.findUniqueOrThrow({ where: { id: bookingId } });
    });

    await this.recordTimelineEvent(
      bookingId, "RETURN_INITIATED", business.id, "RENTER",
      isEarlyReturn ? "Early Return Initiated" : "Resource Return Initiated",
      isEarlyReturn
        ? `Renter marked early return (before agreed end date ${booking.endDate.toLocaleDateString()}). Evidence uploaded. Awaiting owner confirmation.`
        : "Renter marked resources returned and uploaded return condition evidence. Awaiting owner confirmation of physical receipt."
    );

    return updated;
  }

  // ─────────────────────────────────────────────────────────────────────
  // OWNER CONFIRMS RECEIPT (Fake Return Protection)
  // ─────────────────────────────────────────────────────────────────────

  static async ownerConfirmReceipt(
    bookingId: string,
    userId: string,
    input: OwnerReceiptInput
  ) {
    const { booking, business, isProvider } = await this.loadForParty(bookingId, userId);
    if (!isProvider) throw forbidden("Only the resource owner can confirm return receipt");

    if (booking.bookingStatus !== "RETURN_INITIATED") {
      throw conflict("Return must be initiated by the renter before owner can confirm receipt", "INVALID_STATE");
    }

    const now = new Date();

    if (input.received) {
      const deadline = new Date(now.getTime() + 2 * 60 * 60 * 1000); // +2 hours
      const updated = await prisma.$transaction(async (tx) => {
        const ok = await claimTransition(tx, bookingId, { bookingStatus: "RETURN_INITIATED" }, {
          ownerReceivedAt:         now,
          ownerInspectionDeadline: deadline,
          bookingStatus:           "OWNER_INSPECTION",
          status:                  "owner_inspection",
        });
        if (!ok) throw stateChanged();
        return tx.bookingRequest.findUniqueOrThrow({ where: { id: bookingId } });
      });

      await this.recordTimelineEvent(
        bookingId, "OWNER_RECEIPT_CONFIRMED", business.id, "OWNER",
        "Physical Receipt Confirmed (2-Hour Window Started)",
        `Owner confirmed physical receipt of returned items. 2-hour inspection window active until ${deadline.toLocaleTimeString()}. If no damage is reported, the security deposit of ₹${(booking.securityDepositPaise / 100).toLocaleString()} will be automatically refunded.`
      );

      return updated;

    } else {
      // Fake return — goes to DISPUTED so admin can resolve it uniformly
      const updated = await prisma.$transaction(async (tx) => {
        const ok = await claimTransition(tx, bookingId, { bookingStatus: "RETURN_INITIATED" }, {
          bookingStatus: "DISPUTED",
          status: "disputed",
          nonReturnReportedAt: now,
        });
        if (!ok) throw stateChanged();

        const claim = await tx.damageClaim.create({
          data: {
            bookingId,
            claimantId: business.id,
            claimType: "RETURN_NOT_RECEIVED",
            description: input.notes || "Owner reported that physical resource was not received.",
            claimedAmountPaise: booking.securityDepositPaise,
            status: "DISPUTED",
          },
        });

        await tx.dispute.create({
          data: {
            bookingId,
            damageClaimId: claim.id,
            status: "OPEN",
          },
        });

        return tx.bookingRequest.findUniqueOrThrow({ where: { id: bookingId } });
      });

      await this.recordTimelineEvent(
        bookingId, "RETURN_NOT_RECEIVED", business.id, "OWNER",
        "Return Not Received (Dispute Filed)",
        "Owner reported resources were NOT received despite renter's return claim. Booking entered DISPUTED status and sent to Customer Care."
      );

      return updated;
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // OWNER ACCEPTS RETURN — Everything OK → deposit refunded, completed
  // ─────────────────────────────────────────────────────────────────────

  static async ownerAcceptReturn(
    bookingId: string,
    userId: string,
    _notes?: string
  ) {
    const { booking, business, isProvider } = await this.loadForParty(bookingId, userId);
    if (!isProvider) throw forbidden("Only the owner can accept return condition");

    if (booking.bookingStatus !== "OWNER_INSPECTION") {
      throw conflict("Return condition can only be accepted during the OWNER_INSPECTION window", "INVALID_STATE");
    }

    const now = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const ok = await claimTransition(tx, bookingId, { bookingStatus: "OWNER_INSPECTION" }, {
        bookingStatus:   "COMPLETED",
        financialStatus: "DEPOSIT_REFUNDED",
        completedAt:     now,
        status:          "completed",
      });
      if (!ok) throw stateChanged();

      await tx.paymentTransaction.create({
        data: {
          bookingId,
          type: "DEPOSIT_REFUND",
          amountPaise: booking.securityDepositPaise,
          status: "COMPLETED",
          providerReference: ledgerRef.depositRefund(bookingId),
        },
      });

      return tx.bookingRequest.findUniqueOrThrow({ where: { id: bookingId } });
    });

    await this.recordTimelineEvent(
      bookingId, "OWNER_RETURN_ACCEPTED", business.id, "OWNER",
      "Return Accepted & Deposit Released",
      `Owner confirmed pristine condition. Security deposit (₹${(booking.securityDepositPaise / 100).toLocaleString()}) refunded to renter. Rental transaction complete.`
    );

    return updated;
  }

  // ─────────────────────────────────────────────────────────────────────
  // OWNER SUBMITS DAMAGE CLAIM
  // ─────────────────────────────────────────────────────────────────────

  static async ownerSubmitDamageClaim(
    bookingId: string,
    userId: string,
    input: OwnerDamageClaimInput
  ) {
    const { booking, business, isProvider } = await this.loadForParty(bookingId, userId);
    if (!isProvider) throw forbidden("Only the resource owner can submit damage claims");

    if (booking.bookingStatus !== "OWNER_INSPECTION") {
      throw conflict("Damage claims can only be submitted during the OWNER_INSPECTION window", "INVALID_STATE");
    }

    const now = new Date();
    if (booking.ownerInspectionDeadline && now > booking.ownerInspectionDeadline) {
      throw conflict("Owner inspection window has expired. No damage claim can be submitted.", "DEADLINE_PASSED");
    }

    if (input.claimedAmountPaise > booking.securityDepositPaise) {
      throw unprocessable(
        `Claimed amount (₹${(input.claimedAmountPaise / 100).toLocaleString()}) cannot exceed the security deposit (₹${(booking.securityDepositPaise / 100).toLocaleString()})`,
        "CLAIM_EXCEEDS_DEPOSIT"
      );
    }

    const media = await resolveOwnedMedia(userId, input.evidenceUrls, { field: "evidence" });

    const updated = await prisma.$transaction(async (tx) => {
      const ok = await claimTransition(
        tx,
        bookingId,
        { bookingStatus: "OWNER_INSPECTION", ownerInspectionDeadline: { gte: now } },
        { bookingStatus: "DISPUTED", status: "disputed" }
      );
      if (!ok) throw stateChanged();

      const claim = await tx.damageClaim.create({
        data: {
          bookingId,
          claimantId:        business.id,
          claimType:         input.claimType,
          description:       input.description,
          claimedAmountPaise: input.claimedAmountPaise,
          status: "PENDING",
        },
      });

      for (const m of media) {
        await tx.evidence.create({
          data: {
            bookingId,
            uploadedById: business.id,
            stage: "DAMAGE_CLAIM",
            type: m.type,
            fileUrl: m.fileUrl,
            fileHash: m.fileHash,
            notes: input.description,
          },
        });
      }

      await tx.dispute.create({
        data: {
          bookingId,
          damageClaimId: claim.id,
          status: "OPEN",
        },
      });

      return tx.bookingRequest.findUniqueOrThrow({ where: { id: bookingId } });
    });

    await this.recordTimelineEvent(
      bookingId, "DAMAGE_CLAIMED", business.id, "OWNER",
      "Owner Filed Damage Claim",
      `Owner filed a claim for ₹${(input.claimedAmountPaise / 100).toLocaleString()} (${input.claimType}): "${input.description}". Deposit held in dispute.`
    );

    return updated;
  }

  // ─────────────────────────────────────────────────────────────────────
  // RENTER RESPONDS TO DAMAGE CLAIM
  // ─────────────────────────────────────────────────────────────────────

  static async renterRespondClaim(
    bookingId: string,
    userId: string,
    input: RenterClaimResponseInput
  ) {
    const { booking, business, isSeeker } = await this.loadForParty(bookingId, userId);
    if (!isSeeker) throw forbidden("Only the renter can respond to damage claims");

    if (booking.bookingStatus !== "DISPUTED") {
      throw conflict("Booking must be in DISPUTED status to respond to a claim", "INVALID_STATE");
    }

    const [claim, dispute] = await Promise.all([
      prisma.damageClaim.findFirst({ where: { bookingId }, orderBy: { createdAt: "desc" } }),
      prisma.dispute.findFirst({ where: { bookingId, status: "OPEN" }, orderBy: { createdAt: "desc" } }),
    ]);

    if (!claim)   throw notFound("No pending damage claim found for this booking");
    if (!dispute) throw notFound("No open dispute found for this booking");
    // The renter answers the OWNER's claim; their own handover report goes to Customer Care
    if (claim.claimantId !== booking.providerId) {
      throw conflict("This dispute was raised by you and is waiting for Customer Care", "NOT_OWNER_CLAIM");
    }

    const media = await resolveOwnedMedia(userId, input.rebuttalEvidenceUrls ?? [], { field: "rebuttal evidence" });

    if (input.action === "ACCEPT") {
      // Renter accepts — settle
      const payoutToOwner  = Math.min(claim.claimedAmountPaise, booking.securityDepositPaise);
      const refundToRenter = Math.max(0, booking.securityDepositPaise - payoutToOwner);
      const now = new Date();

      const updated = await prisma.$transaction(async (tx) => {
        const ok = await claimTransition(tx, bookingId, { bookingStatus: "DISPUTED" }, {
          bookingStatus:   "COMPLETED",
          financialStatus: "PARTIAL_SETTLEMENT",
          completedAt:     now,
          status:          "completed",
        });
        if (!ok) throw stateChanged();

        await tx.dispute.update({
          where: { id: dispute.id },
          data: {
            status: "RESOLVED",
            renterResponse: "Accepted by renter",
            adminDecision: "PAY_OWNER",
            resolutionAmountPaise: payoutToOwner,
            resolutionNotes: "Renter accepted claim without dispute.",
            resolvedAt: now,
          },
        });

        await tx.damageClaim.update({
          where: { id: claim.id },
          data: { status: "RESOLVED", resolvedAt: now },
        });

        if (payoutToOwner > 0) {
          await tx.paymentTransaction.create({
            data: {
              bookingId,
              type: "DAMAGE_PAYOUT",
              amountPaise: payoutToOwner,
              status: "COMPLETED",
              providerReference: ledgerRef.damagePayout(bookingId),
            },
          });
        }

        if (refundToRenter > 0) {
          await tx.paymentTransaction.create({
            data: {
              bookingId,
              type: "DEPOSIT_REFUND",
              amountPaise: refundToRenter,
              status: "COMPLETED",
              providerReference: ledgerRef.depositRefund(bookingId),
            },
          });
        }

        return tx.bookingRequest.findUniqueOrThrow({ where: { id: bookingId } });
      });

      await this.recordTimelineEvent(
        bookingId, "CLAIM_ACCEPTED", business.id, "RENTER",
        "Damage Claim Accepted by Renter",
        `Renter agreed to ₹${(payoutToOwner / 100).toLocaleString()} deduction from deposit. Remaining ₹${(refundToRenter / 100).toLocaleString()} refunded.`
      );

      return updated;

    } else {
      // DISPUTE claim — send to admin
      const updated = await prisma.$transaction(async (tx) => {
        await tx.dispute.update({
          where: { id: dispute.id },
          data: {
            renterResponse: input.rebuttalNotes || null,
            renterReason:   input.reason || "NOT_CAUSED_BY_RENTER",
          },
        });

        for (const m of media) {
          await tx.evidence.create({
            data: {
              bookingId,
              uploadedById: business.id,
              stage: "RENTER_REBUTTAL",
              type: m.type,
              fileUrl: m.fileUrl,
              fileHash: m.fileHash,
              notes: input.rebuttalNotes,
            },
          });
        }

        return tx.bookingRequest.findUnique({ where: { id: bookingId } });
      });

      await this.recordTimelineEvent(
        bookingId, "CLAIM_DISPUTED", business.id, "RENTER",
        "Renter Disputed Damage Claim",
        `Renter contested claim (${input.reason || "Disputed"}): "${input.rebuttalNotes || "Condition disputed"}". Sent to Customer Care Panel for review.`
      );

      return updated;
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // ADMIN RESOLVES DISPUTE (called only from admin.routes behind authenticateAdmin)
  // ─────────────────────────────────────────────────────────────────────

  static async adminResolveDispute(
    bookingId: string,
    adminId: string,
    input: AdminResolveDisputeInput
  ) {
    // Defence in depth: the caller must be a real admin record
    const admin = await prisma.admin.findUnique({ where: { id: adminId } });
    if (!admin) {
      throw forbidden("Admin access required to resolve disputes");
    }

    const booking = await prisma.bookingRequest.findUnique({ where: { id: bookingId } });
    if (!booking) throw notFound("Booking not found");

    if (booking.bookingStatus !== "DISPUTED") {
      throw conflict("Only DISPUTED bookings can be resolved by admin", "INVALID_STATE");
    }
    if (input.decision === "PARTIAL_SETTLEMENT" && input.resolutionAmountPaise === undefined) {
      throw unprocessable("resolutionAmountPaise is required for a partial settlement", "AMOUNT_REQUIRED");
    }

    const [dispute, claim] = await Promise.all([
      prisma.dispute.findFirst({ where: { bookingId }, orderBy: { createdAt: "desc" } }),
      prisma.damageClaim.findFirst({ where: { bookingId }, orderBy: { createdAt: "desc" } }),
    ]);

    const now = new Date();
    const deposit = booking.securityDepositPaise;

    let financialStatus = "PARTIAL_SETTLEMENT";
    let resolutionAmount = input.resolutionAmountPaise ?? 0;
    const ledger: { type: string; amountPaise: number; providerReference: string }[] = [];

    if (input.decision === "REFUND_RENTER" || input.decision === "REJECT_CLAIM") {
      financialStatus  = "DEPOSIT_REFUNDED";
      resolutionAmount = deposit;
      ledger.push({ type: "DEPOSIT_REFUND", amountPaise: deposit, providerReference: ledgerRef.depositRefund(bookingId) });
    } else if (input.decision === "PAY_OWNER") {
      financialStatus  = "DEPOSIT_TO_OWNER";
      resolutionAmount = deposit;
      ledger.push({ type: "DAMAGE_PAYOUT", amountPaise: deposit, providerReference: ledgerRef.damagePayout(bookingId) });
    } else {
      const ownerShare  = Math.min(resolutionAmount, deposit);
      const renterShare = Math.max(0, deposit - ownerShare);
      resolutionAmount = ownerShare;
      if (ownerShare > 0)  ledger.push({ type: "DAMAGE_PAYOUT", amountPaise: ownerShare, providerReference: ledgerRef.damagePayout(bookingId) });
      if (renterShare > 0) ledger.push({ type: "DEPOSIT_REFUND", amountPaise: renterShare, providerReference: ledgerRef.depositRefund(bookingId) });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const ok = await claimTransition(tx, bookingId, { bookingStatus: "DISPUTED" }, {
        bookingStatus:   "COMPLETED",
        financialStatus,
        completedAt:     now,
        status:          "completed",
      });
      if (!ok) throw stateChanged();

      for (const entry of ledger) {
        await tx.paymentTransaction.create({ data: { bookingId, status: "COMPLETED", ...entry } });
      }

      if (dispute) {
        await tx.dispute.update({
          where: { id: dispute.id },
          data: {
            status: "RESOLVED",
            adminDecision: input.decision,
            resolutionAmountPaise: resolutionAmount,
            resolutionNotes: input.resolutionNotes,
            resolvedById: adminId,
            resolvedAt: now,
          },
        });
      }

      if (claim) {
        await tx.damageClaim.update({
          where: { id: claim.id },
          data: {
            status: input.decision === "REJECT_CLAIM" ? "REJECTED" : "RESOLVED",
            resolvedAt: now,
          },
        });
      }

      return tx.bookingRequest.findUniqueOrThrow({ where: { id: bookingId } });
    });

    await this.recordTimelineEvent(
      bookingId, "DISPUTE_RESOLVED", adminId, "ADMIN",
      `Dispute Resolved by Customer Care (${input.decision})`,
      `${input.resolutionNotes}. Financial settlement executed.`
    );

    return updated;
  }

  // ─────────────────────────────────────────────────────────────────────
  // REPORT NON-RETURN
  // ─────────────────────────────────────────────────────────────────────

  static async reportNonReturn(bookingId: string, userId: string) {
    const { booking, business, isProvider } = await this.loadForParty(bookingId, userId);
    if (!isProvider) throw forbidden("Only the owner can report non-return");

    if (booking.bookingStatus !== "ACTIVE") {
      throw conflict("Non-return can only be reported when the booking is ACTIVE", "INVALID_STATE");
    }

    if (new Date() < booking.endDate) {
      throw conflict("Cannot report non-return before the agreed rental end date", "TOO_EARLY");
    }

    const now = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const ok = await claimTransition(tx, bookingId, { bookingStatus: "ACTIVE" }, {
        bookingStatus:       "DISPUTED",
        nonReturnReportedAt: now,
        status:              "disputed",
      });
      if (!ok) throw stateChanged();

      const claim = await tx.damageClaim.create({
        data: {
          bookingId,
          claimantId: business.id,
          claimType: "MISSING_ITEM",
          description: "Owner reported the resource was not returned after the rental period.",
          claimedAmountPaise: booking.securityDepositPaise,
          status: "DISPUTED",
        },
      });

      await tx.dispute.create({
        data: {
          bookingId,
          damageClaimId: claim.id,
          status: "OPEN",
        },
      });

      return tx.bookingRequest.findUniqueOrThrow({ where: { id: bookingId } });
    });

    await this.recordTimelineEvent(
      bookingId, "NON_RETURN_REPORTED", business.id, "OWNER",
      "Resource Non-Return Reported",
      "Owner reported that the resource was not returned after the agreed rental period. Dispute opened; deposit held; sent to Customer Care."
    );

    return updated;
  }
}
