import { prisma } from "../config/database.js";
import { BusinessService } from "./business.service.js";
import { VectorStoreService } from "./rag/vector-store.js";
import { getCommittedQuantities } from "./capacity.js";
import type { CreateResourceInput, UpdateResourceInput, ResourceQuery } from "../schemas/resource.schema.js";

export class ResourceService {
  /**
   * Create a new resource for a business
   */
  static async createResource(userId: string, input: CreateResourceInput) {
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
        rentAmountPaise: input.rentAmountPaise,
        securityDepositPaise: input.securityDepositPaise,
        photos: input.photos || [],
        hasPreExistingDamage: input.hasPreExistingDamage || false,
        damageDescription: input.damageDescription || null,
        damagePhotos: input.damagePhotos || [],
      },
    });

    // Keep vector database index in sync
    VectorStoreService.indexSingleResource(resource).catch(() => {});

    return resource;
  }

  /**
   * Get all resources with optional filters
   */
  static async getResources(userId: string, query: ResourceQuery) {
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
   * Get a resource by ID — public read, no ownership check.
   * Used by marketplace detail pages and the booking flow.
   */
  static async getResourceById(resourceId: string) {
    const resource = await prisma.resource.findUnique({
      where: { id: resourceId },
      include: {
        business: {
          select: { id: true, name: true, ownerId: true, city: true, state: true, businessType: true },
        },
        availabilityWindows: {
          orderBy: { fromDate: "asc" },
          select: { id: true, fromDate: true, toDate: true, note: true },
        },
      },
    });
    return resource;
  }

  /**
   * Verify if a user OWNS a specific resource (used only by edit/delete).
   */
  static async verifyResourceAccess(resourceId: string, userId: string): Promise<boolean> {
    const resource = await prisma.resource.findUnique({ where: { id: resourceId } });
    if (!resource) return false;
    return await BusinessService.verifyOwnership(resource.businessId, userId);
  }

  /**
   * Update a resource
   * Enforces ownership - only the business owner can update their resources
   */
  static async updateResource(
    resourceId: string,
    userId: string,
    input: UpdateResourceInput
  ) {
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

    // Keep vector database index in sync
    VectorStoreService.indexSingleResource(updatedResource).catch(() => {});

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

    // Remove from vector database index
    VectorStoreService.deleteResource(resourceId).catch(() => {});
  }

  /**
   * Get all resources from all businesses (Marketplace view).
   * Excludes the caller's own business so users can't book their own listings.
   */
  static async getAllResources(
    query: ResourceQuery & { startDate?: string; endDate?: string },
    excludeBusinessId?: string            // caller's own businessId — excluded from results
  ) {
    const where: any = { isActive: true };
    if (query.resourceType) where.resourceType = query.resourceType;
    if (query.status)       where.status       = query.status;

    // Never show the caller's own listings in the marketplace
    if (excludeBusinessId) {
      where.businessId = { not: excludeBusinessId };
    }

    // Date-availability server-side filter
    let dateRange: { start: Date; end: Date } | null = null;
    if (query.startDate && query.endDate) {
      const start = new Date(query.startDate);
      const end   = new Date(query.endDate);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        where.availabilityWindows = {
          some: { fromDate: { lte: start }, toDate: { gte: end } },
        };
        dateRange = { start, end };
      }
    }

    let resources = await prisma.resource.findMany({
      where,
      include: {
        availabilityWindows: {
          orderBy: { fromDate: "asc" },
          select: { id: true, fromDate: true, toDate: true, note: true },
        },
        business: {
          select: {
            id: true, name: true, city: true, state: true, businessType: true,
            reviewsReceived: { select: { rating: true, reviewerRole: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Quantity-aware: hide a listing only when accepted/active bookings use up every unit.
    // Pending requests don't hold stock (same rule as booking create/accept).
    let committed = new Map<string, number>();
    if (dateRange) {
      committed = await getCommittedQuantities(resources.map((r) => r.id), dateRange.start, dateRange.end);
      resources = resources.filter((r) => r.quantity - (committed.get(r.id) ?? 0) > 0);
    }

    return resources.map((r) => {
      const reviews  = r.business.reviewsReceived ?? [];
      const asOwner  = reviews.filter(rv => rv.reviewerRole === "RENTER");
      const ownerRating = asOwner.length
        ? +(asOwner.reduce((s, rv) => s + rv.rating, 0) / asOwner.length).toFixed(1)
        : null;
      return {
        ...r,
        business: {
          id: r.business.id, name: r.business.name,
          city: r.business.city, state: r.business.state,
          businessType: r.business.businessType,
          ownerRating, reviewCount: asOwner.length,
        },
        ...(dateRange ? { availableQuantity: r.quantity - (committed.get(r.id) ?? 0) } : {}),
      };
    });
  }
}
