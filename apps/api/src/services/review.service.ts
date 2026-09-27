import { prisma } from "../config/database.js";
import { BusinessService } from "./business.service.js";
import { conflict, forbidden, notFound, unprocessable } from "../utils/http-error.js";
import { notifyReviewReceived } from "./notifications/account-notifications.js";

export interface SubmitReviewInput {
  bookingId: string;
  rating: number;   // 1–5
  comment?: string;
}

// ─── Reputation aggregation helpers ──────────────────────────

/**
 * Compute full reputation stats for a business.
 * Called on-the-fly — no denormalised columns needed.
 */
export async function getBusinessReputation(businessId: string) {
  // All reviews where this business is the subject
  const reviews = await prisma.review.findMany({
    where: { subjectId: businessId },
    select: {
      rating: true,
      reviewerRole: true,
      comment: true,
      createdAt: true,
      reviewer: { select: { id: true, name: true, businessType: true, city: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Split by role the REVIEWER held — that tells us whether THIS business was
  // acting as owner (received by a RENTER reviewer) or renter (received by OWNER)
  const asOwnerReviews   = reviews.filter(r => r.reviewerRole === "RENTER");  // renter reviewed owner
  const asRenterReviews  = reviews.filter(r => r.reviewerRole === "OWNER");   // owner reviewed renter

  const avg = (arr: { rating: number }[]) =>
    arr.length ? +(arr.reduce((s, r) => s + r.rating, 0) / arr.length).toFixed(1) : null;

  // Booking counts
  const [resourcesGiven, resourcesTaken, completedBookings, ownerCancellations] = await Promise.all([
    // resources this business OWNED that reached COMPLETED
    prisma.bookingRequest.count({
      where: { providerId: businessId, bookingStatus: "COMPLETED" },
    }),
    // resources this business RENTED that reached COMPLETED
    prisma.bookingRequest.count({
      where: { seekerId: businessId, bookingStatus: "COMPLETED" },
    }),
    // total completed either side
    prisma.bookingRequest.count({
      where: {
        OR: [{ providerId: businessId }, { seekerId: businessId }],
        bookingStatus: "COMPLETED",
      },
    }),
    // accepted bookings this business cancelled as the owner (incl. no-shows)
    prisma.bookingRequest.count({
      where: { providerId: businessId, cancelledBy: "OWNER", acceptedAt: { not: null } },
    }),
  ]);

  return {
    totalReviews:       reviews.length,
    asOwnerRating:      avg(asOwnerReviews),
    asOwnerReviewCount: asOwnerReviews.length,
    asRenterRating:     avg(asRenterReviews),
    asRenterReviewCount: asRenterReviews.length,
    overallRating:      avg(reviews),
    resourcesGiven,     // times this biz successfully rented out a resource
    resourcesTaken,     // times this biz successfully rented in a resource
    completedBookings,
    ownerCancellations, // times this biz cancelled or failed to hand over after accepting
    recentReviews: reviews.slice(0, 10).map(r => ({
      rating:       r.rating,
      reviewerRole: r.reviewerRole,
      comment:      r.comment,
      createdAt:    r.createdAt,
      reviewer: {
        id:           r.reviewer.id,
        name:         r.reviewer.name,
        businessType: r.reviewer.businessType,
        city:         r.reviewer.city,
      },
    })),
  };
}

// ─── Review service ───────────────────────────────────────────

export class ReviewService {
  /**
   * Submit a review for a completed booking.
   * - Only allowed when bookingStatus === COMPLETED
   * - Each side (seeker / provider) can leave exactly one review per booking
   * - reviewerRole is determined by who is calling, not passed in
   */
  static async submitReview(
    userId: string,
    input: SubmitReviewInput
  ) {
    if (input.rating < 1 || input.rating > 5) {
      throw unprocessable("Rating must be between 1 and 5", "INVALID_RATING");
    }

    const business = await BusinessService.getBusinessByUserId(userId);
    if (!business) throw forbidden("You must have a business to submit a review", "NO_BUSINESS");

    const booking = await prisma.bookingRequest.findUnique({
      where: { id: input.bookingId },
      include: { seeker: true, provider: true },
    });
    const isSeeker   = booking?.seekerId   === business.id;
    const isProvider = booking?.providerId === business.id;

    if (!booking || (!isSeeker && !isProvider)) throw notFound("Booking not found");
    if (booking.bookingStatus !== "COMPLETED") {
      throw conflict("Reviews can only be submitted for completed bookings", "BOOKING_NOT_COMPLETED");
    }

    // Reviewer role = hat they wore in THIS booking
    const reviewerRole = isSeeker ? "RENTER" : "OWNER";
    // Subject = the other party
    const subjectId    = isSeeker ? booking.providerId : booking.seekerId;

    const reviewKey = {
      bookingId_reviewerId_reviewerRole: {
        bookingId:    input.bookingId,
        reviewerId:   business.id,
        reviewerRole,
      },
    };
    const isNew = !(await prisma.review.findUnique({ where: reviewKey, select: { id: true } }));

    // Upsert — idempotent if they try to re-submit
    const review = await prisma.review.upsert({
      where: reviewKey,
      update: {
        rating:  input.rating,
        comment: input.comment ?? null,
      },
      create: {
        bookingId:    input.bookingId,
        reviewerId:   business.id,
        subjectId,
        reviewerRole,
        rating:       input.rating,
        comment:      input.comment ?? null,
      },
    });

    // Only a first review is news to the other party; edits stay silent
    if (isNew) void notifyReviewReceived(review.id);

    return review;
  }

  /** Fetch all reviews left BY a business (as owner or renter) */
  static async getReviewsGiven(businessId: string) {
    return prisma.review.findMany({
      where: { reviewerId: businessId },
      include: {
        subject:  { select: { id: true, name: true, city: true } },
        booking:  { select: { id: true, startDate: true, endDate: true, resource: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /** Full profile: business info + address + reputation stats */
  static async getBusinessProfile(businessId: string) {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        name: true,
        businessType: true,
        city: true,
        state: true,
        createdAt: true,
        // Public endpoint: no personal contact details (phone, user id) of the owner
        owner: { select: { verificationStatus: true } },
        resources: {
          where: { isActive: true, deletedAt: null },
          select: {
            id: true, name: true, resourceType: true,
            rentAmountPaise: true, location: true, photos: true,
          },
          take: 6,
        },
      },
    });
    if (!business) throw notFound("Business not found");

    const reputation = await getBusinessReputation(businessId);

    return { business, reputation };
  }
}
