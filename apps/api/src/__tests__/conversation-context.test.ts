import { describe, it, expect, vi } from "vitest";
import {
  sanitizeHistory,
  isFollowUpMessage,
  buildStandaloneQuery,
  getLastShownListings,
  resolveListingReference,
} from "../services/rag/conversation-context.js";
import type { ChatHistoryMessage } from "../services/rag/types.js";

vi.mock("../services/rag/vector-store.js", () => ({
  VectorStoreService: {
    searchPolicies: vi.fn(async () => []),
    searchResources: vi.fn(async () => []),
  },
}));

const listingReply =
  "### 🎯 Available Matches for Your Request\n\n" +
  "#### 1. [Chiavari Chairs](/marketplace/res-chairs) — *Hosted by A*\n" +
  "#### 2. [Round Banquet Tables](/marketplace/res-tables) — *Hosted by B*\n";

describe("conversation context helpers", () => {
  it("keeps only recent user/assistant turns and trims them", () => {
    const history: ChatHistoryMessage[] = [
      { role: "system", content: "ignore me" },
      { role: "user", content: "   " },
      ...Array.from({ length: 12 }, (_, i) => ({ role: "user" as const, content: `turn ${i}` })),
    ];

    const cleaned = sanitizeHistory(history);
    expect(cleaned).toHaveLength(10);
    expect(cleaned.every(m => m.role === "user")).toBe(true);
    expect(cleaned[9].content).toBe("turn 11");
  });

  it("detects follow-ups only when there is earlier conversation", () => {
    expect(isFollowUpMessage("which one is cheapest?", false)).toBe(false);
    expect(isFollowUpMessage("which one is cheapest?", true)).toBe(true);
    expect(isFollowUpMessage("what about Mumbai?", true)).toBe(true);
    expect(isFollowUpMessage("and 50 tables?", true)).toBe(true);
    expect(isFollowUpMessage("How does the 1-hour handover inspection work?", true)).toBe(false);
  });

  it("builds a standalone query with the current message first", () => {
    expect(buildStandaloneQuery("make it 50 chairs", ["I need 30 chairs on 28th October", "older", "oldest"]))
      .toBe("make it 50 chairs I need 30 chairs on 28th October older");
  });

  it("finds listings shown in the last answer, preferring explicit IDs", () => {
    const history: ChatHistoryMessage[] = [
      { role: "user", content: "I need chairs and tables" },
      { role: "assistant", content: listingReply },
      { role: "user", content: "what is escrow?" },
      { role: "assistant", content: "Escrow explanation" },
    ];
    expect(getLastShownListings(history).map(l => l.id)).toEqual(["res-chairs", "res-tables"]);

    history.push({ role: "assistant", content: "LLM reply without links", listingIds: ["x", "y", "z"] });
    expect(getLastShownListings(history).map(l => l.id)).toEqual(["x", "y", "z"]);
  });

  it("resolves ordinal, title and single-listing references", () => {
    const shown = [
      { id: "res-chairs", title: "Chiavari Chairs" },
      { id: "res-tables", title: "Round Banquet Tables" },
    ];
    expect(resolveListingReference("tell me more about the second one", shown)?.id).toBe("res-tables");
    expect(resolveListingReference("what's the deposit on option 1?", shown)?.id).toBe("res-chairs");
    expect(resolveListingReference("is the last one available?", shown)?.id).toBe("res-tables");
    expect(resolveListingReference("Are the round banquet tables in Pune?", shown)?.id).toBe("res-tables");
    expect(resolveListingReference("is it available?", shown)).toBeUndefined();
    expect(resolveListingReference("is it available?", [shown[0]])?.id).toBe("res-chairs");
    expect(resolveListingReference("this is my first time renting", shown)).toBeUndefined();
  });
});

describe("RagService follow-up handling", () => {
  it("keeps the previous topic for a vague follow-up question", async () => {
    const { RagService } = await import("../services/rag/rag.service.js");

    const res = await RagService.processQuery({
      message: "and what if they reject it?",
      history: [
        { role: "user", content: "Can I negotiate the price or get a bulk discount?" },
        { role: "assistant", content: "### 💬 How Price Negotiation Works on HostNexus" },
      ],
    });

    expect(res.intent).toBe("negotiation_inquiry");
  });

  it("does not inherit the previous topic when the new question has its own", async () => {
    const { RagService } = await import("../services/rag/rag.service.js");

    const res = await RagService.processQuery({
      message: "What happens if they get damaged?",
      history: [
        { role: "user", content: "I need 30 chairs and 40 tables" },
        { role: "assistant", content: listingReply },
      ],
    });

    expect(res.intent).toBe("damage_inquiry");
  });

  it("treats 'do they have' as a follow-up rather than an AV listing search", async () => {
    const { RagService } = await import("../services/rag/rag.service.js");

    const res = await RagService.processQuery({
      message: "do they have a refund window?",
      history: [
        { role: "user", content: "How does the escrow payment and security deposit refund work?" },
        { role: "assistant", content: "### 💳 HostNexus Escrow & Payment Security" },
      ],
    });

    expect(res.intent).toBe("payment_escrow_inquiry");
  });
});
