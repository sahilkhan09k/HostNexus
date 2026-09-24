import { prisma } from "../config/database.js";
import { BusinessService } from "./business.service.js";
import { BookingService } from "./booking.service.js";

// ─── Logic ───────────────────────────────────────────────────
//
// Flow:
//   1. Renter creates booking request at listed price (status: BOOKING_REQUESTED)
//   2. Before owner accepts, EITHER side can open a negotiation:
//      - Renter sends initial offer (lower than listed price)
//      - Owner counters or accepts
//   3. Counter-offers ping-pong until:
//      a) One side accepts → booking's rentAmountPaise updated, booking accepted
//      b) Either side rejects → negotiation REJECTED, booking can still be
//         accepted at listed price (owner's prerogative) or cancelled
//
// Invariant: only ONE open negotiation per booking at a time.

export class NegotiationService {
  /** Get full negotiation thread for a booking (public to both parties) */
  static async getByBookingId(bookingId: string) {
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
    if (offeredAmountPaise <= 0) throw new Error("Offer amount must be greater than 0");

    const business = await BusinessService.getBusinessByUserId(userId);
    if (!business) throw new Error("You must have a business to negotiate");

    const booking = await prisma.bookingRequest.findUnique({
      where: { id: bookingId },
      include: { seeker: true, provider: true, negotiation: { include: { offers: { orderBy: { createdAt: "desc" }, take: 1 } } } },
    });
    if (!booking) throw new Error("Booking not found");

    const isSeeker   = booking.seekerId   === business.id;
    const isProvider = booking.providerId === business.id;
    if (!isSeeker && !isProvider) throw new Error("You are not a party to this booking");

    // Negotiation only allowed while booking is in BOOKING_REQUESTED state
    if (!["BOOKING_REQUESTED", "BOOKING_ACCEPTED"].includes(booking.bookingStatus)) {
      throw new Error("Negotiation is only possible before the booking is funded");
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
        throw new Error("This negotiation is no longer open");
      }

      // ── Validate turn-order: caller must be the OTHER party from the last offer ──
      const lastOffer = negotiation!.offers?.[0];
      if (lastOffer && lastOffer.proposerRole === proposerRole) {
        throw new Error("It is not your turn — wait for the other party to respond");
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
   * - Updates the booking's rentAmountPaise to the agreed price.
   * - Closes the negotiation as ACCEPTED.
   * - Transitions booking to BOOKING_ACCEPTED.
   */
  static async acceptOffer(userId: string, bookingId: string) {
    const business = await BusinessService.getBusinessByUserId(userId);
    if (!business) throw new Error("No business found");

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
    if (!booking) throw new Error("Booking not found");

    const isSeeker   = booking.seekerId   === business.id;
    const isProvider = booking.providerId === business.id;
    if (!isSeeker && !isProvider) throw new Error("Not your booking");

    const neg = booking.negotiation;
    if (!neg || neg.status !== "OPEN") throw new Error("No open negotiation");

    const latestOffer = neg.offers[0];
    if (!latestOffer || latestOffer.status !== "PENDING")
      throw new Error("No pending offer to accept");

    // The acceptor must be the OPPOSITE party of the proposer
    const callerRole = isSeeker ? "SEEKER" : "PROVIDER";
    if (latestOffer.proposerRole === callerRole)
      throw new Error("You cannot accept your own offer");

    return prisma.$transaction(async (tx) => {
      // Mark offer accepted
      await tx.negotiationOffer.update({
        where: { id: latestOffer.id },
        data: { status: "ACCEPTED" },
      });

      // Close negotiation
      await tx.negotiation.update({
        where: { id: neg.id },
        data: { status: "ACCEPTED" },
      });

      // Recalculate totals based on agreed daily rate
      const totalDays = booking.totalDays ?? 1;
      const newRentPaise  = latestOffer.offeredAmountPaise * totalDays;
      const newTotalPaise = newRentPaise + booking.securityDepositPaise;

      // Update booking price + accept
      const updated = await tx.bookingRequest.update({
        where: { id: bookingId },
        data: {
          rentAmountPaise:  newRentPaise,
          totalAmountPaise: newTotalPaise,
          proposedPrice:    latestOffer.offeredAmountPaise / 100,
          finalPrice:       latestOffer.offeredAmountPaise / 100,
          bookingStatus:    "BOOKING_ACCEPTED",
          status:           "accepted",
        },
      });

      await BookingService.recordTimelineEvent(
        bookingId,
        "NEGOTIATION_ACCEPTED",
        business.id,
        isSeeker ? "RENTER" : "OWNER",
        "Negotiated price accepted",
        `${business.name} accepted the offer of ₹${(latestOffer.offeredAmountPaise / 100).toLocaleString()}/day. Booking confirmed at agreed price.`
      );

      return updated;
    });
  }

  /**
   * Reject the negotiation entirely (either party).
   * Booking stays at BOOKING_REQUESTED — owner can still accept at listed price.
   */
  static async rejectNegotiation(userId: string, bookingId: string, reason?: string) {
    const business = await BusinessService.getBusinessByUserId(userId);
    if (!business) throw new Error("No business found");

    const booking = await prisma.bookingRequest.findUnique({
      where: { id: bookingId },
      include: { negotiation: true },
    });
    if (!booking) throw new Error("Booking not found");

    const isSeeker   = booking.seekerId   === business.id;
    const isProvider = booking.providerId === business.id;
    if (!isSeeker && !isProvider) throw new Error("Not your booking");

    const neg = booking.negotiation;
    if (!neg || neg.status !== "OPEN") throw new Error("No open negotiation to reject");

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
