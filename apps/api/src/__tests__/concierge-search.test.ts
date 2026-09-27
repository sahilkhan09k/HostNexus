import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RagService } from "../services/rag/rag.service.js";
import { parseRequest } from "../services/rag/request-parser.js";
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
const ask = (message: string) => RagService.processQuery({ message });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
  db.__reset();
  db.__seed("user", { id: "u-1", verificationStatus: "VERIFIED" });
  db.__seed("business", { id: "biz-1", name: "SK caterers", ownerId: "u-1", city: null });
});

afterEach(() => vi.useRealTimers());

describe("the reported case: banquet hall for 300 guests in Pune under ₹50,000", () => {
  beforeEach(() => {
    db.__seed("business", { id: "biz-mum", name: "na", ownerId: "u-1", city: "navi mumbai" });
    listing("hall", { name: "abc", resourceType: "Banquet Hall", businessId: "biz-mum", location: "mumbai", rentAmountPaise: 2_000_000 });
  });

  it("says there is no hall in Pune first, then offers the Mumbai one as a labelled alternative", async () => {
    const res = await ask("Find a banquet hall for 300 guests in Pune under ₹50,000");
    const noPune = res.reply.indexOf("No banquet halls are listed in **Pune**");
    const elsewhere = res.reply.indexOf("available in other places");
    expect(noPune).toBeGreaterThan(-1);
    expect(elsewhere).toBeGreaterThan(noPune);
    expect(res.reply).toContain("Searching for: 300 guests · in Pune · budget ₹50,000");

    expect(res.results).toHaveLength(1);
    expect(res.results[0].tier).toBe("ALTERNATIVE");
    expect(res.results[0].caveats).toContain("Not in Pune — in Mumbai");
    expect(res.results[0].caveats).toContain("Capacity not stated — confirm it fits 300 guests");
    expect(res.results[0].price).toBe("₹20,000/day"); // not "/unit/day" for a single hall
    expect(res.results[0].matchedFor).toBe("banquet hall");

    // Follow-ups widen the search where results exist; budget wasn't the problem here
    expect(res.suggestedFollowUps[0]).toBe("Find a banquet hall for 300 guests in Mumbai");
    expect(res.suggestedFollowUps.join(" ")).not.toContain("no budget limit");
  });

  it("shows a hall in the requested city as a direct match with no alternatives", async () => {
    listing("pune-hall", {
      name: "Royal Pune Banquets", resourceType: "Banquet Hall", location: "Koregaon Park, Pune",
      description: "Seats 500 guests", rentAmountPaise: 4_000_000,
    });
    const res = await ask("Find a banquet hall for 300 guests in Pune under ₹50,000");
    expect(res.results.map((r) => [r.id, r.tier])).toEqual([["pune-hall", "MATCH"]]);
    expect(res.results[0].caveats).toEqual([]);
    expect(res.results[0].features).toContain("Holds 500 guests");
    expect(res.reply).toContain("✅ Found in Pune");
    expect(res.reply).not.toContain("abc");
  });
});

describe("budget", () => {
  it("explains when every hall in the city is over budget and shows them as over-budget options", async () => {
    listing("pricey", { name: "Grand Pune Hall", resourceType: "Banquet Hall", location: "Pune", rentAmountPaise: 6_000_000 });
    const res = await ask("banquet hall in Pune under 50k");
    expect(res.reply).toContain("No banquet halls in **Pune** within **₹50,000**. The cheapest there is ₹60,000 for 1 day.");
    expect(res.results[0].tier).toBe("ALTERNATIVE");
    expect(res.results[0].caveats).toContain("Over your ₹50,000 budget by ₹10,000");
  });

  it("counts every day of a date range against a total budget", async () => {
    listing("hall", { name: "Pune Hall", resourceType: "Banquet Hall", location: "Pune", rentAmountPaise: 2_000_000 });
    const oneDay = await ask("banquet hall in Pune under ₹50,000 on 28th October");
    expect(oneDay.results[0].tier).toBe("MATCH");
    const threeDays = await ask("banquet hall in Pune under ₹50,000 from 28th to 30th October");
    expect(threeDays.results[0].tier).toBe("ALTERNATIVE"); // 3 × ₹20,000 = ₹60,000
    expect(threeDays.reply).toContain("from 28 Oct 2026 to 30 Oct 2026");
  });

  it("reads per-unit budgets", async () => {
    listing("chairs", { name: "Plastic Chairs", quantity: 100, rentAmountPaise: 15_000 });
    const res = await ask("30 chairs under ₹100 per chair");
    expect(res.results[0].tier).toBe("ALTERNATIVE");
    expect(res.results[0].caveats[0]).toContain("Over your ₹100 budget");
  });

  it("judges a multi-item budget on the whole order", async () => {
    listing("chairs", { name: "Plastic Chairs", quantity: 100, rentAmountPaise: 5_000 });
    listing("tables", { name: "Round Tables", quantity: 20, rentAmountPaise: 30_000 });
    const res = await ask("30 chairs and 10 tables under ₹5,000");
    // 30 × ₹50 + 10 × ₹300 = ₹4,500
    expect(res.reply).toContain("about **₹4,500** — within your ₹5,000 budget");
    expect(res.results.every((r) => r.tier === "MATCH")).toBe(true);
  });
});

describe("guest capacity", () => {
  it("rules out a hall that is stated to be too small", async () => {
    listing("small", { name: "Cosy Hall", resourceType: "Banquet Hall", location: "Pune", description: "Capacity: 150 pax" });
    const res = await ask("banquet hall for 300 guests in Pune");
    expect(res.results).toEqual([]);
    expect(res.reply).toContain("Cosy Hall holds only 150 guests");
    expect(res.reply).toContain("big enough");
  });

  it("does not read a guest count as a number of halls", async () => {
    listing("hall", { name: "Pune Hall", resourceType: "Banquet Hall", location: "Pune" });
    const res = await ask("need a 300 pax banquet hall in Pune");
    expect(res.results[0].requestedQuantity).toBeNull();
    expect(res.reply).not.toContain("300 banquet halls");
  });

  it("assumes one chair per guest when no count is given", async () => {
    listing("chairs", { name: "Plastic Chairs", quantity: 100 });
    const res = await ask("chairs for 250 guests");
    expect(res.reply).toContain("250 chairs (one per guest)");
    expect(res.reply).toContain("**150 short**");
  });
});

describe("locations", () => {
  beforeEach(() => {
    listing("andheri", { name: "Andheri Hall", resourceType: "Banquet Hall", location: "Andheri West, Mumbai" });
    listing("vashi", { name: "Vashi Hall", resourceType: "Banquet Hall", location: "Vashi, Navi Mumbai" });
  });

  it("treats Navi Mumbai as nearby, not as Mumbai", async () => {
    const res = await ask("banquet hall in Mumbai");
    expect(res.results.map((r) => [r.id, r.tier])).toEqual([["andheri", "MATCH"]]);
  });

  it("offers nearby cities before far ones when the city has none", async () => {
    listing("pune", { name: "Pune Hall", resourceType: "Banquet Hall", location: "Pune" });
    const res = await ask("banquet hall in Thane");
    expect(res.reply).toContain("No banquet halls are listed in **Thane**");
    expect(res.results.map((r) => r.id).sort()).toEqual(["andheri", "pune", "vashi"]);
    expect(res.results.slice(0, 2).map((r) => r.id).sort()).toEqual(["andheri", "vashi"]); // nearby first
    expect(res.results.every((r) => r.tier === "ALTERNATIVE")).toBe(true);
    expect(res.results[0].caveats[0]).toMatch(/^Near Thane, not in it/);
    expect(res.results[2].caveats[0]).toBe("Not in Thane — in Pune");
  });

  it("recognises a city written without 'in', and old names", async () => {
    expect((await ask("Bombay banquet hall")).results.map((r) => r.id)).toEqual(["andheri"]);
  });

  it("'anywhere' removes the location filter", async () => {
    const res = await ask("banquet hall anywhere");
    expect(res.results.map((r) => r.tier)).toEqual(["MATCH", "MATCH"]);
  });
});

describe("request parsing", () => {
  const parse = (m: string) => parseRequest(m, T0);

  it.each([
    ["hall under 50k", 5_000_000, "total"],
    ["hall with a budget of 1.5 lakh", 15_000_000, "total"],
    ["hall within Rs 75,000", 7_500_000, "total"],
    ["hall under ₹20,000 per day", 2_000_000, "per_day"],
  ])("budget: %s", (m, paise, basis) => {
    expect(parse(m).budget).toMatchObject({ amountPaise: paise, basis });
  });

  it.each([
    ["on 28th October", "2026-10-28", "2026-10-28"],
    ["from 28th to 30th October", "2026-10-28", "2026-10-30"],
    ["28-30 oct", "2026-10-28", "2026-10-30"],
    ["Oct 28 to 30", "2026-10-28", "2026-10-30"],
    ["from 28 Oct to 2 Nov", "2026-10-28", "2026-11-02"],
    ["on 28th October for 3 days", "2026-10-28", "2026-10-30"],
    ["30 Dec to 2 Jan", "2026-12-30", "2027-01-02"],
  ])("dates: %s", (m, start, end) => {
    expect(parse(`hall ${m}`)).toMatchObject({ startDate: start, endDate: end });
  });

  it("stops a place name at the next keyword", () => {
    expect(parse("chairs in Koregaon Park under 5000").location?.label).toBe("Koregaon Park");
    expect(parse("hall in Pune under ₹50,000").location).toEqual({ label: "Pune", city: "pune" });
  });

  it("does not read money as a quantity", () => {
    expect(parse("banquet hall under ₹50,000").requirements[0].quantity).toBeUndefined();
    expect(parse("1,000 plastic chairs").requirements[0].quantity).toBe(1000);
  });
});
