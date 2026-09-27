import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { prisma } from "../config/database.js";
import { env } from "../config/env.js";
import { AuthService, JWT_ISSUER, SALT_ROUNDS } from "./auth.service.js";
import { notFound, unauthorized } from "../utils/http-error.js";
import { notifyKycEvent } from "./notifications/account-notifications.js";
import { disconnectUser } from "./notifications/realtime.service.js";
import { pageArgs, toPage, type Pagination } from "../utils/pagination.js";

const ADMIN_TOKEN_EXPIRY = "1h";
const ADMIN_AUDIENCE = "hostnexus-admin";

/**
 * Admin tokens are signed with their own key. When ADMIN_JWT_SECRET is not set
 * (development), a key is derived from JWT_SECRET with HKDF so a user token can
 * never verify as an admin token even if the payload shape were identical.
 */
const ADMIN_SIGNING_KEY: Buffer = env.ADMIN_JWT_SECRET
  ? Buffer.from(env.ADMIN_JWT_SECRET, "utf8")
  : Buffer.from(crypto.hkdfSync("sha256", env.JWT_SECRET, "hostnexus", "admin-jwt-signing-key", 32));

let dummyHashPromise: Promise<string> | null = null;
const getDummyHash = () => (dummyHashPromise ??= bcrypt.hash(crypto.randomBytes(16).toString("hex"), SALT_ROUNDS));

const USER_LIST_SELECT = {
  id: true,
  email: true,
  ownerName: true,
  phone: true,
  verificationStatus: true,
  verificationNotes: true,
  gstCertificateUrl: true,
  aadhaarUrl: true,
  gstin: true,
  gstLegalName: true,
  gstTradeName: true,
  createdAt: true,
  businesses: {
    select: {
      id: true,
      name: true,
      businessType: true,
      addressLine: true,
      city: true,
      state: true,
      pincode: true,
    },
  },
} as const;

export class AdminService {
  static generateAdminToken(adminId: string, tokenVersion: number): string {
    return jwt.sign({ sub: adminId, type: "admin", ver: tokenVersion }, ADMIN_SIGNING_KEY, {
      algorithm: "HS256",
      expiresIn: ADMIN_TOKEN_EXPIRY,
      issuer: JWT_ISSUER,
      audience: ADMIN_AUDIENCE,
    });
  }

  /** Signature/claims check only (no DB). */
  static verifyAdminToken(token: string): { sub: string; ver: number } {
    const payload = jwt.verify(token, ADMIN_SIGNING_KEY, {
      algorithms: ["HS256"],
      issuer: JWT_ISSUER,
      audience: ADMIN_AUDIENCE,
    }) as { sub?: string; type?: string; ver?: number };
    if (payload.type !== "admin" || typeof payload.sub !== "string" || typeof payload.ver !== "number") {
      throw new Error("Not an admin token");
    }
    return { sub: payload.sub, ver: payload.ver };
  }

  /** Full check used by the middleware: the admin must still exist and not have been logged out. */
  static async verifyAdminSession(token: string): Promise<{ sub: string }> {
    const payload = this.verifyAdminToken(token);
    const admin = await prisma.admin.findUnique({ where: { id: payload.sub }, select: { tokenVersion: true } });
    if (!admin || admin.tokenVersion !== payload.ver) throw new Error("Admin session revoked");
    return { sub: payload.sub };
  }

  static async login(email: string, password: string) {
    const admin = await prisma.admin.findUnique({ where: { email } });
    const valid = await bcrypt.compare(password, admin?.passwordHash ?? (await getDummyHash()));
    if (!admin || !valid) throw unauthorized("Invalid admin credentials", "INVALID_CREDENTIALS");

    const token = this.generateAdminToken(admin.id, admin.tokenVersion);
    return {
      token,
      admin: { id: admin.id, email: admin.email, name: admin.name },
    };
  }

  /** Logs the admin out of every session. */
  static async logout(adminId: string): Promise<void> {
    await prisma.admin.update({ where: { id: adminId }, data: { tokenVersion: { increment: 1 } } });
  }

  /**
   * List users with their business and KYC documents, optionally filtered by status.
   */
  static async listUsers(status: string | undefined, page: Pagination) {
    const where: { verificationStatus?: string } = {};
    if (status) where.verificationStatus = status;

    const rows = await prisma.user.findMany({
      where,
      select: USER_LIST_SELECT,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...pageArgs(page),
    });

    return toPage(rows, page);
  }

  /** Approve a user — flips verificationStatus to VERIFIED */
  static async approveUser(userId: string) {
    const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, verificationStatus: true } });
    if (!exists) throw notFound("User not found");
    const user = await prisma.user.update({
      where: { id: userId },
      data: { verificationStatus: "VERIFIED" },
      select: USER_LIST_SELECT,
    });
    if (exists.verificationStatus !== "VERIFIED") void notifyKycEvent(userId, { kind: "APPROVED" });
    return user;
  }

  /** Reject a user with an optional reason — also kills every live session they hold */
  static async rejectUser(userId: string, notes?: string) {
    const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, verificationStatus: true } });
    if (!exists) throw notFound("User not found");
    const user = await prisma.user.update({
      where: { id: userId },
      data: { verificationStatus: "REJECTED", verificationNotes: notes ?? "Verification rejected by admin." },
      select: USER_LIST_SELECT,
    });
    await AuthService.revokeAllSessions(userId);
    disconnectUser(userId); // drop live sockets now rather than at token expiry
    if (exists.verificationStatus !== "REJECTED") void notifyKycEvent(userId, { kind: "REJECTED", reason: notes });
    return user;
  }

  /** Dashboard summary counts */
  static async getSummary() {
    const [pending, verified, rejected, totalResources, totalBookings, openDisputes] = await Promise.all([
      prisma.user.count({ where: { verificationStatus: "PENDING" } }),
      prisma.user.count({ where: { verificationStatus: "VERIFIED" } }),
      prisma.user.count({ where: { verificationStatus: "REJECTED" } }),
      prisma.resource.count({ where: { deletedAt: null } }),
      prisma.bookingRequest.count(),
      prisma.bookingRequest.count({ where: { bookingStatus: "DISPUTED" } }),
    ]);
    return { pending, verified, rejected, totalResources, totalBookings, openDisputes };
  }

  /** Disputed bookings awaiting a Customer Care decision */
  static async listDisputes(page: Pagination) {
    const rows = await prisma.bookingRequest.findMany({
      where: { bookingStatus: "DISPUTED" },
      include: {
        resource: { select: { id: true, name: true, resourceType: true } },
        seeker: { select: { id: true, name: true } },
        provider: { select: { id: true, name: true } },
        damageClaims: { orderBy: { createdAt: "desc" } },
        disputes: { orderBy: { createdAt: "desc" } },
        evidence: { orderBy: { createdAt: "asc" } },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      ...pageArgs(page),
    });
    return toPage(rows, page);
  }
}
