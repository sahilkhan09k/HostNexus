import type { BookingRequest, Prisma } from "@prisma/client";
import { prisma } from "../config/database.js";
import { BusinessService } from "./business.service.js";
import { RazorpayService } from "./razorpay.service.js";
import { PaymentService } from "./payment.service.js";
import { assertCapacity, lockResource } from "./capacity.js";
import { resolveOwnedMedia } from "./evidence.js";
import { notifyBookingEvent, type BookingEvent } from "./notifications/booking-notifications.js";
import { describeBillablePeriod, PRICING_BASIS_UNIT, rentFor, toPricingBasis } from "./pricing.js";
import {
  RENTER_INSPECTION_MS,
  OWNER_INSPECTION_MS,
  OWNER_RECEIPT_WINDOW_MS,
  HANDOVER_ISSUE_RESPONSE_MS,
  RETURN_CLAIM_RESPONSE_MS,
  MAX_HANDOVER_CODE_ATTEMPTS,
  addMs,
  toCalendarDay,
  todayIst,
  inclusiveDays,
  istDayEnd,
  requestExpiresAt,
  paymentDeadlineFor,
  handoverOpensAt,
  handoverDeadlineFor,
  nonReturnEscalatesAt,
  generateHandoverCode,
  safeEqual,
} from "./booking-rules.js";
import { badRequest, conflict, forbidden, notFound, unprocessable, HttpError } from "../utils/http-error.js";
import { pageArgs, toPage, type Pagination } from "../utils/pagination.js";
import type {
  CreateBookingRequestInput,
  UpdateBookingStatusInput,
  BookingQuery,
  HandoverInput,
  RenterReceivingInspectionInput,
  OwnerHandoverResponseInput,
  ReturnInitiationInput,
  OwnerReceiptInput,
  OwnerDamageClaimInput,
  RenterClaimResponseInput,
  AdminResolveDisputeInput,
} from "../schemas/booking.schema.js";

type Tx = Prisma.TransactionClient;
type ActorRole = "OWNER" | "RENTER" | "ADMIN" | "SYSTEM";
type Notify = (event: BookingEvent) => void;
const noNotify: Notify = () => {};

// ── Limits ─────────────────────────────────────────────────────────────
export const MAX_BOOKING_DAYS = 365;
/** Razorpay's minimum order is ₹1 */
export const MIN_ORDER_PAISE = 100;
/** Money columns are Postgres INT — keep totals well clear of 2^31 */
export const MAX_ORDER_PAISE = 2_000_000_000;

/** Only these business fields are exposed to the other party of a booking */
const PARTY_SELECT = { select: { id: true, name: true, businessType: true, city: true, state: true } } as const;

/**
 * Store evidence for a custody step. Every file must be one the acting user
 * uploaded through /api/upload (checked in resolveOwnedMedia); the stored URL
 * and hash come from that upload record, never from the request.
 */
async function saveEvidence(
  tx: Tx,
  userId: string,
  urls: string[],
  field: string,
  base: { bookingId: string; uploadedById: string; stage: string; inspectionId?: string; notes?: string | null }
): Promise<number> {
  const media = await resolveOwnedMedia(userId, urls, { db: tx, field });
  for (const m of media) {
    await tx.evidence.create({ data: { ...base, type: m.type, fileUrl: m.fileUrl, fileHash: m.fileHash } });
  }
  return media.length;
}

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN")}`;

/** Row-lock a booking for the rest of the transaction and return its fresh state. */
async function lockBooking(tx: Tx, bookingId: string): Promise<BookingRequest> {
  await tx.$queryRaw`SELECT id FROM "booking_requests" WHERE id = ${bookingId} FOR UPDATE`;
  const booking = await tx.bookingRequest.findUnique({ where: { id: bookingId } });
  if (!booking) throw notFound("Booking not found");
  return booking;
}

/** The handover code is a secret for the renter; strip it for everyone else. */
function forViewer<T extends { seekerId: string }>(booking: T, viewerBusinessId?: string | null): T {
  if (viewerBusinessId && viewerBusinessId === booking.seekerId) return booking;
  const { handoverCode: _secret, ...rest } = booking as T & { handoverCode?: string | null };
  return rest as T;
}

async function requireBusiness(userId: string) {
  const business = await BusinessService.getBusinessByUserId(userId);
  if (!business) throw forbidden("You must have a business to manage bookings");
  return business;
}

/** 404 (not 403) for anyone who isn't the renter or the owner, so booking ids can't be probed. */
function requireParty(booking: { seekerId: string; providerId: string }, businessId: string) {
  if (booking.seekerId !== businessId && booking.providerId !== businessId) throw notFound("Booking not found");
}

function assertStatus(booking: BookingRequest, expected: string | string[], message: string) {
  const ok = Array.isArray(expected) ? expected.includes(booking.bookingStatus) : booking.bookingStatus === expected;
  if (!ok) throw conflict(message, "INVALID_BOOKING_STATE");
}

let deadlineRun: Promise<void> | null = null;

export class BookingService {
  // ─────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Record an audit timeline event. Inside a transaction (db given) it is part
   * of the same atomic write; otherwise it is best-effort.
   */
  static async recordTimelineEvent(
    bookingId: string,
    eventType: string,
    actorId: string | null,
    actorRole: ActorRole,
    title: string,
    description: string,
    metadata: Record<string, unknown> | null = null,
    db?: Tx
  ) {
    const data = {
      bookingId,
      eventType,
      actorId,
      actorRole,
      title,
      description,
      metadata: metadata ? (metadata as any) : undefined,
    };
    if (db) {
      await db.bookingTimelineEvent.create({ data });
      return;
    }
    try {
      await prisma.bookingTimelineEvent.create({ data });
    } catch (e) {
      console.error("Failed to record timeline event:", e);
    }
  }

  /**
   * Run a state transition with the booking row locked, then send any refunds
   * the transition queued. Every state change goes through here, so two
   * concurrent actions on one booking can never both succeed.
   */
  private static async inBookingTx<T>(
    bookingId: string,
    fn: (tx: Tx, booking: BookingRequest, notify: Notify) => Promise<T>
  ): Promise<T> {
    // Notifications are only sent once the transition has committed
    const events: BookingEvent[] = [];
    const result = await prisma.$transaction(
      async (tx) => {
        events.length = 0; // a retried transaction starts clean
        return fn(tx, await lockBooking(tx, bookingId), (e) => events.push(e));
      },
      { maxWait: 10_000, timeout: 20_000 }
    );
    await PaymentService.processRefunds(bookingId).catch((err) =>
      console.error(`[Payments] Refund processing for ${bookingId} failed:`, err)
    );
    for (const event of events) void notifyBookingEvent(bookingId, event);
    return result;
  }

  private static async closeNegotiation(tx: Tx, bookingId: string) {
    await tx.negotiationOffer.updateMany({
      where: { status: "PENDING", negotiation: { bookingId } },
      data: { status: "REJECTED" },
    });
    await tx.negotiation.updateMany({
      where: { bookingId, status: "OPEN" },
      data: { status: "CANCELLED" },
    });
  }

  /**
   * Cancel a booking before handover. Anything held in escrow goes back to the
   * renter in full.
   */
  private static async cancelBooking(
    tx: Tx,
    booking: BookingRequest,
    opts: {
      by: "RENTER" | "OWNER" | "SYSTEM";
      legacyStatus?: string;
      reason: string;
      eventType: string;
      title: string;
      actorId: string | null;
      actorRole: ActorRole;
      notify?: Notify;
      event?: (refundedPaise: number) => BookingEvent;
    }
  ) {
    let refundedPaise = 0;
    let financialStatus = booking.financialStatus === "PENDING_PAYMENT" ? "NO_PAYMENT" : booking.financialStatus;
    let refundNote = "";
    if (booking.financialStatus === "FUNDS_HELD") {
      const { heldPaise } = await PaymentService.ledger(tx, booking.id);
      await PaymentService.queueRefund(tx, booking.id, "FULL_REFUND", heldPaise);
      refundedPaise = heldPaise;
      financialStatus = "FULLY_REFUNDED";
      refundNote = ` Full payment of ${rupees(heldPaise)} is being refunded to the renter.`;
    }

    const updated = await tx.bookingRequest.update({
      where: { id: booking.id },
      data: {
        bookingStatus: "CANCELLED",
        financialStatus,
        status: opts.legacyStatus ?? "cancelled",
        cancelledAt: new Date(),
        cancelledBy: opts.by,
        rejectionReason: opts.reason,
        handoverCode: null,
      },
    });
    await this.closeNegotiation(tx, booking.id);
    await this.recordTimelineEvent(
      booking.id, opts.eventType, opts.actorId, opts.actorRole, opts.title,
      `${opts.reason}${refundNote}`, null, tx
    );
    if (opts.event) opts.notify?.(opts.event(refundedPaise));
    return updated;
  }

  /** Release rent + transport to the owner, less any part refunded to the renter. */
  private static async releaseRent(tx: Tx, booking: BookingRequest, refundToRenterPaise = 0) {
    const rentAndTransport = booking.rentAmountPaise + booking.transportFeePaise;
    const refund = Math.min(Math.max(0, refundToRenterPaise), rentAndTransport);
    await PaymentService.queueRefund(tx, booking.id, "RENT_REFUND", refund);
    await PaymentService.queuePayout(tx, booking.id, "RENT_PAYOUT", rentAndTransport - refund);
    return { ownerPaise: rentAndTransport - refund, refundPaise: refund };
  }

  /** Split the security deposit: `ownerShare` to the owner, the rest back to the renter. */
  private static async settleDeposit(tx: Tx, booking: BookingRequest, ownerShareRequested: number) {
    const deposit = booking.securityDepositPaise;
    const ownerShare = Math.min(Math.max(0, ownerShareRequested), deposit);
    await PaymentService.queuePayout(tx, booking.id, "DAMAGE_PAYOUT", ownerShare);
    await PaymentService.queueRefund(tx, booking.id, "DEPOSIT_REFUND", deposit - ownerShare);
    const financialStatus =
      ownerShare === 0 ? "DEPOSIT_REFUNDED" : ownerShare === deposit ? "DEPOSIT_TO_OWNER" : "PARTIAL_SETTLEMENT";
    return { ownerShare, renterShare: deposit - ownerShare, financialStatus };
  }

  private static async latestDispute(tx: Tx, bookingId: string) {
    return tx.dispute.findFirst({
      where: { bookingId },
      orderBy: { createdAt: "desc" },
      include: { damageClaim: true },
    });
  }

  // ─────────────────────────────────────────────────────────────────────
  // DEADLINES — run by the background worker only (reads never move money)
  // ─────────────────────────────────────────────────────────────────────

  /** Enforce every expired deadline. Concurrent callers share one run. */
  static processDeadlines(): Promise<void> {
    if (!deadlineRun) {
      deadlineRun = this.runDeadlineSweeps().finally(() => {
        deadlineRun = null;
      });
    }
    return deadlineRun;
  }

  /** Kept for the worker and older callers. */
  static processExpiredInspections(): Promise<void> {
    return this.processDeadlines();
  }

  private static async runDeadlineSweeps(): Promise<void> {
    const now = new Date();
    const ids = async (where: Prisma.BookingRequestWhereInput) =>
      (await prisma.bookingRequest.findMany({ where, select: { id: true } })).map((b) => b.id);
    const each = async (bookingIds: string[], fn: (id: string) => Promise<unknown>) => {
      for (const id of bookingIds) {
        try {
          await fn(id);
        } catch (err) {
          console.error(`[Deadlines] ${id}:`, err);
        }
      }
    };

    // 1. Requests nobody accepted before their start day ended
    await each(await ids({ bookingStatus: "BOOKING_REQUESTED", startDate: { lte: now } }), (id) =>
      this.inBookingTx(id, async (tx, b, notify) => {
        if (b.bookingStatus !== "BOOKING_REQUESTED" || requestExpiresAt(b.startDate) > now) return;
        await this.cancelBooking(tx, b, {
          by: "SYSTEM", legacyStatus: "expired", reason: "Request expired: the owner did not respond before the start date.",
          eventType: "REQUEST_EXPIRED", title: "Booking Request Expired", actorId: null, actorRole: "SYSTEM",
          notify, event: () => ({ kind: "EXPIRED", reason: "REQUEST" }),
        });
      })
    );

    // 2. Accepted but never paid
    await each(
      await ids({ bookingStatus: "BOOKING_ACCEPTED", financialStatus: "PENDING_PAYMENT", paymentDeadline: { lte: now } }),
      async (id) => {
        // Never cancel a booking whose payment went through but was not verified
        if (await this.reconcilePayment(id).catch(() => false)) return;
        await this.inBookingTx(id, async (tx, b, notify) => {
          if (b.bookingStatus !== "BOOKING_ACCEPTED" || b.financialStatus !== "PENDING_PAYMENT") return;
          await this.cancelBooking(tx, b, {
            by: "SYSTEM", legacyStatus: "expired", reason: "Payment deadline passed: the renter did not fund escrow in time. The units have been released.",
            eventType: "PAYMENT_EXPIRED", title: "Unpaid Booking Cancelled", actorId: null, actorRole: "SYSTEM",
            notify, event: () => ({ kind: "EXPIRED", reason: "PAYMENT" }),
          });
        });
      }
    );

    // 3. Paid, but the owner never handed over — owner no-show
    await each(
      await ids({ bookingStatus: "BOOKING_ACCEPTED", financialStatus: "FUNDS_HELD", handoverDeadline: { lte: now } }),
      (id) => this.inBookingTx(id, async (tx, b, notify) => {
        if (b.bookingStatus !== "BOOKING_ACCEPTED" || b.financialStatus !== "FUNDS_HELD") return;
        await this.cancelBooking(tx, b, {
          by: "OWNER", reason: "Owner no-show: the resource was not handed over by the deadline.",
          eventType: "OWNER_NO_SHOW", title: "Cancelled — Owner Did Not Hand Over", actorId: null, actorRole: "SYSTEM",
          notify, event: (refundedPaise) => ({ kind: "OWNER_NO_SHOW", refundedPaise }),
        });
      })
    );

    // 4. Renter inspection window expired without a report → auto-accept
    await each(
      await ids({ bookingStatus: "HANDOVER_INSPECTION", renterInspectionDeadline: { lte: now } }),
      (id) => this.inBookingTx(id, async (tx, b, notify) => {
        if (b.bookingStatus !== "HANDOVER_INSPECTION") return;
        const { ownerPaise } = await this.releaseRent(tx, b);
        await tx.bookingRequest.update({
          where: { id: b.id },
          data: { bookingStatus: "ACTIVE", financialStatus: "RENT_RELEASED", status: "active", receivedQuantity: b.quantity },
        });
        await this.recordTimelineEvent(
          b.id, "AUTO_TIMEOUT_RELEASE", null, "SYSTEM",
          "Renter Inspection Window Expired (Auto-Accepted)",
          `The 1-hour inspection window elapsed without a reported issue. ${rupees(ownerPaise)} (rent${b.transportFeePaise > 0 ? " + transport" : ""}) queued for payout to the owner; the deposit stays in escrow.`,
          null, tx
        );
        notify({ kind: "RENT_RELEASED", auto: true });
      })
    );

    // 5. Owner ignored a handover issue → renter refunded in full
    await each(
      (await prisma.dispute.findMany({
        where: { kind: "HANDOVER_ISSUE", status: "OPEN", responseDeadline: { lte: now }, booking: { bookingStatus: "DISPUTED" } },
        select: { bookingId: true },
      })).map((d) => d.bookingId),
      (id) => this.inBookingTx(id, async (tx, b, notify) => {
        const dispute = await this.latestDispute(tx, id);
        if (b.bookingStatus !== "DISPUTED" || dispute?.kind !== "HANDOVER_ISSUE" || dispute.status !== "OPEN") return;
        await this.resolveHandoverIssue(tx, b, dispute.id, "FULL_REFUND", 0,
          "The owner did not respond to the renter's handover issue within 24 hours.", null, "SYSTEM", notify);
      })
    );

    // 6. Nothing returned well after the last rental day → non-return dispute for admin
    await each(await ids({ bookingStatus: "ACTIVE", endDate: { lte: now } }), (id) =>
      this.inBookingTx(id, async (tx, b, notify) => {
        if (b.bookingStatus !== "ACTIVE" || nonReturnEscalatesAt(b.endDate) > now) return;
        await this.openNonReturnDispute(tx, b, null, "SYSTEM", notify);
      })
    );

    // 7. Owner never confirmed a return → receipt confirmed automatically
    await each(
      await ids({ bookingStatus: "RETURN_INITIATED", ownerReceiptDeadline: { lte: now } }),
      (id) => this.inBookingTx(id, async (tx, b, notify) => {
        if (b.bookingStatus !== "RETURN_INITIATED") return;
        const deadline = addMs(now, OWNER_INSPECTION_MS);
        await tx.bookingRequest.update({
          where: { id: b.id },
          data: {
            bookingStatus: "OWNER_INSPECTION",
            status: "owner_inspection",
            ownerReceivedAt: now,
            ownerReceivedQuantity: b.returnedQuantity ?? b.quantity,
            ownerInspectionDeadline: deadline,
          },
        });
        await this.recordTimelineEvent(
          b.id, "OWNER_RECEIPT_AUTO_CONFIRMED", null, "SYSTEM",
          "Return Receipt Auto-Confirmed",
          `The owner did not confirm receipt within 24 hours of the return, so receipt was confirmed automatically. The owner has 2 hours (until ${deadline.toISOString()}) to accept the return or file a claim.`,
          null, tx
        );
        notify({ kind: "RETURN_RECEIVED", deadline, auto: true });
      })
    );

    // 8. Owner inspection window expired without a claim → deposit refunded
    await each(
      await ids({ bookingStatus: "OWNER_INSPECTION", ownerInspectionDeadline: { lte: now } }),
      (id) => this.inBookingTx(id, async (tx, b, notify) => {
        if (b.bookingStatus !== "OWNER_INSPECTION") return;
        await this.settleDeposit(tx, b, 0);
        await tx.bookingRequest.update({
          where: { id: b.id },
          data: { bookingStatus: "COMPLETED", financialStatus: "DEPOSIT_REFUNDED", status: "completed", completedAt: now },
        });
        await this.recordTimelineEvent(
          b.id, "AUTO_TIMEOUT_RELEASE", null, "SYSTEM",
          "Owner Inspection Window Expired (Deposit Auto-Refunded)",
          `The 2-hour owner inspection window elapsed without a claim. The security deposit of ${rupees(b.securityDepositPaise)} is being refunded to the renter.`,
          null, tx
        );
        notify({ kind: "RETURN_ACCEPTED", auto: true });
      })
    );

    // 9. Renter ignored a return claim → claim accepted
    await each(
      (await prisma.dispute.findMany({
        where: { kind: "RETURN_CLAIM", status: "OPEN", responseDeadline: { lte: now }, booking: { bookingStatus: "DISPUTED" } },
        select: { bookingId: true },
      })).map((d) => d.bookingId),
      (id) => this.inBookingTx(id, async (tx, b, notify) => {
        const dispute = await this.latestDispute(tx, id);
        if (b.bookingStatus !== "DISPUTED" || dispute?.kind !== "RETURN_CLAIM" || dispute.status !== "OPEN") return;
        await this.settleReturnClaim(tx, b, dispute, dispute.damageClaim?.claimedAmountPaise ?? b.securityDepositPaise,
          "PAY_OWNER", "The renter did not respond to the claim within 48 hours; the claim was accepted.", null, "SYSTEM",
          notify, (payoutPaise, refundPaise) => ({ kind: "CLAIM_ACCEPTED", payoutPaise, refundPaise, auto: true }));
      })
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // CREATE BOOKING REQUEST
  // ─────────────────────────────────────────────────────────────────────

  static async createBookingRequest(userId: string, input: CreateBookingRequestInput) {
    const seekerBusiness = await requireBusiness(userId);

    const resource = await prisma.resource.findUnique({
      where: { id: input.resourceId },
      include: {
        business: { include: { owner: { select: { verificationStatus: true } } } },
        availabilityWindows: true,
      },
    });

    if (!resource || resource.deletedAt) throw notFound("Resource not found");
    if (!resource.isActive || resource.business.owner?.verificationStatus !== "VERIFIED") {
      throw unprocessable("This resource is not available for booking", "RESOURCE_INACTIVE");
    }
    if (resource.businessId === seekerBusiness.id) {
      throw unprocessable("You cannot book your own resource", "OWN_RESOURCE");
    }

    const startDate = toCalendarDay(input.startDate);
    const endDate   = toCalendarDay(input.endDate);

    if (endDate < startDate) throw unprocessable("End date cannot be before the start date", "INVALID_DATES");
    if (startDate < todayIst()) throw unprocessable("Start date cannot be in the past", "INVALID_DATES");

    const totalDays = inclusiveDays(startDate, endDate);
    if (totalDays > MAX_BOOKING_DAYS) {
      throw unprocessable(`Bookings can be at most ${MAX_BOOKING_DAYS} days long`, "INVALID_DATES");
    }

    if (input.quantity > resource.quantity) {
      throw unprocessable(`Requested quantity (${input.quantity}) exceeds the listed quantity (${resource.quantity})`, "QUANTITY_EXCEEDED");
    }

    // A window must cover every booked day (window dates are inclusive too)
    const windows = resource.availabilityWindows ?? [];
    const hasAvailability =
      windows.length === 0 ||
      windows.some((w) => toCalendarDay(w.fromDate) <= startDate && toCalendarDay(w.toDate) >= endDate);
    if (!hasAvailability) {
      throw unprocessable("The resource is not available for the requested dates. Please check the owner's availability calendar.", "NOT_AVAILABLE");
    }

    // Transport: renter may only pick the owner's transport if the listing offers it.
    const useProviderTransport = input.transportMode === "PROVIDER";
    if (useProviderTransport && !resource.transportAvailable) {
      throw unprocessable("The owner does not provide transport for this resource", "NO_TRANSPORT");
    }
    const transportDistanceKm     = useProviderTransport ? input.transportDistanceKm! : null;
    const transportRatePerKmPaise = useProviderTransport ? resource.transportRatePerKmPaise : 0;
    const transportFeePaise       = useProviderTransport ? Math.round(transportRatePerKmPaise * transportDistanceKm!) : 0;

    // The listed rent is per unit per hour / day / event, as the owner chose on the listing
    const pricingBasis = toPricingBasis(resource.pricingBasis);
    if (pricingBasis === "HOUR" && input.hoursPerDay === undefined) {
      throw unprocessable("This listing is charged per hour. Enter how many hours you need each day.", "HOURS_REQUIRED");
    }
    const hoursPerDay = pricingBasis === "HOUR" ? input.hoursPerDay! : null;
    const rentAmountPaise      = rentFor(resource.rentAmountPaise, { pricingBasis, totalDays, hoursPerDay, quantity: input.quantity });
    const securityDepositPaise = resource.securityDepositPaise;
    const totalAmountPaise     = rentAmountPaise + securityDepositPaise + transportFeePaise;

    if (totalAmountPaise < MIN_ORDER_PAISE) {
      throw unprocessable("The booking total must be at least ₹1", "AMOUNT_TOO_LOW");
    }
    if (!Number.isSafeInteger(totalAmountPaise) || totalAmountPaise > MAX_ORDER_PAISE) {
      throw unprocessable("The booking total is too large. Please book a shorter period or fewer units.", "AMOUNT_TOO_HIGH");
    }

    const bookingRequest = await prisma.$transaction(async (tx) => {
      await lockResource(tx, resource.id);
      await assertCapacity(tx, resource, input.quantity, startDate, endDate);

      const created = await tx.bookingRequest.create({
        data: {
          seekerId:   seekerBusiness.id,
          providerId: resource.businessId,
          resourceId: input.resourceId,
          quantity:   input.quantity,
          startDate,
          endDate,
          totalDays,
          pricingBasis,
          hoursPerDay,
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
          conditionSnapshot: {
            resourceName: resource.name,
            resourceType: resource.resourceType,
            quantity:     input.quantity,
            location:     resource.location,
          } as any,
          listingPhotosSnapshot: resource.photos || [],
          damageDisclosureSnapshot: {
            hasPreExistingDamage: resource.hasPreExistingDamage,
            damageDescription:    resource.damageDescription,
            damagePhotos:         resource.damagePhotos || [],
          } as any,
          termsVersion: "v2.0",
        },
        include: { resource: true, seeker: PARTY_SELECT, provider: PARTY_SELECT },
      });

      await this.recordTimelineEvent(
        created.id, "BOOKING_CREATED", seekerBusiness.id, "RENTER",
        "Booking Requested",
        `Requested by ${seekerBusiness.name} for ${describeBillablePeriod(pricingBasis, totalDays, hoursPerDay)} at ${rupees(resource.rentAmountPaise)}/${PRICING_BASIS_UNIT[pricingBasis]}. Rent: ${rupees(rentAmountPaise)}, Deposit: ${rupees(securityDepositPaise)}. ${
          useProviderTransport
            ? `Owner transport: ${transportDistanceKm} km × ${rupees(transportRatePerKmPaise)}/km = ${rupees(transportFeePaise)}.`
            : "Renter arranges own transport."
        }`,
        null, tx
      );
      return created;
    });

    void notifyBookingEvent(bookingRequest.id, { kind: "REQUESTED" });
    return bookingRequest;
  }

  // ─────────────────────────────────────────────────────────────────────
  // READ OPERATIONS (participants only)
  // ─────────────────────────────────────────────────────────────────────

  static async getBookingRequests(userId: string, query: BookingQuery, page: Pagination = { limit: 50 }) {
    const business = await requireBusiness(userId);

    const where: Prisma.BookingRequestWhereInput = {};
    if (query.type === "incoming") where.providerId = business.id;
    else if (query.type === "outgoing") where.seekerId = business.id;
    else where.OR = [{ providerId: business.id }, { seekerId: business.id }];

    if (query.bookingStatus)   where.bookingStatus   = query.bookingStatus;
    if (query.financialStatus) where.financialStatus = query.financialStatus;
    if (query.status)          where.status          = query.status;

    const bookings = await prisma.bookingRequest.findMany({
      where,
      include: {
        resource: { select: { id: true, name: true, resourceType: true, location: true, photos: true } },
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
    return toPage(bookings.map((b) => forViewer(b, business.id)), page);
  }

  /** Returns null (→ 404) unless the caller is the renter or the owner. */
  static async getBookingRequestById(bookingId: string, userId: string) {
    const business = await BusinessService.getBusinessByUserId(userId);
    if (!business) return null;

    const booking = await prisma.bookingRequest.findUnique({
      where: { id: bookingId },
      include: {
        resource: true,
        seeker:   PARTY_SELECT,
        provider: PARTY_SELECT,
        inspections: { include: { evidence: true }, orderBy: { createdAt: "asc" } },
        evidence:    { orderBy: { createdAt: "asc" } },
        damageClaims: { include: { disputes: true }, orderBy: { createdAt: "desc" } },
        disputes:            { orderBy: { createdAt: "desc" } },
        paymentTransactions: { orderBy: { createdAt: "asc" } },
        timelineEvents:      { orderBy: { createdAt: "asc" } },
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
    if (!booking) return null;
    if (booking.seekerId !== business.id && booking.providerId !== business.id) return null; // → 404
    return forViewer(booking, business.id);
  }

  // ─────────────────────────────────────────────────────────────────────
  // ACCEPT / REJECT / CANCEL
  // ─────────────────────────────────────────────────────────────────────

  static async updateBookingStatus(bookingId: string, userId: string, input: UpdateBookingStatusInput) {
    const business = await requireBusiness(userId);

    // Accepting also needs the resource lock (capacity), taken before the booking lock.
    if (input.status === "accepted") {
      const existing = await prisma.bookingRequest.findUnique({ where: { id: bookingId } });
      if (!existing) throw notFound("Booking request not found");
      requireParty(existing, business.id);
      if (existing.providerId !== business.id) throw forbidden("Only the owner can accept bookings");
      const accepted = await this.acceptBooking(bookingId, existing.resourceId, business, null);
      void notifyBookingEvent(bookingId, { kind: "ACCEPTED" });
      return forViewer(accepted, business.id);
    }

    // If a checkout succeeded but was never verified, record it first so the
    // cancellation below refunds it instead of leaving the money stranded.
    if (input.status === "cancelled") {
      await this.reconcilePayment(bookingId).catch((err) =>
        console.error(`[Payments] Reconcile before cancel failed for ${bookingId}:`, err)
      );
    }

    const updated = await this.inBookingTx(bookingId, async (tx, booking, notify) => {
      const isProvider = booking.providerId === business.id;
      const isSeeker   = booking.seekerId   === business.id;
      if (!isProvider && !isSeeker) throw notFound("Booking not found");

      if (input.status === "rejected") {
        if (!isProvider) throw forbidden("Only the owner can reject bookings");
        assertStatus(booking, "BOOKING_REQUESTED", "Only a pending request can be rejected");
        return this.cancelBooking(tx, booking, {
          by: "OWNER", legacyStatus: "rejected",
          reason: input.rejectionReason || "Owner declined the booking request.",
          eventType: "BOOKING_REJECTED", title: "Booking Rejected", actorId: business.id, actorRole: "OWNER",
          notify, event: () => ({ kind: "REJECTED" }),
        });
      }

      // cancelled
      if (isSeeker) {
        assertStatus(
          booking, ["BOOKING_REQUESTED", "BOOKING_ACCEPTED"],
          "A booking can only be cancelled before the resource is handed over"
        );
        return this.cancelBooking(tx, booking, {
          by: "RENTER", reason: input.rejectionReason || "Cancelled by renter.",
          eventType: "BOOKING_CANCELLED", title: "Booking Cancelled by Renter", actorId: business.id, actorRole: "RENTER",
          notify, event: (refundedPaise) => ({ kind: "CANCELLED", by: "RENTER", refundedPaise }),
        });
      }

      if (booking.bookingStatus === "BOOKING_REQUESTED") {
        throw conflict("Use reject to decline a pending request");
      }
      assertStatus(booking, "BOOKING_ACCEPTED", "The owner can only cancel an accepted booking before handover");
      return this.cancelBooking(tx, booking, {
        by: "OWNER", reason: input.rejectionReason || "Cancelled by owner after accepting.",
        eventType: "BOOKING_CANCELLED_BY_OWNER", title: "Booking Cancelled by Owner", actorId: business.id, actorRole: "OWNER",
        notify, event: (refundedPaise) => ({ kind: "CANCELLED", by: "OWNER", refundedPaise }),
      });
    });
    return forViewer(updated, business.id);
  }

  /**
   * Accept a request under the resource lock (capacity) and the booking lock.
   * Shared with the negotiation flow; `agreedRatePaise` re-prices the rent.
   */
  static async acceptBooking(
    bookingId: string,
    resourceId: string,
    actor: { id: string; name: string },
    agreedRatePaise: number | null,
    extra?: (tx: Tx, booking: BookingRequest) => Promise<void>
  ) {
    const updated = await prisma.$transaction(
      async (tx) => {
        await lockResource(tx, resourceId);
        const booking = await lockBooking(tx, bookingId);
        assertStatus(booking, "BOOKING_REQUESTED", "Booking can only be accepted while it is a pending request");

        const now = new Date();
        if (requestExpiresAt(booking.startDate) <= now) {
          throw conflict("This request has expired: its start date has passed");
        }

        const resource = await tx.resource.findUnique({ where: { id: resourceId } });
        if (!resource || resource.deletedAt) throw notFound("Resource not found");
        await assertCapacity(tx, resource, booking.quantity, booking.startDate, booking.endDate, bookingId);

        if (extra) await extra(tx, booking);

        const priceData = agreedRatePaise !== null
          ? (() => {
              // Offers are per unit per hour / day / event, like the listed rent
              const rent = rentFor(agreedRatePaise, booking);
              return {
                rentAmountPaise:  rent,
                totalAmountPaise: rent + booking.securityDepositPaise + booking.transportFeePaise,
                proposedPrice:    agreedRatePaise / 100,
                finalPrice:       agreedRatePaise / 100,
              };
            })()
          : {};

        const result = await tx.bookingRequest.update({
          where: { id: bookingId },
          data: {
            ...priceData,
            status: "accepted",
            bookingStatus: "BOOKING_ACCEPTED",
            acceptedAt: now,
            paymentDeadline: paymentDeadlineFor(now, booking.startDate),
          },
        });
        await this.closeNegotiation(tx, bookingId);

        await this.recordTimelineEvent(
          bookingId, "BOOKING_ACCEPTED", actor.id, booking.providerId === actor.id ? "OWNER" : "RENTER",
          "Booking Accepted",
          `${agreedRatePaise !== null ? `Accepted at the negotiated rate of ${rupees(agreedRatePaise)}/${PRICING_BASIS_UNIT[toPricingBasis(booking.pricingBasis)]}.` : `${actor.name} accepted the booking request.`} The renter must pay ${rupees(result.totalAmountPaise)} into escrow by ${result.paymentDeadline!.toISOString()}.`,
          null, tx
        );
        return result;
      },
      { maxWait: 10_000, timeout: 20_000 }
    );
    return updated;
  }

  // ─────────────────────────────────────────────────────────────────────
  // RAZORPAY PAYMENT
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Step 1: create (or reuse) the Razorpay order for this booking. The order id
   * and amount are stored on the booking; only this order can fund it.
   */
  static async createPaymentOrder(bookingId: string, userId: string) {
    const business = await requireBusiness(userId);
    const booking = await prisma.bookingRequest.findUnique({ where: { id: bookingId } });
    if (!booking) throw notFound("Booking not found");
    if (booking.seekerId !== business.id) {
      if (booking.providerId !== business.id) throw notFound("Booking not found");
      throw forbidden("Only the renter can pay for this booking");
    }
    assertStatus(booking, "BOOKING_ACCEPTED", "The owner must accept the booking before payment");
    if (booking.financialStatus !== "PENDING_PAYMENT") throw conflict("Escrow has already been funded for this booking");
    if (booking.paymentDeadline && booking.paymentDeadline <= new Date()) {
      throw conflict("The payment deadline for this booking has passed");
    }
    if (booking.totalAmountPaise < MIN_ORDER_PAISE) {
      throw unprocessable("The booking total must be at least ₹1", "AMOUNT_TOO_LOW");
    }

    const breakdown = {
      bookingId,
      totalAmountPaise:     booking.totalAmountPaise,
      rentAmountPaise:      booking.rentAmountPaise,
      securityDepositPaise: booking.securityDepositPaise,
      transportFeePaise:    booking.transportFeePaise,
      paymentDeadline:      booking.paymentDeadline,
    };

    // A previous checkout may already have succeeded without reaching /verify
    if (booking.razorpayOrderId && (await this.reconcilePayment(bookingId))) {
      throw conflict("This booking is already paid. Escrow is funded.", "ALREADY_PAID");
    }

    if (booking.razorpayOrderId && booking.razorpayOrderAmountPaise === booking.totalAmountPaise) {
      return {
        orderId: booking.razorpayOrderId,
        amount: booking.razorpayOrderAmountPaise,
        currency: "INR",
        keyId: RazorpayService.keyId(),
        ...breakdown,
      };
    }

    const order = await RazorpayService.createOrder(booking.totalAmountPaise, bookingId);
    await prisma.bookingRequest.update({
      where: { id: bookingId },
      data: { razorpayOrderId: order.orderId, razorpayOrderAmountPaise: order.amount },
    });
    return { ...order, ...breakdown };
  }

  /**
   * Step 2: verify the checkout result against Razorpay itself, then fund escrow.
   * If the booking was cancelled or expired while the renter was paying, the
   * captured payment is recorded and refunded in full.
   */
  static async verifyAndFundEscrow(
    bookingId: string,
    userId: string,
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string
  ) {
    const business = await requireBusiness(userId);
    const booking = await prisma.bookingRequest.findUnique({ where: { id: bookingId } });
    if (!booking) throw notFound("Booking not found");
    if (booking.seekerId !== business.id) {
      if (booking.providerId !== business.id) throw notFound("Booking not found");
      throw forbidden("Only the renter can verify payment");
    }

    if (booking.razorpayPaymentId === razorpayPaymentId) return forViewer(booking, business.id); // already verified
    if (!booking.razorpayOrderId || booking.razorpayOrderId !== razorpayOrderId) {
      throw badRequest("This payment does not belong to this booking's order", "PAYMENT_ORDER_MISMATCH");
    }
    if (!RazorpayService.verifySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature)) {
      throw badRequest("Payment verification failed: invalid signature", "PAYMENT_SIGNATURE_INVALID");
    }

    let payment = await RazorpayService.fetchPayment(razorpayPaymentId);
    const expectedAmount = booking.razorpayOrderAmountPaise!;
    if (payment.order_id !== razorpayOrderId || Number(payment.amount) !== expectedAmount || payment.currency !== "INR") {
      throw badRequest("Payment amount or order does not match this booking", "PAYMENT_MISMATCH");
    }
    if (payment.status === "authorized") {
      payment = await RazorpayService.capturePayment(razorpayPaymentId, expectedAmount);
    }
    if (payment.status !== "captured") {
      throw badRequest(`Payment is not complete (status: ${payment.status})`, "PAYMENT_NOT_CAPTURED");
    }

    const outcome = await this.applyCapturedPayment(bookingId, business.id, razorpayOrderId, razorpayPaymentId, expectedAmount);
    if (!outcome.funded) {
      throw conflict("This booking is no longer payable. Your payment has been refunded in full.", "BOOKING_NOT_PAYABLE");
    }
    return forViewer(outcome.booking, business.id);
  }

  /**
   * Record a captured payment of this booking's order. Funds escrow if the
   * booking is still payable; otherwise (cancelled / expired meanwhile) the
   * payment is recorded and refunded in full.
   */
  private static async applyCapturedPayment(
    bookingId: string,
    actorBusinessId: string | null,
    razorpayOrderId: string,
    razorpayPaymentId: string,
    amountPaise: number
  ): Promise<{ funded: boolean; booking: BookingRequest }> {
    return this.inBookingTx(bookingId, async (tx, fresh, notify) => {
      if (fresh.razorpayPaymentId) {
        if (fresh.razorpayPaymentId === razorpayPaymentId) {
          return { funded: fresh.financialStatus !== "FULLY_REFUNDED", booking: fresh };
        }
        throw conflict("Escrow has already been funded for this booking");
      }

      await PaymentService.recordEscrowDeposit(tx, bookingId, amountPaise, razorpayPaymentId);
      const actorRole: ActorRole = actorBusinessId ? "RENTER" : "SYSTEM";

      const payable =
        fresh.bookingStatus === "BOOKING_ACCEPTED" &&
        fresh.financialStatus === "PENDING_PAYMENT" &&
        amountPaise === fresh.totalAmountPaise;

      if (!payable) {
        // Paid too late (cancelled/expired meanwhile) or for a stale amount: refund it all.
        await PaymentService.queueRefund(tx, bookingId, "FULL_REFUND", amountPaise);
        const late = await tx.bookingRequest.update({
          where: { id: bookingId },
          data: { razorpayPaymentId, financialStatus: "FULLY_REFUNDED" },
        });
        await this.recordTimelineEvent(
          bookingId, "LATE_PAYMENT_REFUNDED", actorBusinessId, actorRole,
          "Payment Received After Booking Closed — Refunded",
          `A payment of ${rupees(amountPaise)} arrived after this booking was no longer payable. It is being refunded in full.`,
          { razorpayOrderId, razorpayPaymentId }, tx
        );
        notify({ kind: "LATE_PAYMENT_REFUNDED", refundedPaise: amountPaise });
        return { funded: false, booking: late };
      }

      const now = new Date();
      const handoverDeadline = handoverDeadlineFor(now, fresh.startDate);
      const funded = await tx.bookingRequest.update({
        where: { id: bookingId },
        data: {
          financialStatus: "FUNDS_HELD",
          razorpayPaymentId,
          fundedAt: now,
          handoverDeadline,
          handoverCode: generateHandoverCode(),
          handoverCodeAttempts: 0,
        },
      });
      await this.recordTimelineEvent(
        bookingId, "ESCROW_FUNDED", actorBusinessId, actorRole,
        "Escrow Funded via Razorpay",
        `${rupees(fresh.totalAmountPaise)} (Rent: ${rupees(fresh.rentAmountPaise)} + Deposit: ${rupees(fresh.securityDepositPaise)}${fresh.transportFeePaise > 0 ? ` + Transport: ${rupees(fresh.transportFeePaise)}` : ""}) held in platform escrow. The owner must hand over by ${handoverDeadline.toISOString()}. Razorpay Payment ID: ${razorpayPaymentId}`,
        { razorpayOrderId, razorpayPaymentId }, tx
      );
      notify({ kind: "PAYMENT_RECEIVED" });
      return { funded: true, booking: funded };
    });
  }

  /**
   * Recover a payment whose verify call never arrived (e.g. the renter closed
   * the tab right after paying): look the booking's order up on Razorpay and
   * apply any successful payment. Returns true if a payment was applied.
   */
  static async reconcilePayment(bookingId: string): Promise<boolean> {
    const booking = await prisma.bookingRequest.findUnique({ where: { id: bookingId } });
    if (!booking?.razorpayOrderId || booking.razorpayPaymentId || !booking.razorpayOrderAmountPaise) return false;

    const attempts = await RazorpayService.fetchOrderPayments(booking.razorpayOrderId);
    const paid = attempts.find(
      (p) => ["captured", "authorized"].includes(p.status) && Number(p.amount) === booking.razorpayOrderAmountPaise
    );
    if (!paid) return false;
    if (paid.status === "authorized") await RazorpayService.capturePayment(paid.id, booking.razorpayOrderAmountPaise);

    await this.applyCapturedPayment(bookingId, null, booking.razorpayOrderId, paid.id, booking.razorpayOrderAmountPaise);
    return true;
  }

  /**
   * Server-to-server confirmation from the Razorpay webhook (payment.captured /
   * order.paid). Funds the booking even if the renter closed the browser before
   * the verify call. The webhook body is only a hint: order, amount and status
   * are re-fetched from Razorpay. Returns true when this call funded the booking.
   */
  static async fundEscrowFromWebhook(razorpayOrderId: string, razorpayPaymentId: string): Promise<boolean> {
    const booking = await prisma.bookingRequest.findUnique({ where: { razorpayOrderId } });
    if (!booking?.razorpayOrderAmountPaise) return false;
    if (booking.razorpayPaymentId === razorpayPaymentId) return false; // already applied

    let payment = await RazorpayService.fetchPayment(razorpayPaymentId);
    const expectedAmount = booking.razorpayOrderAmountPaise;
    if (payment.order_id !== razorpayOrderId || payment.amount !== expectedAmount || payment.currency !== "INR") {
      throw badRequest("Payment does not match this booking", "PAYMENT_MISMATCH");
    }
    if (payment.status === "authorized") payment = await RazorpayService.capturePayment(payment.id, expectedAmount);
    if (payment.status !== "captured") return false;

    try {
      const outcome = await this.applyCapturedPayment(booking.id, null, razorpayOrderId, payment.id, expectedAmount);
      return outcome.funded;
    } catch (err) {
      // A second payment on an already-funded order: record it for manual refund instead of retrying forever
      if (err instanceof HttpError && err.statusCode === 409) {
        console.error(`[Payments] Duplicate payment ${payment.id} on funded booking ${booking.id} — refund it manually`);
        return false;
      }
      throw err;
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // HANDOVER — owner enters the renter's code and uploads condition photos
  // ─────────────────────────────────────────────────────────────────────

  static async markHandover(bookingId: string, userId: string, input: HandoverInput) {
    const business = await requireBusiness(userId);

    const result = await this.inBookingTx(bookingId, async (tx, booking, notify) => {
      requireParty(booking, business.id);
      if (booking.providerId !== business.id) throw forbidden("Only the resource owner can mark handover");
      assertStatus(booking, "BOOKING_ACCEPTED", "Booking must be accepted and funded before handover");
      if (booking.financialStatus !== "FUNDS_HELD") throw conflict("Escrow must be funded before the resource can be handed over");

      const now = new Date();
      if (now < handoverOpensAt(booking.startDate)) {
        throw conflict(`Handover opens 1 day before the start date (from ${handoverOpensAt(booking.startDate).toISOString()})`);
      }
      if (booking.handoverDeadline && now > booking.handoverDeadline) {
        throw conflict("The handover deadline has passed");
      }
      if (booking.handoverCodeAttempts >= MAX_HANDOVER_CODE_ATTEMPTS || !booking.handoverCode) {
        throw new HttpError(423, "HANDOVER_CODE_LOCKED", "Handover code locked after too many wrong attempts. Please contact support.");
      }

      if (!safeEqual(input.handoverCode, booking.handoverCode)) {
        const attempts = booking.handoverCodeAttempts + 1;
        await tx.bookingRequest.update({ where: { id: bookingId }, data: { handoverCodeAttempts: attempts } });
        // Commit the attempt count, then report the error.
        return { ok: false as const, remaining: MAX_HANDOVER_CODE_ATTEMPTS - attempts };
      }

      const inspection = await tx.inspection.create({
        data: {
          bookingId,
          type: "HANDOVER",
          performedById: business.id,
          status: "ACCEPTED",
          quantity: booking.quantity,
          notes: input.notes || "Condition recorded by owner at handover.",
        },
      });
      const photos = await saveEvidence(tx, userId, input.evidenceUrls, "handover evidence", {
        bookingId, inspectionId: inspection.id, uploadedById: business.id, stage: "HANDOVER", notes: input.notes,
      });

      const deadline = addMs(now, RENTER_INSPECTION_MS);
      const updated = await tx.bookingRequest.update({
        where: { id: bookingId },
        data: {
          handoverInitiatedAt:      now,
          renterInspectionDeadline: deadline,
          bookingStatus: "HANDOVER_INSPECTION",
          status: "handover",
          handoverCode: null,
        },
      });
      await this.recordTimelineEvent(
        bookingId, "HANDOVER_MARKED", business.id, "OWNER",
        "Handover Verified with Renter's Code",
        `Owner entered the renter's handover code and recorded ${photos} condition photo(s). The renter has 1 hour (until ${deadline.toISOString()}) to inspect and accept or report an issue.`,
        null, tx
      );
      notify({ kind: "HANDOVER_STARTED", deadline });
      return { ok: true as const, booking: updated };
    });

    if (!result.ok) {
      throw badRequest(
        result.remaining > 0
          ? `Incorrect handover code. ${result.remaining} attempt(s) left.`
          : "Incorrect handover code. The code is now locked; please contact support.",
        "HANDOVER_CODE_INVALID"
      );
    }
    return forViewer(result.booking, business.id);
  }

  // ─────────────────────────────────────────────────────────────────────
  // RENTER RECEIVING INSPECTION
  // ─────────────────────────────────────────────────────────────────────

  static async renterReceivingInspection(bookingId: string, userId: string, input: RenterReceivingInspectionInput) {
    const business = await requireBusiness(userId);

    const updated = await this.inBookingTx(bookingId, async (tx, booking, notify) => {
      requireParty(booking, business.id);
      if (booking.seekerId !== business.id) throw forbidden("Only the renter can perform the receiving inspection");
      assertStatus(booking, "HANDOVER_INSPECTION", "Booking is not awaiting your receiving inspection");

      const now = new Date();
      if (booking.renterInspectionDeadline && now > booking.renterInspectionDeadline) {
        throw conflict("Your inspection window has expired. The booking was auto-accepted.");
      }

      const receivedQuantity = input.receivedQuantity ?? booking.quantity;
      if (receivedQuantity > booking.quantity) {
        throw badRequest(`Received quantity cannot exceed the booked quantity (${booking.quantity})`);
      }

      const inspection = await tx.inspection.create({
        data: {
          bookingId,
          type: "RECEIVING",
          performedById: business.id,
          status: input.status,
          quantity: receivedQuantity,
          notes: input.status === "ACCEPTED"
            ? input.notes || "Condition accepted by renter."
            : input.issueDescription!,
        },
      });
      await saveEvidence(tx, userId, input.evidenceUrls, "evidence", {
        bookingId, inspectionId: inspection.id, uploadedById: business.id,
        stage: "RECEIVING", notes: input.issueDescription ?? input.notes,
      });

      if (input.status === "ACCEPTED") {
        if (receivedQuantity < booking.quantity) {
          throw badRequest(
            `You received ${receivedQuantity} of ${booking.quantity} unit(s). Report an issue instead of accepting a short delivery.`
          );
        }
        const { ownerPaise } = await this.releaseRent(tx, booking);
        const b = await tx.bookingRequest.update({
          where: { id: bookingId },
          data: { bookingStatus: "ACTIVE", financialStatus: "RENT_RELEASED", status: "active", receivedQuantity },
        });
        await this.recordTimelineEvent(
          bookingId, "RECEIVING_ACCEPTED", business.id, "RENTER",
          "Resource Accepted by Renter",
          `Renter confirmed receipt of all ${receivedQuantity} unit(s) in acceptable condition. ${rupees(ownerPaise)} (rent${booking.transportFeePaise > 0 ? " + transport" : ""}) queued for payout to the owner; the deposit (${rupees(booking.securityDepositPaise)}) stays in escrow.`,
          null, tx
        );
        notify({ kind: "RENT_RELEASED", auto: false });
        return b;
      }

      // REPORTED_ISSUE → the owner must respond within 24h
      const responseDeadline = addMs(now, HANDOVER_ISSUE_RESPONSE_MS);
      await tx.dispute.create({
        data: {
          bookingId,
          kind: "HANDOVER_ISSUE",
          raisedByRole: "RENTER",
          status: "OPEN",
          responseDeadline,
          renterReason: receivedQuantity < booking.quantity ? "MISSING_QUANTITY" : "CONDITION_MISMATCH",
          renterResponse: input.issueDescription,
        },
      });
      const b = await tx.bookingRequest.update({
        where: { id: bookingId },
        data: { bookingStatus: "DISPUTED", status: "disputed", receivedQuantity },
      });
      await this.recordTimelineEvent(
        bookingId, "RECEIVING_ISSUE", business.id, "RENTER",
        "Handover Issue Reported",
        `Renter received ${receivedQuantity} of ${booking.quantity} unit(s) and reported: "${input.issueDescription}". The whole payment stays in escrow. The owner has until ${responseDeadline.toISOString()} to accept (full refund) or contest (goes to admin).`,
        null, tx
      );
      notify({ kind: "HANDOVER_ISSUE", responseDeadline });
      return b;
    });
    return forViewer(updated, business.id);
  }

  /** Owner accepts (renter refunded in full) or contests (escalated to admin) a handover issue. */
  static async ownerRespondHandoverIssue(bookingId: string, userId: string, input: OwnerHandoverResponseInput) {
    const business = await requireBusiness(userId);

    const updated = await this.inBookingTx(bookingId, async (tx, booking, notify) => {
      requireParty(booking, business.id);
      if (booking.providerId !== business.id) throw forbidden("Only the owner can respond to a handover issue");
      assertStatus(booking, "DISPUTED", "There is no open handover issue on this booking");
      const dispute = await this.latestDispute(tx, bookingId);
      if (dispute?.kind !== "HANDOVER_ISSUE" || dispute.status !== "OPEN") {
        throw conflict("There is no handover issue awaiting your response");
      }

      if (input.action === "ACCEPT") {
        return this.resolveHandoverIssue(
          tx, booking, dispute.id, "FULL_REFUND", 0,
          input.notes || "Owner accepted the renter's handover issue.", business.id, "OWNER", notify
        );
      }

      await tx.dispute.update({
        where: { id: dispute.id },
        data: { status: "ESCALATED", escalatedAt: new Date(), ownerResponse: input.notes },
      });
      await this.recordTimelineEvent(
        bookingId, "HANDOVER_ISSUE_CONTESTED", business.id, "OWNER",
        "Owner Contested the Handover Issue",
        `Owner's response: "${input.notes}". Sent to HostNexus admin for a decision; escrow stays frozen.`,
        null, tx
      );
      notify({ kind: "HANDOVER_ISSUE_CONTESTED" });
      return tx.bookingRequest.findUniqueOrThrow({ where: { id: bookingId } });
    });
    return forViewer(updated, business.id);
  }

  /**
   * Settle a handover issue.
   *  FULL_REFUND    → everything back to the renter, booking cancelled.
   *  REJECT_ISSUE   → rent + transport to the owner, booking ACTIVE, deposit held.
   *  PARTIAL_REFUND → `amount` of rent + transport back to the renter, rest to the owner, booking ACTIVE.
   */
  private static async resolveHandoverIssue(
    tx: Tx,
    booking: BookingRequest,
    disputeId: string,
    decision: "FULL_REFUND" | "REJECT_ISSUE" | "PARTIAL_REFUND",
    amountPaise: number,
    notes: string,
    actorId: string | null,
    actorRole: ActorRole,
    notify: Notify = noNotify
  ) {
    const now = new Date();
    let updated: BookingRequest;
    let summary: string;

    if (decision === "FULL_REFUND") {
      const { heldPaise } = await PaymentService.ledger(tx, booking.id);
      await PaymentService.queueRefund(tx, booking.id, "FULL_REFUND", heldPaise);
      updated = await tx.bookingRequest.update({
        where: { id: booking.id },
        data: {
          bookingStatus: "CANCELLED", financialStatus: "FULLY_REFUNDED", status: "cancelled",
          cancelledAt: now, cancelledBy: "SYSTEM", rejectionReason: "Handover issue upheld",
        },
      });
      summary = `${rupees(heldPaise)} is being refunded to the renter in full; the owner collects the item back.`;
    } else {
      const { ownerPaise, refundPaise } = await this.releaseRent(tx, booking, decision === "PARTIAL_REFUND" ? amountPaise : 0);
      updated = await tx.bookingRequest.update({
        where: { id: booking.id },
        data: { bookingStatus: "ACTIVE", financialStatus: "RENT_RELEASED", status: "active" },
      });
      summary = refundPaise > 0
        ? `${rupees(refundPaise)} refunded to the renter, ${rupees(ownerPaise)} queued for payout to the owner. The rental continues; the deposit stays in escrow.`
        : `${rupees(ownerPaise)} queued for payout to the owner. The rental continues; the deposit stays in escrow.`;
    }

    await tx.dispute.update({
      where: { id: disputeId },
      data: {
        status: "RESOLVED",
        adminDecision: decision,
        resolutionAmountPaise: decision === "PARTIAL_REFUND" ? amountPaise : null,
        resolutionNotes: notes,
        resolvedById: actorId,
        resolvedAt: now,
      },
    });
    await this.recordTimelineEvent(
      booking.id, "DISPUTE_RESOLVED", actorId, actorRole,
      `Handover Issue Resolved (${decision})`, `${notes} ${summary}`, null, tx
    );
    notify({ kind: "DISPUTE_RESOLVED", decision });
    return updated;
  }

  // ─────────────────────────────────────────────────────────────────────
  // RETURN
  // ─────────────────────────────────────────────────────────────────────

  static async initiateReturn(bookingId: string, userId: string, input: ReturnInitiationInput) {
    const business = await requireBusiness(userId);

    const updated = await this.inBookingTx(bookingId, async (tx, booking, notify) => {
      requireParty(booking, business.id);
      if (booking.seekerId !== business.id) throw forbidden("Only the renter can return the resource");
      assertStatus(booking, "ACTIVE", "Booking must be active to start a return");

      const returnedQuantity = input.returnedQuantity ?? booking.quantity;
      if (returnedQuantity > booking.quantity) {
        throw badRequest(`Returned quantity cannot exceed the booked quantity (${booking.quantity})`);
      }

      const now = new Date();
      const isEarlyReturn = now < istDayEnd(booking.endDate);

      const inspection = await tx.inspection.create({
        data: {
          bookingId,
          type: "RETURN",
          performedById: business.id,
          status: "ACCEPTED",
          quantity: returnedQuantity,
          notes: input.notes || "Return evidence submitted by renter.",
        },
      });
      const photos = await saveEvidence(tx, userId, input.returnEvidenceUrls, "return evidence", {
        bookingId, inspectionId: inspection.id, uploadedById: business.id, stage: "RETURN", notes: input.notes,
      });

      const receiptDeadline = addMs(now, OWNER_RECEIPT_WINDOW_MS);
      const b = await tx.bookingRequest.update({
        where: { id: bookingId },
        data: {
          returnInitiatedAt: now,
          returnedQuantity,
          ownerReceiptDeadline: receiptDeadline,
          bookingStatus: "RETURN_INITIATED",
          status: "return_initiated",
        },
      });
      await this.recordTimelineEvent(
        bookingId, "RETURN_INITIATED", business.id, "RENTER",
        isEarlyReturn ? "Early Return Initiated" : "Resource Return Initiated",
        `Renter returned ${returnedQuantity} of ${booking.quantity} unit(s)${isEarlyReturn ? " before the last rental day" : ""} and uploaded ${photos} photo(s). The owner has until ${receiptDeadline.toISOString()} to confirm receipt, after which it is confirmed automatically.`,
        null, tx
      );
      notify({ kind: "RETURN_INITIATED", early: isEarlyReturn });
      return b;
    });
    return forViewer(updated, business.id);
  }

  /** Owner confirms physical receipt (with a count) or reports that nothing arrived. */
  static async ownerConfirmReceipt(bookingId: string, userId: string, input: OwnerReceiptInput) {
    const business = await requireBusiness(userId);

    const updated = await this.inBookingTx(bookingId, async (tx, booking, notify) => {
      requireParty(booking, business.id);
      if (booking.providerId !== business.id) throw forbidden("Only the resource owner can confirm return receipt");
      assertStatus(booking, "RETURN_INITIATED", "The renter must start the return before you can confirm receipt");

      const now = new Date();

      if (input.received) {
        const receivedQuantity = input.receivedQuantity ?? booking.returnedQuantity ?? booking.quantity;
        if (receivedQuantity > booking.quantity) {
          throw badRequest(`Received quantity cannot exceed the booked quantity (${booking.quantity})`);
        }
        await tx.inspection.create({
          data: {
            bookingId, type: "OWNER_RECEIPT", performedById: business.id, status: "ACCEPTED",
            quantity: receivedQuantity, notes: input.notes || "Owner confirmed physical receipt.",
          },
        });
        const deadline = addMs(now, OWNER_INSPECTION_MS);
        const b = await tx.bookingRequest.update({
          where: { id: bookingId },
          data: {
            ownerReceivedAt: now,
            ownerReceivedQuantity: receivedQuantity,
            ownerInspectionDeadline: deadline,
            bookingStatus: "OWNER_INSPECTION",
            status: "owner_inspection",
          },
        });
        await this.recordTimelineEvent(
          bookingId, "OWNER_RECEIPT_CONFIRMED", business.id, "OWNER",
          "Physical Receipt Confirmed (2-Hour Window Started)",
          `Owner confirmed receiving ${receivedQuantity} of ${booking.quantity} unit(s). The owner has until ${deadline.toISOString()} to accept the return or file a claim; otherwise the deposit of ${rupees(booking.securityDepositPaise)} is refunded automatically.`,
          null, tx
        );
        notify({ kind: "RETURN_RECEIVED", deadline });
        return b;
      }

      // Fake-return protection: nothing arrived
      const responseDeadline = addMs(now, RETURN_CLAIM_RESPONSE_MS);
      const claim = await tx.damageClaim.create({
        data: {
          bookingId,
          claimantId: business.id,
          claimType: "RETURN_NOT_RECEIVED",
          description: input.notes || "Owner reported that the returned resource was not received.",
          claimedAmountPaise: booking.securityDepositPaise,
          status: "DISPUTED",
        },
      });
      await tx.dispute.create({
        data: { bookingId, damageClaimId: claim.id, kind: "RETURN_CLAIM", raisedByRole: "OWNER", status: "OPEN", responseDeadline },
      });
      const b = await tx.bookingRequest.update({
        where: { id: bookingId },
        data: { bookingStatus: "DISPUTED", status: "disputed", nonReturnReportedAt: now, ownerReceivedQuantity: 0 },
      });
      await this.recordTimelineEvent(
        bookingId, "RETURN_NOT_RECEIVED", business.id, "OWNER",
        "Return Not Received (Claim Filed)",
        `Owner reported the resource was NOT received despite the renter's return. The renter has until ${responseDeadline.toISOString()} to accept or dispute the claim.`,
        null, tx
      );
      notify({ kind: "RETURN_NOT_RECEIVED", responseDeadline });
      return b;
    });
    return forViewer(updated, business.id);
  }

  /** Owner is satisfied with the return → deposit refunded, booking completed. */
  static async ownerAcceptReturn(bookingId: string, userId: string, _notes?: string) {
    const business = await requireBusiness(userId);

    const updated = await this.inBookingTx(bookingId, async (tx, booking, notify) => {
      requireParty(booking, business.id);
      if (booking.providerId !== business.id) throw forbidden("Only the owner can accept the return");
      assertStatus(booking, "OWNER_INSPECTION", "The return can only be accepted during your inspection window");

      await this.settleDeposit(tx, booking, 0);
      const b = await tx.bookingRequest.update({
        where: { id: bookingId },
        data: { bookingStatus: "COMPLETED", financialStatus: "DEPOSIT_REFUNDED", completedAt: new Date(), status: "completed" },
      });
      await this.recordTimelineEvent(
        bookingId, "OWNER_RETURN_ACCEPTED", business.id, "OWNER",
        "Return Accepted & Deposit Released",
        `Owner accepted the returned condition. The security deposit (${rupees(booking.securityDepositPaise)}) is being refunded to the renter. Rental complete.`,
        null, tx
      );
      notify({ kind: "RETURN_ACCEPTED", auto: false });
      return b;
    });
    return forViewer(updated, business.id);
  }

  // ─────────────────────────────────────────────────────────────────────
  // RETURN CLAIMS
  // ─────────────────────────────────────────────────────────────────────

  static async ownerSubmitDamageClaim(bookingId: string, userId: string, input: OwnerDamageClaimInput) {
    const business = await requireBusiness(userId);

    const updated = await this.inBookingTx(bookingId, async (tx, booking, notify) => {
      requireParty(booking, business.id);
      if (booking.providerId !== business.id) throw forbidden("Only the resource owner can submit claims");
      assertStatus(booking, "OWNER_INSPECTION", "Claims can only be filed during your return inspection window");

      const now = new Date();
      if (booking.ownerInspectionDeadline && now > booking.ownerInspectionDeadline) {
        throw conflict("Your inspection window has expired. No claim can be submitted.");
      }
      if (input.claimedAmountPaise > booking.securityDepositPaise) {
        throw unprocessable(
          `Claimed amount (${rupees(input.claimedAmountPaise)}) cannot exceed the security deposit (${rupees(booking.securityDepositPaise)})`,
          "CLAIM_EXCEEDS_DEPOSIT"
        );
      }
      const receivedQty = booking.ownerReceivedQuantity ?? booking.quantity;
      if (input.claimType === "MISSING_QUANTITY" && receivedQty >= booking.quantity) {
        throw badRequest(`You confirmed receiving all ${booking.quantity} unit(s), so a missing-quantity claim isn't possible`);
      }

      const claim = await tx.damageClaim.create({
        data: {
          bookingId,
          claimantId: business.id,
          claimType: input.claimType,
          description: input.description,
          claimedAmountPaise: input.claimedAmountPaise,
          status: "PENDING",
        },
      });
      await saveEvidence(tx, userId, input.evidenceUrls, "evidence", {
        bookingId, uploadedById: business.id, stage: "DAMAGE_CLAIM", notes: input.description,
      });
      const responseDeadline = addMs(now, RETURN_CLAIM_RESPONSE_MS);
      await tx.dispute.create({
        data: { bookingId, damageClaimId: claim.id, kind: "RETURN_CLAIM", raisedByRole: "OWNER", status: "OPEN", responseDeadline },
      });
      const b = await tx.bookingRequest.update({
        where: { id: bookingId },
        data: { bookingStatus: "DISPUTED", status: "disputed" },
      });
      await this.recordTimelineEvent(
        bookingId, "DAMAGE_CLAIMED", business.id, "OWNER",
        "Owner Filed a Claim",
        `Owner claimed ${rupees(input.claimedAmountPaise)} (${input.claimType}): "${input.description}". The renter has until ${responseDeadline.toISOString()} to accept or dispute; the deposit stays in escrow.`,
        null, tx
      );
      notify({ kind: "DAMAGE_CLAIMED", amountPaise: input.claimedAmountPaise, responseDeadline });
      return b;
    });
    return forViewer(updated, business.id);
  }

  /** Renter accepts (settled from the deposit) or disputes (escalated to admin) an owner's claim. */
  static async renterRespondClaim(bookingId: string, userId: string, input: RenterClaimResponseInput) {
    const business = await requireBusiness(userId);

    const updated = await this.inBookingTx(bookingId, async (tx, booking, notify) => {
      requireParty(booking, business.id);
      if (booking.seekerId !== business.id) throw forbidden("Only the renter can respond to a claim");
      assertStatus(booking, "DISPUTED", "There is no claim awaiting your response");
      const dispute = await this.latestDispute(tx, bookingId);
      if (dispute?.kind !== "RETURN_CLAIM" || dispute.status !== "OPEN") {
        throw conflict("There is no owner claim awaiting your response");
      }

      if (input.action === "ACCEPT") {
        return this.settleReturnClaim(
          tx, booking, dispute, dispute.damageClaim?.claimedAmountPaise ?? booking.securityDepositPaise,
          "PAY_OWNER", "Renter accepted the claim.", business.id, "RENTER",
          notify, (payoutPaise, refundPaise) => ({ kind: "CLAIM_ACCEPTED", payoutPaise, refundPaise })
        );
      }

      await tx.dispute.update({
        where: { id: dispute.id },
        data: {
          status: "ESCALATED",
          escalatedAt: new Date(),
          renterResponse: input.rebuttalNotes || null,
          renterReason: input.reason || "NOT_CAUSED_BY_RENTER",
        },
      });
      await saveEvidence(tx, userId, input.rebuttalEvidenceUrls, "rebuttal evidence", {
        bookingId, uploadedById: business.id, stage: "RENTER_REBUTTAL", notes: input.rebuttalNotes,
      });
      await this.recordTimelineEvent(
        bookingId, "CLAIM_DISPUTED", business.id, "RENTER",
        "Renter Disputed the Claim",
        `Renter contested the claim (${input.reason || "NOT_CAUSED_BY_RENTER"}): "${input.rebuttalNotes || "Condition disputed"}". Sent to HostNexus admin for a decision.`,
        null, tx
      );
      notify({ kind: "CLAIM_DISPUTED" });
      return tx.bookingRequest.findUniqueOrThrow({ where: { id: bookingId } });
    });
    return forViewer(updated, business.id);
  }

  /** Close a return claim by splitting the deposit and completing the booking. */
  private static async settleReturnClaim(
    tx: Tx,
    booking: BookingRequest,
    dispute: { id: string; damageClaimId: string | null },
    ownerShareRequested: number,
    decision: string,
    notes: string,
    actorId: string | null,
    actorRole: ActorRole,
    notify: Notify = noNotify,
    event: (payoutPaise: number, refundPaise: number) => BookingEvent = () => ({ kind: "DISPUTE_RESOLVED", decision })
  ) {
    const now = new Date();
    const { ownerShare, renterShare, financialStatus } = await this.settleDeposit(tx, booking, ownerShareRequested);

    await tx.dispute.update({
      where: { id: dispute.id },
      data: {
        status: "RESOLVED",
        adminDecision: decision,
        resolutionAmountPaise: ownerShare,
        resolutionNotes: notes,
        resolvedById: actorId,
        resolvedAt: now,
      },
    });
    if (dispute.damageClaimId) {
      await tx.damageClaim.update({
        where: { id: dispute.damageClaimId },
        data: { status: decision === "REJECT_CLAIM" || ownerShare === 0 ? "REJECTED" : "RESOLVED", resolvedAt: now },
      });
    }
    const updated = await tx.bookingRequest.update({
      where: { id: booking.id },
      data: { bookingStatus: "COMPLETED", financialStatus, completedAt: now, status: "completed" },
    });
    await this.recordTimelineEvent(
      booking.id, "DISPUTE_RESOLVED", actorId, actorRole,
      `Claim Settled (${decision})`,
      `${notes} ${rupees(ownerShare)} of the deposit goes to the owner and ${rupees(renterShare)} is refunded to the renter.`,
      null, tx
    );
    notify(event(ownerShare, renterShare));
    return updated;
  }

  // ─────────────────────────────────────────────────────────────────────
  // ADMIN — resolve any dispute (called from /api/admin/disputes)
  // ─────────────────────────────────────────────────────────────────────

  static async adminResolveDispute(bookingId: string, adminId: string, input: AdminResolveDisputeInput) {
    const admin = await prisma.admin.findUnique({ where: { id: adminId } });
    if (!admin) throw forbidden("Admin access required to resolve disputes");

    return this.inBookingTx(bookingId, async (tx, booking, notify) => {
      assertStatus(booking, "DISPUTED", "Only disputed bookings can be resolved");
      const dispute = await this.latestDispute(tx, bookingId);
      if (!dispute || dispute.status === "RESOLVED") throw conflict("This booking has no unresolved dispute");

      const notes = `Admin (${admin.name}): ${input.resolutionNotes}`;

      if (dispute.kind === "HANDOVER_ISSUE") {
        if (!["FULL_REFUND", "REJECT_ISSUE", "PARTIAL_REFUND"].includes(input.decision)) {
          throw badRequest("A handover issue can be resolved with FULL_REFUND, REJECT_ISSUE or PARTIAL_REFUND");
        }
        const maxRefund = booking.rentAmountPaise + booking.transportFeePaise;
        const amount = input.resolutionAmountPaise ?? 0;
        if (input.decision === "PARTIAL_REFUND" && (amount <= 0 || amount >= maxRefund)) {
          throw badRequest(`A partial refund must be between ₹0.01 and ${rupees(maxRefund - 1)} (rent + transport)`);
        }
        return this.resolveHandoverIssue(
          tx, booking, dispute.id, input.decision as "FULL_REFUND" | "REJECT_ISSUE" | "PARTIAL_REFUND",
          amount, notes, adminId, "ADMIN", notify
        );
      }

      if (!["REFUND_RENTER", "REJECT_CLAIM", "PAY_OWNER", "PARTIAL_SETTLEMENT"].includes(input.decision)) {
        throw badRequest("A return claim can be resolved with REFUND_RENTER, REJECT_CLAIM, PAY_OWNER or PARTIAL_SETTLEMENT");
      }
      let ownerShare = 0;
      if (input.decision === "PAY_OWNER") {
        ownerShare = dispute.damageClaim?.claimedAmountPaise ?? booking.securityDepositPaise;
      } else if (input.decision === "PARTIAL_SETTLEMENT") {
        const amount = input.resolutionAmountPaise;
        if (amount === undefined || amount < 0 || amount > booking.securityDepositPaise) {
          throw badRequest(`Owner's share must be between ₹0 and the deposit (${rupees(booking.securityDepositPaise)})`);
        }
        ownerShare = amount;
      }
      return this.settleReturnClaim(tx, booking, dispute, ownerShare, input.decision, notes, adminId, "ADMIN", notify);
    });
  }

  // ─────────────────────────────────────────────────────────────────────
  // NON-RETURN
  // ─────────────────────────────────────────────────────────────────────

  /** Owner reports that nothing came back after the last rental day. */
  static async reportNonReturn(bookingId: string, userId: string) {
    const business = await requireBusiness(userId);

    const updated = await this.inBookingTx(bookingId, async (tx, booking, notify) => {
      requireParty(booking, business.id);
      if (booking.providerId !== business.id) throw forbidden("Only the owner can report a non-return");
      assertStatus(booking, "ACTIVE", "Non-return can only be reported while the booking is active");
      if (new Date() < istDayEnd(booking.endDate)) {
        throw conflict("You can report a non-return once the last rental day has ended");
      }
      return this.openNonReturnDispute(tx, booking, business.id, "OWNER", notify);
    });
    return forViewer(updated, business.id);
  }

  /**
   * Open a non-return claim on the deposit. Filed by the owner, the renter gets
   * 48h to respond; raised by the system (no return, no report), it goes
   * straight to admin.
   */
  private static async openNonReturnDispute(
    tx: Tx,
    booking: BookingRequest,
    ownerBusinessId: string | null,
    role: "OWNER" | "SYSTEM",
    notify: Notify = noNotify
  ) {
    const now = new Date();
    const bySystem = role === "SYSTEM";
    const responseDeadline = bySystem ? null : addMs(now, RETURN_CLAIM_RESPONSE_MS);

    const claim = await tx.damageClaim.create({
      data: {
        bookingId: booking.id,
        claimantId: ownerBusinessId ?? booking.providerId,
        claimType: "MISSING_ITEM",
        description: bySystem
          ? "No return was started within 24 hours after the last rental day."
          : "Owner reported the resource was not returned after the rental period.",
        claimedAmountPaise: booking.securityDepositPaise,
        status: "DISPUTED",
      },
    });
    await tx.dispute.create({
      data: {
        bookingId: booking.id,
        damageClaimId: claim.id,
        kind: "RETURN_CLAIM",
        raisedByRole: role,
        status: bySystem ? "ESCALATED" : "OPEN",
        escalatedAt: bySystem ? now : null,
        responseDeadline,
      },
    });
    const updated = await tx.bookingRequest.update({
      where: { id: booking.id },
      data: { bookingStatus: "DISPUTED", nonReturnReportedAt: now, status: "disputed" },
    });
    await this.recordTimelineEvent(
      booking.id, "NON_RETURN_REPORTED", ownerBusinessId, role,
      bySystem ? "Non-Return Escalated Automatically" : "Resource Non-Return Reported",
      bySystem
        ? "No return was started within 24 hours after the last rental day. A non-return claim on the deposit was opened and sent to HostNexus admin."
        : `Owner reported the resource was not returned. The renter has until ${responseDeadline!.toISOString()} to respond; the deposit stays in escrow.`,
      null, tx
    );
    notify({ kind: "NON_RETURN_REPORTED", bySystem, responseDeadline });
    return updated;
  }
}
