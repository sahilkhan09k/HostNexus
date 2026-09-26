import { prisma } from "../config/database.js";
import { BusinessService } from "./business.service.js";
import { VectorStoreService } from "./rag/vector-store.js";
import { getCommittedQuantities } from "./capacity.js";
import { resolveOwnedMedia } from "./evidence.js";
import { conflict, forbidden, notFound } from "../utils/http-error.js";
import { pageArgs, toPage, type Pagination } from "../utils/pagination.js";
import type { CreateResourceInput, UpdateResourceInput, ResourceQuery } from "../schemas/resource.schema.js";

/** Bookings in these states are finished; anything else blocks deleting the listing */
const TERMINAL_BOOKING_STATUSES = ["CANCELLED", "COMPLETED"];

/** Keep the AI concierge index in sync: only active, non-deleted listings are searchable */
function syncVectorIndex(resource: { id: string; isActive: boolean; deletedAt?: Date | null }) {
  // Fire-and-forget: indexing problems must never fail the request that triggered them
  void (async () => {
    if (resource.isActive && !resource.deletedAt) {
      const full = await prisma.resource.findUnique({
        where: { id: resource.id },
        include: {
          business: {
            select: {
              id: true, name: true, city: true, state: true, businessType: true,
              reviewsReceived: { select: { rating: true, reviewerRole: true } },
            },
          },
        },
      });
      if (full) await VectorStoreService.indexSingleResource(full);
    } else {
      await VectorStoreService.deleteResource(resource.id);
    }
  })().catch(() => {});
}

export class ResourceService {
  /**
   * Create a new resource for a business
   */
  static async createResource(userId: string, input: CreateResourceInput) {
    // Get user's business
    const business = await BusinessService.getBusinessByUserId(userId);

    if (!business) {
      throw forbidden("You must have a business to create resources", "NO_BUSINESS");
    }

    // Photos must be files this user uploaded (stored as canonical /uploads/<id> paths)
    const photos = await resolveOwnedMedia(userId, input.photos || [], { field: "photo" });
    const damagePhotos = await resolveOwnedMedia(userId, input.damagePhotos || [], { field: "damage photo" });

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
        photos: photos.map((p) => p.fileUrl),
        hasPreExistingDamage: input.hasPreExistingDamage || false,
        damageDescription: input.damageDescription || null,
        damagePhotos: damagePhotos.map((p) => p.fileUrl),
        transportAvailable: input.transportAvailable ?? false,
        transportRatePerKmPaise: input.transportAvailable ? input.transportRatePerKmPaise ?? 0 : 0,
      },
    });

    syncVectorIndex(resource);

    return resource;
  }

  /**
   * Get all resources with optional filters
   */
  static async getResources(userId: string, query: ResourceQuery) {
    // Get user's business
    const business = await BusinessService.getBusinessByUserId(userId);

    if (!business) {
      throw forbidden("You must have a business to view resources", "NO_BUSINESS");
    }

    // Build where clause
    const where: any = {
      businessId: business.id,
      deletedAt: null,
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
      take: 500,
    });

    return resources;
  }

  /**
   * Get a resource by ID — public read, no ownership check.
   * Used by marketplace detail pages and the booking flow.
   */
  static async getResourceById(resourceId: string) {
    const resource = await prisma.resource.findFirst({
      where: { id: resourceId, deletedAt: null },
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
    if (!resource || resource.deletedAt) return false;
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

    if (!resource || resource.deletedAt) {
      throw notFound("Resource not found");
    }

    // Verify user owns the business that owns this resource
    const isOwner = await BusinessService.verifyOwnership(resource.businessId, userId);

    if (!isOwner) {
      throw notFound("Resource not found");
    }

    // New photos must be the owner's own uploads; photos already on the listing are kept as-is
    const data: UpdateResourceInput = { ...input };
    if (input.photos) {
      data.photos = (await resolveOwnedMedia(userId, input.photos, { keep: resource.photos, field: "photo" })).map((p) => p.fileUrl);
    }
    if (input.damagePhotos) {
      data.damagePhotos = (
        await resolveOwnedMedia(userId, input.damagePhotos, { keep: resource.damagePhotos, field: "damage photo" })
      ).map((p) => p.fileUrl);
    }

    // Update resource
    const updatedResource = await prisma.resource.update({
      where: { id: resourceId },
      data,
    });

    syncVectorIndex(updatedResource);

    return updatedResource;
  }

  /**
   * Delete a resource (soft delete)
   * Enforces ownership and refuses while any booking on it is still in progress,
   * so booking history, the escrow ledger and dispute evidence are never destroyed.
   */
  static async deleteResource(resourceId: string, userId: string): Promise<void> {
    // Get resource
    const resource = await prisma.resource.findUnique({
      where: { id: resourceId },
    });

    if (!resource || resource.deletedAt) {
      throw notFound("Resource not found");
    }

    // Verify user owns the business that owns this resource
    const isOwner = await BusinessService.verifyOwnership(resource.businessId, userId);

    if (!isOwner) {
      throw notFound("Resource not found");
    }

    const openBookings = await prisma.bookingRequest.count({
      where: { resourceId, bookingStatus: { notIn: TERMINAL_BOOKING_STATUSES } },
    });
    if (openBookings > 0) {
      throw conflict(
        "This resource has bookings in progress. Complete or cancel them before deleting it.",
        "HAS_OPEN_BOOKINGS"
      );
    }

    // Soft delete: hidden everywhere, but past bookings keep their resource
    await prisma.resource.update({
      where: { id: resourceId },
      data: { isActive: false, deletedAt: new Date() },
    });

    // Remove from vector database index
    VectorStoreService.deleteResource(resourceId).catch(() => {});
  }

  /**
   * Get resources from all businesses (Marketplace view), one page at a time.
   * Excludes the caller's own business so users can't book their own listings.
   */
  static async getAllResources(
    query: ResourceQuery & { startDate?: string; endDate?: string },
    excludeBusinessId?: string,           // caller's own businessId — excluded from results
    page: Pagination = { limit: 50 }
  ) {
    const where: any = { isActive: true, deletedAt: null };
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

    const rows = await prisma.resource.findMany({
      where,
      include: {
        availabilityWindows: {
          orderBy: { fromDate: "asc" },
          select: { id: true, fromDate: true, toDate: true, note: true },
        },
        business: {
          select: { id: true, name: true, city: true, state: true, businessType: true },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...pageArgs(page),
    });
    const { items, nextCursor } = toPage(rows, page);
    let resources = items;

    // Quantity-aware: hide a listing only when accepted/active bookings use up every unit.
    // Pending requests don't hold stock (same rule as booking create/accept).
    let committed = new Map<string, number>();
    if (dateRange) {
      committed = await getCommittedQuantities(resources.map((r) => r.id), dateRange.start, dateRange.end);
      resources = resources.filter((r) => r.quantity - (committed.get(r.id) ?? 0) > 0);
    }

    // Owner ratings in one aggregate query instead of loading every review
    const businessIds = [...new Set(resources.map((r) => r.businessId))];
    const ratingRows = businessIds.length
      ? await prisma.review.groupBy({
          by: ["subjectId"],
          where: { subjectId: { in: businessIds }, reviewerRole: "RENTER" },
          _avg: { rating: true },
          _count: { _all: true },
        })
      : [];
    const ratings = new Map(ratingRows.map((r) => [r.subjectId, r]));

    const cards = resources.map((r) => {
      const rating = ratings.get(r.businessId);
      const ownerRating = rating?._avg.rating != null ? +rating._avg.rating.toFixed(1) : null;
      return {
        ...r,
        business: {
          id: r.business.id, name: r.business.name,
          city: r.business.city, state: r.business.state,
          businessType: r.business.businessType,
          ownerRating, reviewCount: rating?._count._all ?? 0,
        },
        ...(dateRange ? { availableQuantity: r.quantity - (committed.get(r.id) ?? 0) } : {}),
      };
    });

    return { items: cards, nextCursor };
  }
}
