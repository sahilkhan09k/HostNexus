import type { Request, Response, NextFunction } from "express";
import { AdminService } from "../services/admin.service.js";
import { z } from "zod";

const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const rejectSchema = z.object({
  notes: z.string().optional(),
});

export class AdminController {
  /** POST /api/admin/login */
  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = adminLoginSchema.parse(req.body);
      const result = await AdminService.login(email, password);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /** GET /api/admin/summary */
  static async getSummary(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const summary = await AdminService.getSummary();
      res.status(200).json({ success: true, data: summary });
    } catch (error) {
      next(error);
    }
  }

  /** GET /api/admin/users?status=PENDING|VERIFIED|REJECTED */
  static async listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      const users = await AdminService.listUsers(status);
      res.status(200).json({ success: true, data: { users, count: users.length } });
    } catch (error) {
      next(error);
    }
  }

  /** PATCH /api/admin/users/:id/approve */
  static async approveUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const user = await AdminService.approveUser(id);
      res.status(200).json({ success: true, data: { user }, message: "User verified successfully." });
    } catch (error) {
      next(error);
    }
  }

  /** PATCH /api/admin/users/:id/reject */
  static async rejectUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const { notes } = rejectSchema.parse(req.body);
      const user = await AdminService.rejectUser(id, notes);
      res.status(200).json({ success: true, data: { user }, message: "User rejected." });
    } catch (error) {
      next(error);
    }
  }
}
