import type { Request, Response, NextFunction } from "express";
import { BusinessService } from "../services/business.service.js";
import { createBusinessSchema, updateBusinessSchema } from "../schemas/business.schema.js";

export class BusinessController {
  /**
   * Create a new business
   * POST /api/business
   */
  static async createBusiness(req: Request, res: Response, next: NextFunction): Promise<void> {
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
      const input = createBusinessSchema.parse(req.body);

      // Create business
      const business = await BusinessService.createBusiness(userId, input);

      res.status(201).json({
        success: true,
        data: { business },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get the authenticated user's business
   * GET /api/business/me
   */
  static async getMyBusiness(req: Request, res: Response, next: NextFunction): Promise<void> {
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

      // Get user's business
      const business = await BusinessService.getBusinessByUserId(userId);

      if (!business) {
        res.status(404).json({
          success: false,
          error: {
            code: "BUSINESS_NOT_FOUND",
            message: "No business found for this user",
          },
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: { business },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get a business by ID
   * GET /api/business/:id
   */
  static async getBusinessById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      if (!id || typeof id !== "string") {
        res.status(400).json({
          success: false,
          error: {
            code: "INVALID_BUSINESS_ID",
            message: "Valid business ID is required",
          },
        });
        return;
      }

      const business = await BusinessService.getBusinessById(id);

      if (!business) {
        res.status(404).json({
          success: false,
          error: {
            code: "BUSINESS_NOT_FOUND",
            message: "Business not found",
          },
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: { business },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update the authenticated user's business
   * PATCH /api/business/:id
   */
  static async updateBusiness(req: Request, res: Response, next: NextFunction): Promise<void> {
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
            code: "INVALID_BUSINESS_ID",
            message: "Valid business ID is required",
          },
        });
        return;
      }

      // Validate input
      const input = updateBusinessSchema.parse(req.body);

      // Update business (service handles ownership verification)
      const business = await BusinessService.updateBusiness(id, userId, input);

      res.status(200).json({
        success: true,
        data: { business },
      });
    } catch (error) {
      next(error);
    }
  }
}
