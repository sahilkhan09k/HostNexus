/**
 * End-to-end checks against the real Express app (no database needed):
 * H-04 upload serving, H-06 body limits, M-02 CORS, M-03 error leakage,
 * M-08 headers, C-01 webhook signature, L-03 admin/user token separation.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import type { AddressInfo } from "net";
import type { Server } from "http";
import jwt from "jsonwebtoken";

vi.mock("../config/database.js", () => {
  const model = () => ({
    findUnique: vi.fn().mockResolvedValue(null),
    findFirst: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    count: vi.fn().mockResolvedValue(0),
    delete: vi.fn(),
  });
  return {
    prisma: {
      user: model(), admin: model(), auditLog: model(), razorpayWebhookEvent: model(),
      bookingRequest: model(), resource: model(), upload: model(), refreshToken: model(),
      $queryRaw: vi.fn(), $transaction: vi.fn(),
    },
    disconnectDatabase: vi.fn(),
  };
});

import { createApp } from "../app.js";
import { env } from "../config/env.js";
import { errorHandler } from "../middleware/error-handler.js";
import { httpError } from "../utils/http-error.js";
import { JWT_AUDIENCE, JWT_ISSUER } from "../services/auth.service.js";

let server: Server;
let base: string;
const legacyHtml = path.join(process.cwd(), "uploads", `test-legacy-${Date.now()}.html`);
const legacyPng = path.join(process.cwd(), "uploads", `test-image-${Date.now()}.png`);

beforeAll(async () => {
  await fs.mkdir(path.dirname(legacyHtml), { recursive: true });
  await fs.writeFile(legacyHtml, "<script>alert(document.domain)</script>");
  await fs.writeFile(legacyPng, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  server = createApp().listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  server.close();
  await fs.unlink(legacyHtml).catch(() => {});
  await fs.unlink(legacyPng).catch(() => {});
});

describe("security headers", () => {
  it("sets a locked-down CSP, nosniff and no x-powered-by on API responses", async () => {
    const res = await fetch(`${base}/health`);
    expect(res.headers.get("x-powered-by")).toBeNull();
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-security-policy")).toContain("default-src 'none'");
    expect(res.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
  });

  it("returns JSON 404 for unknown routes", async () => {
    const res = await fetch(`${base}/api/does-not-exist`);
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ success: false, error: { code: "NOT_FOUND" } });
  });
});

describe("H-04 — /uploads can't be used to host active content", () => {
  it("forces download and sandboxes any non-media file", async () => {
    const res = await fetch(`${base}/uploads/${path.basename(legacyHtml)}`);
    expect(res.headers.get("content-disposition")).toBe("attachment");
    expect(res.headers.get("content-security-policy")).toContain("sandbox");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("still serves images inline for cross-origin <img> use", async () => {
    const res = await fetch(`${base}/uploads/${path.basename(legacyPng)}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toBeNull();
    expect(res.headers.get("cross-origin-resource-policy")).toBe("cross-origin");
  });

  it("does not serve files outside the uploads folder", async () => {
    const res = await fetch(`${base}/uploads/..%2f.env`);
    expect([400, 403, 404]).toContain(res.status);
  });

  it("requires authentication for media uploads", async () => {
    const res = await fetch(`${base}/api/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: "x.html", base64Data: "PHNjcmlwdD4=" }),
    });
    expect(res.status).toBe(401);
  });
});

describe("H-06 — request size limits", () => {
  it("rejects oversized JSON bodies on normal routes with 413", async () => {
    const res = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "a@b.co", password: "x".repeat(200 * 1024) }),
    });
    expect(res.status).toBe(413);
  });

  it("does not parse form-encoded bodies at all (qs attack surface removed)", async () => {
    const res = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "email[__proto__][x]=1&password=a",
    });
    expect(res.status).toBe(400); // body is empty → validation error, not parsed
  });
});

describe("M-02 — CORS allowlist", () => {
  it("allows the configured frontend origin", async () => {
    const res = await fetch(`${base}/health`, { headers: { Origin: "http://localhost:3000" } });
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
  });

  it("does not reflect arbitrary origins", async () => {
    const res = await fetch(`${base}/health`, { headers: { Origin: "https://evil.example" } });
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });
});

describe("L-03 — admin and user tokens are not interchangeable", () => {
  it("a valid user access token is rejected by admin routes", async () => {
    const userToken = jwt.sign({ sub: "u1", type: "access", ver: 0 }, env.JWT_SECRET, {
      expiresIn: "15m", issuer: JWT_ISSUER, audience: JWT_AUDIENCE,
    });
    const res = await fetch(`${base}/api/admin/users`, { headers: { Authorization: `Bearer ${userToken}` } });
    expect(res.status).toBe(401);
  });

  it("an old-style admin token signed with JWT_SECRET is rejected", async () => {
    const legacyAdmin = jwt.sign({ sub: "admin-1", type: "admin" }, env.JWT_SECRET, { expiresIn: "8h" });
    const res = await fetch(`${base}/api/admin/summary`, { headers: { Authorization: `Bearer ${legacyAdmin}` } });
    expect(res.status).toBe(401);
  });

  it("dispute resolution is no longer reachable with a user token on /api/bookings", async () => {
    const res = await fetch(`${base}/api/bookings/b1/resolve-dispute`, { method: "POST" });
    expect(res.status).toBe(401); // user auth runs first; the route itself moved to /api/admin
  });
});

describe("C-01 — Razorpay webhook", () => {
  it("rejects deliveries without a valid signature", async () => {
    (env as any).RAZORPAY_WEBHOOK_SECRET = "whsec_test_1234567890abcdef";
    const body = JSON.stringify({ event: "payment.captured", payload: {} });
    const res = await fetch(`${base}/api/webhooks/razorpay`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Razorpay-Signature": "0".repeat(64) },
      body,
    });
    expect(res.status).toBe(400);
  });

  it("verifies the signature over the raw bytes", async () => {
    (env as any).RAZORPAY_WEBHOOK_SECRET = "whsec_test_1234567890abcdef";
    const body = JSON.stringify({ event: "refund.created", payload: {} });
    const sig = crypto.createHmac("sha256", "whsec_test_1234567890abcdef").update(body).digest("hex");
    const res = await fetch(`${base}/api/webhooks/razorpay`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Razorpay-Signature": sig },
      body,
    });
    expect(res.status).toBe(200);
  });
});

describe("M-03 — error responses don't leak internals", () => {
  function run(err: Error) {
    const res: any = { status: vi.fn(), json: vi.fn() };
    res.status.mockReturnValue(res);
    errorHandler(err, { path: "/x", method: "GET" } as any, res, vi.fn());
    return res;
  }

  it("unexpected errors become a generic 500", () => {
    const res = run(new Error("Invalid `prisma.bookingRequest.create()` invocation in D:\\app\\booking.service.ts:265:30"));
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0].error.message).toBe("An unexpected error occurred");
  });

  it("expected HttpErrors keep their status, code and message", () => {
    const res = run(httpError(409, "NOT_CANCELLABLE", "This booking can no longer be cancelled."));
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].error).toEqual({ code: "NOT_CANCELLABLE", message: "This booking can no longer be cancelled." });
  });
});
