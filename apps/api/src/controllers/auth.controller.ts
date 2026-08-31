import type { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/auth.service.js";
import { registerSchema, loginSchema } from "../schemas/auth.schema.js";

export class AuthController {
  /**
   * Register a new user
   * POST /api/auth/register
   */
  static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate input
      const input = registerSchema.parse(req.body);

      // Register user
      const result = await AuthService.register(input);

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Login user
   * POST /api/auth/login
   */
  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate input
      const input = loginSchema.parse(req.body);

      // Login user
      const result = await AuthService.login(input);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get current authenticated user
   * GET /api/auth/me
   */
  static async getCurrentUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // User ID is attached by auth middleware
      const userId = (req as any).userId;

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

      // Get user
      const user = await AuthService.getUserById(userId);

      if (!user) {
        res.status(404).json({
          success: false,
          error: {
            code: "USER_NOT_FOUND",
            message: "User not found",
          },
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: { user },
      });
    } catch (error) {
      next(error);
    }
  }
}
