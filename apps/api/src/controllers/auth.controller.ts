import type { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/auth.service.js";
import { registerSchema, loginSchema } from "../schemas/auth.schema.js";

export class AuthController {
  /** POST /api/auth/register */
  static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = registerSchema.parse(req.body);
      const result = await AuthService.register(input);
      // 202 Accepted — account created but awaiting verification
      res.status(202).json({
        success: true,
        data: result,
        message: "Account created. Awaiting admin verification.",
      });
    } catch (error) {
      next(error);
    }
  }

  /** POST /api/auth/login */
  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = loginSchema.parse(req.body);
      const result = await AuthService.login(input);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /** POST /api/auth/refresh */
  static async refresh(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body as { refreshToken?: string };
      if (!refreshToken || typeof refreshToken !== "string") {
        res.status(400).json({ success: false, error: { code: "MISSING_REFRESH_TOKEN", message: "refreshToken is required" } });
        return;
      }
      const tokens = AuthService.refreshTokens(refreshToken);
      res.status(200).json({ success: true, data: { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken } });
    } catch (error) {
      res.status(401).json({ success: false, error: { code: "INVALID_REFRESH_TOKEN", message: error instanceof Error ? error.message : "Invalid token" } });
    }
  }

  /** GET /api/auth/me — returns user + verificationStatus */
  static async getCurrentUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId;
      if (!userId) {
        res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
        return;
      }
      const user = await AuthService.getUserById(userId);
      if (!user) {
        res.status(404).json({ success: false, error: { code: "USER_NOT_FOUND", message: "User not found" } });
        return;
      }
      res.status(200).json({ success: true, data: { user } });
    } catch (error) {
      next(error);
    }
  }

  /** GET /api/auth/validate — used by frontend boot; rejects non-VERIFIED users */
  static async validateSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId;
      if (!userId) {
        res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
        return;
      }
      const user = await AuthService.validateSession(userId);
      if (!user) {
        res.status(403).json({ success: false, error: { code: "ACCOUNT_NOT_VERIFIED", message: "Account not verified" } });
        return;
      }
      res.status(200).json({ success: true, data: { user } });
    } catch (error) {
      next(error);
    }
  }
}
