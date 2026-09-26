import { describe, it, expect, vi, beforeEach } from "vitest";
import jwt from "jsonwebtoken";
import type { Request, Response } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { AuthController } from "../controllers/auth.controller.js";
import { prisma } from "../config/database.js";
import { env } from "../config/env.js";

vi.mock("../config/database.js", async () => {
  const { createFakePrisma } = await import("./helpers/fake-prisma.js");
  return { prisma: createFakePrisma() };
});

const db = prisma as any;

function mockRes() {
  const res: Partial<Response> & { statusCode?: number; body?: any } = {};
  res.status = vi.fn((code: number) => { res.statusCode = code; return res as Response; });
  res.json = vi.fn((body: any) => { res.body = body; return res as Response; });
  return res as Response & { statusCode?: number; body?: any };
}

const access  = (sub: string) => jwt.sign({ sub, type: "access" }, env.JWT_SECRET, { expiresIn: "15m" });
const refresh = (sub: string) => jwt.sign({ sub, type: "refresh" }, env.REFRESH_TOKEN_SECRET, { expiresIn: "7d" });

beforeEach(() => {
  db.__reset();
  db.__seed("user", { id: "u-ok", verificationStatus: "VERIFIED" });
  db.__seed("user", { id: "u-sus", verificationStatus: "SUSPENDED" });
  db.__seed("user", { id: "u-rej", verificationStatus: "REJECTED" });
});

describe("account status on every request (#17)", () => {
  it("lets a verified user through", async () => {
    const req = { headers: { authorization: `Bearer ${access("u-ok")}` } } as Request;
    const res = mockRes();
    const next = vi.fn();
    await authenticate(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.userId).toBe("u-ok");
  });

  it.each([
    ["u-sus", "ACCOUNT_SUSPENDED"],
    ["u-rej", "ACCOUNT_REJECTED"],
  ])("blocks %s with a still-valid token (%s)", async (userId, code) => {
    const req = { headers: { authorization: `Bearer ${access(userId)}` } } as Request;
    const res = mockRes();
    const next = vi.fn();
    await authenticate(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body.error.code).toBe(code);
  });

  it("refuses to refresh a suspended user's session", async () => {
    const res = mockRes();
    await AuthController.refresh({ body: { refreshToken: refresh("u-sus") } } as Request, res);
    expect(res.statusCode).toBe(403);
    expect(res.body.error.code).toBe("ACCOUNT_SUSPENDED");
  });

  it("refreshes a verified user's session", async () => {
    const res = mockRes();
    await AuthController.refresh({ body: { refreshToken: refresh("u-ok") } } as Request, res);
    expect(res.statusCode).toBe(200);
    expect(typeof res.body.data.accessToken).toBe("string");
  });
});
