import crypto from "crypto";

/**
 * Booking timing rules and calendar helpers — the single place every deadline
 * in the booking lifecycle is defined.
 *
 * Calendar model: a booking's startDate and endDate are calendar days stored at
 * 00:00 UTC, and both are INCLUSIVE (start = end is a one-day booking). Business
 * deadlines are measured against the Indian calendar day (IST, UTC+5:30).
 */

export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS  = 24 * HOUR_MS;
const IST_OFFSET_MS  = (5 * 60 + 30) * 60 * 1000;

/** Renter has this long after a verified handover to inspect and accept or report an issue. */
export const RENTER_INSPECTION_MS = 1 * HOUR_MS;
/** Owner has this long after receiving the return to accept it or file a claim. */
export const OWNER_INSPECTION_MS = 2 * HOUR_MS;
/** Renter must pay within this long of the owner accepting (capped at the end of the start day). */
export const PAYMENT_WINDOW_MS = 24 * HOUR_MS;
/** Owner may hand over from this long before the start day (delivery time). */
export const HANDOVER_EARLIEST_BEFORE_START_MS = 24 * HOUR_MS;
/** Owner always gets at least this long after funding to hand over. */
export const MIN_HANDOVER_WINDOW_MS = 12 * HOUR_MS;
/** Owner must confirm a return within this long, or receipt is confirmed automatically. */
export const OWNER_RECEIPT_WINDOW_MS = 24 * HOUR_MS;
/** Owner must respond to a renter's handover issue within this long, or the renter is refunded. */
export const HANDOVER_ISSUE_RESPONSE_MS = 24 * HOUR_MS;
/** Renter must respond to an owner's return claim within this long, or the claim is accepted. */
export const RETURN_CLAIM_RESPONSE_MS = 48 * HOUR_MS;
/** Grace after the last rental day before a missing return is escalated to admin. */
export const NON_RETURN_GRACE_MS = 24 * HOUR_MS;
/** Wrong handover-code attempts allowed before the code locks. */
export const MAX_HANDOVER_CODE_ATTEMPTS = 5;

/**
 * Normalise any date input to its IST calendar day at 00:00 UTC.
 * "2026-10-01", "2026-10-01T00:00:00.000Z" and the browser's local midnight
 * ("2026-09-30T18:30:00.000Z") all map to 2026-10-01T00:00:00.000Z.
 */
export function toCalendarDay(input: string | Date): Date {
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) throw new Error("Invalid date");
  // A bare "YYYY-MM-DD" string is already a calendar day at 00:00 UTC.
  if (typeof input === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input)) return d;
  const ist = new Date(d.getTime() + IST_OFFSET_MS);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()));
}

/** Today's IST calendar day. */
export function todayIst(now: Date = new Date()): Date {
  return toCalendarDay(now);
}

/** The instant an IST calendar day begins. */
export function istDayStart(day: Date): Date {
  return new Date(day.getTime() - IST_OFFSET_MS);
}

/** The instant an IST calendar day ends (= next day's start). */
export function istDayEnd(day: Date): Date {
  return new Date(day.getTime() + DAY_MS - IST_OFFSET_MS);
}

/** Inclusive day count: start = end → 1. */
export function inclusiveDays(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;
}

/** A pending request expires once its start day is over. */
export function requestExpiresAt(startDate: Date): Date {
  return istDayEnd(startDate);
}

export function paymentDeadlineFor(acceptedAt: Date, startDate: Date): Date {
  return new Date(Math.min(acceptedAt.getTime() + PAYMENT_WINDOW_MS, istDayEnd(startDate).getTime()));
}

export function handoverOpensAt(startDate: Date): Date {
  return new Date(istDayStart(startDate).getTime() - HANDOVER_EARLIEST_BEFORE_START_MS);
}

export function handoverDeadlineFor(fundedAt: Date, startDate: Date): Date {
  return new Date(Math.max(istDayEnd(startDate).getTime(), fundedAt.getTime() + MIN_HANDOVER_WINDOW_MS));
}

/** After this, an ACTIVE booking with no return started is escalated as a non-return. */
export function nonReturnEscalatesAt(endDate: Date): Date {
  return new Date(istDayEnd(endDate).getTime() + NON_RETURN_GRACE_MS);
}

export function addMs(from: Date, ms: number): Date {
  return new Date(from.getTime() + ms);
}

/** Six-digit, cryptographically random handover code. */
export function generateHandoverCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/** Constant-time comparison for codes and signatures. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/** Bookings in these states are finished; everything else is "open". */
export const TERMINAL_BOOKING_STATUSES = ["COMPLETED", "CANCELLED"];

// ─── Escrow ledger ───────────────────────────────────────────

export type LedgerLine = { direction: string; amountPaise: number; status?: string };

/**
 * Money in, money out and what is still held in escrow for one booking.
 * FAILED lines still count: a failed refund is retried, never dropped.
 */
export function summarizeLedger(lines: LedgerLine[]) {
  let inPaise = 0, toRenterPaise = 0, toOwnerPaise = 0;
  for (const l of lines) {
    if (l.direction === "IN") inPaise += l.amountPaise;
    else if (l.direction === "TO_RENTER") toRenterPaise += l.amountPaise;
    else if (l.direction === "TO_OWNER") toOwnerPaise += l.amountPaise;
  }
  return { inPaise, toRenterPaise, toOwnerPaise, heldPaise: inPaise - toRenterPaise - toOwnerPaise };
}
