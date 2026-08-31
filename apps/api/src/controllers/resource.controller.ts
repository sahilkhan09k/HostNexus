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
   * Get a resource by ID
   * GET /api/resources/:id
   */
  static async getResourceById(req: Request, res: Response, next: NextFunction): Promise<void> {
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

      const resource = await ResourceService.getResourceById(id);

      if (!resource) {
        res.status(404).json({
          success: false,
          error: {
            code: "RESOURCE_NOT_FOUND",
            message: "Resource not found",
          },
        });
        return;
      }

      // Verify user has access to this resource
      const hasAccess = await ResourceService.verifyResourceAccess(id, userId);

      if (!hasAccess) {
        res.status(403).json({
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "You do not have access to this resource",
          },
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: { resource },
      });
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
}
