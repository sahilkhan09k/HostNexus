import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RagService } from "../services/rag/rag.service.js";
import { ListingRetriever } from "../services/rag/listing-retriever.js";
import { prisma } from "../config/database.js";

vi.mock("../config/database.js", async () => {
  const { createFakePrisma } = await import("./helpers/fake-prisma.js");
  return { prisma: createFakePrisma() };
});

const db = prisma as any;
const T0 = new Date("2026-10-01T04:30:00.000Z"); // 10:00 IST, 1 Oct 2026

function listing(id: string, fields: Record<string, unknown>) {
  return db.__seed("resource", {
    id, businessId: "biz-1", resourceType: "Furniture", description: null, quantity: 1, unit: null,
    status: "available", location: "Pune", rentAmountPaise: 10_000, securityDepositPaise: 10_000,
    photos: [], hasPreExistingDamage: false, damageDescription: null, damagePhotos: [], ...fields,
  });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
  db.__reset();
  db.__seed("user", { id: "u-1", verificationStatus: "VERIFIED" });
  db.__seed("business", { id: "biz-1", name: "SK caterers", ownerId: "u-1", city: "Pune" });
});

afterEach(() => vi.useRealTimers());

describe("the reported case: 30 chairs + 40 tables when neither is listed", () => {
  beforeEach(() => {
    // Exactly the live inventory from the bug report
    listing("bench", { name: "School Hard Wood Bench", description: "The bench are highly polished", quantity: 50, location: "Pillai University, New Panvel" });
    listing("hall", { name: "abc", resourceType: "Banquet Hall", quantity: 1, location: "mumbai", rentAmountPaise: 2_000_000 });
  });

  it("says chairs and tables aren't available and shows no unrelated listings", async () => {
    const res = await RagService.processQuery({ message: "I want to order 30 chairs, 40 tables on 28th October" });
    expect(res.intent).toBe("listing_inquiry");
    expect(res.results).toEqual([]); // no bench, no banquet hall
    expect(res.reply).toContain("30 chairs");
    expect(res.reply).toContain("No chairs are listed");
    expect(res.reply).toContain("40 tables");
    expect(res.reply).toContain("No tables are listed");
    expect(res.reply).toContain("28 Oct 2026");
    expect(res.reply).not.toMatch(/bench|abc|banquet/i);
  });
});

describe("strict item matching", () => {
  it("only returns listings that are the requested item", async () => {
    listing("chairs", { name: "Chiavari Chairs", quantity: 100 });
    listing("tables", { name: "Round Banquet Tables", quantity: 20 });
    listing("hall", { name: "Grand Hall", resourceType: "Banquet Hall" });
    listing("cloth", { name: "White Tablecloths", resourceType: "Linen", quantity: 200 });

    const res = await RagService.processQuery({ message: "Need 30 chairs on 28th October" });
    expect(res.results.map((r) => r.id)).toEqual(["chairs"]);
    expect(res.results[0]).toMatchObject({ matchedFor: "chairs", requestedQuantity: 30, match: 100, quantityAvailable: 100 });
  });

  it("does not treat tablecloths as tables", async () => {
    listing("cloth", { name: "White Tablecloths", resourceType: "Linen", quantity: 200 });
    const res = await RagService.processQuery({ message: "I need 10 tables" });
    expect(res.results).toEqual([]);
    expect(res.reply).toContain("No tables are listed");
  });

  it("reports a shortfall honestly and scores fit by real quantity", async () => {
    listing("chairs", { name: "Plastic Chairs", quantity: 20 });
    const res = await RagService.processQuery({ message: "30 chairs on 28 Oct" });
    expect(res.results[0].match).toBe(67); // 20 of 30
    expect(res.results[0].fitLabel).toContain("Has 20 of the 30 chairs");
    expect(res.reply).toContain("Only **20** free");
    expect(res.reply).toContain("**10 short**");
  });

  it("subtracts units already booked on that date", async () => {
    listing("chairs", { name: "Plastic Chairs", quantity: 50 });
    db.__seed("bookingRequest", {
      id: "b1", resourceId: "chairs", quantity: 40, bookingStatus: "ACTIVE",
      startDate: new Date("2026-10-27"), endDate: new Date("2026-10-29"),
    });
    const onBookedDay = await RagService.processQuery({ message: "30 chairs on 28th October" });
    expect(onBookedDay.results[0].quantityAvailable).toBe(10);
    const onFreeDay = await RagService.processQuery({ message: "30 chairs on 30th October" });
    expect(onFreeDay.results[0].quantityAvailable).toBe(50);
  });

  it("says when a listing exists but nothing is free on that date", async () => {
    listing("chairs", { name: "Plastic Chairs", quantity: 50 });
    db.__seed("availabilityWindow", { id: "w", resourceId: "chairs", fromDate: new Date("2026-11-01"), toDate: new Date("2026-11-30") });
    const res = await RagService.processQuery({ message: "30 chairs on 28th October" });
    expect(res.results).toEqual([]);
    expect(res.reply).toContain("fully booked or unavailable on your dates");
  });

  it("hides deleted, inactive and suspended-owner listings", async () => {
    listing("gone", { name: "Old Chairs", deletedAt: new Date() });
    listing("off", { name: "Spare Chairs", isActive: false });
    db.__seed("user", { id: "u-2", verificationStatus: "SUSPENDED" });
    db.__seed("business", { id: "biz-2", name: "Banned", ownerId: "u-2" });
    listing("sus", { name: "Cheap Chairs", businessId: "biz-2" });
    const res = await RagService.processQuery({ message: "I need chairs" });
    expect(res.results).toEqual([]);
  });

  it("answers unknown items without guessing", async () => {
    listing("chairs", { name: "Plastic Chairs", quantity: 50 });
    const res = await RagService.processQuery({ message: "I need a photographer for my event" });
    expect(res.intent).toBe("listing_inquiry");
    expect(res.results).toEqual([]);
    expect(res.reply).toContain("No photographers are listed");
  });
});

describe("no invented numbers", () => {
  it("shows no rating when there are no reviews, and never claims mint condition", async () => {
    listing("chairs", { name: "Plastic Chairs", quantity: 50 });
    const [card] = (await RagService.processQuery({ message: "30 chairs" })).results;
    expect(card.rating).toBeNull();
    expect(card.reviewCount).toBe(0);
    expect(card.features.join(" ")).not.toMatch(/mint/i);
    expect(card.price).toBe("₹100/unit/day");
  });

  it("uses the real average rating when reviews exist", async () => {
    listing("chairs", { name: "Plastic Chairs", quantity: 50 });
    // include of reviewsReceived goes through the business relation
    db.__store.business[0].reviewsReceived = [
      { rating: 4, reviewerRole: "RENTER" },
      { rating: 5, reviewerRole: "RENTER" },
      { rating: 1, reviewerRole: "OWNER" }, // a review of them as renter doesn't count
    ];
    const [card] = (await RagService.processQuery({ message: "30 chairs" })).results;
    expect(card.rating).toBe(4.5);
    expect(card.reviewCount).toBe(2);
  });
});

describe("intent classification uses whole words", () => {
  it.each([
    ["Is the platform available on weekends?", "policy_question"],        // "available" is not "av"
    ["How does my business get verified?", "policy_question"],          // "business" is not "bus"
    ["What happens if my product gets damaged?", "damage_inquiry"],
    ["How does the escrow payment work?", "payment_escrow_inquiry"],
    ["Need a sound system and 2 projectors", "listing_inquiry"],
    ["I want to hire 3 buses", "listing_inquiry"],
  ])("%s → %s", (message, intent) => {
    expect(RagService.classifyIntent(message)).toBe(intent);
  });
});

describe("parsing", () => {
  it("reads per-item quantities", () => {
    const reqs = ListingRetriever.parseUserRequirements("I want 30 chiavari chairs, 40 round tables and a projector");
    expect(reqs.map((r) => [r.key, r.quantity])).toEqual([["chair", 30], ["table", 40], ["av", undefined]]);
  });

  it.each([
    ["on 28th October", "2026-10-28"],
    ["on October 28", "2026-10-28"],
    ["28 oct 2027", "2027-10-28"],
    ["on 28/10", "2026-10-28"],
    ["on 2026-12-05", "2026-12-05"],
    ["on 5th March", "2027-03-05"], // already past this year → next year
    ["tomorrow", "2026-10-02"],
  ])("date %s → %s", (text, iso) => {
    expect(ListingRetriever.parseRequestedDate(`30 chairs ${text}`, T0)).toBe(iso);
  });

  it("reads a city but not 'in October'", () => {
    expect(ListingRetriever.parseLocation("30 chairs in Pune on 28th October")).toBe("pune");
    expect(ListingRetriever.parseLocation("30 chairs in October")).toBeUndefined();
  });
});
