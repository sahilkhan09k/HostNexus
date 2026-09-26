import { prisma } from "../config/database.js";
import { BusinessService } from "./business.service.js";
import { BookingService } from "./booking.service.js";
import { badRequest, conflict, forbidden, notFound } from "../utils/http-error.js";

// ─── Logic ───────────────────────────────────────────────────
//
// Flow:
//   1. Renter creates booking request at listed price (status: BOOKING_REQUESTED)
//   2. While the booking is still a request (never after acceptance, so the
//      price is fixed before any payment order exists), EITHER side can negotiate:
//      - Renter sends initial offer (lower than listed price)
//      - Owner counters or accepts
//   3. Counter-offers ping-pong until:
//      a) One side accepts → booking's rentAmountPaise updated, booking accepted
//      b) Either side rejects → negotiation REJECTED, booking can still be
//         accepted at listed price (owner's prerogative) or cancelled
//
// Invariant: only ONE open negotiation per booking at a time.

export class NegotiationService {
  /** Full negotiation thread for a booking — only the renter and the owner can read it. */
  static async getByBookingId(bookingId: string, userId: string) {
    const business = await BusinessService.getBusinessByUserId(userId);
    const booking = await prisma.bookingRequest.findUnique({
      where: { id: bookingId },
      select: { seekerId: true, providerId: true },
    });
    if (!booking || !business || (booking.seekerId !== business.id && booking.providerId !== business.id)) {
      throw notFound("Booking not found");
    }
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
    if (offeredAmountPaise <= 0) throw badRequest("Offer amount must be greater than 0");

    const business = await BusinessService.getBusinessByUserId(userId);
    if (!business) throw forbidden("You must have a business to negotiate");

    const booking = await prisma.bookingRequest.findUnique({
      where: { id: bookingId },
      include: { seeker: true, provider: true, negotiation: { include: { offers: { orderBy: { createdAt: "desc" }, take: 1 } } } },
    });
    if (!booking) throw notFound("Booking not found");

    const isSeeker   = booking.seekerId   === business.id;
    const isProvider = booking.providerId === business.id;
    if (!isSeeker && !isProvider) throw forbidden("You are not a party to this booking");

    // Price is only negotiable while the booking is a pending request. Once the
    // owner accepts, the amount is locked so a payment order can't go stale.
    if (booking.bookingStatus !== "BOOKING_REQUESTED") {
      throw conflict("The price can only be negotiated before the owner accepts the booking");
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
        throw conflict("This negotiation is no longer open");
      }

      // ── Validate turn-order: caller must be the OTHER party from the last offer ──
      const lastOffer = negotiation!.offers?.[0];
      if (lastOffer && lastOffer.proposerRole === proposerRole) {
        throw conflict("It is not your turn — wait for the other party to respond");
      }

      // ── Mark previous pending offer as COUNTERED ──
      if (lastOffer && lastOffer.status === "PENDING") {
        await tx.negotiationOffer.update({
          where: { id: lastOffer.id },
          data: { status: "COUNTERED" },
        });
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
   * Goes through the same locked, capacity-checked path as a normal owner
   * accept, re-prices the rent at the agreed daily rate and closes the thread.
   */
  static async acceptOffer(userId: string, bookingId: string) {
    const business = await BusinessService.getBusinessByUserId(userId);
    if (!business) throw forbidden("No business found");

    const booking = await prisma.bookingRequest.findUnique({ where: { id: bookingId } });
    if (!booking) throw notFound("Booking not found");

    const isSeeker   = booking.seekerId   === business.id;
    const isProvider = booking.providerId === business.id;
    if (!isSeeker && !isProvider) throw forbidden("Not your booking");
    const callerRole = isSeeker ? "SEEKER" : "PROVIDER";

    const loadOffer = async (db: Pick<typeof prisma, "negotiation">) => {
      const neg = await db.negotiation.findUnique({
        where: { bookingId },
        include: { offers: { orderBy: { createdAt: "desc" }, take: 1 } },
      });
      if (!neg || neg.status !== "OPEN") throw conflict("No open negotiation");
      const latestOffer = neg.offers[0];
      if (!latestOffer || latestOffer.status !== "PENDING") throw conflict("No pending offer to accept");
      // The acceptor must be the OPPOSITE party of the proposer
      if (latestOffer.proposerRole === callerRole) throw conflict("You cannot accept your own offer");
      return { neg, latestOffer };
    };

    // Read the offer to learn the agreed rate, then re-validate it under the locks.
    const agreedRate = (await loadOffer(prisma)).latestOffer.offeredAmountPaise;

    return BookingService.acceptBooking(bookingId, booking.resourceId, business, agreedRate, async (tx) => {
      const { neg, latestOffer } = await loadOffer(tx);
      if (latestOffer.offeredAmountPaise !== agreedRate) throw conflict("The offer changed; please review it again");
      await tx.negotiationOffer.update({ where: { id: latestOffer.id }, data: { status: "ACCEPTED" } });
      await tx.negotiation.update({ where: { id: neg.id }, data: { status: "ACCEPTED" } });
      await BookingService.recordTimelineEvent(
        bookingId, "NEGOTIATION_ACCEPTED", business.id, isSeeker ? "RENTER" : "OWNER",
        "Negotiated price accepted",
        `${business.name} accepted the offer of ₹${(agreedRate / 100).toLocaleString()}/day.`,
        null, tx
      );
    });
  }

  /**
   * Reject the negotiation entirely (either party).
   * Booking stays at BOOKING_REQUESTED — owner can still accept at listed price.
   */
  static async rejectNegotiation(userId: string, bookingId: string, reason?: string) {
    const business = await BusinessService.getBusinessByUserId(userId);
    if (!business) throw forbidden("No business found");

    const booking = await prisma.bookingRequest.findUnique({
      where: { id: bookingId },
      include: { negotiation: true },
    });
    if (!booking) throw notFound("Booking not found");

    const isSeeker   = booking.seekerId   === business.id;
    const isProvider = booking.providerId === business.id;
    if (!isSeeker && !isProvider) throw forbidden("Not your booking");

    const neg = booking.negotiation;
    if (!neg || neg.status !== "OPEN") throw conflict("No open negotiation to reject");

    await prisma.$transaction(async (tx) => {
      // Mark latest pending offer rejected
      await tx.negotiationOffer.updateMany({
        where: { negotiationId: neg.id, status: "PENDING" },
        data: { status: "REJECTED" },
      });

      await tx.negotiation.update({
        where: { id: neg.id },
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
