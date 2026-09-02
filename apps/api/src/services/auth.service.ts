import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../config/database.js";
import { env } from "../config/env.js";
import type { RegisterInput, LoginInput } from "../schemas/auth.schema.js";

const SALT_ROUNDS = 10;
const JWT_EXPIRATION = "7d";

interface SafeUser {
  id: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

interface AuthResponse {
  user: SafeUser;
  token: string;
}

export class AuthService {
  /**
   * Remove password hash from user object
   */
  private static sanitizeUser(user: { id: string; email: string; passwordHash: string; createdAt: Date; updatedAt: Date }): SafeUser {
    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }

  /**
   * Generate JWT token
   */
  private static generateToken(userId: string): string {
    return jwt.sign({ sub: userId }, env.JWT_SECRET, {
      expiresIn: JWT_EXPIRATION,
    });
  }

  /**
   * Verify JWT token
   */
  static verifyToken(token: string): { sub: string } {
    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as { sub: string };
      return payload;
    } catch (error) {
      throw new Error("Invalid or expired token");
    }
  }

  /**
   * Register a new user with business
   */
  static async register(input: RegisterInput): Promise<AuthResponse> {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existingUser) {
      throw new Error("User with this email already exists");
    }

    // Hash password
    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

    // Create user AND business atomically in a transaction
    const user = await prisma.$transaction(async (tx) => {
      // Create user
      const newUser = await tx.user.create({
        data: {
          email: input.email,
          passwordHash,
        },
      });

      // Create business for the user with provided business name
      await tx.business.create({
        data: {
          name: input.businessName,
          ownerId: newUser.id,
        },
      });

      return newUser;
    });

    // Generate token
    const token = this.generateToken(user.id);

    return {
      user: this.sanitizeUser(user),
      token,
    };
  }

  /**
   * Login user
   */
  static async login(input: LoginInput): Promise<AuthResponse> {
    // Find user
    const user = await prisma.user.findUnique({
      where: { email: input.email },
    });

    // Use consistent error message for security
    if (!user) {
      throw new Error("Invalid email or password");
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new Error("Invalid email or password");
    }

    // Generate token
    const token = this.generateToken(user.id);

    return {
      user: this.sanitizeUser(user),
      token,
    };
  }

  /**
   * Get user by ID (for authenticated routes)
   */
  static async getUserById(userId: string): Promise<SafeUser | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return null;
    }

    return this.sanitizeUser(user);
  }
}
