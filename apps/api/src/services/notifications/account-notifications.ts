import { prisma } from "../../config/database.js";
import { logger } from "../../utils/logger.js";
import { NotificationService } from "./notification.service.js";

/**
 * KYC / verification and reputation events. Like booking notifications these are
 * fire-and-forget: they never throw into the operation that triggered them.
 */

type KycEvent =
  | { kind: "SUBMITTED" } // registration needs manual review
  | { kind: "AUTO_VERIFIED" } // GSTIN matched at signup
  | { kind: "APPROVED" } // admin approved
  | { kind: "REJECTED"; reason?: string | null };

function safely(label: string, meta: Record<string, unknown>, work: () => Promise<void>): Promise<void> {
  return work().catch((err) => {
    logger.error(`${label} notification failed`, { ...meta, error: err instanceof Error ? err.message : String(err) });
  });
}

export function notifyKycEvent(userId: string, event: KycEvent): Promise<void> {
  return safely("KYC", { userId, event: event.kind }, async () => {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, ownerName: true, businesses: { select: { name: true }, take: 1 } },
    });
    if (!user) return;

    const businessName = user.businesses[0]?.name ?? "your business";
    const email = { to: user.email, recipientName: user.ownerName ?? businessName };

    switch (event.kind) {
      case "SUBMITTED":
        await NotificationService.notify({
          userId,
          type: "KYC_SUBMITTED",
          title: "Verification in progress",
          message: `Thanks for registering ${businessName} on HostNexus. Your GST details need a quick manual review — we'll email you as soon as your account is approved. You can sign in once it is verified.`,
          email,
        });
        // Work waiting in the admin console
        await NotificationService.notifyAdmins(
          "New business awaiting KYC review",
          `${businessName} registered and its GST details need manual verification. Review the application in the admin console.`
        );
        break;

      case "AUTO_VERIFIED":
      case "APPROVED":
        await NotificationService.notify({
          userId,
          type: "KYC_APPROVED",
          title: "Your business is verified",
          message: `${businessName} is verified on HostNexus. You can now list resources, send booking requests and negotiate with other businesses.`,
          data: { link: "/dashboard" },
          email: { ...email, ctaLabel: "Go to dashboard" },
        });
        break;

      case "REJECTED":
        await NotificationService.notify({
          userId,
          type: "KYC_REJECTED",
          title: "Verification unsuccessful",
          message: `We couldn't verify ${businessName}.${event.reason ? ` Reason: "${event.reason.slice(0, 500)}".` : ""} If you believe this is a mistake, please contact HostNexus support.`,
          email,
        });
        break;
    }
  });
}

/** Tells the reviewed business about a new review. Updates to an existing review stay silent. */
export function notifyReviewReceived(reviewId: string): Promise<void> {
  return safely("Review", { reviewId }, async () => {
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      select: {
        id: true,
        rating: true,
        bookingId: true,
        reviewer: { select: { name: true } },
        subject: { select: { id: true, ownerId: true } },
      },
    });
    if (!review) return;

    await NotificationService.notify({
      userId: review.subject.ownerId,
      type: "REVIEW_RECEIVED",
      title: "New review received",
      message: `${review.reviewer.name} rated your business ${review.rating}/5.`,
      data: {
        link: `/business/${review.subject.id}`,
        reviewId: review.id,
        bookingId: review.bookingId,
        businessId: review.subject.id,
      },
    });
  });
}
