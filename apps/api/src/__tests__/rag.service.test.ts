import { describe, it, expect, vi, beforeAll } from "vitest";
import { RagService } from "../services/rag/rag.service.js";

// Inventory answers read listings from the database; use an in-memory one.
vi.mock("../config/database.js", async () => {
  const { createFakePrisma } = await import("./helpers/fake-prisma.js");
  return { prisma: createFakePrisma() };
});

// Use the built-in answers so these tests don't depend on a live LLM.
beforeAll(() => {
  for (const k of ["GROQ_API_KEY", "GEMINI_API_KEY", "OPENAI_API_KEY"]) delete process.env[k];
});

describe("HostNexus RAG Pipeline", () => {
  it("should comprehensively answer damage policy questions with 4-stage chain of custody and escrow details", async () => {
    const res = await RagService.processQuery({
      message: "what will happen if my product gets damage?",
    });

    expect(res.intent).toBe("damage_inquiry");
    expect(res.reply).toContain("Damage & Security Deposit Protection Protocol");
    expect(res.reply).toContain("1-hour");
    expect(res.reply).toContain("2-Hour");
    expect(res.reply).toContain("Escrow");
    expect(res.reply).toContain("Admin Arbitration");
    expect(res.suggestedFollowUps.length).toBeGreaterThan(0);
    expect(res.sources.length).toBeGreaterThan(0);
  });

  it("answers an inventory request from listings (none here) instead of inventing matches", async () => {
    const res = await RagService.processQuery({
      message: "I want to order 30 chairs, 40 tables on 28th October",
    });

    expect(res.intent).toBe("listing_inquiry");
    expect(res.results).toEqual([]);
    expect(res.reply).toContain("No chairs are listed");
    expect(res.reply).toContain("No tables are listed");
  });

  it("should handle negotiation questions accurately", async () => {
    const res = await RagService.processQuery({
      message: "Can I negotiate the price or get a bulk discount?",
    });

    expect(res.intent).toBe("negotiation_inquiry");
    expect(res.reply).toContain("Negotiation");
    expect(res.reply).toContain("Counter-Offer");
  });

  it("should handle escrow and payment safety questions", async () => {
    const res = await RagService.processQuery({
      message: "How does the escrow payment and security deposit refund work?",
    });

    expect(res.intent).toBe("payment_escrow_inquiry");
    expect(res.reply).toContain("Escrow");
    expect(res.reply).toContain("Razorpay");
  });
});
