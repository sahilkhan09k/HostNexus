import { prisma } from "../config/database.js";
import type { CreateBusinessInput, UpdateBusinessInput } from "../schemas/business.schema.js";

export interface SafeBusiness {
  id: string;
  name: string;
  ownerId: string;
  businessType: string | null;
  addressLine: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class BusinessService {
  static async createBusiness(userId: string, input: CreateBusinessInput): Promise<SafeBusiness> {
    const existing = await prisma.business.findFirst({ where: { ownerId: userId } });
    if (existing) throw new Error("User already has a business");
    return prisma.business.create({
      data: { name: input.name, ownerId: userId },
    });
  }

  static async getBusinessById(businessId: string): Promise<SafeBusiness | null> {
    return prisma.business.findUnique({ where: { id: businessId } });
  }

  static async getBusinessByUserId(userId: string): Promise<SafeBusiness | null> {
    return prisma.business.findFirst({ where: { ownerId: userId } });
  }

  static async updateBusiness(
    businessId: string,
    userId: string,
    input: UpdateBusinessInput
  ): Promise<SafeBusiness> {
    const business = await prisma.business.findUnique({ where: { id: businessId } });
    if (!business) throw new Error("Business not found");
    if (business.ownerId !== userId) throw new Error("Unauthorized: You can only update your own business");
    return prisma.business.update({ where: { id: businessId }, data: input });
  }

  static async verifyOwnership(businessId: string, userId: string): Promise<boolean> {
    const business = await prisma.business.findUnique({ where: { id: businessId } });
    return business?.ownerId === userId;
  }
}
