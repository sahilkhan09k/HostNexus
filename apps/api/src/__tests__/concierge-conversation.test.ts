import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from "vitest";
import { RagService } from "../services/rag/rag.service.js";
import type { RagResponse } from "../services/rag/types.js";
import { prisma } from "../config/database.js";

vi.mock("../config/database.js", async () => {
  const { createFakePrisma } = await import("./helpers/fake-prisma.js");
  return { prisma: createFakePrisma() };
});

// Built-in answers only, so the policy follow-ups are deterministic
beforeAll(() => {
  for (const k of ["GROQ_API_KEY", "GEMINI_API_KEY", "OPENAI_API_KEY"]) delete process.env[k];
});

const db = prisma as any;
const T0 = new Date("2026-10-01T04:30:00.000Z"); // 10:00 IST, 1 Oct 2026

function listing(id: string, fields: Record<string, unknown>) {
  return db.__seed("resource", {
    id, businessId: "biz-1", resourceType: "Furniture", description: null, quantity: 1, unit: null,
    status: "available", location: "Pune", rentAmountPaise: 10_000, securityDepositPaise: 10_000,
    photos: [], hasPreExistingDamage: false, damageDescription: null, damagePhotos: [],
    transportAvailable: false, transportRatePerKmPaise: 0, ...fields,
  });
}

/** A chat session: every turn sends back the context the previous reply returned, like the web UI does. */
function session() {
  let context: RagResponse["context"];
  const history: Array<{ role: "user" | "assistant"; content: string }> = [];
  return {
    async say(message: string) {
      const res = await RagService.processQuery({ message, context, history: [...history] });
      context = res.context;
      history.push({ role: "user", content: message }, { role: "assistant", content: res.reply });
      return res;
    },
    get context() {
      return context;
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
  db.__reset();
  db.__seed("user", { id: "u-1", verificationStatus: "VERIFIED" });
  db.__seed("business", { id: "biz-1", name: "SK caterers", ownerId: "u-1", city: null });
});

afterEach(() => vi.useRealTimers());

describe("refining the last search", () => {
  beforeEach(() => {
    listing("mumbai-hall", { name: "abc", resourceType: "Banquet Hall", location: "mumbai", rentAmountPaise: 2_000_000 });
    listing("pune-hall", { name: "Royal Pune Banquets", resourceType: "Banquet Hall", location: "Pune", description: "Seats 500 guests", rentAmountPaise: 6_000_000 });
  });

  it("'what about Mumbai?' keeps the hall, guests and budget and only changes the city", async () => {
    const chat = session();
    const first = await chat.say("Find a banquet hall for 300 guests in Pune under ₹50,000");
    expect(first.results.map((r) => r.id)).toContain("pune-hall"); // over budget → alternative

    const next = await chat.say("what about Mumbai?");
    expect(next.intent).toBe("listing_inquiry");
    expect(next.reply).toContain("Same search as before, now in **Mumbai**");
    expect(next.reply).toContain("Searching for: 300 guests · in Mumbai · budget ₹50,000");
    expect(next.results.map((r) => [r.id, r.tier])).toEqual([["mumbai-hall", "MATCH"]]);
  });

  it("changes the budget, dates and location step by step", async () => {
    const chat = session();
    await chat.say("banquet hall in Pune under ₹50,000");
    expect(chat.context?.search?.budget?.amountPaise).toBe(5_000_000);

    const noLimit = await chat.say("no budget limit");
    expect(noLimit.reply).toContain("**no budget limit**");
    expect(noLimit.results.map((r) => [r.id, r.tier])).toEqual([["pune-hall", "MATCH"]]);

    const dated = await chat.say("on 5th November instead");
    expect(dated.reply).toContain("5 Nov 2026");
    expect(chat.context?.search?.startDate).toBe("2026-11-05");
    expect(chat.context?.search?.location?.label).toBe("Pune"); // still Pune

    const anywhere = await chat.say("anywhere?");
    expect(anywhere.reply).toContain("in **any city**");
    expect(anywhere.results.map((r) => r.id).sort()).toEqual(["mumbai-hall", "pune-hall"]);
  });
});

describe("quantities and extra items", () => {
  beforeEach(() => {
    listing("chairs", { name: "Plastic Chairs", quantity: 100, location: "Pune" });
    listing("tables", { name: "Round Tables", quantity: 20, location: "Pune" });
  });

  it("'make it 50' changes the count of the item being searched", async () => {
    const chat = session();
    await chat.say("30 chairs in Pune on 28th October");
    const res = await chat.say("make it 150");
    expect(res.reply).toContain("Same search as before, **150 chairs**");
    expect(res.reply).toContain("**50 short**");
    expect(chat.context?.search?.items).toEqual([{ key: "chair", quantity: 150 }]);
  });

  it("'and 40 tables?' is a new item for the same event: city and date carry over", async () => {
    const chat = session();
    await chat.say("30 chairs in Pune on 28th October");
    const res = await chat.say("and 40 tables?");
    expect(res.reply).toContain("Using your earlier details: in Pune · on 28 Oct");
    expect(res.reply).toContain("**20** free");
    expect(res.results.map((r) => r.id)).toEqual(["tables"]);
  });

  it("does not carry a budget over to a different item", async () => {
    const chat = session();
    await chat.say("30 chairs in Pune under ₹500");
    const res = await chat.say("what about 10 tables?");
    expect(res.reply).not.toContain("budget");
    expect(chat.context?.search?.budget).toBeUndefined();
  });
});

describe("questions about listings already shown", () => {
  beforeEach(() => {
    listing("cheap", { name: "Plastic Chairs", quantity: 100, rentAmountPaise: 5_000, securityDepositPaise: 20_000 });
    listing("nice", {
      name: "Chiavari Chairs", quantity: 60, rentAmountPaise: 15_000, securityDepositPaise: 50_000,
      transportAvailable: true, transportRatePerKmPaise: 2_500, hasPreExistingDamage: true, damageDescription: "Two chairs have scuffed legs",
    });
    db.__seed("bookingRequest", {
      id: "b1", resourceId: "cheap", quantity: 100, bookingStatus: "ACTIVE",
      startDate: new Date("2026-10-30"), endDate: new Date("2026-10-30"),
    });
  });

  it("'is the first one available on 30th October?' checks that listing on that date", async () => {
    const chat = session();
    const search = await chat.say("50 chairs on 28th October");
    expect(search.results[0].id).toBe("cheap");

    const res = await chat.say("is the first one available on 30th October?");
    expect(res.reply).toContain("### About Plastic Chairs");
    expect(res.reply).toContain("Not available on 30 Oct 2026");
    expect(res.results.map((r) => r.id)).toEqual(["cheap"]);

    const second = await chat.say("and the second one?");
    // "the second one" still refers to the original result list
    expect(second.reply).toContain("### About Chiavari Chairs");
  });

  it("answers deposit, delivery and condition questions from the listing", async () => {
    const chat = session();
    await chat.say("50 chairs on 28th October");
    const deposit = await chat.say("how much is the deposit for the second one?");
    expect(deposit.reply).toContain("deposit: **₹500**");

    const delivery = await chat.say("does the owner of the second one deliver?");
    expect(delivery.reply).toContain("can deliver at **₹25/km**");

    const condition = await chat.say("what condition is the second one in?");
    expect(condition.reply).toContain("Two chairs have scuffed legs");
  });

  it("says which listing it assumed when 'it' is ambiguous", async () => {
    const chat = session();
    await chat.say("50 chairs on 28th October");
    const res = await chat.say("how much is it for 3 days?");
    expect(res.reply).toContain("You didn't say which one");
  });

  it("compares the listings shown", async () => {
    const chat = session();
    await chat.say("chairs");
    const res = await chat.say("which one is cheaper?");
    expect(res.reply).toContain("**Cheapest:** [Plastic Chairs]");
  });

  it("recognises a listing by its name", async () => {
    const chat = session();
    await chat.say("50 chairs on 28th October");
    const res = await chat.say("is Chiavari Chairs free on 30th October?");
    expect(res.reply).toContain("### About Chiavari Chairs");
    expect(res.reply).toContain("60 of 60 free on 30 Oct 2026");
  });
});

describe("policy questions in the same conversation", () => {
  it("continues the previous policy topic on a short follow-up", async () => {
    const chat = session();
    const first = await chat.say("What happens if my product gets damaged?");
    expect(first.intent).toBe("damage_inquiry");
    const next = await chat.say("and who decides?");
    expect(next.intent).toBe("damage_inquiry");
    expect(next.reply).toContain("Arbitration");
  });

  it("a policy question in the middle doesn't make the concierge forget the search", async () => {
    listing("mumbai-hall", { name: "abc", resourceType: "Banquet Hall", location: "mumbai" });
    const chat = session();
    await chat.say("banquet hall in Pune");
    const policy = await chat.say("How does the escrow payment work?");
    expect(policy.intent).toBe("payment_escrow_inquiry");
    const back = await chat.say("what about Mumbai?");
    expect(back.results.map((r) => [r.id, r.tier])).toEqual([["mumbai-hall", "MATCH"]]);
  });

  it("without any context, a bare follow-up is not mistaken for a search", async () => {
    const res = await RagService.processQuery({ message: "what about Mumbai?" });
    expect(res.intent).toBe("policy_question");
    expect(res.results).toEqual([]);
  });

  it("'what if it gets damaged?' is still a damage question after a search", async () => {
    listing("chairs", { name: "Plastic Chairs", quantity: 100 });
    const chat = session();
    await chat.say("30 chairs");
    const res = await chat.say("what if it gets damaged?");
    expect(res.intent).toBe("damage_inquiry");
  });
});
