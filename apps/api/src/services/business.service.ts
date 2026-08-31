import { prisma } from "../config/database.js";
import type { CreateBusinessInput, UpdateBusinessInput } from "../schemas/business.schema.js";

interface SafeBusiness {
  id: string;
  name: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export class BusinessService {
  /**
   * Create a new business for a user
   */
  static async createBusiness(userId: string, input: CreateBusinessInput): Promise<SafeBusiness> {
    // Check if user already has a business
    const existingBusiness = await prisma.business.findFirst({
      where: { ownerId: userId },
    });

    if (existingBusiness) {
      throw new Error("User already has a business");
    }

    // Create business
    const business = await prisma.business.create({
      data: {
        name: input.name,
        ownerId: userId,
      },
    });

    return business;
  }

  /**
   * Get a business by ID
   */
  static async getBusinessById(businessId: string): Promise<SafeBusiness | null> {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
    });

    return business;
  }

  /**
   * Get business owned by a user
   */
  static async getBusinessByUserId(userId: string): Promise<SafeBusiness | null> {
    const business = await prisma.business.findFirst({
      where: { ownerId: userId },
    });

    return business;
  }

  /**
   * Update a business
   * Enforces ownership - only the owner can update their business
   */
  static async updateBusiness(
    businessId: string,
    userId: string,
    input: UpdateBusinessInput
  ): Promise<SafeBusiness> {
    // Verify business exists and user is the owner
    const business = await prisma.business.findUnique({
      where: { id: businessId },
    });

    if (!business) {
      throw new Error("Business not found");
    }

    if (business.ownerId !== userId) {
      throw new Error("Unauthorized: You can only update your own business");
    }

    // Update business
    const updatedBusiness = await prisma.business.update({
      where: { id: businessId },
      data: input,
    });

    return updatedBusiness;
  }

  /**
   * Verify if a user owns a specific business
   */
  static async verifyOwnership(businessId: string, userId: string): Promise<boolean> {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
    });

    return business?.ownerId === userId;
  }
}
