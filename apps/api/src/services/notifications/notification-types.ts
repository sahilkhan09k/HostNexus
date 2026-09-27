/**
 * Notification catalog — the single place that decides how each event is delivered.
 *
 * Every notification is persisted (notification center) and pushed over the socket
 * so badges stay in sync. On top of that:
 *   - email: also send a transactional email (important business events only)
 *   - toast: show a popup in the browser. `false` = in-app only (list + badge, no popup)
 *
 * Purely UI-level signals that should not be stored (e.g. "this booking changed,
 * refetch it") are sent with `emitToUser` in realtime.ts instead of a notification.
 */
export interface NotificationPolicy {
  email: boolean;
  toast: boolean;
}

export const NOTIFICATION_POLICIES = {
  // ── Booking lifecycle ──────────────────────────────────────────────
  BOOKING_REQUESTED:        { email: true,  toast: true },  // → owner
  BOOKING_ACCEPTED:         { email: true,  toast: true },  // → renter (pay to confirm)
  BOOKING_REJECTED:         { email: true,  toast: true },  // → renter
  BOOKING_CANCELLED:        { email: true,  toast: true },  // → the other party
  BOOKING_EXPIRED:          { email: true,  toast: true },  // → both (request unanswered / unpaid)
  OWNER_NO_SHOW:            { email: true,  toast: true },  // → both (renter refunded in full)
  PAYMENT_REFUNDED:         { email: true,  toast: true },  // → renter (paid after the booking closed)
  PAYMENT_RECEIVED:         { email: true,  toast: true },  // → owner (escrow funded, hand over)
  PAYMENT_CONFIRMED:        { email: false, toast: true },  // → renter (receipt of their own action)
  HANDOVER_STARTED:         { email: true,  toast: true },  // → renter (1-hour inspection window)
  RENT_RELEASED:            { email: false, toast: true },  // → owner
  HANDOVER_ISSUE_REPORTED:  { email: true,  toast: true },  // → owner (accept or contest within 24h)
  HANDOVER_ISSUE_CONTESTED: { email: true,  toast: true },  // → renter (sent to admin)
  RETURN_INITIATED:         { email: true,  toast: true },  // → owner (confirm receipt)
  RETURN_RECEIVED:          { email: false, toast: true },  // → renter (2-hour owner inspection)
  RETURN_NOT_RECEIVED:      { email: true,  toast: true },  // → renter (dispute opened)
  DEPOSIT_REFUNDED:         { email: true,  toast: true },  // → renter (booking completed)
  BOOKING_COMPLETED:        { email: false, toast: false }, // → owner (informational)
  DAMAGE_CLAIM_FILED:       { email: true,  toast: true },  // → renter (respond to claim)
  DAMAGE_CLAIM_ACCEPTED:    { email: true,  toast: true },  // → owner (payout)
  DAMAGE_CLAIM_DISPUTED:    { email: false, toast: true },  // → owner (sent to Customer Care)
  DISPUTE_RESOLVED:         { email: true,  toast: true },  // → both
  NON_RETURN_REPORTED:      { email: true,  toast: true },  // → renter
  INSPECTION_AUTO_ACCEPTED: { email: false, toast: false }, // → renter (window expired)

  // ── Negotiation ────────────────────────────────────────────────────
  NEGOTIATION_OFFER:        { email: true,  toast: true },  // → other party (turn-based: one per turn)
  NEGOTIATION_ACCEPTED:     { email: true,  toast: true },  // → other party
  NEGOTIATION_REJECTED:     { email: false, toast: true },  // → other party

  // ── Reputation ─────────────────────────────────────────────────────
  REVIEW_RECEIVED:          { email: false, toast: true },  // → reviewed business

  // ── Account / KYC ──────────────────────────────────────────────────
  KYC_SUBMITTED:            { email: true,  toast: false }, // → user (under manual review)
  KYC_APPROVED:             { email: true,  toast: true },  // → user
  KYC_REJECTED:             { email: true,  toast: false }, // → user (can no longer sign in)
} as const satisfies Record<string, NotificationPolicy>;

export type NotificationType = keyof typeof NOTIFICATION_POLICIES;

export const NOTIFICATION_TYPES = Object.keys(NOTIFICATION_POLICIES) as NotificationType[];

export function isNotificationType(value: string): value is NotificationType {
  return Object.prototype.hasOwnProperty.call(NOTIFICATION_POLICIES, value);
}

/**
 * Ids the frontend needs to open the related object. `link` is an app-relative
 * path ("/dashboard/bookings?booking=…") built on the server, never from user input.
 */
export interface NotificationData {
  link?: string;
  bookingId?: string;
  resourceId?: string;
  businessId?: string;
  reviewId?: string;
  negotiationId?: string;
}
