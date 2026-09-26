import { prisma } from "../config/database.js";
import { BusinessService } from "./business.service.js";
import { BookingService, MAX_ORDER_PAISE, MIN_ORDER_PAISE } from "./booking.service.js";
import { assertCapacity, lockResource } from "./capacity.js";
import { conflict, forbidden, notFound, unprocessable } from "../utils/http-error.js";

// ─── Logic ───────────────────────────────────────────────────
//
// Flow:
//   1. Renter creates booking request at listed price (status: BOOKING_REQUESTED)
//   2. Before the owner accepts, EITHER side can open a negotiation:
//      - Renter sends initial offer (lower than listed price)
//      - Owner counters or accepts
//   3. Counter-offers ping-pong until:
//      a) One side accepts → booking's rentAmountPaise updated, booking accepted
//      b) Either side rejects → negotiation REJECTED, booking can still be
//         accepted at listed price (owner's prerogative) or cancelled
//
// Invariants:
//   - only ONE open negotiation per booking at a time
//   - prices can only change while the booking is BOOKING_REQUESTED and unpaid;
//     once accepted/funded the amount is frozen (it is what the renter pays/paid)

/** The only state in which the price of a booking may still change */
const NEGOTIABLE = { bookingStatus: "BOOKING_REQUESTED", financialStatus: "PENDING_PAYMENT" } as const;

/** Offers below this share of the listed daily rent are refused */
export const MIN_OFFER_RATIO = 0.3;

function assertNegotiable(booking: { bookingStatus: string; financialStatus: string }) {
  if (booking.bookingStatus !== NEGOTIABLE.bookingStatus || booking.financialStatus !== NEGOTIABLE.financialStatus) {
    throw conflict("Negotiation is only possible before the owner accepts the booking", "NOT_NEGOTIABLE");
  }
}

export class NegotiationService {
  /** Full negotiation thread for a booking — only for the renter and the owner */
  static async getByBookingId(bookingId: string, userId: string) {
    const booking = await prisma.bookingRequest.findFirst({
      where: { id: bookingId, OR: [{ seeker: { ownerId: userId } }, { provider: { ownerId: userId } }] },
      select: { id: true },
    });
    if (!booking) throw notFound("Booking not found");

    return prisma.negotiation.findUnique({
      where: { bookingId },
      include: {
        offers: {
          include: {
            proposer: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });
  }

  /**
   * Start negotiation OR add a counter-offer.
   * - First call with a bookingId creates the Negotiation + first NegotiationOffer.
   * - Subsequent calls from the other party add a counter-offer and mark the
   *   previous offer as COUNTERED.
   */
  static async makeOffer(
    userId: string,
    bookingId: string,
    offeredAmountPaise: number,
    message?: string
  ) {
    if (offeredAmountPaise <= 0) throw unprocessable("Offer amount must be greater than 0", "INVALID_OFFER");

    const business = await BusinessService.getBusinessByUserId(userId);
    if (!business) throw forbidden("You must have a business to negotiate", "NO_BUSINESS");

    const booking = await prisma.bookingRequest.findUnique({
      where: { id: bookingId },
      include: {
        resource: { select: { rentAmountPaise: true } },
        negotiation: { include: { offers: { orderBy: { createdAt: "desc" }, take: 1 } } },
      },
    });
    if (!booking) throw notFound("Booking not found");

    const isSeeker   = booking.seekerId   === business.id;
    const isProvider = booking.providerId === business.id;
    if (!isSeeker && !isProvider) throw notFound("Booking not found");

    assertNegotiable(booking);

    const listedDaily = booking.resource.rentAmountPaise;
    if (listedDaily > 0 && offeredAmountPaise < Math.ceil(listedDaily * MIN_OFFER_RATIO)) {
      throw unprocessable(
        `Offers must be at least ${Math.round(MIN_OFFER_RATIO * 100)}% of the listed daily rate (₹${(Math.ceil(listedDaily * MIN_OFFER_RATIO) / 100).toLocaleString()})`,
        "OFFER_TOO_LOW"
      );
    }
    const totalDays = booking.totalDays ?? 1;
    const newTotal = offeredAmountPaise * totalDays + booking.securityDepositPaise + booking.transportFeePaise;
    if (!Number.isSafeInteger(newTotal) || newTotal > MAX_ORDER_PAISE) {
      throw unprocessable("Offer amount is too large", "INVALID_OFFER");
    }

    const proposerRole = isSeeker ? "SEEKER" : "PROVIDER";

    return prisma.$transaction(async (tx) => {
      let negotiation = booking.negotiation;

      // ── Create negotiation on first offer ──
      if (!negotiation) {
        negotiation = await tx.negotiation.create({
          data: { bookingId, status: "OPEN" },
          include: { offers: { include: { proposer: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } } },
        }) as any;
      } else if (negotiation.status !== "OPEN") {
        throw conflict("This negotiation is no longer open", "NEGOTIATION_CLOSED");
      }

      // ── Validate turn-order: caller must be the OTHER party from the last offer ──
      const lastOffer = negotiation!.offers?.[0];
      if (lastOffer && lastOffer.proposerRole === proposerRole) {
        throw conflict("It is not your turn — wait for the other party to respond", "NOT_YOUR_TURN");
      }

      // ── Mark previous pending offer as COUNTERED (atomically, so two counters can't race) ──
      if (lastOffer) {
        const countered = await tx.negotiationOffer.updateMany({
          where: { id: lastOffer.id, status: "PENDING" },
          data: { status: "COUNTERED" },
        });
        if (countered.count !== 1) throw conflict("The offer was already answered. Please refresh.", "OFFER_CHANGED");
      }

      // ── Create new offer ──
      const offer = await tx.negotiationOffer.create({
        data: {
          negotiationId: negotiation!.id,
          proposerId: business.id,
          proposerRole,
          offeredAmountPaise,
          message: message ?? null,
          status: "PENDING",
        },
        include: { proposer: { select: { id: true, name: true } } },
      });

      // ── Timeline event ──
      await BookingService.recordTimelineEvent(
        bookingId,
        "NEGOTIATION_OFFER",
        business.id,
        isSeeker ? "RENTER" : "OWNER",
        `${isSeeker ? "Renter" : "Owner"} made a counter-offer`,
        `${business.name} offered ₹${(offeredAmountPaise / 100).toLocaleString()} per day${message ? `: "${message}"` : "."}`
      );

      return offer;
    });
  }

  /**
   * Accept the current pending offer.
   * - Updates the booking's rentAmountPaise to the agreed price.
   * - Closes the negotiation as ACCEPTED.
   * - Transitions booking to BOOKING_ACCEPTED (with the same capacity check as a normal accept).
   */
  static async acceptOffer(userId: string, bookingId: string) {
    const business = await BusinessService.getBusinessByUserId(userId);
    if (!business) throw forbidden("No business found", "NO_BUSINESS");

    const booking = await prisma.bookingRequest.findUnique({
      where: { id: bookingId },
      include: {
        negotiation: {
          include: {
            offers: { orderBy: { createdAt: "desc" }, take: 1 },
          },
        },
      },
    });
    if (!booking) throw notFound("Booking not found");

    const isSeeker   = booking.seekerId   === business.id;
    const isProvider = booking.providerId === business.id;
    if (!isSeeker && !isProvider) throw notFound("Booking not found");

    assertNegotiable(booking);

    const neg = booking.negotiation;
    if (!neg || neg.status !== "OPEN") throw conflict("No open negotiation", "NEGOTIATION_CLOSED");

    const latestOffer = neg.offers[0];
    if (!latestOffer || latestOffer.status !== "PENDING")
      throw conflict("No pending offer to accept", "NO_PENDING_OFFER");

    // The acceptor must be the OPPOSITE party of the proposer
    const callerRole = isSeeker ? "SEEKER" : "PROVIDER";
    if (latestOffer.proposerRole === callerRole)
      throw forbidden("You cannot accept your own offer", "OWN_OFFER");

    // Recalculate totals based on agreed daily rate
    const totalDays = booking.totalDays ?? 1;
    const newRentPaise  = latestOffer.offeredAmountPaise * totalDays;
    const newTotalPaise = newRentPaise + booking.securityDepositPaise + booking.transportFeePaise;
    if (newTotalPaise < MIN_ORDER_PAISE || newTotalPaise > MAX_ORDER_PAISE) {
      throw unprocessable("The negotiated total is out of range", "INVALID_OFFER");
    }

    return prisma.$transaction(async (tx) => {
      // Same overbooking protection as the owner's normal accept
      await lockResource(tx, booking.resourceId);
      const resource = await tx.resource.findUnique({ where: { id: booking.resourceId } });
      if (!resource) throw notFound("Resource not found");
      await assertCapacity(tx, resource, booking.quantity, booking.startDate, booking.endDate, bookingId);

      // Claim the offer and the booking state atomically
      const offerClaim = await tx.negotiationOffer.updateMany({
        where: { id: latestOffer.id, status: "PENDING" },
        data: { status: "ACCEPTED" },
      });
      if (offerClaim.count !== 1) throw conflict("This offer was already answered. Please refresh.", "OFFER_CHANGED");

      const bookingClaim = await tx.bookingRequest.updateMany({
        where: { id: bookingId, ...NEGOTIABLE },
        data: {
          rentAmountPaise:  newRentPaise,
          totalAmountPaise: newTotalPaise,
          proposedPrice:    latestOffer.offeredAmountPaise / 100,
          finalPrice:       latestOffer.offeredAmountPaise / 100,
          bookingStatus:    "BOOKING_ACCEPTED",
          status:           "accepted",
        },
      });
      if (bookingClaim.count !== 1) {
        throw conflict("Negotiation is only possible before the owner accepts the booking", "NOT_NEGOTIABLE");
      }

      await tx.negotiation.update({
        where: { id: neg.id },
        data: { status: "ACCEPTED" },
      });

      await BookingService.recordTimelineEvent(
        bookingId,
        "NEGOTIATION_ACCEPTED",
        business.id,
        isSeeker ? "RENTER" : "OWNER",
        "Negotiated price accepted",
        `${business.name} accepted the offer of ₹${(latestOffer.offeredAmountPaise / 100).toLocaleString()}/day. Booking confirmed at agreed price.`
      );

      return tx.bookingRequest.findUniqueOrThrow({ where: { id: bookingId } });
    });
  }

  /**
   * Reject the negotiation entirely (either party).
   * Booking stays at BOOKING_REQUESTED — owner can still accept at listed price.
   */
  static async rejectNegotiation(userId: string, bookingId: string, reason?: string) {
    const business = await BusinessService.getBusinessByUserId(userId);
    if (!business) throw forbidden("No business found", "NO_BUSINESS");

    const booking = await prisma.bookingRequest.findUnique({
      where: { id: bookingId },
      include: { negotiation: true },
    });
    if (!booking) throw notFound("Booking not found");

    const isSeeker   = booking.seekerId   === business.id;
    const isProvider = booking.providerId === business.id;
    if (!isSeeker && !isProvider) throw notFound("Booking not found");

    const neg = booking.negotiation;
    if (!neg || neg.status !== "OPEN") throw conflict("No open negotiation to reject", "NEGOTIATION_CLOSED");

    await prisma.$transaction(async (tx) => {
      const closed = await tx.negotiation.updateMany({
        where: { id: neg.id, status: "OPEN" },
        data: { status: "REJECTED" },
      });
      if (closed.count !== 1) throw conflict("No open negotiation to reject", "NEGOTIATION_CLOSED");

      await tx.negotiationOffer.updateMany({
        where: { negotiationId: neg.id, status: "PENDING" },
        data: { status: "REJECTED" },
      });
    });

    await BookingService.recordTimelineEvent(
      bookingId,
      "NEGOTIATION_REJECTED",
      business.id,
      isSeeker ? "RENTER" : "OWNER",
      "Negotiation rejected",
      reason
        ? `${business.name} rejected the negotiation: "${reason}"`
        : `${business.name} ended the price negotiation.`
    );
  }
}
