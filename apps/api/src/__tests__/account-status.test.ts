import { describe, it, expect, vi, beforeEach } from "vitest";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import type { Request, Response } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { AuthService, JWT_AUDIENCE, JWT_ISSUER } from "../services/auth.service.js";
import { prisma } from "../config/database.js";
import { env } from "../config/env.js";

vi.mock("../config/database.js", async () => {
  const { createFakePrisma } = await import("./helpers/fake-prisma.js");
  return { prisma: createFakePrisma() };
});

const db = prisma as any;
const PASSWORD = "a strong pass 99";

function mockRes() {
  const res: Partial<Response> & { statusCode?: number; body?: any } = {};
  res.status = vi.fn((code: number) => { res.statusCode = code; return res as Response; });
  res.json = vi.fn((body: any) => { res.body = body; return res as Response; });
  return res as Response & { statusCode?: number; body?: any };
}

const access = (sub: string) =>
  jwt.sign({ sub, type: "access", ver: 0 }, env.JWT_SECRET, {
    algorithm: "HS256", expiresIn: "15m", issuer: JWT_ISSUER, audience: JWT_AUDIENCE,
  });

beforeEach(async () => {
  db.__reset();
  const passwordHash = await bcrypt.hash(PASSWORD, 4);
  db.__seed("user", { id: "u-ok", email: "ok@example.com", passwordHash, verificationStatus: "VERIFIED", tokenVersion: 0 });
  db.__seed("user", { id: "u-sus", email: "sus@example.com", passwordHash, verificationStatus: "SUSPENDED", tokenVersion: 0 });
  db.__seed("user", { id: "u-rej", email: "rej@example.com", passwordHash, verificationStatus: "REJECTED", tokenVersion: 0 });
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

  it.each(["u-sus", "u-rej"])("cuts off %s even with a still-valid token", async (userId) => {
    const req = { headers: { authorization: `Bearer ${access(userId)}` } } as Request;
    const res = mockRes();
    const next = vi.fn();
    await authenticate(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body.error.code).toBe("SESSION_REVOKED");
  });

  it("tells a suspended user why they can't sign in", async () => {
    await expect(AuthService.login({ email: "sus@example.com", password: PASSWORD }))
      .rejects.toMatchObject({ statusCode: 403, code: "ACCOUNT_SUSPENDED" });
  });
});
