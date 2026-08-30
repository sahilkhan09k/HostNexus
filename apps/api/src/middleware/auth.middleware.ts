import type { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/auth.service.js";

/**
 * Extend Express Request type to include userId
 */
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

/**
 * Authentication middleware
 * Verifies JWT token and attaches user ID to request
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({
        success: false,
        error: {
          code: "MISSING_TOKEN",
          message: "Authorization header is required",
        },
      });
      return;
    }

    // Check Bearer format
    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      res.status(401).json({
        success: false,
        error: {
          code: "INVALID_TOKEN_FORMAT",
          message: "Authorization header must be in format: Bearer <token>",
        },
      });
      return;
    }

    const token = parts[1];

    // Verify token
    const payload = AuthService.verifyToken(token);

    // Attach user ID to request
    req.userId = payload.sub;

    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: {
        code: "INVALID_TOKEN",
        message: error instanceof Error ? error.message : "Token verification failed",
      },
    });
  }
}
