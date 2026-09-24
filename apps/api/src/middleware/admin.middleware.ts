import type { Request, Response, NextFunction } from "express";
import { AdminService } from "../services/admin.service.js";

declare global {
  namespace Express {
    interface Request {
      adminId?: string;
    }
  }
}

export function authenticateAdmin(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.status(401).json({ success: false, error: { code: "MISSING_TOKEN", message: "Admin token required" } });
      return;
    }

    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      res.status(401).json({ success: false, error: { code: "INVALID_TOKEN_FORMAT", message: "Bearer token required" } });
      return;
    }

    const payload = AdminService.verifyAdminToken(parts[1]);
    req.adminId = payload.sub;
    next();
  } catch {
    res.status(401).json({ success: false, error: { code: "INVALID_ADMIN_TOKEN", message: "Invalid or expired admin token" } });
  }
}
