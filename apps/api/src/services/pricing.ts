import type { VALID_RESOURCE_TYPES } from "../schemas/resource.schema.js";

/**
 * How a listing's rent is charged. The owner's listed rent (`rentAmountPaise`)
 * is the price of ONE of these units, for ONE unit of quantity:
 *   HOUR  — per hour of use on each booked day
 *   DAY   — per booked calendar day
 *   EVENT — flat per booking, however many days it covers
 *
 * Bookings are still whole calendar days (inclusive); an hourly booking blocks
 * the whole day for capacity, and the renter says how many hours they need on
 * each of those days.
 *
 * Keep in sync with apps/web/src/lib/pricing.ts.
 */
export const PRICING_BASES = ["HOUR", "DAY", "EVENT"] as const;
export type PricingBasis = (typeof PRICING_BASES)[number];

export const MAX_HOURS_PER_DAY = 24;

/**
 * Which bases make sense for each category. The first one is the default.
 * e.g. a banquet hall is rented by the hour or the day, never "per event piece".
 */
export const PRICING_BASES_BY_TYPE: Record<(typeof VALID_RESOURCE_TYPES)[number], readonly PricingBasis[]> = {
  "Banquet Hall":       ["DAY", "HOUR"],
  "Event Space":        ["DAY", "HOUR"],
  "Meeting Space":      ["HOUR", "DAY"],
  "Kitchen Facility":   ["DAY", "HOUR"],
  "Vehicle":            ["DAY", "HOUR", "EVENT"],
  "AV Equipment":       ["DAY", "EVENT"],
  "Catering Equipment": ["DAY", "EVENT"],
  "Crockery/Cutlery":   ["EVENT", "DAY"],
  "Cold Storage":       ["DAY"],
  "Furniture":          ["EVENT", "DAY"],
  "Tent/Canopy":        ["EVENT", "DAY"],
  "Staff/Manpower":     ["HOUR", "DAY", "EVENT"],
  "Parking Space":      ["HOUR", "DAY"],
  "Generator/Power":    ["DAY", "HOUR"],
  "Linen/Textile":      ["EVENT", "DAY"],
  "Decor Items":        ["EVENT", "DAY"],
  "Equipment":          ["DAY", "HOUR", "EVENT"],
  "Other":              ["DAY", "HOUR", "EVENT"],
};

export const PRICING_BASIS_UNIT: Record<PricingBasis, string> = {
  HOUR:  "hour",
  DAY:   "day",
  EVENT: "event",
};

export function allowedPricingBases(resourceType: string): readonly PricingBasis[] {
  return PRICING_BASES_BY_TYPE[resourceType as keyof typeof PRICING_BASES_BY_TYPE] ?? ["DAY"];
}

export function defaultPricingBasis(resourceType: string): PricingBasis {
  return allowedPricingBases(resourceType)[0];
}

export function isPricingBasisAllowed(resourceType: string, basis: string): basis is PricingBasis {
  return allowedPricingBases(resourceType).includes(basis as PricingBasis);
}

/** Rows written before pricing bases existed are per day. */
export function toPricingBasis(basis: string | null | undefined): PricingBasis {
  return PRICING_BASES.includes(basis as PricingBasis) ? (basis as PricingBasis) : "DAY";
}

/** How many rate units one unit of quantity is billed for. */
export function billableUnits(basis: string | null | undefined, totalDays: number, hoursPerDay?: number | null): number {
  switch (toPricingBasis(basis)) {
    case "HOUR":  return totalDays * (hoursPerDay ?? 1);
    case "EVENT": return 1;
    default:      return totalDays;
  }
}

/** Rent for a booking: rate × billable units × quantity. */
export function rentFor(
  ratePaise: number,
  booking: { pricingBasis?: string | null; totalDays?: number | null; hoursPerDay?: number | null; quantity: number }
): number {
  return ratePaise * billableUnits(booking.pricingBasis, booking.totalDays ?? 1, booking.hoursPerDay) * booking.quantity;
}

/** "3 days", "2 days × 5 hours", "1 event" — for timeline and notification text. */
export function describeBillablePeriod(basis: string | null | undefined, totalDays: number, hoursPerDay?: number | null): string {
  const days = `${totalDays} day${totalDays === 1 ? "" : "s"}`;
  switch (toPricingBasis(basis)) {
    case "HOUR":  return `${days} × ${hoursPerDay ?? 1} hour${hoursPerDay === 1 ? "" : "s"}`;
    case "EVENT": return `${days} (flat per event)`;
    default:      return days;
  }
}
