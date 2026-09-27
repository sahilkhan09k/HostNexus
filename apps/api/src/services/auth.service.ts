import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { prisma } from "../config/database.js";
import { env } from "../config/env.js";
import { GstinService, type GstinDetails } from "./gstin.service.js";
import { evaluateKycMatch } from "./kyc-match.js";
import { conflict, unauthorized, forbidden, unprocessable } from "../utils/http-error.js";
import type { RegisterInput, LoginInput } from "../schemas/auth.schema.js";

export const SALT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const JWT_ISSUER = "hostnexus-api";
export const JWT_AUDIENCE = "hostnexus-web";
const JWT_ALGORITHMS: jwt.Algorithm[] = ["HS256"];

interface SafeUser {
  id: string;
  email: string;
  ownerName: string | null;
  phone: string | null;
  verificationStatus: string;
  gstin?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface AuthResponse {
  user: SafeUser;
  token: string;
  accessToken: string;
  refreshToken: string;
}

export interface AccessTokenPayload {
  sub: string;
  ver: number;
}

const sha256 = (value: string) => crypto.createHash("sha256").update(value).digest("hex");

// Compared against when the email does not exist, so login timing doesn't reveal registered emails
let dummyHashPromise: Promise<string> | null = null;
const getDummyHash = () => (dummyHashPromise ??= bcrypt.hash(crypto.randomBytes(16).toString("hex"), SALT_ROUNDS));

export class AuthService {
  private static sanitizeUser(user: {
    id: string;
    email: string;
    ownerName: string | null;
    phone: string | null;
    verificationStatus: string;
    gstin?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): SafeUser {
    // Explicit allowlist — never spread the DB row (passwordHash, tokenVersion, KYC notes...)
    return {
      id: user.id,
      email: user.email,
      ownerName: user.ownerName,
      phone: user.phone,
      verificationStatus: user.verificationStatus,
      gstin: user.gstin ?? null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private static generateAccessToken(userId: string, tokenVersion: number): string {
    return jwt.sign({ sub: userId, type: "access", ver: tokenVersion }, env.JWT_SECRET, {
      algorithm: "HS256",
      expiresIn: ACCESS_TOKEN_EXPIRY,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
  }

  /** Issues a refresh token and records its hash so it can be rotated/revoked. */
  private static async issueRefreshToken(userId: string, tokenVersion: number, familyId: string): Promise<{ token: string; id: string }> {
    const id = crypto.randomUUID();
    const token = jwt.sign({ sub: userId, type: "refresh", ver: tokenVersion, fam: familyId }, env.REFRESH_TOKEN_SECRET, {
      algorithm: "HS256",
      expiresIn: Math.floor(REFRESH_TOKEN_TTL_MS / 1000),
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      jwtid: id,
    });
    await prisma.refreshToken.create({
      data: { id, userId, familyId, tokenHash: sha256(token), expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS) },
    });
    return { token, id };
  }

  private static async generateTokenPair(userId: string, tokenVersion: number, familyId: string = crypto.randomUUID()): Promise<TokenPair & { refreshTokenId: string }> {
    const refresh = await this.issueRefreshToken(userId, tokenVersion, familyId);
    return {
      accessToken: this.generateAccessToken(userId, tokenVersion),
      refreshToken: refresh.token,
      refreshTokenId: refresh.id,
    };
  }

  /** Verifies signature, algorithm, issuer, audience, expiry and token type. Does not hit the DB. */
  static verifyToken(token: string): AccessTokenPayload {
    try {
      const payload = jwt.verify(token, env.JWT_SECRET, {
        algorithms: JWT_ALGORITHMS,
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      }) as { sub?: string; type?: string; ver?: number };
      if (payload.type !== "access" || typeof payload.sub !== "string" || typeof payload.ver !== "number") {
        throw new Error("Invalid token type");
      }
      return { sub: payload.sub, ver: payload.ver };
    } catch {
      throw unauthorized("Invalid or expired token", "INVALID_TOKEN");
    }
  }

  /**
   * Full access-token check used by the authenticate middleware: the account must
   * still exist, still be VERIFIED, and not have had its tokens revoked since issue.
   */
  static async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    const payload = this.verifyToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { verificationStatus: true, tokenVersion: true },
    });
    if (!user || user.verificationStatus !== "VERIFIED" || user.tokenVersion !== payload.ver) {
      throw unauthorized("Session revoked. Please sign in again.", "SESSION_REVOKED");
    }
    return payload;
  }

  /**
   * Rotates a refresh token. Each refresh token can be used once; presenting an
   * already-rotated token means it was stolen (or replayed), so the whole token
   * family is revoked and the user must sign in again.
   */
  static async refreshTokens(refreshToken: string): Promise<{ userId: string } & TokenPair> {
    let payload: { sub?: string; type?: string; ver?: number; fam?: string; jti?: string };
    try {
      payload = jwt.verify(refreshToken, env.REFRESH_TOKEN_SECRET, {
        algorithms: JWT_ALGORITHMS,
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      }) as typeof payload;
    } catch {
      throw unauthorized("Invalid or expired refresh token", "INVALID_REFRESH_TOKEN");
    }
    if (payload.type !== "refresh" || !payload.sub || !payload.jti || !payload.fam || typeof payload.ver !== "number") {
      throw unauthorized("Invalid or expired refresh token", "INVALID_REFRESH_TOKEN");
    }

    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: sha256(refreshToken) } });
    if (!stored || stored.id !== payload.jti || stored.userId !== payload.sub) {
      throw unauthorized("Invalid or expired refresh token", "INVALID_REFRESH_TOKEN");
    }

    if (stored.revokedAt) {
      await this.revokeFamily(stored.familyId);
      const { audit } = await import("./audit.service.js");
      await audit({ action: "AUTH_REFRESH_REUSE_DETECTED", actorType: "USER", actorId: stored.userId, metadata: { familyId: stored.familyId } });
      throw unauthorized("Session revoked. Please sign in again.", "REFRESH_TOKEN_REUSED");
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { verificationStatus: true, tokenVersion: true },
    });
    if (!user || user.verificationStatus !== "VERIFIED" || user.tokenVersion !== payload.ver) {
      await this.revokeFamily(stored.familyId);
      throw unauthorized("Session revoked. Please sign in again.", "SESSION_REVOKED");
    }

    // Claim the token atomically: a concurrent refresh with the same token gets count 0
    const claimed = await prisma.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (claimed.count !== 1) {
      await this.revokeFamily(stored.familyId);
      throw unauthorized("Session revoked. Please sign in again.", "REFRESH_TOKEN_REUSED");
    }

    const tokens = await this.generateTokenPair(payload.sub, user.tokenVersion, stored.familyId);
    await prisma.refreshToken.update({ where: { id: stored.id }, data: { replacedById: tokens.refreshTokenId } });
    return { userId: payload.sub, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
  }

  static async revokeFamily(familyId: string): Promise<void> {
    await prisma.refreshToken.updateMany({ where: { familyId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  /** Logout: revokes the session (token family) the presented refresh token belongs to. */
  static async logout(refreshToken: string): Promise<string | null> {
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: sha256(refreshToken) } });
    if (!stored) return null;
    await this.revokeFamily(stored.familyId);
    return stored.userId;
  }

  /** Invalidates every access and refresh token the user holds (used on reject). */
  static async revokeAllSessions(userId: string): Promise<void> {
    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } }),
      prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
  }

  /**
   * Register with automated KYC: extract the GSTIN from the uploaded GST
   * certificate, verify it is registered and Active, and cross-check the
   * registry's legal/trade name and state against what the user typed.
   * Matching accounts are VERIFIED immediately; anything else waits for admin review.
   */
  static async register(input: RegisterInput): Promise<{ user: SafeUser; gstin: GstinDetails; autoVerified: boolean }> {
    const existingUser = await prisma.user.findUnique({ where: { email: input.email } });
    if (existingUser) {
      throw conflict("An account with this email already exists", "EMAIL_TAKEN");
    }

    const upload = await GstinService.findKycUpload(input.gstCertificateUrl);
    if (upload.ownerId) {
      throw unprocessable("This document has already been used for another registration. Please upload it again.", "GSTIN_DOCUMENT_INVALID");
    }

    const gstin = await GstinService.extractFromDocument(input.gstCertificateUrl);
    const gstinTaken = await prisma.user.findUnique({ where: { gstin } });
    if (gstinTaken) {
      throw conflict(
        `GSTIN ${gstin} is already registered on HostNexus. If this is your business, please contact support.`,
        "GSTIN_ALREADY_REGISTERED"
      );
    }
    const details = await GstinService.verify(gstin);

    const match = evaluateKycMatch({
      gstin,
      legalName: details.legalName,
      tradeName: details.tradeName,
      businessName: input.businessName,
      ownerName: input.ownerName,
      state: input.state,
    });

    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
    const registryName = details.legalName ? ` (${details.legalName}${details.tradeName ? ` / ${details.tradeName}` : ""})` : "";

    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: input.email,
          passwordHash,
          ownerName: input.ownerName,
          phone: input.phone,
          verificationStatus: match.autoVerified ? "VERIFIED" : "PENDING",
          verificationNotes: match.autoVerified
            ? `Auto-verified via GSTIN ${gstin}${registryName}`
            : `Manual review: GSTIN ${gstin}${registryName} — name ${match.nameMatches ? "matches" : "DOES NOT match"}, state ${match.stateMatches ? "matches" : "DOES NOT match"}`,
          gstCertificateUrl: input.gstCertificateUrl,
          gstin,
          gstLegalName: details.legalName,
          gstTradeName: details.tradeName,
        },
      });

      await tx.business.create({
        data: {
          name: input.businessName,
          ownerId: newUser.id,
          businessType: input.businessType,
          addressLine: input.addressLine,
          city: input.city,
          state: input.state,
          pincode: input.pincode,
        },
      });

      // Bind the KYC document to this account so it can't be reused by another registration
      const bound = await tx.upload.updateMany({
        where: { id: upload.id, ownerId: null },
        data: { ownerId: newUser.id },
      });
      if (bound.count !== 1) {
        throw unprocessable("This document has already been used for another registration.", "GSTIN_DOCUMENT_INVALID");
      }

      return newUser;
    });

    return { user: this.sanitizeUser(user), gstin: details, autoVerified: match.autoVerified };
  }

  /**
   * Login: blocks users who are PENDING or REJECTED.
   * Always runs one bcrypt comparison so response time doesn't reveal whether the email exists.
   */
  static async login(input: LoginInput): Promise<AuthResponse> {
    const user = await prisma.user.findUnique({ where: { email: input.email } });

    const isPasswordValid = await bcrypt.compare(input.password, user?.passwordHash ?? (await getDummyHash()));
    if (!user || !isPasswordValid) {
      throw unauthorized("Invalid email or password", "INVALID_CREDENTIALS");
    }

    if (user.verificationStatus === "PENDING") {
      throw forbidden(
        "Your account is pending verification. Our team will review your documents and notify you within 24–48 hours.",
        "ACCOUNT_PENDING"
      );
    }

    if (user.verificationStatus === "REJECTED") {
      throw forbidden("Your account verification was rejected. Please contact support.", "ACCOUNT_REJECTED");
    }

    if (user.verificationStatus === "SUSPENDED") {
      throw forbidden("Your account has been suspended. Please contact support.", "ACCOUNT_SUSPENDED");
    }

    const tokens = await this.generateTokenPair(user.id, user.tokenVersion);
    return {
      user: this.sanitizeUser(user),
      token: tokens.accessToken,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  static async getUserById(userId: string): Promise<SafeUser | null> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return null;
    return this.sanitizeUser(user);
  }

  /**
   * Validate session — used by frontend on boot.
   * Returns the safe user if token is valid and account is verified.
   */
  static async validateSession(userId: string): Promise<SafeUser | null> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.verificationStatus !== "VERIFIED") return null;
    return this.sanitizeUser(user);
  }
}
