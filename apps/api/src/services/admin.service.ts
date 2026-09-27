import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { prisma } from "../config/database.js";
import { env } from "../config/env.js";
import { AuthService, JWT_ISSUER, SALT_ROUNDS } from "./auth.service.js";
import { TERMINAL_BOOKING_STATUSES } from "./booking-rules.js";
import { badRequest, conflict, notFound, unauthorized } from "../utils/http-error.js";
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

    // Open bookings per user, so the panel can warn before suspending someone mid-rental.
    const businessIds = rows.flatMap((u) => u.businesses.map((b) => b.id));
    const openCounts = new Map<string, number>();
    if (businessIds.length) {
      const open = await prisma.bookingRequest.findMany({
        where: {
          bookingStatus: { notIn: TERMINAL_BOOKING_STATUSES },
          OR: [{ seekerId: { in: businessIds } }, { providerId: { in: businessIds } }],
        },
        select: { seekerId: true, providerId: true },
      });
      for (const b of open) {
        for (const id of new Set([b.seekerId, b.providerId])) openCounts.set(id, (openCounts.get(id) ?? 0) + 1);
      }
    }

    return toPage(
      rows.map((u) => ({ ...u, openBookings: u.businesses.reduce((n, b) => n + (openCounts.get(b.id) ?? 0), 0) })),
      page
    );
  }

  /**
   * Suspend a verified user: every session is revoked at once and their
   * listings disappear from the marketplace. Open bookings are left for admin
   * to handle through the dispute console.
   */
  static async suspendUser(userId: string, reason: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw notFound("User not found");
    if (user.verificationStatus !== "VERIFIED") throw conflict("Only verified users can be suspended");
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { verificationStatus: "SUSPENDED", verificationNotes: reason },
      select: USER_LIST_SELECT,
    });
    await AuthService.revokeAllSessions(userId);
    disconnectUser(userId);
    return updated;
  }

  /** Lift a suspension. */
  static async reinstateUser(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw notFound("User not found");
    if (user.verificationStatus !== "SUSPENDED") throw conflict("Only suspended users can be reinstated");
    return prisma.user.update({
      where: { id: userId },
      data: { verificationStatus: "VERIFIED", verificationNotes: null },
      select: USER_LIST_SELECT,
    });
  }

  // ── Dispute console ───────────────────────────────────────

  /** Disputes with everything admin needs to decide them. */
  static async listDisputes(status: "OPEN" | "ESCALATED" | "RESOLVED" | "ALL" = "ALL") {
    if (!["OPEN", "ESCALATED", "RESOLVED", "ALL"].includes(status)) throw badRequest("Invalid dispute status filter");
    const statusFilter = status === "ALL" ? {} : { status };

    const disputes = await prisma.dispute.findMany({
      where: statusFilter,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        damageClaim: true,
        booking: {
          include: {
            resource: { select: { id: true, name: true, resourceType: true, photos: true } },
            seeker:   { select: { id: true, name: true, city: true } },
            provider: { select: { id: true, name: true, city: true } },
            inspections: { orderBy: { createdAt: "asc" } },
            evidence:    { orderBy: { createdAt: "asc" } },
            timelineEvents: { orderBy: { createdAt: "asc" } },
            paymentTransactions: { orderBy: { createdAt: "asc" } },
          },
        },
      },
    });
    return disputes.map(({ booking: { handoverCode: _secret, ...booking }, ...d }) => ({ ...d, booking }));
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
    const [pending, verified, rejected, suspended, totalResources, totalBookings, openDisputes, pendingPayouts, failedRefunds] = await Promise.all([
      prisma.user.count({ where: { verificationStatus: "PENDING" } }),
      prisma.user.count({ where: { verificationStatus: "VERIFIED" } }),
      prisma.user.count({ where: { verificationStatus: "REJECTED" } }),
      prisma.user.count({ where: { verificationStatus: "SUSPENDED" } }),
      prisma.resource.count({ where: { deletedAt: null } }),
      prisma.bookingRequest.count(),
      prisma.dispute.count({ where: { status: { in: ["OPEN", "ESCALATED"] } } }),
      prisma.paymentTransaction.count({ where: { direction: "TO_OWNER", status: "PENDING" } }),
      prisma.paymentTransaction.count({ where: { direction: "TO_RENTER", status: "FAILED" } }),
    ]);
    return { pending, verified, rejected, suspended, totalResources, totalBookings, openDisputes, pendingPayouts, failedRefunds };
  }
}
