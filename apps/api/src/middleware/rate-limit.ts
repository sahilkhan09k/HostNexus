import type { Request, Response } from "express";
import rateLimit, { ipKeyGenerator, type Options } from "express-rate-limit";

/**
 * Rate limits. The default in-memory store is per-process: when running more
 * than one API instance, pass a shared store (e.g. `rate-limit-redis`) via `store`.
 * Correct client IPs depend on `app.set("trust proxy", <hops>)` in app.ts.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const disabled = process.env.NODE_ENV === "test";

const clientIp = (req: Request) => ipKeyGenerator(req.ip ?? "unknown");
const userOrIp = (req: Request) => (req.userId ? `user:${req.userId}` : `ip:${clientIp(req)}`);

function limiter(name: string, windowMs: number, limit: number, extra: Partial<Options> = {}) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skip: () => disabled,
    keyGenerator: (req) => `${name}:${clientIp(req)}`,
    handler: (_req: Request, res: Response) => {
      res.status(429).json({
        success: false,
        error: { code: "RATE_LIMITED", message: "Too many requests. Please try again later." },
      });
    },
    ...extra,
  });
}

/** Baseline for every request */
export const globalLimiter = limiter("global", MINUTE, 300);

/** Credential stuffing: per IP ... */
export const loginIpLimiter = limiter("login-ip", 15 * MINUTE, 20);
/** ... and per targeted account (only failures count) */
export const loginAccountLimiter = limiter("login-acct", 15 * MINUTE, 5, {
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `login-acct:${String(req.body?.email ?? "").trim().toLowerCase().slice(0, 254)}`,
});
export const adminLoginLimiter = limiter("admin-login", 15 * MINUTE, 5, { skipSuccessfulRequests: true });

/** Registration triggers PDF parsing, LLM calls and a paid GSTIN lookup */
export const registerLimiter = limiter("register", DAY, 5);
export const refreshLimiter = limiter("refresh", 15 * MINUTE, 60);

/** Public AI concierge: per-minute burst plus a daily budget */
export const aiBurstLimiter = limiter("ai-burst", MINUTE, 10, { keyGenerator: (req) => `ai-burst:${userOrIp(req)}` });
export const aiDailyLimiter = limiter("ai-daily", DAY, 100, { keyGenerator: (req) => `ai-daily:${userOrIp(req)}` });

export const uploadLimiter = limiter("upload", HOUR, 60, { keyGenerator: (req) => `upload:${userOrIp(req)}` });
export const kycUploadLimiter = limiter("kyc-upload", HOUR, 10);
export const paymentLimiter = limiter("payment", HOUR, 30, { keyGenerator: (req) => `payment:${userOrIp(req)}` });

/** Bookings, offers, reviews and other writes by signed-in users */
export const writeLimiter = limiter("write", MINUTE, 30, {
  keyGenerator: (req) => `write:${userOrIp(req)}`,
  skip: (req) => disabled || req.method === "GET",
});

/** Unauthenticated read endpoints that hit the database */
export const publicReadLimiter = limiter("public-read", MINUTE, 60);
