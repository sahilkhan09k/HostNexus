import type { Request, Response, NextFunction } from "express";
import { AdminService } from "../services/admin.service.js";

declare global {
  namespace Express {
    interface Request {
      adminId?: string;
    }
  }
}

export async function authenticateAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
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

  let adminId: string;
  try {
    // Throws synchronously for bad signatures/claims; DB errors propagate as 500 below
    AdminService.verifyAdminToken(parts[1]);
  } catch {
    res.status(401).json({ success: false, error: { code: "INVALID_ADMIN_TOKEN", message: "Invalid or expired admin token" } });
    return;
  }

  try {
    adminId = (await AdminService.verifyAdminSession(parts[1])).sub;
  } catch (err) {
    if (err instanceof Error && err.message === "Admin session revoked") {
      res.status(401).json({ success: false, error: { code: "INVALID_ADMIN_TOKEN", message: "Invalid or expired admin token" } });
      return;
    }
    next(err);
    return;
  }

  req.adminId = adminId;
  next();
}
