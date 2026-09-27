import { describe, it, expect, vi, beforeEach } from "vitest";
import jwt from "jsonwebtoken";

// ── In-memory stand-ins for the tables the auth service touches ─────────────
const db = vi.hoisted(() => ({
  users: new Map<string, any>(),
  refreshTokens: new Map<string, any>(),
}));

vi.mock("../config/database.js", () => {
  const matches = (row: any, where: any) =>
    Object.entries(where).every(([k, v]) => (v === null ? row[k] == null : row[k] === v));
  const prisma: any = {
    user: {
      findUnique: vi.fn(async ({ where }: any) => {
        if (where.id) return db.users.get(where.id) ?? null;
        return [...db.users.values()].find((u) => u.email === where.email || (where.gstin && u.gstin === where.gstin)) ?? null;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const u = db.users.get(where.id);
        if (data.tokenVersion?.increment) u.tokenVersion += data.tokenVersion.increment;
        return u;
      }),
      create: vi.fn(),
    },
    refreshToken: {
      create: vi.fn(async ({ data }: any) => {
        db.refreshTokens.set(data.id, { ...data, revokedAt: null, replacedById: null });
      }),
      findUnique: vi.fn(async ({ where }: any) =>
        [...db.refreshTokens.values()].find((t) => t.tokenHash === where.tokenHash) ?? null
      ),
      update: vi.fn(async ({ where, data }: any) => Object.assign(db.refreshTokens.get(where.id), data)),
      updateMany: vi.fn(async ({ where, data }: any) => {
        let count = 0;
        for (const t of db.refreshTokens.values()) {
          if (matches(t, where)) {
            Object.assign(t, data);
            count++;
          }
        }
        return { count };
      }),
    },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(async (arg: any) => (Array.isArray(arg) ? Promise.all(arg) : arg(prisma))),
  };
  return { prisma };
});

vi.mock("../services/gstin.service.js", () => ({
  GstinService: {
    findKycUpload: vi.fn(),
    extractFromDocument: vi.fn(),
    verify: vi.fn(),
  },
}));

import bcrypt from "bcrypt";
import { AuthService, JWT_AUDIENCE, JWT_ISSUER } from "../services/auth.service.js";
import { GstinService } from "../services/gstin.service.js";
import { prisma } from "../config/database.js";
import { env } from "../config/env.js";

const userId = "test-user-123";
const PASSWORD = "correct horse 42";

async function seedUser(overrides: Partial<Record<string, unknown>> = {}) {
  db.users.set(userId, {
    id: userId,
    email: "owner@example.com",
    passwordHash: await bcrypt.hash(PASSWORD, 4),
    ownerName: "Asha Patel",
    phone: "9999999999",
    verificationStatus: "VERIFIED",
    tokenVersion: 0,
    gstin: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
}

beforeEach(async () => {
  db.users.clear();
  db.refreshTokens.clear();
  vi.clearAllMocks();
  await seedUser();
});

describe("Access tokens", () => {
  it("issues access tokens that verifyToken accepts (HS256, issuer, audience, version)", async () => {
    const { accessToken } = await AuthService.login({ email: "owner@example.com", password: PASSWORD });
    expect(AuthService.verifyToken(accessToken)).toEqual({ sub: userId, ver: 0 });
    const decoded = jwt.decode(accessToken, { complete: true }) as any;
    expect(decoded.header.alg).toBe("HS256");
    expect(decoded.payload.iss).toBe(JWT_ISSUER);
    expect(decoded.payload.aud).toBe(JWT_AUDIENCE);
  });

  it("rejects a refresh-type token, a token without type, and a token without issuer/audience", () => {
    const opts = { expiresIn: "15m", issuer: JWT_ISSUER, audience: JWT_AUDIENCE } as const;
    const refreshTyped = jwt.sign({ sub: userId, type: "refresh", ver: 0 }, env.JWT_SECRET, opts);
    const untyped = jwt.sign({ sub: userId, ver: 0 }, env.JWT_SECRET, opts);
    const noIssuer = jwt.sign({ sub: userId, type: "access", ver: 0 }, env.JWT_SECRET, { expiresIn: "15m" });
    for (const t of [refreshTyped, untyped, noIssuer]) {
      expect(() => AuthService.verifyToken(t)).toThrow("Invalid or expired token");
    }
  });

  it("rejects tokens signed with the none algorithm", () => {
    const none = jwt.sign({ sub: userId, type: "access", ver: 0, iss: JWT_ISSUER, aud: JWT_AUDIENCE }, "", { algorithm: "none" } as any);
    expect(() => AuthService.verifyToken(none)).toThrow("Invalid or expired token");
  });

  it("stops accepting a user's access token once the account is rejected (H-07)", async () => {
    const { accessToken } = await AuthService.login({ email: "owner@example.com", password: PASSWORD });
    await expect(AuthService.verifyAccessToken(accessToken)).resolves.toEqual({ sub: userId, ver: 0 });

    db.users.get(userId).verificationStatus = "REJECTED";
    await expect(AuthService.verifyAccessToken(accessToken)).rejects.toMatchObject({ statusCode: 401, code: "SESSION_REVOKED" });
  });

  it("revokeAllSessions invalidates outstanding access tokens via tokenVersion", async () => {
    const { accessToken } = await AuthService.login({ email: "owner@example.com", password: PASSWORD });
    await AuthService.revokeAllSessions(userId);
    await expect(AuthService.verifyAccessToken(accessToken)).rejects.toMatchObject({ code: "SESSION_REVOKED" });
  });
});

describe("Refresh token rotation", () => {
  it("rotates: returns a new pair and the old refresh token stops working", async () => {
    const first = await AuthService.login({ email: "owner@example.com", password: PASSWORD });
    const second = await AuthService.refreshTokens(first.refreshToken);

    expect(second.userId).toBe(userId);
    expect(second.refreshToken).not.toBe(first.refreshToken);
    expect(AuthService.verifyToken(second.accessToken).sub).toBe(userId);

    // Replaying the rotated token is treated as theft
    await expect(AuthService.refreshTokens(first.refreshToken)).rejects.toMatchObject({ code: "REFRESH_TOKEN_REUSED" });
  });

  it("reuse of an old token revokes the whole session family, including the newest token", async () => {
    const first = await AuthService.login({ email: "owner@example.com", password: PASSWORD });
    const second = await AuthService.refreshTokens(first.refreshToken);

    await expect(AuthService.refreshTokens(first.refreshToken)).rejects.toMatchObject({ code: "REFRESH_TOKEN_REUSED" });
    await expect(AuthService.refreshTokens(second.refreshToken)).rejects.toMatchObject({ code: "REFRESH_TOKEN_REUSED" });
  });

  it("refuses to refresh for a rejected user (a banned session can't be extended forever)", async () => {
    const { refreshToken } = await AuthService.login({ email: "owner@example.com", password: PASSWORD });
    db.users.get(userId).verificationStatus = "REJECTED";
    await expect(AuthService.refreshTokens(refreshToken)).rejects.toMatchObject({ statusCode: 401, code: "SESSION_REVOKED" });
  });

  it("logout revokes the session's refresh token", async () => {
    const { refreshToken } = await AuthService.login({ email: "owner@example.com", password: PASSWORD });
    await expect(AuthService.logout(refreshToken)).resolves.toBe(userId);
    await expect(AuthService.refreshTokens(refreshToken)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("rejects garbage, access tokens used as refresh tokens, and tokens never issued by us", async () => {
    const { accessToken } = await AuthService.login({ email: "owner@example.com", password: PASSWORD });
    const forgedButValid = jwt.sign(
      { sub: userId, type: "refresh", ver: 0, fam: "x" },
      env.REFRESH_TOKEN_SECRET,
      { issuer: JWT_ISSUER, audience: JWT_AUDIENCE, jwtid: "not-in-db", expiresIn: "7d" }
    );
    for (const t of ["invalid.token.here", accessToken, forgedButValid]) {
      await expect(AuthService.refreshTokens(t)).rejects.toMatchObject({ statusCode: 401 });
    }
  });
});

describe("Login", () => {
  it("returns the same 401 for unknown email and wrong password, and still runs bcrypt for unknown emails (L-01)", async () => {
    const compare = vi.spyOn(bcrypt, "compare");
    const unknown = AuthService.login({ email: "nobody@example.com", password: PASSWORD });
    await expect(unknown).rejects.toMatchObject({ statusCode: 401, code: "INVALID_CREDENTIALS", message: "Invalid email or password" });
    const wrong = AuthService.login({ email: "owner@example.com", password: "wrong password 1" });
    await expect(wrong).rejects.toMatchObject({ statusCode: 401, code: "INVALID_CREDENTIALS", message: "Invalid email or password" });
    expect(compare).toHaveBeenCalledTimes(2);
    compare.mockRestore();
  });

  it("never returns passwordHash or tokenVersion", async () => {
    const res = await AuthService.login({ email: "owner@example.com", password: PASSWORD });
    expect(res.user).not.toHaveProperty("passwordHash");
    expect(res.user).not.toHaveProperty("tokenVersion");
  });
});

describe("Registration KYC cross-check (H-05)", () => {
  const input = {
    email: "new@example.com",
    password: "a strong pass 99",
    ownerName: "Ravi Kumar",
    phone: "9876543210",
    businessName: "Sunrise Caterers",
    businessType: "Caterer",
    addressLine: "12 MG Road",
    city: "Pune",
    state: "Maharashtra",
    pincode: "411001",
    gstCertificateUrl: "/kyc/0b6c6f5e-1f1a-4c1e-9a55-0d2b1f0a9e11.pdf",
  };

  function captureCreatedUser() {
    const created: any[] = [];
    (prisma as any).user.create.mockImplementation(async ({ data }: any) => {
      const u = { id: "new-user", createdAt: new Date(), updatedAt: new Date(), tokenVersion: 0, ...data };
      created.push(u);
      return u;
    });
    (prisma as any).business = { create: vi.fn() };
    (prisma as any).upload = { updateMany: vi.fn().mockResolvedValue({ count: 1 }) };
    return created;
  }

  beforeEach(() => {
    (GstinService.findKycUpload as any).mockResolvedValue({ id: "0b6c6f5e-1f1a-4c1e-9a55-0d2b1f0a9e11.pdf", ownerId: null, purpose: "KYC" });
    (GstinService.extractFromDocument as any).mockResolvedValue("27AAPFU0939F1ZV");
  });

  it("auto-verifies when the registry name and state match", async () => {
    const created = captureCreatedUser();
    (GstinService.verify as any).mockResolvedValue({ gstin: "27AAPFU0939F1ZV", legalName: "SUNRISE CATERERS PRIVATE LIMITED", tradeName: null, status: "Active" });
    const res = await AuthService.register(input as any);
    expect(res.autoVerified).toBe(true);
    expect(created[0].verificationStatus).toBe("VERIFIED");
  });

  it("sends someone else's GSTIN to manual review instead of verifying it", async () => {
    const created = captureCreatedUser();
    (GstinService.verify as any).mockResolvedValue({ gstin: "27AAPFU0939F1ZV", legalName: "TAJ HOTELS LIMITED", tradeName: "TAJ", status: "Active" });
    const res = await AuthService.register(input as any);
    expect(res.autoVerified).toBe(false);
    expect(created[0].verificationStatus).toBe("PENDING");
    expect(created[0].verificationNotes).toContain("DOES NOT match");
  });

  it("sends a state mismatch to manual review", async () => {
    const created = captureCreatedUser();
    (GstinService.verify as any).mockResolvedValue({ gstin: "27AAPFU0939F1ZV", legalName: "SUNRISE CATERERS", tradeName: null, status: "Active" });
    const res = await AuthService.register({ ...input, state: "Karnataka" } as any);
    expect(res.autoVerified).toBe(false);
    expect(created[0].verificationStatus).toBe("PENDING");
  });

  it("refuses a KYC document already bound to another account", async () => {
    captureCreatedUser();
    (GstinService.findKycUpload as any).mockResolvedValue({ id: "x.pdf", ownerId: "someone-else", purpose: "KYC" });
    await expect(AuthService.register(input as any)).rejects.toMatchObject({ code: "GSTIN_DOCUMENT_INVALID" });
  });
});
