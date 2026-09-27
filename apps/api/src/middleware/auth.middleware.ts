import type { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/auth.service.js";
import { HttpError } from "../utils/http-error.js";

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
 * Verifies the JWT and that the account is still VERIFIED and its tokens haven't been revoked.
 */
export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({
      success: false,
      error: { code: "MISSING_TOKEN", message: "Authorization header is required" },
    });
    return;
  }

  // Check Bearer format
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    res.status(401).json({
      success: false,
      error: { code: "INVALID_TOKEN_FORMAT", message: "Authorization header must be in format: Bearer <token>" },
    });
    return;
  }

  try {
    const payload = await AuthService.verifyAccessToken(parts[1]);
    req.userId = payload.sub;
  } catch (error) {
    if (!(error instanceof HttpError)) {
      // e.g. database unavailable — a server error, not a bad token
      next(error);
      return;
    }
    res.status(401).json({ success: false, error: { code: error.code, message: error.message } });
    return;
  }
  next();
}
