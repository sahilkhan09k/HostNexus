import type { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/auth.service.js";
import { audit } from "../services/audit.service.js";
import { registerSchema, loginSchema, refreshSchema } from "../schemas/auth.schema.js";
import { HttpError } from "../utils/http-error.js";

export class AuthController {
  /** POST /api/auth/register */
  static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = registerSchema.parse(req.body);
      const result = await AuthService.register(input);
      await audit({ action: "AUTH_REGISTER", actorType: "USER", actorId: result.user.id, req,
        metadata: { autoVerified: result.autoVerified, gstin: result.gstin.gstin } });
      res.status(201).json({
        success: true,
        data: { user: result.user, gstin: result.gstin },
        message: result.autoVerified
          ? "GSTIN verified. Account created."
          : "Account created. Your GST details are being reviewed by our team; you can sign in once approved.",
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
      await audit({ action: "AUTH_LOGIN_SUCCESS", actorType: "USER", actorId: result.user.id, req });
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      if (error instanceof HttpError) {
        await audit({ action: "AUTH_LOGIN_FAILED", actorType: "ANONYMOUS", req,
          metadata: { reason: error.code, email: typeof req.body?.email === "string" ? req.body.email.slice(0, 254) : undefined } });
      }
      next(error);
    }
  }

  /** POST /api/auth/refresh — rotates the refresh token */
  static async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = refreshSchema.parse(req.body);
      const tokens = await AuthService.refreshTokens(refreshToken);
      res.status(200).json({ success: true, data: { token: tokens.accessToken, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken } });
    } catch (error) {
      next(error);
    }
  }

  /** POST /api/auth/logout — revokes the session the refresh token belongs to */
  static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = refreshSchema.parse(req.body);
      const userId = await AuthService.logout(refreshToken);
      if (userId) await audit({ action: "AUTH_LOGOUT", actorType: "USER", actorId: userId, req });
      res.status(200).json({ success: true, data: null });
    } catch (error) {
      next(error);
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
