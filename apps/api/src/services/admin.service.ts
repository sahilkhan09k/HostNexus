import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../config/database.js";
import { env } from "../config/env.js";
import { TERMINAL_BOOKING_STATUSES } from "./booking-rules.js";
import { badRequest, conflict, notFound } from "../utils/http-error.js";

const ADMIN_TOKEN_EXPIRY = "8h";

export class AdminService {
  static generateAdminToken(adminId: string): string {
    return jwt.sign({ sub: adminId, type: "admin" }, env.JWT_SECRET, {
      expiresIn: ADMIN_TOKEN_EXPIRY,
    });
  }

  static verifyAdminToken(token: string): { sub: string } {
    const payload = jwt.verify(token, env.JWT_SECRET) as { sub: string; type?: string };
    if (payload.type !== "admin") throw new Error("Not an admin token");
    return { sub: payload.sub };
  }

  static async login(email: string, password: string) {
    const admin = await prisma.admin.findUnique({ where: { email } });
    if (!admin) throw new Error("Invalid admin credentials");

    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) throw new Error("Invalid admin credentials");

    const token = this.generateAdminToken(admin.id);
    return {
      token,
      admin: { id: admin.id, email: admin.email, name: admin.name },
    };
  }

  /**
   * List all users with their business and KYC documents, optionally filtered by status.
   */
  static async listUsers(status?: string) {
    const where: any = {};
    if (status) where.verificationStatus = status;

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        ownerName: true,
        phone: true,
        verificationStatus: true,
        verificationNotes: true,
        gstCertificateUrl: true,
        aadhaarUrl: true,
        gstin: true,
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
      },
      orderBy: { createdAt: "desc" },
    });

    // Open bookings per user, so the panel can warn before suspending someone mid-rental.
    const businessIds = users.flatMap((u) => u.businesses.map((b) => b.id));
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

    return users.map((u) => ({
      ...u,
      openBookings: u.businesses.reduce((n, b) => n + (openCounts.get(b.id) ?? 0), 0),
    }));
  }

  /**
   * Suspend a verified user: they are signed out on their next request and their
   * listings disappear from the marketplace. Open bookings are left for admin
   * to handle through the dispute console.
   */
  static async suspendUser(userId: string, reason: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw notFound("User not found");
    if (user.verificationStatus !== "VERIFIED") throw conflict("Only verified users can be suspended");
    return prisma.user.update({
      where: { id: userId },
      data: { verificationStatus: "SUSPENDED", verificationNotes: reason },
    });
  }

  /** Lift a suspension. */
  static async reinstateUser(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw notFound("User not found");
    if (user.verificationStatus !== "SUSPENDED") throw conflict("Only suspended users can be reinstated");
    return prisma.user.update({
      where: { id: userId },
      data: { verificationStatus: "VERIFIED", verificationNotes: null },
    });
  }

  // ── Dispute console ───────────────────────────────────────

  /** Disputed bookings with everything admin needs to decide them. */
  static async listDisputes(status: "OPEN" | "ESCALATED" | "RESOLVED" | "ALL" = "ALL") {
    const statusFilter = status === "ALL" ? {} : { status };
    if (!["OPEN", "ESCALATED", "RESOLVED", "ALL"].includes(status)) throw badRequest("Invalid dispute status filter");

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
    const user = await prisma.user.update({
      where: { id: userId },
      data: { verificationStatus: "VERIFIED", verificationNotes: null },
    });
    return user;
  }

  /** Reject a user with an optional reason */
  static async rejectUser(userId: string, notes?: string) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { verificationStatus: "REJECTED", verificationNotes: notes ?? "Verification rejected by admin." },
    });
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
