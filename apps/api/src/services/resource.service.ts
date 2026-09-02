import { prisma } from "../config/database.js";
import { BusinessService } from "./business.service.js";
import type { CreateResourceInput, UpdateResourceInput, ResourceQuery } from "../schemas/resource.schema.js";

interface SafeResource {
  id: string;
  businessId: string;
  name: string;
  description: string | null;
  resourceType: string;
  quantity: number;
  unit: string | null;
  status: string;
  location: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class ResourceService {
  /**
   * Create a new resource for a business
   */
  static async createResource(userId: string, input: CreateResourceInput): Promise<SafeResource> {
    // Get user's business
    const business = await BusinessService.getBusinessByUserId(userId);

    if (!business) {
      throw new Error("You must have a business to create resources");
    }

    // Create resource
    const resource = await prisma.resource.create({
      data: {
        businessId: business.id,
        name: input.name,
        description: input.description || null,
        resourceType: input.resourceType,
        quantity: input.quantity,
        unit: input.unit || null,
        status: input.status,
        location: input.location || null,
        isActive: input.isActive,
      },
    });

    return resource;
  }

  /**
   * Get all resources with optional filters
   */
  static async getResources(userId: string, query: ResourceQuery): Promise<SafeResource[]> {
    // Get user's business
    const business = await BusinessService.getBusinessByUserId(userId);

    if (!business) {
      throw new Error("You must have a business to view resources");
    }

    // Build where clause
    const where: any = {
      businessId: business.id,
    };

    if (query.resourceType) {
      where.resourceType = query.resourceType;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive === "true";
    }

    // Get resources
    const resources = await prisma.resource.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
    });

    return resources;
  }

  /**
   * Get a resource by ID
   */
  static async getResourceById(resourceId: string): Promise<SafeResource | null> {
    const resource = await prisma.resource.findUnique({
      where: { id: resourceId },
    });

    return resource;
  }

  /**
   * Update a resource
   * Enforces ownership - only the business owner can update their resources
   */
  static async updateResource(
    resourceId: string,
    userId: string,
    input: UpdateResourceInput
  ): Promise<SafeResource> {
    // Get resource
    const resource = await prisma.resource.findUnique({
      where: { id: resourceId },
    });

    if (!resource) {
      throw new Error("Resource not found");
    }

    // Verify user owns the business that owns this resource
    const isOwner = await BusinessService.verifyOwnership(resource.businessId, userId);

    if (!isOwner) {
      throw new Error("Unauthorized: You can only update resources belonging to your business");
    }

    // Update resource
    const updatedResource = await prisma.resource.update({
      where: { id: resourceId },
      data: input,
    });

    return updatedResource;
  }

  /**
   * Delete a resource
   * Enforces ownership - only the business owner can delete their resources
   */
  static async deleteResource(resourceId: string, userId: string): Promise<void> {
    // Get resource
    const resource = await prisma.resource.findUnique({
      where: { id: resourceId },
    });

    if (!resource) {
      throw new Error("Resource not found");
    }

    // Verify user owns the business that owns this resource
    const isOwner = await BusinessService.verifyOwnership(resource.businessId, userId);

    if (!isOwner) {
      throw new Error("Unauthorized: You can only delete resources belonging to your business");
    }

    // Delete resource
    await prisma.resource.delete({
      where: { id: resourceId },
    });
  }

  /**
   * Verify if a user can access a specific resource
   */
  static async verifyResourceAccess(resourceId: string, userId: string): Promise<boolean> {
    const resource = await prisma.resource.findUnique({
      where: { id: resourceId },
    });

    if (!resource) {
      return false;
    }

    return await BusinessService.verifyOwnership(resource.businessId, userId);
  }

  /**
   * Get all resources from all businesses (Marketplace view)
   */
  static async getAllResources(query: ResourceQuery): Promise<(SafeResource & { business?: { id: string; name: string } })[]> {
    // Build where clause
    const where: any = {
      isActive: true, // Only show active resources in marketplace
    };

    if (query.resourceType) {
      where.resourceType = query.resourceType;
    }

    if (query.status) {
      where.status = query.status;
    }

    // Get all resources from all businesses
    const resources = await prisma.resource.findMany({
      where,
      include: {
        business: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return resources;
  }
}
