import { describe, it, expect, vi, beforeAll } from "vitest";
import { AiController } from "../controllers/ai.controller.js";

// Inventory answers read listings from the database; use an in-memory one.
vi.mock("../config/database.js", async () => {
  const { createFakePrisma } = await import("./helpers/fake-prisma.js");
  return { prisma: createFakePrisma() };
});

// Use the built-in answers so these tests don't depend on a live LLM.
beforeAll(() => {
  for (const k of ["GROQ_API_KEY", "GEMINI_API_KEY", "OPENAI_API_KEY"]) delete process.env[k];
});

function makeRes() {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
}

function makeNext() {
  return vi.fn();
}

describe("AiController.handleConciergeQuery", () => {
  it("should respond with 200 and RAG data for a damage policy question", async () => {
    const req = {
      body: {
        message: "what will happen if my product gets damage?",
      },
    } as any;
    const res = makeRes();
    const next = makeNext();

    await AiController.handleConciergeQuery(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalled();
    const callArg = res.json.mock.calls[0][0];
    expect(callArg.success).toBe(true);
    expect(callArg.data.intent).toBe("damage_inquiry");
    expect(callArg.data.reply.toLowerCase()).toContain("damage");
    expect(callArg.data.reply.toLowerCase()).toContain("escrow");
  }, 15000);

  it("should respond with 200 and only real matches for a multi-item order request", async () => {
    const req = {
      body: {
        message: "I want to order 30 chairs, 40 tables on 28th October",
        date: "2026-10-28",
      },
    } as any;
    const res = makeRes();
    const next = makeNext();

    await AiController.handleConciergeQuery(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalled();
    const callArg = res.json.mock.calls[0][0];
    expect(callArg.success).toBe(true);
    expect(callArg.data.intent).toBe("listing_inquiry");
    // Nothing is listed in the empty test database, so nothing may be shown
    expect(callArg.data.results).toEqual([]);
    expect(callArg.data.reply).toContain("No chairs are listed");
  });
});
