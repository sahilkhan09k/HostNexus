/**
 * How a listing's rent is charged. The listed rent is the price of ONE of
 * these units, for ONE unit of quantity:
 *   HOUR  — per hour of use on each booked day
 *   DAY   — per booked calendar day
 *   EVENT — flat per booking, however many days it covers
 *
 * Mirrors apps/api/src/services/pricing.ts — keep the two in sync.
 */
export const PRICING_BASES = ["HOUR", "DAY", "EVENT"] as const;
export type PricingBasis = (typeof PRICING_BASES)[number];

export const MAX_HOURS_PER_DAY = 24;

/** Which bases make sense for each category. The first one is the default. */
export const PRICING_BASES_BY_TYPE: Record<string, readonly PricingBasis[]> = {
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

/** "hour" | "day" | "event" */
export const PRICING_BASIS_UNIT: Record<PricingBasis, string> = {
  HOUR:  "hour",
  DAY:   "day",
  EVENT: "event",
};

/** Dropdown labels on the listing form */
export const PRICING_BASIS_OPTION: Record<PricingBasis, { label: string; hint: string }> = {
  HOUR:  { label: "Per hour",          hint: "Renters pick dates and how many hours they need each day." },
  DAY:   { label: "Per day",           hint: "Renters pay for every booked day." },
  EVENT: { label: "Per event (flat)",  hint: "One fixed price per booking, however many days it covers." },
};

export function allowedPricingBases(resourceType: string): readonly PricingBasis[] {
  return PRICING_BASES_BY_TYPE[resourceType] ?? ["DAY"];
}

export function defaultPricingBasis(resourceType: string): PricingBasis {
  return allowedPricingBases(resourceType)[0];
}

export function isPricingBasisAllowed(resourceType: string, basis: string): basis is PricingBasis {
  return allowedPricingBases(resourceType).includes(basis as PricingBasis);
}

/** Listings and bookings from before pricing bases existed are per day. */
export function toPricingBasis(basis: string | null | undefined): PricingBasis {
  return PRICING_BASES.includes(basis as PricingBasis) ? (basis as PricingBasis) : "DAY";
}

/** "/hour", "/day" or "/event" for price tags */
export function rateSuffix(basis: string | null | undefined): string {
  return `/${PRICING_BASIS_UNIT[toPricingBasis(basis)]}`;
}

/** How many rate units one unit of quantity is billed for. */
export function billableUnits(basis: string | null | undefined, totalDays: number, hoursPerDay?: number | null): number {
  switch (toPricingBasis(basis)) {
    case "HOUR":  return totalDays * (hoursPerDay ?? 1);
    case "EVENT": return 1;
    default:      return totalDays;
  }
}

/** Rent in the same currency unit as `rate`: rate × billable units × quantity (matches the API). */
export function rentFor(
  rate: number,
  basis: string | null | undefined,
  totalDays: number,
  hoursPerDay: number | null | undefined,
  quantity: number
): number {
  return rate * billableUnits(basis, totalDays, hoursPerDay) * quantity;
}

/** "3d × ₹2,000", "3d × 5h × ₹500", "1 event × ₹4,000" — the breakdown shown next to a rent total */
export function rentBreakdown(
  basis: string | null | undefined,
  totalDays: number,
  hoursPerDay: number | null | undefined,
  rateINR: number
): string {
  const rate = `₹${rateINR.toLocaleString()}`;
  switch (toPricingBasis(basis)) {
    case "HOUR":  return `${totalDays}d × ${hoursPerDay ?? 1}h × ${rate}`;
    case "EVENT": return `1 event × ${rate}`;
    default:      return `${totalDays}d × ${rate}`;
  }
}
