import { prisma } from "../../config/database.js";
import { logger } from "../../utils/logger.js";
import { NotificationService, type NotifyInput } from "./notification.service.js";
import { emitToUser, REALTIME_EVENTS } from "./realtime.service.js";
import type { NotificationType } from "./notification-types.js";

/**
 * Booking & negotiation events → who is told what.
 *
 * Services call `notifyBookingEvent(bookingId, event)` (without awaiting) after the
 * state change has committed. Recipients are always derived from the booking row
 * itself (renter = seeker business owner, owner = provider business owner), never
 * from request input. Both parties also get a `booking:updated` realtime signal so
 * open booking screens refresh.
 */

export type PartyRole = "OWNER" | "RENTER";

export type BookingEvent =
  | { kind: "REQUESTED" }
  | { kind: "ACCEPTED" }
  | { kind: "REJECTED" }
  | { kind: "CANCELLED"; by: PartyRole; refundedPaise: number }
  | { kind: "EXPIRED"; reason: "REQUEST" | "PAYMENT" }
  | { kind: "OWNER_NO_SHOW"; refundedPaise: number }
  | { kind: "PAYMENT_RECEIVED" }
  | { kind: "LATE_PAYMENT_REFUNDED"; refundedPaise: number }
  | { kind: "HANDOVER_STARTED"; deadline: Date }
  | { kind: "RENT_RELEASED"; auto: boolean }
  | { kind: "HANDOVER_ISSUE"; responseDeadline: Date }
  | { kind: "HANDOVER_ISSUE_CONTESTED" }
  | { kind: "RETURN_INITIATED"; early: boolean }
  | { kind: "RETURN_RECEIVED"; deadline: Date; auto?: boolean }
  | { kind: "RETURN_NOT_RECEIVED"; responseDeadline: Date }
  | { kind: "RETURN_ACCEPTED"; auto: boolean }
  | { kind: "DAMAGE_CLAIMED"; amountPaise: number; responseDeadline: Date }
  | { kind: "CLAIM_ACCEPTED"; payoutPaise: number; refundPaise: number; auto?: boolean }
  | { kind: "CLAIM_DISPUTED" }
  | { kind: "DISPUTE_RESOLVED"; decision: string }
  | { kind: "NON_RETURN_REPORTED"; bySystem: boolean; responseDeadline: Date | null }
  | { kind: "NEGOTIATION_OFFER"; by: PartyRole; amountPaise: number; message?: string | null }
  | { kind: "NEGOTIATION_ACCEPTED"; by: PartyRole; amountPaise: number }
  | { kind: "NEGOTIATION_REJECTED"; by: PartyRole };

interface Party {
  businessId: string;
  businessName: string;
  userId: string;
  email: string;
  ownerName: string | null;
}

export interface BookingContext {
  id: string;
  resourceId: string;
  resourceName: string;
  quantity: number;
  startDate: Date;
  endDate: Date;
  totalAmountPaise: number;
  securityDepositPaise: number;
  rejectionReason: string | null;
  owner: Party;
  renter: Party;
}

// ── Formatting ─────────────────────────────────────────────────────────

const TZ = "Asia/Kolkata";

export const rupees = (paise: number) =>
  `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

const day = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: TZ });
const time = (d: Date) => `${d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: TZ })} IST`;

/** Keeps user-written text (reasons, offer notes) short inside notifications */
const clip = (s: string, max = 280) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

const DECISION_TEXT: Record<string, string> = {
  REFUND_RENTER: "the full security deposit is refunded to the renter",
  REJECT_CLAIM: "the claim was rejected and the full deposit is refunded to the renter",
  PAY_OWNER: "the security deposit is paid to the owner",
  PARTIAL_SETTLEMENT: "the security deposit is split between both parties",
  FULL_REFUND: "the handover issue was upheld and the renter is refunded in full",
  REJECT_ISSUE: "the handover issue was rejected, rent is paid to the owner and the rental continues",
  PARTIAL_REFUND: "part of the rent is refunded to the renter and the rental continues",
};

/** Handover-issue decisions that keep the rental going (the rest close the booking) */
const ONGOING_DECISIONS = new Set(["REJECT_ISSUE", "PARTIAL_REFUND"]);

// ── Context ────────────────────────────────────────────────────────────

const PARTY = { select: { id: true, name: true, owner: { select: { id: true, email: true, ownerName: true } } } } as const;

async function loadContext(bookingId: string): Promise<BookingContext | null> {
  const b = await prisma.bookingRequest.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      quantity: true,
      startDate: true,
      endDate: true,
      totalAmountPaise: true,
      securityDepositPaise: true,
      rejectionReason: true,
      resource: { select: { id: true, name: true } },
      seeker: PARTY,
      provider: PARTY,
    },
  });
  if (!b) return null;

  const party = (biz: typeof b.seeker): Party => ({
    businessId: biz.id,
    businessName: biz.name,
    userId: biz.owner.id,
    email: biz.owner.email,
    ownerName: biz.owner.ownerName,
  });

  return {
    id: b.id,
    resourceId: b.resource.id,
    resourceName: b.resource.name,
    quantity: b.quantity,
    startDate: b.startDate,
    endDate: b.endDate,
    totalAmountPaise: b.totalAmountPaise,
    securityDepositPaise: b.securityDepositPaise,
    rejectionReason: b.rejectionReason,
    owner: party(b.provider),
    renter: party(b.seeker),
  };
}

// ── Messages ───────────────────────────────────────────────────────────

/** Deep link that opens this booking in the dashboard, on the recipient's tab */
export const bookingLink = (bookingId: string, role: PartyRole) =>
  `/dashboard/bookings?tab=${role === "OWNER" ? "incoming" : "outgoing"}&booking=${bookingId}`;

export function buildBookingNotifications(ctx: BookingContext, event: BookingEvent): NotifyInput[] {
  const out: NotifyInput[] = [];
  const dates = `${day(ctx.startDate)} – ${day(ctx.endDate)}`;
  const item = `${ctx.quantity} × ${ctx.resourceName}`;
  const baseDetails = [
    { label: "Resource", value: item },
    { label: "Dates", value: dates },
  ];

  const to = (
    role: PartyRole,
    type: NotificationType,
    title: string,
    message: string,
    opts: { details?: Array<{ label: string; value: string }>; ctaLabel?: string } = {}
  ) => {
    const party = role === "OWNER" ? ctx.owner : ctx.renter;
    out.push({
      userId: party.userId,
      type,
      title,
      message,
      data: {
        link: bookingLink(ctx.id, role),
        bookingId: ctx.id,
        resourceId: ctx.resourceId,
        businessId: role === "OWNER" ? ctx.renter.businessId : ctx.owner.businessId,
      },
      email: {
        to: party.email,
        recipientName: party.ownerName ?? party.businessName,
        details: opts.details ?? baseDetails,
        ctaLabel: opts.ctaLabel ?? "View booking",
      },
    });
  };

  const owner = ctx.owner.businessName;
  const renter = ctx.renter.businessName;
  const other = (by: PartyRole): PartyRole => (by === "OWNER" ? "RENTER" : "OWNER");
  const nameOf = (role: PartyRole) => (role === "OWNER" ? owner : renter);

  switch (event.kind) {
    case "REQUESTED":
      to("OWNER", "BOOKING_REQUESTED", "New booking request",
        `${renter} requested ${item} for ${dates}. Review and accept or decline the request.`,
        { details: [...baseDetails, { label: "Booking total", value: rupees(ctx.totalAmountPaise) }], ctaLabel: "View request" });
      break;

    case "ACCEPTED":
      to("RENTER", "BOOKING_ACCEPTED", "Booking accepted",
        `${owner} accepted your request for ${item}. Pay ${rupees(ctx.totalAmountPaise)} into escrow to confirm the booking.`,
        { details: [...baseDetails, { label: "Amount due", value: rupees(ctx.totalAmountPaise) }], ctaLabel: "Pay now" });
      break;

    case "REJECTED":
      to("RENTER", "BOOKING_REJECTED", "Booking request declined",
        `${owner} declined your request for ${item}.${ctx.rejectionReason ? ` Reason: "${clip(ctx.rejectionReason)}"` : ""}`);
      break;

    case "CANCELLED": {
      const refund = event.refundedPaise > 0 ? ` The escrow payment of ${rupees(event.refundedPaise)} is being refunded to the renter.` : "";
      if (event.by === "RENTER") {
        to("OWNER", "BOOKING_CANCELLED", "Booking cancelled",
          `${renter} cancelled their booking for ${item} (${dates}).${refund}`);
      } else {
        to("RENTER", "BOOKING_CANCELLED", "Booking cancelled by the owner",
          `${owner} cancelled your booking for ${item} (${dates}).${ctx.rejectionReason ? ` Reason: "${clip(ctx.rejectionReason)}"` : ""}${refund}`);
      }
      break;
    }

    case "EXPIRED":
      if (event.reason === "REQUEST") {
        to("RENTER", "BOOKING_EXPIRED", "Booking request expired",
          `${owner} did not respond to your request for ${item} before the start date, so it expired.`);
        to("OWNER", "BOOKING_EXPIRED", "Booking request expired",
          `The request from ${renter} for ${item} expired because it was not answered before the start date.`);
      } else {
        to("RENTER", "BOOKING_EXPIRED", "Unpaid booking cancelled",
          `Your booking for ${item} was cancelled because escrow was not funded before the payment deadline.`);
        to("OWNER", "BOOKING_EXPIRED", "Unpaid booking cancelled",
          `${renter} did not pay for ${item} before the deadline, so the booking was cancelled and the units released.`);
      }
      break;

    case "OWNER_NO_SHOW":
      to("RENTER", "OWNER_NO_SHOW", "Owner did not hand over — full refund",
        `${owner} did not hand over ${item} by the deadline. Your payment of ${rupees(event.refundedPaise)} is being refunded in full.`);
      to("OWNER", "OWNER_NO_SHOW", "Booking cancelled — handover missed",
        `You did not hand over ${item} to ${renter} by the deadline, so the booking was cancelled and the renter refunded. This counts as an owner cancellation.`);
      break;

    case "LATE_PAYMENT_REFUNDED":
      to("RENTER", "PAYMENT_REFUNDED", "Payment refunded",
        `Your payment of ${rupees(event.refundedPaise)} for ${item} arrived after the booking was closed, so it is being refunded in full.`);
      break;

    case "PAYMENT_RECEIVED":
      to("OWNER", "PAYMENT_RECEIVED", "Payment received — ready for handover",
        `${renter} paid ${rupees(ctx.totalAmountPaise)} into escrow for ${item}. At handover, ask the renter for their 6-digit handover code and enter it in HostNexus with condition photos.`,
        { details: [...baseDetails, { label: "Held in escrow", value: rupees(ctx.totalAmountPaise) }] });
      to("RENTER", "PAYMENT_CONFIRMED", "Payment confirmed",
        `Your payment of ${rupees(ctx.totalAmountPaise)} for ${item} is held safely in escrow. Share your 6-digit handover code (shown on the booking) with the owner only when you receive the item.`);
      break;

    case "HANDOVER_STARTED":
      to("RENTER", "HANDOVER_STARTED", "Resource handed over — inspect within 1 hour",
        `${owner} marked ${item} as handed over. Inspect it and accept or report an issue before ${time(event.deadline)}. After that it is accepted automatically.`,
        { details: [...baseDetails, { label: "Inspect before", value: `${time(event.deadline)}, ${day(event.deadline)}` }], ctaLabel: "Inspect now" });
      break;

    case "RENT_RELEASED":
      to("OWNER", "RENT_RELEASED", "Rent released",
        event.auto
          ? `The renter's inspection window for ${item} ended without issues. Rent has been released to you; the deposit stays in escrow.`
          : `${renter} accepted ${item} in good condition. Rent has been released to you; the deposit stays in escrow.`);
      if (event.auto) {
        to("RENTER", "INSPECTION_AUTO_ACCEPTED", "Handover auto-accepted",
          `Your 1-hour inspection window for ${item} ended, so the handover was accepted automatically.`);
      }
      break;

    case "HANDOVER_ISSUE":
      to("OWNER", "HANDOVER_ISSUE_REPORTED", "Issue reported at handover",
        `${renter} reported a problem with ${item} during their receiving inspection. Accept it (full refund to the renter) or contest it before ${time(event.responseDeadline)}, ${day(event.responseDeadline)}. If you do not respond, the renter is refunded automatically.`,
        { ctaLabel: "Respond to issue" });
      break;

    case "HANDOVER_ISSUE_CONTESTED":
      to("RENTER", "HANDOVER_ISSUE_CONTESTED", "Owner contested your handover issue",
        `${owner} contested the issue you reported for ${item}. HostNexus admin will review the evidence from both sides; your payment stays in escrow.`);
      break;

    case "RETURN_INITIATED":
      to("OWNER", "RETURN_INITIATED", event.early ? "Early return started" : "Return started",
        `${renter} marked ${item} as returned${event.early ? " before the agreed end date" : ""}. Confirm whether you have received it.`,
        { ctaLabel: "Confirm receipt" });
      break;

    case "RETURN_RECEIVED":
      to("RENTER", "RETURN_RECEIVED", "Return received by owner",
        `${event.auto ? `${owner} did not confirm within 24 hours, so receipt of ${item} was confirmed automatically.` : `${owner} confirmed receiving ${item}.`} If no damage is reported by ${time(event.deadline)}, your deposit of ${rupees(ctx.securityDepositPaise)} is refunded automatically.`);
      break;

    case "RETURN_NOT_RECEIVED":
      to("RENTER", "RETURN_NOT_RECEIVED", "Owner has not received your return",
        `${owner} reported that ${item} was not received. Accept the claim or dispute it before ${time(event.responseDeadline)}, ${day(event.responseDeadline)}; otherwise the deposit goes to the owner.`,
        { ctaLabel: "Respond to claim" });
      break;

    case "RETURN_ACCEPTED":
      to("RENTER", "DEPOSIT_REFUNDED", "Deposit refunded — booking complete",
        event.auto
          ? `No damage was reported for ${item} within the inspection window. Your deposit of ${rupees(ctx.securityDepositPaise)} has been refunded.`
          : `${owner} accepted the return of ${item}. Your deposit of ${rupees(ctx.securityDepositPaise)} has been refunded. You can now leave a review.`,
        { details: [...baseDetails, { label: "Deposit refunded", value: rupees(ctx.securityDepositPaise) }] });
      if (event.auto) {
        to("OWNER", "BOOKING_COMPLETED", "Booking completed",
          `The inspection window for ${item} ended without a damage claim, so the deposit was refunded to ${renter}.`);
      }
      break;

    case "DAMAGE_CLAIMED":
      to("RENTER", "DAMAGE_CLAIM_FILED", "Damage claim filed",
        `${owner} filed a claim of ${rupees(event.amountPaise)} against your deposit for ${item}. Accept the deduction or dispute it before ${time(event.responseDeadline)}, ${day(event.responseDeadline)}; otherwise the claim is accepted automatically.`,
        { details: [...baseDetails, { label: "Amount claimed", value: rupees(event.amountPaise) }], ctaLabel: "Respond to claim" });
      break;

    case "CLAIM_ACCEPTED":
      to("OWNER", "DAMAGE_CLAIM_ACCEPTED", "Damage claim accepted",
        `${event.auto ? `${renter} did not respond in time, so your claim for ${item} was accepted.` : `${renter} accepted your claim for ${item}.`} ${rupees(event.payoutPaise)} is paid to you${event.refundPaise > 0 ? ` and ${rupees(event.refundPaise)} is refunded to the renter` : ""}.`);
      break;

    case "CLAIM_DISPUTED":
      to("OWNER", "DAMAGE_CLAIM_DISPUTED", "Damage claim disputed",
        `${renter} disputed your claim for ${item}. HostNexus admin will review the evidence from both sides.`);
      break;

    case "DISPUTE_RESOLVED": {
      const outcome = DECISION_TEXT[event.decision] ?? "the settlement has been applied";
      for (const role of ["OWNER", "RENTER"] as const) {
        to(role, "DISPUTE_RESOLVED", "Dispute resolved",
          `The dispute on ${item} was resolved: ${outcome}.${ONGOING_DECISIONS.has(event.decision) ? "" : " The booking is now closed."}`);
      }
      break;
    }

    case "NON_RETURN_REPORTED":
      if (event.bySystem) {
        for (const role of ["OWNER", "RENTER"] as const) {
          to(role, "NON_RETURN_REPORTED", "Return overdue — sent to admin",
            `No return was started for ${item} within 24 hours after the last rental day. The deposit is held and HostNexus admin will review the case.`);
        }
      } else {
        to("RENTER", "NON_RETURN_REPORTED", "Non-return reported",
          `${owner} reported that ${item} was not returned after the rental period. Respond${event.responseDeadline ? ` before ${time(event.responseDeadline)}, ${day(event.responseDeadline)}` : ""}; otherwise the deposit goes to the owner.`,
          { ctaLabel: "Respond to claim" });
      }
      break;

    case "NEGOTIATION_OFFER":
      to(other(event.by), "NEGOTIATION_OFFER", "New price offer",
        `${nameOf(event.by)} offered ${rupees(event.amountPaise)} per day for ${item}.${event.message ? ` "${clip(event.message)}"` : ""} Accept, counter or decline.`,
        { details: [...baseDetails, { label: "Offer (per day)", value: rupees(event.amountPaise) }], ctaLabel: "Respond to offer" });
      break;

    case "NEGOTIATION_ACCEPTED":
      to(other(event.by), "NEGOTIATION_ACCEPTED", "Offer accepted",
        `${nameOf(event.by)} accepted ${rupees(event.amountPaise)} per day for ${item}. The booking is confirmed at the agreed price${other(event.by) === "RENTER" ? " — pay into escrow to lock it in" : ""}.`,
        { details: [...baseDetails, { label: "Booking total", value: rupees(ctx.totalAmountPaise) }] });
      break;

    case "NEGOTIATION_REJECTED":
      to(other(event.by), "NEGOTIATION_REJECTED", "Negotiation ended",
        `${nameOf(event.by)} ended the price negotiation for ${item}. The request stays open at the listed price.`);
      break;
  }

  return out;
}

const NEGOTIATION_EVENTS = new Set<BookingEvent["kind"]>(["NEGOTIATION_OFFER", "NEGOTIATION_ACCEPTED", "NEGOTIATION_REJECTED"]);

/**
 * Fire-and-forget: never throws, never blocks the caller's response.
 * Returns the promise so tests (and scripts) can await delivery.
 */
export function notifyBookingEvent(bookingId: string, event: BookingEvent): Promise<void> {
  return (async () => {
    try {
      const ctx = await loadContext(bookingId);
      if (!ctx) return;

      for (const party of [ctx.owner, ctx.renter]) {
        emitToUser(party.userId, REALTIME_EVENTS.BOOKING_UPDATED, { bookingId, event: event.kind });
        if (NEGOTIATION_EVENTS.has(event.kind)) {
          emitToUser(party.userId, REALTIME_EVENTS.NEGOTIATION_UPDATED, { bookingId, event: event.kind });
        }
      }

      await NotificationService.notifyMany(buildBookingNotifications(ctx, event));
    } catch (err) {
      logger.error("Booking notification failed", {
        bookingId,
        event: event.kind,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  })();
}
