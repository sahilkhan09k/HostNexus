import { describe, it, expect } from "vitest";
import { RagService } from "../services/rag/rag.service.js";

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

  it("should match multi-item inventory when user requests '30 chairs, 40 tables on 28th October'", async () => {
    const res = await RagService.processQuery({
      message: "I want to order 30 chairs, 40 tables on 28th October",
      date: "2026-10-28",
    });

    expect(res.intent).toBe("listing_inquiry");
    expect(res.results.length).toBeGreaterThan(0);

    // Verify at least one chair listing and one table listing returned
    const titles = res.results.map(r => r.title.toLowerCase());
    const hasChair = titles.some(t => t.includes("chair"));
    const hasTable = titles.some(t => t.includes("table"));

    expect(hasChair).toBe(true);
    expect(hasTable).toBe(true);

    // Verify detailed attributes on cards
    const chairCard = res.results.find(r => r.title.toLowerCase().includes("chair"))!;
    expect(chairCard.whyChoose).toBeDefined();
    expect(chairCard.features.length).toBeGreaterThan(0);
    expect(chairCard.price).toBeDefined();
    expect(chairCard.match).toBeGreaterThanOrEqual(75);

    // Verify explanation in the markdown reply
    expect(res.reply).toContain("Chairs");
    expect(res.reply).toContain("Tables");
    expect(res.reply).toContain("Why Choose This");
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
