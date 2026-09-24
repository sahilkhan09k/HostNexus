import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../config/database.js";
import { env } from "../config/env.js";
import type { RegisterInput, LoginInput } from "../schemas/auth.schema.js";

const SALT_ROUNDS = 10;
const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";

interface SafeUser {
  id: string;
  email: string;
  ownerName: string | null;
  phone: string | null;
  verificationStatus: string;
  createdAt: Date;
  updatedAt: Date;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface AuthResponse {
  user: SafeUser;
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  private static sanitizeUser(user: {
    id: string;
    email: string;
    ownerName: string | null;
    phone: string | null;
    passwordHash: string;
    verificationStatus: string;
    createdAt: Date;
    updatedAt: Date;
  }): SafeUser {
    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }

  private static generateAccessToken(userId: string): string {
    return jwt.sign({ sub: userId, type: "access" }, env.JWT_SECRET, {
      expiresIn: ACCESS_TOKEN_EXPIRY,
    });
  }

  private static generateRefreshToken(userId: string): string {
    return jwt.sign({ sub: userId, type: "refresh" }, env.REFRESH_TOKEN_SECRET, {
      expiresIn: REFRESH_TOKEN_EXPIRY,
    });
  }

  private static generateTokenPair(userId: string): TokenPair {
    return {
      accessToken: this.generateAccessToken(userId),
      refreshToken: this.generateRefreshToken(userId),
    };
  }

  static verifyToken(token: string): { sub: string } {
    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as { sub: string; type?: string };
      if (payload.type && payload.type !== "access") {
        throw new Error("Invalid token type");
      }
      return { sub: payload.sub };
    } catch {
      throw new Error("Invalid or expired token");
    }
  }

  static refreshTokens(refreshToken: string): { userId: string } & TokenPair {
    try {
      const payload = jwt.verify(refreshToken, env.REFRESH_TOKEN_SECRET) as {
        sub: string;
        type?: string;
      };
      if (payload.type && payload.type !== "refresh") {
        throw new Error("Invalid token type");
      }
      const tokens = this.generateTokenPair(payload.sub);
      return { userId: payload.sub, ...tokens };
    } catch {
      throw new Error("Invalid or expired refresh token");
    }
  }

  /**
   * Register: create user (PENDING) + business in one transaction.
   * Does NOT issue tokens — user must wait for admin verification.
   */
  static async register(input: RegisterInput): Promise<{ user: SafeUser }> {
    const existingUser = await prisma.user.findUnique({ where: { email: input.email } });
    if (existingUser) {
      throw new Error("An account with this email already exists");
    }

    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: input.email,
          passwordHash,
          ownerName: input.ownerName,
          phone: input.phone,
          verificationStatus: "PENDING",
          gstCertificateUrl: input.gstCertificateUrl,
          aadhaarUrl: input.aadhaarUrl,
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

      return newUser;
    });

    return { user: this.sanitizeUser(user) };
  }

  /**
   * Login: blocks users who are PENDING or REJECTED.
   */
  static async login(input: LoginInput): Promise<AuthResponse> {
    const user = await prisma.user.findUnique({ where: { email: input.email } });

    if (!user) {
      throw new Error("Invalid email or password");
    }

    const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new Error("Invalid email or password");
    }

    if (user.verificationStatus === "PENDING") {
      const err = new Error("Your account is pending verification. Our team will review your documents and notify you within 24–48 hours.");
      (err as any).code = "ACCOUNT_PENDING";
      (err as any).statusCode = 403;
      throw err;
    }

    if (user.verificationStatus === "REJECTED") {
      const err = new Error("Your account verification was rejected. Please contact support.");
      (err as any).code = "ACCOUNT_REJECTED";
      (err as any).statusCode = 403;
      throw err;
    }

    const tokens = this.generateTokenPair(user.id);
    return { user: this.sanitizeUser(user), ...tokens };
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
