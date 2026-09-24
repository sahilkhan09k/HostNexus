import { prisma } from "../config/database.js";
import { BusinessService } from "./business.service.js";
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
  /**
   * Helper: Record a chronological audit timeline event
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

  /**
   * Idempotent server-side evaluation of expired inspections (Renter 1hr & Owner 2hr)
   */
  static async processExpiredInspections(): Promise<void> {
    const now = new Date();

    // 1. Renter inspection timeouts (1 hour expired without reporting an issue)
    const expiredRenterInspections = await prisma.bookingRequest.findMany({
      where: {
        bookingStatus: "HANDOVER_INSPECTION",
        renterInspectionDeadline: {
          lte: now,
        },
      },
    });

    for (const booking of expiredRenterInspections) {
      await prisma.$transaction(async (tx) => {
        await tx.bookingRequest.update({
          where: { id: booking.id },
          data: {
            bookingStatus: "ACTIVE",
            financialStatus: "RENT_RELEASED",
          },
        });

        // Record payout of rent to owner
        await tx.paymentTransaction.create({
          data: {
            bookingId: booking.id,
            type: "RENT_PAYOUT",
            amountPaise: booking.rentAmountPaise,
            status: "COMPLETED",
            providerReference: `AUTO_RENT_${booking.id}`,
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
        ownerInspectionDeadline: {
          lte: now,
        },
      },
      include: {
        damageClaims: true,
      },
    });

    for (const booking of expiredOwnerInspections) {
      // If no damage claim exists, auto refund deposit to renter
      if (booking.damageClaims.length === 0) {
        await prisma.$transaction(async (tx) => {
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
              providerReference: `AUTO_REFUND_${booking.id}`,
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

  /**
   * Create a new booking request with commercial & condition snapshots
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
      include: { business: true },
    });

    if (!resource) {
      throw new Error("Resource not found");
    }

    if (!resource.isActive) {
      throw new Error("This resource is not available for booking");
    }

    if (resource.businessId === seekerBusiness.id) {
      throw new Error("You cannot book your own resource");
    }

    const startDate = new Date(input.startDate);
    const endDate = new Date(input.endDate);
    const totalDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));

    if (endDate.getTime() < startDate.getTime()) {
      throw new Error("End date must be after start date");
    }

    // Exact financial calculation in paise
    const rentAmountPaise = resource.rentAmountPaise * totalDays;
    const securityDepositPaise = resource.securityDepositPaise;
    const totalAmountPaise = rentAmountPaise + securityDepositPaise;

    // Create commercial & condition snapshot (immutable chain of custody baseline)
    const conditionSnapshot = {
      resourceName: resource.name,
      resourceType: resource.resourceType,
      quantity: input.quantity,
      location: resource.location,
    };

    const listingPhotosSnapshot = resource.photos || [];

    const damageDisclosureSnapshot = {
      hasPreExistingDamage: resource.hasPreExistingDamage,
      damageDescription: resource.damageDescription,
      damagePhotos: resource.damagePhotos || [],
    };

    const bookingRequest = await prisma.bookingRequest.create({
      data: {
        seekerId: seekerBusiness.id,
        providerId: resource.businessId,
        resourceId: input.resourceId,
        quantity: input.quantity,
        startDate,
        endDate,
        totalDays,
        specialRequests: input.specialRequests || null,
        bookingStatus: "BOOKING_REQUESTED",
        financialStatus: "PENDING_PAYMENT",
        status: "pending",
        rentAmountPaise,
        securityDepositPaise,
        totalAmountPaise,
        proposedPrice: input.proposedPrice || (totalAmountPaise / 100),
        conditionSnapshot: conditionSnapshot as any,
        listingPhotosSnapshot,
        damageDisclosureSnapshot: damageDisclosureSnapshot as any,
        termsVersion: "v2.0",
      },
      include: {
        resource: true,
        seeker: true,
        provider: true,
      },
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

  /**
   * Get all booking requests for a user's business
   */
  static async getBookingRequests(userId: string, query: BookingQuery) {
    // Lazy check on queries
    await this.processExpiredInspections();

    const business = await BusinessService.getBusinessByUserId(userId);
    if (!business) {
      throw new Error("You must have a business to view booking requests");
    }

    let where: any = {};
    if (query.type === "incoming") {
      where.providerId = business.id;
    } else if (query.type === "outgoing") {
      where.seekerId = business.id;
    } else {
      where.OR = [{ providerId: business.id }, { seekerId: business.id }];
    }

    if (query.bookingStatus) {
      where.bookingStatus = query.bookingStatus;
    }
    if (query.financialStatus) {
      where.financialStatus = query.financialStatus;
    }
    if (query.status) {
      where.status = query.status;
    }

    const bookingRequests = await prisma.bookingRequest.findMany({
      where,
      include: {
        resource: {
          select: {
            id: true,
            name: true,
            resourceType: true,
            location: true,
            photos: true,
          },
        },
        seeker: {
          select: {
            id: true,
            name: true,
          },
        },
        provider: {
          select: {
            id: true,
            name: true,
          },
        },
        damageClaims: true,
        disputes: true,
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
      orderBy: {
        createdAt: "desc",
      },
    });

    return bookingRequests;
  }

  /**
   * Get a booking request by ID with full chain of custody details
   */
  static async getBookingRequestById(bookingId: string) {
    await this.processExpiredInspections();

    const bookingRequest = await prisma.bookingRequest.findUnique({
      where: { id: bookingId },
      include: {
        resource: true,
        seeker: true,
        provider: true,
        inspections: {
          include: {
            evidence: true,
          },
          orderBy: {
            createdAt: "asc",
          },
        },
        evidence: {
          orderBy: {
            createdAt: "asc",
          },
        },
        damageClaims: {
          include: {
            disputes: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        },
        disputes: {
          orderBy: {
            createdAt: "desc",
          },
        },
        paymentTransactions: {
          orderBy: {
            createdAt: "asc",
          },
        },
        timelineEvents: {
          orderBy: {
            createdAt: "asc",
          },
        },
        negotiation: {
          include: {
            offers: {
              include: {
                proposer: { select: { id: true, name: true } },
              },
              orderBy: { createdAt: "asc" },
            },
          },
        },
      },
    });

    return bookingRequest;
  }

  /**
   * Owner accepts or rejects booking request
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
    const isSeeker = booking.seekerId === business.id;

    if (!isProvider && !isSeeker) {
      throw new Error("Unauthorized to update this booking");
    }

    if (input.status === "accepted") {
      if (!isProvider) throw new Error("Only the owner can accept bookings");
      const updated = await prisma.bookingRequest.update({
        where: { id: bookingId },
        data: {
          status: "accepted",
          bookingStatus: "BOOKING_ACCEPTED",
        },
      });

      await this.recordTimelineEvent(
        bookingId,
        "BOOKING_ACCEPTED",
        business.id,
        "OWNER",
        "Booking Accepted",
        `Owner ${booking.provider.name} accepted the booking request. Awaiting renter escrow payment.`
      );
      return updated;
    }

    if (input.status === "rejected") {
      if (!isProvider) throw new Error("Only the owner can reject bookings");
      const updated = await prisma.bookingRequest.update({
        where: { id: bookingId },
        data: {
          status: "rejected",
          bookingStatus: "CANCELLED",
          rejectionReason: input.rejectionReason || null,
        },
      });

      await this.recordTimelineEvent(
        bookingId,
        "BOOKING_REJECTED",
        business.id,
        "OWNER",
        "Booking Rejected",
        input.rejectionReason || "Owner declined the booking request."
      );
      return updated;
    }

    if (input.status === "cancelled") {
      if (!isSeeker) throw new Error("Only the requester can cancel bookings");
      const updated = await prisma.bookingRequest.update({
        where: { id: bookingId },
        data: {
          status: "cancelled",
          bookingStatus: "CANCELLED",
          rejectionReason: input.rejectionReason || "Cancelled by renter",
        },
      });

      await this.recordTimelineEvent(
        bookingId,
        "BOOKING_CANCELLED",
        business.id,
        "RENTER",
        "Booking Cancelled",
        input.rejectionReason || "Renter cancelled the booking."
      );
      return updated;
    }

    return booking;
  }

  /**
   * Renter funds escrow (Rent + Security Deposit)
   */
  static async payEscrow(bookingId: string, userId: string) {
    const booking = await prisma.bookingRequest.findUnique({
      where: { id: bookingId },
      include: { seeker: true },
    });
    if (!booking) throw new Error("Booking not found");

    const business = await BusinessService.getBusinessByUserId(userId);
    if (!business || business.id !== booking.seekerId) {
      throw new Error("Only the renter can fund escrow");
    }

    const updated = await prisma.$transaction(async (tx) => {
      const b = await tx.bookingRequest.update({
        where: { id: bookingId },
        data: {
          financialStatus: "FUNDS_HELD",
        },
      });

      await tx.paymentTransaction.create({
        data: {
          bookingId,
          type: "ESCROW_DEPOSIT",
          amountPaise: booking.totalAmountPaise,
          status: "COMPLETED",
          providerReference: `SIM_ESCROW_${Date.now()}`,
        },
      });

      return b;
    });

    await this.recordTimelineEvent(
      bookingId,
      "ESCROW_FUNDED",
      business.id,
      "RENTER",
      "Escrow Funded",
      `₹${(booking.totalAmountPaise / 100).toLocaleString()} (Rent: ₹${(booking.rentAmountPaise / 100).toLocaleString()} + Deposit: ₹${(booking.securityDepositPaise / 100).toLocaleString()}) safely held in platform escrow.`
    );

    return updated;
  }

  /**
   * Owner marks resource handed over -> starts 1-hour renter inspection window
   */
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

    const now = new Date();
    const deadline = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour

    const updated = await prisma.bookingRequest.update({
      where: { id: bookingId },
      data: {
        handoverInitiatedAt: now,
        renterInspectionDeadline: deadline,
        bookingStatus: "HANDOVER_INSPECTION",
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

  /**
   * Renter performs receiving inspection (Accept or Report Issue)
   */
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
      throw new Error("Booking is not in receiving inspection status");
    }

    if (input.status === "ACCEPTED") {
      // Transition to ACTIVE & RENT_RELEASED
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

        if (input.evidenceUrls && input.evidenceUrls.length > 0) {
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
            bookingStatus: "ACTIVE",
            financialStatus: "RENT_RELEASED",
          },
        });

        await tx.paymentTransaction.create({
          data: {
            bookingId,
            type: "RENT_PAYOUT",
            amountPaise: booking.rentAmountPaise,
            status: "COMPLETED",
            providerReference: `RENT_RELEASE_${Date.now()}`,
          },
        });

        return b;
      });

      await this.recordTimelineEvent(
        bookingId,
        "RECEIVING_ACCEPTED",
        business.id,
        "RENTER",
        "Resource Accepted by Renter",
        `Renter confirmed physical receipt and acceptable condition. Rent (₹${(booking.rentAmountPaise / 100).toLocaleString()}) disbursed to owner; Security Deposit (₹${(booking.securityDepositPaise / 100).toLocaleString()}) remains safely held in escrow.`
      );

      return updated;
    } else {
      // REPORTED_ISSUE -> DISPUTED
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

        if (input.evidenceUrls && input.evidenceUrls.length > 0) {
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

        return await tx.bookingRequest.update({
          where: { id: bookingId },
          data: {
            bookingStatus: "DISPUTED",
          },
        });
      });

      await this.recordTimelineEvent(
        bookingId,
        "RECEIVING_ISSUE",
        business.id,
        "RENTER",
        "Critical Handover Issue Reported",
        `Renter reported severe discrepancy or defects during receiving inspection: "${input.issueDescription}". Booking entered dispute; platform escrow frozen.`
      );

      return updated;
    }
  }

  /**
   * Renter returns resource and uploads return evidence
   */
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
      throw new Error("Booking must be in active status to initiate return");
    }

    const now = new Date();
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

      if (input.returnEvidenceUrls && input.returnEvidenceUrls.length > 0) {
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

      return await tx.bookingRequest.update({
        where: { id: bookingId },
        data: {
          returnInitiatedAt: now,
          bookingStatus: "RETURN_INITIATED",
        },
      });
    });

    await this.recordTimelineEvent(
      bookingId,
      "RETURN_INITIATED",
      business.id,
      "RENTER",
      "Resource Return Initiated",
      "Renter marked resources returned and uploaded return condition evidence. Awaiting owner confirmation of physical receipt."
    );

    return updated;
  }

  /**
   * Owner confirms receipt (Fake Return Protection)
   */
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

    const now = new Date();

    if (input.received) {
      const deadline = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours
      const updated = await prisma.bookingRequest.update({
        where: { id: bookingId },
        data: {
          ownerReceivedAt: now,
          ownerInspectionDeadline: deadline,
          bookingStatus: "OWNER_INSPECTION",
        },
      });

      await this.recordTimelineEvent(
        bookingId,
        "OWNER_RECEIPT_CONFIRMED",
        business.id,
        "OWNER",
        "Physical Receipt Confirmed (2-Hour Window Started)",
        `Owner confirmed physical receipt of returned items. 2-hour inspection window active until ${deadline.toLocaleTimeString()}. If no damage is reported, the security deposit of ₹${(booking.securityDepositPaise / 100).toLocaleString()} will be automatically refunded.`
      );

      return updated;
    } else {
      // Fake return: owner declares NOT received
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

        return await tx.bookingRequest.update({
          where: { id: bookingId },
          data: {
            bookingStatus: "RETURN_NOT_RECEIVED",
          },
        });
      });

      await this.recordTimelineEvent(
        bookingId,
        "RETURN_NOT_RECEIVED",
        business.id,
        "OWNER",
        "Return Not Received (Dispute Filed)",
        "Owner reported resources were NOT received despite return claim. Incident flagged for customer care review."
      );

      return updated;
    }
  }

  /**
   * Owner accepts return condition ("Everything is OK") -> deposit refunded, completed
   */
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

    const now = new Date();

    const updated = await prisma.$transaction(async (tx) => {
      const b = await tx.bookingRequest.update({
        where: { id: bookingId },
        data: {
          bookingStatus: "COMPLETED",
          financialStatus: "DEPOSIT_REFUNDED",
          completedAt: now,
          status: "completed",
        },
      });

      await tx.paymentTransaction.create({
        data: {
          bookingId,
          type: "DEPOSIT_REFUND",
          amountPaise: booking.securityDepositPaise,
          status: "COMPLETED",
          providerReference: `REFUND_OK_${Date.now()}`,
        },
      });

      return b;
    });

    await this.recordTimelineEvent(
      bookingId,
      "OWNER_RETURN_ACCEPTED",
      business.id,
      "OWNER",
      "Return Accepted & Deposit Released",
      `Owner confirmed pristine condition. Security deposit (₹${(booking.securityDepositPaise / 100).toLocaleString()}) refunded to renter. Rental transaction complete.`
    );

    return updated;
  }

  /**
   * Owner submits return damage / missing quantity claim
   */
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

    const updated = await prisma.$transaction(async (tx) => {
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

      return await tx.bookingRequest.update({
        where: { id: bookingId },
        data: {
          bookingStatus: "DISPUTED",
        },
      });
    });

    await this.recordTimelineEvent(
      bookingId,
      "DAMAGE_CLAIMED",
      business.id,
      "OWNER",
      "Owner Filed Damage Claim",
      `Owner filed a claim for ₹${(input.claimedAmountPaise / 100).toLocaleString()} (${input.claimType}): "${input.description}". Deposit held in dispute.`
    );

    return updated;
  }

  /**
   * Renter responds to damage claim (Accept or Dispute)
   */
  static async renterRespondClaim(
    bookingId: string,
    userId: string,
    input: RenterClaimResponseInput
  ) {
    const booking = await prisma.bookingRequest.findUnique({
      where: { id: bookingId },
      include: { damageClaims: true, disputes: true },
    });
    if (!booking) throw new Error("Booking not found");

    const business = await BusinessService.getBusinessByUserId(userId);
    if (!business || business.id !== booking.seekerId) {
      throw new Error("Only the renter can respond to damage claims");
    }

    const claim = booking.damageClaims[0];
    const dispute = booking.disputes[0];

    if (input.action === "ACCEPT") {
      // Renter accepts claim -> settle claim amount to owner, refund remaining deposit to renter
      const payoutToOwner = Math.min(claim.claimedAmountPaise, booking.securityDepositPaise);
      const refundToRenter = Math.max(0, booking.securityDepositPaise - payoutToOwner);

      const updated = await prisma.$transaction(async (tx) => {
        if (dispute) {
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
        }

        if (claim) {
          await tx.damageClaim.update({
            where: { id: claim.id },
            data: { status: "RESOLVED", resolvedAt: new Date() },
          });
        }

        // Transactions
        if (payoutToOwner > 0) {
          await tx.paymentTransaction.create({
            data: {
              bookingId,
              type: "DAMAGE_PAYOUT",
              amountPaise: payoutToOwner,
              status: "COMPLETED",
              providerReference: `DAMAGE_PAYOUT_${Date.now()}`,
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
              providerReference: `REM_DEPOSIT_${Date.now()}`,
            },
          });
        }

        return await tx.bookingRequest.update({
          where: { id: bookingId },
          data: {
            bookingStatus: "COMPLETED",
            financialStatus: "PARTIAL_SETTLEMENT",
            completedAt: new Date(),
          },
        });
      });

      await this.recordTimelineEvent(
        bookingId,
        "CLAIM_ACCEPTED",
        business.id,
        "RENTER",
        "Damage Claim Accepted by Renter",
        `Renter agreed to ₹${(payoutToOwner / 100).toLocaleString()} deduction from deposit. Remaining ₹${(refundToRenter / 100).toLocaleString()} refunded.`
      );

      return updated;
    } else {
      // Dispute claim
      const updated = await prisma.$transaction(async (tx) => {
        if (dispute) {
          await tx.dispute.update({
            where: { id: dispute.id },
            data: {
              renterResponse: input.rebuttalNotes || null,
              renterReason: input.reason || "NOT_CAUSED_BY_RENTER",
            },
          });
        }

        if (input.rebuttalEvidenceUrls && input.rebuttalEvidenceUrls.length > 0) {
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

        return await tx.bookingRequest.findUnique({ where: { id: bookingId } });
      });

      await this.recordTimelineEvent(
        bookingId,
        "CLAIM_DISPUTED",
        business.id,
        "RENTER",
        "Renter Disputed Damage Claim",
        `Renter contested claim (${input.reason || "Disputed"}): "${input.rebuttalNotes || "Condition disputed"}". Sent to Customer Care Panel for review.`
      );

      return updated;
    }
  }

  /**
   * Customer Care / Admin resolves dispute
   */
  static async adminResolveDispute(
    bookingId: string,
    adminUserId: string,
    input: AdminResolveDisputeInput
  ) {
    const booking = await prisma.bookingRequest.findUnique({
      where: { id: bookingId },
      include: { damageClaims: true, disputes: true },
    });
    if (!booking) throw new Error("Booking not found");

    const dispute = booking.disputes[0];
    const claim = booking.damageClaims[0];

    const now = new Date();

    const updated = await prisma.$transaction(async (tx) => {
      let financialStatus: string = "PARTIAL_SETTLEMENT";
      let resolutionAmount = input.resolutionAmountPaise || 0;

      if (input.decision === "REFUND_RENTER" || input.decision === "REJECT_CLAIM") {
        financialStatus = "DEPOSIT_REFUNDED";
        resolutionAmount = booking.securityDepositPaise;

        await tx.paymentTransaction.create({
          data: {
            bookingId,
            type: "DEPOSIT_REFUND",
            amountPaise: booking.securityDepositPaise,
            status: "COMPLETED",
            providerReference: `ADMIN_FULL_REFUND_${Date.now()}`,
          },
        });
      } else if (input.decision === "PAY_OWNER") {
        financialStatus = "DEPOSIT_TO_OWNER";
        resolutionAmount = booking.securityDepositPaise;

        await tx.paymentTransaction.create({
          data: {
            bookingId,
            type: "DAMAGE_PAYOUT",
            amountPaise: booking.securityDepositPaise,
            status: "COMPLETED",
            providerReference: `ADMIN_PAY_OWNER_${Date.now()}`,
          },
        });
      } else if (input.decision === "PARTIAL_SETTLEMENT") {
        financialStatus = "PARTIAL_SETTLEMENT";
        const ownerShare = Math.min(resolutionAmount, booking.securityDepositPaise);
        const renterShare = Math.max(0, booking.securityDepositPaise - ownerShare);

        if (ownerShare > 0) {
          await tx.paymentTransaction.create({
            data: {
              bookingId,
              type: "DAMAGE_PAYOUT",
              amountPaise: ownerShare,
              status: "COMPLETED",
              providerReference: `ADMIN_PARTIAL_OWNER_${Date.now()}`,
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
              providerReference: `ADMIN_PARTIAL_RENTER_${Date.now()}`,
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

      return await tx.bookingRequest.update({
        where: { id: bookingId },
        data: {
          bookingStatus: "COMPLETED",
          financialStatus,
          completedAt: now,
          status: "completed",
        },
      });
    });

    await this.recordTimelineEvent(
      bookingId,
      "DISPUTE_RESOLVED",
      adminUserId,
      "ADMIN",
      `Dispute Resolved by Customer Care (${input.decision})`,
      `${input.resolutionNotes}. Financial settlement executed.`
    );

    return updated;
  }

  /**
   * Report non-return if rental period ends and item is never returned
   */
  static async reportNonReturn(bookingId: string, userId: string) {
    const booking = await prisma.bookingRequest.findUnique({
      where: { id: bookingId },
    });
    if (!booking) throw new Error("Booking not found");

    const business = await BusinessService.getBusinessByUserId(userId);
    if (!business || business.id !== booking.providerId) {
      throw new Error("Only the owner can report non-return");
    }

    const now = new Date();
    const updated = await prisma.bookingRequest.update({
      where: { id: bookingId },
      data: {
        bookingStatus: "NON_RETURNED",
        nonReturnReportedAt: now,
      },
    });

    await this.recordTimelineEvent(
      bookingId,
      "NON_RETURN_REPORTED",
      business.id,
      "OWNER",
      "Resource Non-Return Reported",
      "Owner reported that the resource was not returned after the agreed rental period. Deposit held; renter default registered."
    );

    return updated;
  }
}
