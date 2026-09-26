import { describe, it, expect, vi } from "vitest";
import { AiController } from "../controllers/ai.controller.js";

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

  it("should respond with 200 and matched listings for multi-item order request", async () => {
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
    expect(callArg.data.results.length).toBeGreaterThan(0);
    expect(callArg.data.results.some((r: any) => r.title.toLowerCase().includes("chair"))).toBe(true);
    expect(callArg.data.results.some((r: any) => r.title.toLowerCase().includes("table"))).toBe(true);
  });
});
