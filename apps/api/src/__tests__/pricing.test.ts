import { describe, it, expect } from "vitest";
import {
  allowedPricingBases,
  billableUnits,
  defaultPricingBasis,
  isPricingBasisAllowed,
  PRICING_BASES_BY_TYPE,
  rentFor,
} from "../services/pricing.js";
import { createResourceSchema, updateResourceSchema, VALID_RESOURCE_TYPES } from "../schemas/resource.schema.js";
import { createBookingRequestSchema } from "../schemas/booking.schema.js";

describe("pricing bases per category", () => {
  it("every category has at least one basis, and its default is allowed", () => {
    for (const type of VALID_RESOURCE_TYPES) {
      expect(PRICING_BASES_BY_TYPE[type].length).toBeGreaterThan(0);
      expect(isPricingBasisAllowed(type, defaultPricingBasis(type))).toBe(true);
    }
  });

  it("a banquet hall is charged per hour or per day, never per event", () => {
    expect([...allowedPricingBases("Banquet Hall")].sort()).toEqual(["DAY", "HOUR"]);
    expect(isPricingBasisAllowed("Banquet Hall", "EVENT")).toBe(false);
  });

  it("every category allows per day, so listings from before pricing bases stay valid", () => {
    for (const type of VALID_RESOURCE_TYPES) expect(isPricingBasisAllowed(type, "DAY")).toBe(true);
  });
});

describe("rent", () => {
  it("per day: rate × days × quantity", () => {
    expect(rentFor(1000, { pricingBasis: "DAY", totalDays: 3, quantity: 2 })).toBe(6000);
  });

  it("per hour: rate × hours per day × days × quantity", () => {
    expect(billableUnits("HOUR", 2, 5)).toBe(10);
    expect(rentFor(1000, { pricingBasis: "HOUR", totalDays: 2, hoursPerDay: 5, quantity: 3 })).toBe(30_000);
  });

  it("per event: flat per unit, whatever the length", () => {
    expect(rentFor(1000, { pricingBasis: "EVENT", totalDays: 4, quantity: 5 })).toBe(5000);
  });

  it("bookings from before pricing bases are per day", () => {
    expect(rentFor(1000, { pricingBasis: undefined, totalDays: 3, quantity: 1 })).toBe(3000);
  });
});

describe("listing and booking validation", () => {
  const listing = { name: "Grand Hall", resourceType: "Banquet Hall", quantity: 1 };

  it("rejects a basis the category doesn't allow", () => {
    const r = createResourceSchema.safeParse({ ...listing, pricingBasis: "EVENT" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(["pricingBasis"]);
  });

  it("accepts an allowed basis, or none (the category default is used)", () => {
    expect(createResourceSchema.safeParse({ ...listing, pricingBasis: "HOUR" }).success).toBe(true);
    expect(createResourceSchema.safeParse(listing).success).toBe(true);
  });

  it("rejects unknown bases on update", () => {
    expect(updateResourceSchema.safeParse({ pricingBasis: "WEEK" }).success).toBe(false);
  });

  it("hours per day must be 1–24 whole hours", () => {
    const booking = { resourceId: "r", quantity: 1, startDate: "2026-10-03", endDate: "2026-10-03" };
    expect(createBookingRequestSchema.safeParse({ ...booking, hoursPerDay: 6 }).success).toBe(true);
    expect(createBookingRequestSchema.safeParse({ ...booking, hoursPerDay: 0 }).success).toBe(false);
    expect(createBookingRequestSchema.safeParse({ ...booking, hoursPerDay: 25 }).success).toBe(false);
    expect(createBookingRequestSchema.safeParse({ ...booking, hoursPerDay: 2.5 }).success).toBe(false);
  });
});
