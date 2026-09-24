import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../config/database.js";
import { env } from "../config/env.js";

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

    return users;
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
    const [pending, verified, rejected, totalResources, totalBookings] = await Promise.all([
      prisma.user.count({ where: { verificationStatus: "PENDING" } }),
      prisma.user.count({ where: { verificationStatus: "VERIFIED" } }),
      prisma.user.count({ where: { verificationStatus: "REJECTED" } }),
      prisma.resource.count(),
      prisma.bookingRequest.count(),
    ]);
    return { pending, verified, rejected, totalResources, totalBookings };
  }
}
