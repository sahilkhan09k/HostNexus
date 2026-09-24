import type { Request, Response, NextFunction } from "express";
import { ResourceService } from "../services/resource.service.js";
import { createResourceSchema, updateResourceSchema, resourceQuerySchema } from "../schemas/resource.schema.js";

export class ResourceController {
  /**
   * Create a new resource
   * POST /api/resources
   */
  static async createResource(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "User not authenticated",
          },
        });
        return;
      }

      // Validate input
      const input = createResourceSchema.parse(req.body);

      // Create resource
      const resource = await ResourceService.createResource(userId, input);

      res.status(201).json({
        success: true,
        data: { resource },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all resources for the authenticated user's business
   * GET /api/resources
   */
  static async getResources(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "User not authenticated",
          },
        });
        return;
      }

      // Validate query parameters
      const query = resourceQuerySchema.parse(req.query);

      // Get resources
      const resources = await ResourceService.getResources(userId, query);

      res.status(200).json({
        success: true,
        data: { resources, count: resources.length },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get a resource by ID — public read (any authenticated user can view any resource)
   * GET /api/resources/:id
   */
  static async getResourceById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId;
      const { id } = req.params;

      if (!userId) {
        res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "User not authenticated" } });
        return;
      }

      if (!id || typeof id !== "string") {
        res.status(400).json({ success: false, error: { code: "INVALID_RESOURCE_ID", message: "Valid resource ID is required" } });
        return;
      }

      const resource = await ResourceService.getResourceById(id);

      if (!resource) {
        res.status(404).json({ success: false, error: { code: "RESOURCE_NOT_FOUND", message: "Resource not found" } });
        return;
      }

      // No ownership check — any verified user can view any resource
      res.status(200).json({ success: true, data: { resource } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update a resource
   * PATCH /api/resources/:id
   */
  static async updateResource(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId;
      const { id } = req.params;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "User not authenticated",
          },
        });
        return;
      }

      if (!id || typeof id !== "string") {
        res.status(400).json({
          success: false,
          error: {
            code: "INVALID_RESOURCE_ID",
            message: "Valid resource ID is required",
          },
        });
        return;
      }

      // Validate input
      const input = updateResourceSchema.parse(req.body);

      // Update resource (service handles ownership verification)
      const resource = await ResourceService.updateResource(id, userId, input);

      res.status(200).json({
        success: true,
        data: { resource },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete a resource
   * DELETE /api/resources/:id
   */
  static async deleteResource(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId;
      const { id } = req.params;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "User not authenticated",
          },
        });
        return;
      }

      if (!id || typeof id !== "string") {
        res.status(400).json({
          success: false,
          error: {
            code: "INVALID_RESOURCE_ID",
            message: "Valid resource ID is required",
          },
        });
        return;
      }

      // Delete resource (service handles ownership verification)
      await ResourceService.deleteResource(id, userId);

      res.status(200).json({
        success: true,
        data: { message: "Resource deleted successfully" },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all resources from all businesses (Marketplace) — excludes caller's own listings
   * GET /api/resources/all
   */
  static async getAllResources(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId;

      if (!userId) {
        res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "User not authenticated" } });
        return;
      }

      const query = resourceQuerySchema.parse(req.query);

      // Resolve caller's own businessId so we can exclude their listings
      let excludeBusinessId: string | undefined;
      try {
        const { BusinessService } = await import("../services/business.service.js");
        const biz = await BusinessService.getBusinessByUserId(userId);
        excludeBusinessId = biz?.id;
      } catch { /* non-fatal */ }

      const resources = await ResourceService.getAllResources(
        {
          ...query,
          startDate: typeof req.query.startDate === "string" ? req.query.startDate : undefined,
          endDate:   typeof req.query.endDate   === "string" ? req.query.endDate   : undefined,
        },
        excludeBusinessId
      );

      res.status(200).json({ success: true, data: { resources, count: resources.length } });
    } catch (error) {
      next(error);
    }
  }
}
