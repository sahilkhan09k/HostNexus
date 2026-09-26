import { prisma } from "../config/database.js";
import { BusinessService } from "./business.service.js";
import { RazorpayService } from "./razorpay.service.js";
import { assertCapacity, lockResource } from "./capacity.js";
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

  // ─────────────────────────────────────────────────────────────────────
  // FIX #13 — Concurrent-safe expired inspection processing
  // Uses an in-transaction re-validation to prevent duplicate payouts
  // when the lazy-check path and the cron run simultaneously.
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Idempotent server-side evaluation of expired inspections
   * (Renter 1hr & Owner 2hr).
   */
  static async processExpiredInspections(): Promise<void> {
    const now = new Date();

    // 1. Renter inspection timeouts (1 hour expired without reporting an issue)
    const expiredRenterInspections = await prisma.bookingRequest.findMany({
      where: {
        bookingStatus: "HANDOVER_INSPECTION",
        renterInspectionDeadline: { lte: now },
      },
    });

    for (const booking of expiredRenterInspections) {
      await prisma.$transaction(async (tx) => {
        // Re-validate inside transaction to prevent concurrent duplicates (#13)
        const fresh = await tx.bookingRequest.findUnique({
          where: { id: booking.id },
          select: { bookingStatus: true, financialStatus: true },
        });
        if (fresh?.bookingStatus !== "HANDOVER_INSPECTION") return;

        await tx.bookingRequest.update({
          where: { id: booking.id },
          data: {
            bookingStatus: "ACTIVE",
            financialStatus: "RENT_RELEASED",
            status: "active",
          },
        });

        await tx.paymentTransaction.create({
          data: {
            bookingId: booking.id,
            type: "RENT_PAYOUT",
            amountPaise: booking.rentAmountPaise,
            status: "COMPLETED",
            providerReference: `AUTO_RENT_${booking.id}`,   // stable, booking-id-scoped (#18)
          },
        });
      });

      await this.recordTimelineEvent(
        booking.id,
        "AUTO_TIMEOUT_RELEASE",
        null,
        "SYSTEM",
        "Renter Inspection Window Expired (Auto-Accepted)",
        "The 1-hour inspection window elapsed without reported defects. Resource marked active and rent released to owner; deposit remains safely in escrow."
      );
    }

    // 2. Owner return inspection timeouts (2 hours expired without damage claim)
    const expiredOwnerInspections = await prisma.bookingRequest.findMany({
      where: {
        bookingStatus: "OWNER_INSPECTION",
        ownerInspectionDeadline: { lte: now },
      },
      include: { damageClaims: true },
    });

    for (const booking of expiredOwnerInspections) {
      // Only auto-refund if no claim was submitted
      if (booking.damageClaims.length === 0) {
        await prisma.$transaction(async (tx) => {
          // Re-validate inside transaction (#13)
          const fresh = await tx.bookingRequest.findUnique({
            where: { id: booking.id },
            select: { bookingStatus: true, financialStatus: true },
          });
          if (fresh?.bookingStatus !== "OWNER_INSPECTION") return;

          await tx.bookingRequest.update({
            where: { id: booking.id },
            data: {
              bookingStatus: "COMPLETED",
              financialStatus: "DEPOSIT_REFUNDED",
              completedAt: now,
              status: "completed",
            },
          });

          await tx.paymentTransaction.create({
            data: {
              bookingId: booking.id,
              type: "DEPOSIT_REFUND",
              amountPaise: booking.securityDepositPaise,
              status: "COMPLETED",
              providerReference: `AUTO_REFUND_${booking.id}`,   // stable (#18)
            },
          });
        });

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

  /**
   * Create a new booking request with commercial & condition snapshots.
   * FIX #17: Validates availability windows & booking conflicts.
   * FIX #19: Strict startDate < endDate check.
   * FIX #21: Validates requested quantity against resource.quantity.
   */
  static async createBookingRequest(
    userId: string,
    input: CreateBookingRequestInput
  ) {
    const seekerBusiness = await BusinessService.getBusinessByUserId(userId);
    if (!seekerBusiness) {
      throw new Error("You must have a business to create booking requests");
    }

    const resource = await prisma.resource.findUnique({
      where: { id: input.resourceId },
      include: {
        business: true,
        availabilityWindows: true,
      },
    });

    if (!resource) throw new Error("Resource not found");
    if (!resource.isActive) throw new Error("This resource is not available for booking");
    if (resource.businessId === seekerBusiness.id) {
      throw new Error("You cannot book your own resource");
    }

    const startDate = new Date(input.startDate);
    const endDate   = new Date(input.endDate);

    // FIX #19: Strict date validation
    if (endDate <= startDate) {
      throw new Error("End date must be strictly after start date");
    }

    const totalDays = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // FIX #21: Quantity guard
    if (input.quantity > resource.quantity) {
      throw new Error(
        `Requested quantity (${input.quantity}) exceeds available quantity (${resource.quantity})`
      );
    }

    // FIX #17a: Availability window check
    const hasAvailability =
      !resource.availabilityWindows ||
      resource.availabilityWindows.length === 0 ||
      resource.availabilityWindows.some(
        (w) => w.fromDate <= startDate && w.toDate >= endDate
      );
    if (!hasAvailability) {
      throw new Error(
        "The resource is not available for the requested date range. Please check the owner's availability calendar."
      );
    }

    // Financial calculation in paise
    const rentAmountPaise      = resource.rentAmountPaise * totalDays;
    const securityDepositPaise = resource.securityDepositPaise;
    const totalAmountPaise     = rentAmountPaise + securityDepositPaise;

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

    // FIX #17b: Quantity-aware conflict check, atomic with the insert.
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
          proposedPrice: input.proposedPrice ?? (totalAmountPaise / 100),
          conditionSnapshot:        conditionSnapshot as any,
          listingPhotosSnapshot,
          damageDisclosureSnapshot: damageDisclosureSnapshot as any,
          termsVersion: "v2.0",
        },
        include: {
          resource: true,
          seeker:   true,
          provider: true,
        },
      });
    });

    await this.recordTimelineEvent(
      bookingRequest.id,
      "BOOKING_CREATED",
      seekerBusiness.id,
      "RENTER",
      "Booking Requested",
      `Requested by ${seekerBusiness.name} for ${totalDays} day(s). Rent: ₹${(rentAmountPaise / 100).toLocaleString()}, Deposit: ₹${(securityDepositPaise / 100).toLocaleString()}`
    );

    return bookingRequest;
  }

  // ─────────────────────────────────────────────────────────────────────
  // READ OPERATIONS
  // ─────────────────────────────────────────────────────────────────────

  static async getBookingRequests(userId: string, query: BookingQuery) {
    await this.processExpiredInspections();

    const business = await BusinessService.getBusinessByUserId(userId);
    if (!business) throw new Error("You must have a business to view booking requests");

    let where: any = {};
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

    return prisma.bookingRequest.findMany({
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
      orderBy: { createdAt: "desc" },
    });
  }

  static async getBookingRequestById(bookingId: string) {
    await this.processExpiredInspections();

    return prisma.bookingRequest.findUnique({
      where: { id: bookingId },
      include: {
        resource: true,
        seeker:   true,
        provider: true,
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

  /**
   * Owner accepts / rejects booking request; renter can cancel.
   * FIX #14: Refunds escrow on cancellation if funds are held.
   * FIX #16: Removed dead "completed" branch — handled by ownerAcceptReturn.
   */
  static async updateBookingStatus(
    bookingId: string,
    userId: string,
    input: UpdateBookingStatusInput
  ) {
    const booking = await prisma.bookingRequest.findUnique({
      where: { id: bookingId },
      include: { provider: true, seeker: true },
    });
    if (!booking) throw new Error("Booking request not found");

    const business = await BusinessService.getBusinessByUserId(userId);
    if (!business) throw new Error("You must have a business to update bookings");

    const isProvider = booking.providerId === business.id;
    const isSeeker   = booking.seekerId   === business.id;

    if (!isProvider && !isSeeker) {
      throw new Error("Unauthorized to update this booking");
    }

    // ── ACCEPT ────────────────────────────────────────────────────────
    if (input.status === "accepted") {
      if (!isProvider) throw new Error("Only the owner can accept bookings");
      if (booking.bookingStatus !== "BOOKING_REQUESTED") {
        throw new Error("Booking can only be accepted when in BOOKING_REQUESTED status");
      }

      // Re-check capacity at accept time: several pending requests may overlap,
      // and only the ones that still fit may be accepted.
      const updated = await prisma.$transaction(async (tx) => {
        await lockResource(tx, booking.resourceId);
        const resource = await tx.resource.findUnique({ where: { id: booking.resourceId } });
        if (!resource) throw new Error("Resource not found");

        // Re-read status under the lock so a double-click can't accept twice
        const current = await tx.bookingRequest.findUnique({ where: { id: bookingId } });
        if (current?.bookingStatus !== "BOOKING_REQUESTED") {
          throw new Error("Booking can only be accepted when in BOOKING_REQUESTED status");
        }

        await assertCapacity(tx, resource, booking.quantity, booking.startDate, booking.endDate, bookingId);

        return tx.bookingRequest.update({
          where: { id: bookingId },
          data: { status: "accepted", bookingStatus: "BOOKING_ACCEPTED" },
        });
      });

      await this.recordTimelineEvent(
        bookingId, "BOOKING_ACCEPTED", business.id, "OWNER",
        "Booking Accepted",
        `Owner ${booking.provider.name} accepted the booking request. Awaiting renter escrow payment.`
      );
      return updated;
    }

    // ── REJECT ────────────────────────────────────────────────────────
    if (input.status === "rejected") {
      if (!isProvider) throw new Error("Only the owner can reject bookings");
      if (booking.bookingStatus !== "BOOKING_REQUESTED") {
        throw new Error("Booking can only be rejected when in BOOKING_REQUESTED status");
      }

      const updated = await prisma.bookingRequest.update({
        where: { id: bookingId },
        data: {
          status: "rejected",
          bookingStatus: "CANCELLED",
          rejectionReason: input.rejectionReason || null,
        },
      });

      await this.recordTimelineEvent(
        bookingId, "BOOKING_REJECTED", business.id, "OWNER",
        "Booking Rejected",
        input.rejectionReason || "Owner declined the booking request."
      );
      return updated;
    }

    // ── CANCEL (by renter) ────────────────────────────────────────────
    if (input.status === "cancelled") {
      if (!isSeeker) throw new Error("Only the requester can cancel bookings");

      // FIX #14: Refund escrow if already funded
      if (booking.financialStatus === "FUNDS_HELD") {
        const updated = await prisma.$transaction(async (tx) => {
          await tx.paymentTransaction.create({
            data: {
              bookingId,
              type: "DEPOSIT_REFUND",
              amountPaise: booking.totalAmountPaise,
              status: "COMPLETED",
              providerReference: `CANCEL_REFUND_${bookingId}`,
            },
          });

          return tx.bookingRequest.update({
            where: { id: bookingId },
            data: {
              status: "cancelled",
              bookingStatus: "CANCELLED",
              financialStatus: "DEPOSIT_REFUNDED",
              rejectionReason: input.rejectionReason || "Cancelled by renter",
            },
          });
        });

        await this.recordTimelineEvent(
          bookingId, "BOOKING_CANCELLED", business.id, "RENTER",
          "Booking Cancelled (Escrow Refunded)",
          `Renter cancelled after funding escrow. Full payment of ₹${(booking.totalAmountPaise / 100).toLocaleString()} refunded.`
        );
        return updated;
      }

      // No funds held — simple cancel
      const updated = await prisma.bookingRequest.update({
        where: { id: bookingId },
        data: {
          status: "cancelled",
          bookingStatus: "CANCELLED",
          rejectionReason: input.rejectionReason || "Cancelled by renter",
        },
      });

      await this.recordTimelineEvent(
        bookingId, "BOOKING_CANCELLED", business.id, "RENTER",
        "Booking Cancelled",
        input.rejectionReason || "Renter cancelled the booking."
      );
      return updated;
    }

    return booking;
  }

  // ─────────────────────────────────────────────────────────────────────
  // RAZORPAY PAYMENT — CREATE ORDER
  // FIX #1 & #2: Guard on bookingStatus + financialStatus idempotency
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Step 1 of payment: Creates a Razorpay order and returns order details
   * to the frontend so the user can complete the checkout flow.
   */
  static async createPaymentOrder(bookingId: string, userId: string) {
    const booking = await prisma.bookingRequest.findUnique({
      where: { id: bookingId },
      include: { seeker: true },
    });
    if (!booking) throw new Error("Booking not found");

    const business = await BusinessService.getBusinessByUserId(userId);
    if (!business || business.id !== booking.seekerId) {
      throw new Error("Only the renter can initiate payment");
    }

    // FIX #2: Must be in BOOKING_ACCEPTED state
    if (booking.bookingStatus !== "BOOKING_ACCEPTED") {
      throw new Error("Booking must be accepted by the owner before payment");
    }

    // FIX #1: Idempotency — do not allow double-payment
    if (booking.financialStatus !== "PENDING_PAYMENT") {
      throw new Error("Escrow has already been funded for this booking");
    }

    const orderDetails = await RazorpayService.createOrder(
      booking.totalAmountPaise,
      bookingId
    );

    return {
      ...orderDetails,
      bookingId,
      totalAmountPaise: booking.totalAmountPaise,
      rentAmountPaise:  booking.rentAmountPaise,
      securityDepositPaise: booking.securityDepositPaise,
    };
  }

  // ─────────────────────────────────────────────────────────────────────
  // RAZORPAY PAYMENT — VERIFY & FUND ESCROW
  // FIX #1: Double-call guard via financialStatus check inside transaction
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Step 2 of payment: Verify Razorpay signature, then atomically
   * mark escrow as funded and record the payment transaction.
   */
  static async verifyAndFundEscrow(
    bookingId: string,
    userId: string,
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string
  ) {
    const booking = await prisma.bookingRequest.findUnique({
      where: { id: bookingId },
      include: { seeker: true },
    });
    if (!booking) throw new Error("Booking not found");

    const business = await BusinessService.getBusinessByUserId(userId);
    if (!business || business.id !== booking.seekerId) {
      throw new Error("Only the renter can verify payment");
    }

    // FIX #1 & #2: State guards
    if (booking.bookingStatus !== "BOOKING_ACCEPTED") {
      throw new Error("Booking must be in BOOKING_ACCEPTED status to verify payment");
    }
    if (booking.financialStatus !== "PENDING_PAYMENT") {
      throw new Error("Escrow has already been funded for this booking");
    }

    // Verify Razorpay HMAC signature
    const isValid = RazorpayService.verifySignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    );
    if (!isValid) {
      throw new Error("Payment verification failed: invalid signature");
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Double-check inside transaction to prevent concurrent re-payment (#1)
      const fresh = await tx.bookingRequest.findUnique({
        where: { id: bookingId },
        select: { financialStatus: true },
      });
      if (fresh?.financialStatus !== "PENDING_PAYMENT") {
        throw new Error("Escrow has already been funded for this booking");
      }

      const b = await tx.bookingRequest.update({
        where: { id: bookingId },
        data: { financialStatus: "FUNDS_HELD" },
      });

      await tx.paymentTransaction.create({
        data: {
          bookingId,
          type: "ESCROW_DEPOSIT",
          amountPaise: booking.totalAmountPaise,
          status: "COMPLETED",
          providerReference: razorpayPaymentId,   // stable unique Razorpay payment ID (#18)
        },
      });

      return b;
    });

    await this.recordTimelineEvent(
      bookingId,
      "ESCROW_FUNDED",
      business.id,
      "RENTER",
      "Escrow Funded via Razorpay",
      `₹${(booking.totalAmountPaise / 100).toLocaleString()} (Rent: ₹${(booking.rentAmountPaise / 100).toLocaleString()} + Deposit: ₹${(booking.securityDepositPaise / 100).toLocaleString()}) safely held in platform escrow. Razorpay Payment ID: ${razorpayPaymentId}`,
      { razorpayOrderId, razorpayPaymentId }
    );

    return updated;
  }

  // ─────────────────────────────────────────────────────────────────────
  // HANDOVER — Owner marks resource handed over
  // FIX #3: Checks bookingStatus === BOOKING_ACCEPTED AND financialStatus === FUNDS_HELD
  // ─────────────────────────────────────────────────────────────────────

  static async markHandover(bookingId: string, userId: string) {
    const booking = await prisma.bookingRequest.findUnique({
      where: { id: bookingId },
      include: { provider: true },
    });
    if (!booking) throw new Error("Booking not found");

    const business = await BusinessService.getBusinessByUserId(userId);
    if (!business || business.id !== booking.providerId) {
      throw new Error("Only the resource owner can mark handover");
    }

    // FIX #3
    if (booking.bookingStatus !== "BOOKING_ACCEPTED") {
      throw new Error("Booking must be in BOOKING_ACCEPTED status before handover");
    }
    if (booking.financialStatus !== "FUNDS_HELD") {
      throw new Error("Escrow must be funded before the resource can be handed over");
    }

    const now      = new Date();
    const deadline = new Date(now.getTime() + 60 * 60 * 1000); // +1 hour

    const updated = await prisma.bookingRequest.update({
      where: { id: bookingId },
      data: {
        handoverInitiatedAt:     now,
        renterInspectionDeadline: deadline,
        bookingStatus: "HANDOVER_INSPECTION",
        // FIX #20: Keep legacy status in sync
        status: "active",
      },
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
  // FIX #4: Enforces renterInspectionDeadline
  // ─────────────────────────────────────────────────────────────────────

  static async renterReceivingInspection(
    bookingId: string,
    userId: string,
    input: RenterReceivingInspectionInput
  ) {
    const booking = await prisma.bookingRequest.findUnique({
      where: { id: bookingId },
      include: { seeker: true },
    });
    if (!booking) throw new Error("Booking not found");

    const business = await BusinessService.getBusinessByUserId(userId);
    if (!business || business.id !== booking.seekerId) {
      throw new Error("Only the renter can perform receiving inspection");
    }

    if (booking.bookingStatus !== "HANDOVER_INSPECTION") {
      throw new Error("Booking is not in HANDOVER_INSPECTION status");
    }

    // FIX #4: Deadline enforcement
    const now = new Date();
    if (booking.renterInspectionDeadline && now > booking.renterInspectionDeadline) {
      throw new Error(
        "Renter inspection window has expired. The booking was auto-accepted by the system."
      );
    }

    if (input.status === "ACCEPTED") {
      const updated = await prisma.$transaction(async (tx) => {
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

        if (input.evidenceUrls?.length) {
          for (const url of input.evidenceUrls) {
            await tx.evidence.create({
              data: {
                bookingId,
                inspectionId: inspection.id,
                uploadedById: business.id,
                stage: "RECEIVING",
                fileUrl: url,
              },
            });
          }
        }

        const b = await tx.bookingRequest.update({
          where: { id: bookingId },
          data: {
            bookingStatus:   "ACTIVE",
            financialStatus: "RENT_RELEASED",
            status:          "active",   // FIX #20
          },
        });

        await tx.paymentTransaction.create({
          data: {
            bookingId,
            type: "RENT_PAYOUT",
            amountPaise: booking.rentAmountPaise,
            status: "COMPLETED",
            providerReference: `RENT_RELEASE_${bookingId}`,   // stable (#18)
          },
        });

        return b;
      });

      await this.recordTimelineEvent(
        bookingId, "RECEIVING_ACCEPTED", business.id, "RENTER",
        "Resource Accepted by Renter",
        `Renter confirmed physical receipt and acceptable condition. Rent (₹${(booking.rentAmountPaise / 100).toLocaleString()}) disbursed to owner; Security Deposit (₹${(booking.securityDepositPaise / 100).toLocaleString()}) remains safely held in escrow.`
      );

      return updated;

    } else {
      // REPORTED_ISSUE → DISPUTED
      const updated = await prisma.$transaction(async (tx) => {
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

        if (input.evidenceUrls?.length) {
          for (const url of input.evidenceUrls) {
            await tx.evidence.create({
              data: {
                bookingId,
                inspectionId: inspection.id,
                uploadedById: business.id,
                stage: "RECEIVING",
                fileUrl: url,
                notes: input.issueDescription,
              },
            });
          }
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

        return tx.bookingRequest.update({
          where: { id: bookingId },
          data: {
            bookingStatus: "DISPUTED",
            status: "disputed",   // FIX #20
          },
        });
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
  // FIX #11: Adds note if return is before endDate (early return awareness)
  // ─────────────────────────────────────────────────────────────────────

  static async initiateReturn(
    bookingId: string,
    userId: string,
    input: ReturnInitiationInput
  ) {
    const booking = await prisma.bookingRequest.findUnique({
      where: { id: bookingId },
    });
    if (!booking) throw new Error("Booking not found");

    const business = await BusinessService.getBusinessByUserId(userId);
    if (!business || business.id !== booking.seekerId) {
      throw new Error("Only the renter can mark resource returned");
    }

    if (booking.bookingStatus !== "ACTIVE") {
      throw new Error("Booking must be in ACTIVE status to initiate return");
    }

    const now = new Date();
    const isEarlyReturn = now < booking.endDate;

    const updated = await prisma.$transaction(async (tx) => {
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

      if (input.returnEvidenceUrls?.length) {
        for (const url of input.returnEvidenceUrls) {
          await tx.evidence.create({
            data: {
              bookingId,
              inspectionId: inspection.id,
              uploadedById: business.id,
              stage: "RETURN",
              fileUrl: url,
            },
          });
        }
      }

      return tx.bookingRequest.update({
        where: { id: bookingId },
        data: {
          returnInitiatedAt: now,
          bookingStatus: "RETURN_INITIATED",
          status: "return_initiated",   // FIX #20
        },
      });
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
  // FIX #10: Guard on bookingStatus === RETURN_INITIATED
  // FIX #12: Sets bookingStatus to DISPUTED (not RETURN_NOT_RECEIVED) so
  //          adminResolveDispute can handle it uniformly
  // ─────────────────────────────────────────────────────────────────────

  static async ownerConfirmReceipt(
    bookingId: string,
    userId: string,
    input: OwnerReceiptInput
  ) {
    const booking = await prisma.bookingRequest.findUnique({
      where: { id: bookingId },
    });
    if (!booking) throw new Error("Booking not found");

    const business = await BusinessService.getBusinessByUserId(userId);
    if (!business || business.id !== booking.providerId) {
      throw new Error("Only the resource owner can confirm return receipt");
    }

    // FIX #10: State guard
    if (booking.bookingStatus !== "RETURN_INITIATED") {
      throw new Error("Return must be initiated by the renter before owner can confirm receipt");
    }

    const now = new Date();

    if (input.received) {
      const deadline = new Date(now.getTime() + 2 * 60 * 60 * 1000); // +2 hours
      const updated = await prisma.bookingRequest.update({
        where: { id: bookingId },
        data: {
          ownerReceivedAt:         now,
          ownerInspectionDeadline: deadline,
          bookingStatus:           "OWNER_INSPECTION",
          status:                  "owner_inspection",   // FIX #20
        },
      });

      await this.recordTimelineEvent(
        bookingId, "OWNER_RECEIPT_CONFIRMED", business.id, "OWNER",
        "Physical Receipt Confirmed (2-Hour Window Started)",
        `Owner confirmed physical receipt of returned items. 2-hour inspection window active until ${deadline.toLocaleTimeString()}. If no damage is reported, the security deposit of ₹${(booking.securityDepositPaise / 100).toLocaleString()} will be automatically refunded.`
      );

      return updated;

    } else {
      // FIX #12: Fake return — transition to DISPUTED (not RETURN_NOT_RECEIVED)
      // so admin can resolve it uniformly via adminResolveDispute
      const updated = await prisma.$transaction(async (tx) => {
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

        return tx.bookingRequest.update({
          where: { id: bookingId },
          data: {
            bookingStatus: "DISPUTED",   // FIX #12 — was RETURN_NOT_RECEIVED
            status: "disputed",
            nonReturnReportedAt: now,
          },
        });
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
  // FIX #6: Guard on bookingStatus === OWNER_INSPECTION
  // ─────────────────────────────────────────────────────────────────────

  static async ownerAcceptReturn(
    bookingId: string,
    userId: string,
    _notes?: string
  ) {
    const booking = await prisma.bookingRequest.findUnique({
      where: { id: bookingId },
    });
    if (!booking) throw new Error("Booking not found");

    const business = await BusinessService.getBusinessByUserId(userId);
    if (!business || business.id !== booking.providerId) {
      throw new Error("Only the owner can accept return condition");
    }

    // FIX #6: State guard
    if (booking.bookingStatus !== "OWNER_INSPECTION") {
      throw new Error(
        "Return condition can only be accepted during the OWNER_INSPECTION window"
      );
    }

    const now = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const b = await tx.bookingRequest.update({
        where: { id: bookingId },
        data: {
          bookingStatus:   "COMPLETED",
          financialStatus: "DEPOSIT_REFUNDED",
          completedAt:     now,
          status:          "completed",   // FIX #20
        },
      });

      await tx.paymentTransaction.create({
        data: {
          bookingId,
          type: "DEPOSIT_REFUND",
          amountPaise: booking.securityDepositPaise,
          status: "COMPLETED",
          providerReference: `REFUND_OK_${bookingId}`,   // stable (#18)
        },
      });

      return b;
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
  // FIX #5: Guard on bookingStatus === OWNER_INSPECTION + deadline check
  // FIX #15: Validate claimedAmountPaise <= securityDepositPaise
  // ─────────────────────────────────────────────────────────────────────

  static async ownerSubmitDamageClaim(
    bookingId: string,
    userId: string,
    input: OwnerDamageClaimInput
  ) {
    const booking = await prisma.bookingRequest.findUnique({
      where: { id: bookingId },
    });
    if (!booking) throw new Error("Booking not found");

    const business = await BusinessService.getBusinessByUserId(userId);
    if (!business || business.id !== booking.providerId) {
      throw new Error("Only the resource owner can submit damage claims");
    }

    // FIX #5: State guard
    if (booking.bookingStatus !== "OWNER_INSPECTION") {
      throw new Error(
        "Damage claims can only be submitted during the OWNER_INSPECTION window"
      );
    }

    // FIX #5: Deadline enforcement
    if (booking.ownerInspectionDeadline && new Date() > booking.ownerInspectionDeadline) {
      throw new Error("Owner inspection window has expired. No damage claim can be submitted.");
    }

    // FIX #15: Claimed amount cannot exceed deposit
    if (input.claimedAmountPaise > booking.securityDepositPaise) {
      throw new Error(
        `Claimed amount (₹${(input.claimedAmountPaise / 100).toLocaleString()}) cannot exceed the security deposit (₹${(booking.securityDepositPaise / 100).toLocaleString()})`
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
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

      for (const url of input.evidenceUrls) {
        await tx.evidence.create({
          data: {
            bookingId,
            uploadedById: business.id,
            stage: "DAMAGE_CLAIM",
            fileUrl: url,
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

      return tx.bookingRequest.update({
        where: { id: bookingId },
        data: {
          bookingStatus: "DISPUTED",
          status: "disputed",   // FIX #20
        },
      });
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
  // FIX #7: Explicit null guards & correct ordering for claim/dispute fetch
  // ─────────────────────────────────────────────────────────────────────

  static async renterRespondClaim(
    bookingId: string,
    userId: string,
    input: RenterClaimResponseInput
  ) {
    const booking = await prisma.bookingRequest.findUnique({
      where: { id: bookingId },
      include: {
        damageClaims: { orderBy: { createdAt: "desc" } },   // FIX #7: explicit order
        disputes:     { orderBy: { createdAt: "desc" } },
      },
    });
    if (!booking) throw new Error("Booking not found");

    const business = await BusinessService.getBusinessByUserId(userId);
    if (!business || business.id !== booking.seekerId) {
      throw new Error("Only the renter can respond to damage claims");
    }

    if (booking.bookingStatus !== "DISPUTED") {
      throw new Error("Booking must be in DISPUTED status to respond to a claim");
    }

    // FIX #7: Explicit null checks
    const claim   = booking.damageClaims[0];
    const dispute = booking.disputes[0];

    if (!claim)   throw new Error("No pending damage claim found for this booking");
    if (!dispute) throw new Error("No open dispute found for this booking");

    if (input.action === "ACCEPT") {
      // Renter accepts — settle
      const payoutToOwner  = Math.min(claim.claimedAmountPaise, booking.securityDepositPaise);
      const refundToRenter = Math.max(0, booking.securityDepositPaise - payoutToOwner);

      const updated = await prisma.$transaction(async (tx) => {
        await tx.dispute.update({
          where: { id: dispute.id },
          data: {
            status: "RESOLVED",
            renterResponse: "Accepted by renter",
            adminDecision: "PAY_OWNER",
            resolutionAmountPaise: payoutToOwner,
            resolutionNotes: "Renter accepted claim without dispute.",
            resolvedAt: new Date(),
          },
        });

        await tx.damageClaim.update({
          where: { id: claim.id },
          data: { status: "RESOLVED", resolvedAt: new Date() },
        });

        if (payoutToOwner > 0) {
          await tx.paymentTransaction.create({
            data: {
              bookingId,
              type: "DAMAGE_PAYOUT",
              amountPaise: payoutToOwner,
              status: "COMPLETED",
              providerReference: `DAMAGE_PAYOUT_${bookingId}`,   // stable (#18)
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
              providerReference: `REM_DEPOSIT_${bookingId}`,   // stable (#18)
            },
          });
        }

        return tx.bookingRequest.update({
          where: { id: bookingId },
          data: {
            bookingStatus:   "COMPLETED",
            financialStatus: "PARTIAL_SETTLEMENT",
            completedAt:     new Date(),
            status:          "completed",   // FIX #20
          },
        });
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

        if (input.rebuttalEvidenceUrls?.length) {
          for (const url of input.rebuttalEvidenceUrls) {
            await tx.evidence.create({
              data: {
                bookingId,
                uploadedById: business.id,
                stage: "RENTER_REBUTTAL",
                fileUrl: url,
                notes: input.rebuttalNotes,
              },
            });
          }
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
  // ADMIN RESOLVES DISPUTE
  // FIX #8: Verifies caller is an actual Admin record in the database
  // ─────────────────────────────────────────────────────────────────────

  static async adminResolveDispute(
    bookingId: string,
    adminUserId: string,
    input: AdminResolveDisputeInput
  ) {
    // FIX #8: Verify admin role — must exist in the admins table
    const admin = await prisma.admin.findUnique({ where: { id: adminUserId } });
    if (!admin) {
      throw new Error("Unauthorized: Admin access required to resolve disputes");
    }

    const booking = await prisma.bookingRequest.findUnique({
      where: { id: bookingId },
      include: {
        damageClaims: { orderBy: { createdAt: "desc" } },   // FIX #7 consistency
        disputes:     { orderBy: { createdAt: "desc" } },
      },
    });
    if (!booking) throw new Error("Booking not found");

    if (booking.bookingStatus !== "DISPUTED") {
      throw new Error("Only DISPUTED bookings can be resolved by admin");
    }

    const dispute = booking.disputes[0];
    const claim   = booking.damageClaims[0];

    const now = new Date();

    const updated = await prisma.$transaction(async (tx) => {
      let financialStatus = "PARTIAL_SETTLEMENT";
      let resolutionAmount = input.resolutionAmountPaise ?? 0;

      if (input.decision === "REFUND_RENTER" || input.decision === "REJECT_CLAIM") {
        financialStatus  = "DEPOSIT_REFUNDED";
        resolutionAmount = booking.securityDepositPaise;

        await tx.paymentTransaction.create({
          data: {
            bookingId,
            type: "DEPOSIT_REFUND",
            amountPaise: booking.securityDepositPaise,
            status: "COMPLETED",
            providerReference: `ADMIN_FULL_REFUND_${bookingId}`,   // stable (#18)
          },
        });

      } else if (input.decision === "PAY_OWNER") {
        financialStatus  = "DEPOSIT_TO_OWNER";
        resolutionAmount = booking.securityDepositPaise;

        await tx.paymentTransaction.create({
          data: {
            bookingId,
            type: "DAMAGE_PAYOUT",
            amountPaise: booking.securityDepositPaise,
            status: "COMPLETED",
            providerReference: `ADMIN_PAY_OWNER_${bookingId}`,   // stable (#18)
          },
        });

      } else if (input.decision === "PARTIAL_SETTLEMENT") {
        financialStatus = "PARTIAL_SETTLEMENT";
        const ownerShare  = Math.min(resolutionAmount, booking.securityDepositPaise);
        const renterShare = Math.max(0, booking.securityDepositPaise - ownerShare);

        if (ownerShare > 0) {
          await tx.paymentTransaction.create({
            data: {
              bookingId,
              type: "DAMAGE_PAYOUT",
              amountPaise: ownerShare,
              status: "COMPLETED",
              providerReference: `ADMIN_PARTIAL_OWNER_${bookingId}`,   // stable (#18)
            },
          });
        }
        if (renterShare > 0) {
          await tx.paymentTransaction.create({
            data: {
              bookingId,
              type: "DEPOSIT_REFUND",
              amountPaise: renterShare,
              status: "COMPLETED",
              providerReference: `ADMIN_PARTIAL_RENTER_${bookingId}`,   // stable (#18)
            },
          });
        }
      }

      if (dispute) {
        await tx.dispute.update({
          where: { id: dispute.id },
          data: {
            status: "RESOLVED",
            adminDecision: input.decision,
            resolutionAmountPaise: resolutionAmount,
            resolutionNotes: input.resolutionNotes,
            resolvedById: adminUserId,
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

      return tx.bookingRequest.update({
        where: { id: bookingId },
        data: {
          bookingStatus:   "COMPLETED",
          financialStatus,
          completedAt:     now,
          status:          "completed",   // FIX #20
        },
      });
    });

    await this.recordTimelineEvent(
      bookingId, "DISPUTE_RESOLVED", adminUserId, "ADMIN",
      `Dispute Resolved by Customer Care (${input.decision})`,
      `${input.resolutionNotes}. Financial settlement executed.`
    );

    return updated;
  }

  // ─────────────────────────────────────────────────────────────────────
  // REPORT NON-RETURN
  // FIX #9: Guard on bookingStatus === ACTIVE + endDate must have passed
  // ─────────────────────────────────────────────────────────────────────

  static async reportNonReturn(bookingId: string, userId: string) {
    const booking = await prisma.bookingRequest.findUnique({
      where: { id: bookingId },
    });
    if (!booking) throw new Error("Booking not found");

    const business = await BusinessService.getBusinessByUserId(userId);
    if (!business || business.id !== booking.providerId) {
      throw new Error("Only the owner can report non-return");
    }

    // FIX #9: State guard
    if (booking.bookingStatus !== "ACTIVE") {
      throw new Error("Non-return can only be reported when the booking is ACTIVE");
    }

    // FIX #9: Cannot report non-return before the rental period has ended
    if (new Date() < booking.endDate) {
      throw new Error("Cannot report non-return before the agreed rental end date");
    }

    const now = new Date();
    const updated = await prisma.$transaction(async (tx) => {
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

      return tx.bookingRequest.update({
        where: { id: bookingId },
        data: {
          bookingStatus:       "DISPUTED",   // FIX #9: route through DISPUTED for admin resolution
          nonReturnReportedAt: now,
          status:              "disputed",   // FIX #20
        },
      });
    });

    await this.recordTimelineEvent(
      bookingId, "NON_RETURN_REPORTED", business.id, "OWNER",
      "Resource Non-Return Reported",
      "Owner reported that the resource was not returned after the agreed rental period. Dispute opened; deposit held; sent to Customer Care."
    );

    return updated;
  }
}
