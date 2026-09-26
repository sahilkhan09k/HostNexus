import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { AdminService } from "../services/admin.service.js";
import { BookingService } from "../services/booking.service.js";
import { GstinService } from "../services/gstin.service.js";
import { audit } from "../services/audit.service.js";
import { adminLoginSchema } from "../schemas/auth.schema.js";
import { adminResolveDisputeSchema } from "../schemas/booking.schema.js";
import { paginationSchema } from "../utils/pagination.js";
import { HttpError } from "../utils/http-error.js";

const rejectSchema = z.object({
  notes: z.string().max(1000).optional(),
});

const listUsersQuery = paginationSchema.extend({
  status: z.enum(["PENDING", "VERIFIED", "REJECTED"]).optional(),
});

const idParam = z.string().min(1).max(64);

export class AdminController {
  /** POST /api/admin/login */
  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = adminLoginSchema.parse(req.body);
      const result = await AdminService.login(email, password);
      await audit({ action: "ADMIN_LOGIN_SUCCESS", actorType: "ADMIN", actorId: result.admin.id, req });
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      if (error instanceof HttpError) {
        await audit({ action: "ADMIN_LOGIN_FAILED", actorType: "ANONYMOUS", req,
          metadata: { email: typeof req.body?.email === "string" ? req.body.email.slice(0, 254) : undefined } });
      }
      next(error);
    }
  }

  /** POST /api/admin/logout — invalidates all of this admin's tokens */
  static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await AdminService.logout(req.adminId!);
      res.status(200).json({ success: true, data: null });
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

  /** GET /api/admin/users?status=PENDING|VERIFIED|REJECTED&limit=&cursor= */
  static async listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, ...page } = listUsersQuery.parse(req.query);
      const { items, nextCursor } = await AdminService.listUsers(status, page);
      res.status(200).json({ success: true, data: { users: items, count: items.length, nextCursor } });
    } catch (error) {
      next(error);
    }
  }

  /** PATCH /api/admin/users/:id/approve */
  static async approveUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = idParam.parse(req.params.id);
      const user = await AdminService.approveUser(id);
      await audit({ action: "ADMIN_USER_APPROVED", actorType: "ADMIN", actorId: req.adminId, targetType: "User", targetId: id, req });
      res.status(200).json({ success: true, data: { user }, message: "User verified successfully." });
    } catch (error) {
      next(error);
    }
  }

  /** PATCH /api/admin/users/:id/reject */
  static async rejectUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = idParam.parse(req.params.id);
      const { notes } = rejectSchema.parse(req.body);
      const user = await AdminService.rejectUser(id, notes);
      await audit({ action: "ADMIN_USER_REJECTED", actorType: "ADMIN", actorId: req.adminId, targetType: "User", targetId: id, req,
        metadata: { notes } });
      res.status(200).json({ success: true, data: { user }, message: "User rejected." });
    } catch (error) {
      next(error);
    }
  }

  /** GET /api/admin/kyc/:file — streams a private KYC document to an authenticated admin */
  static async getKycDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ref = `/kyc/${String(req.params.file)}`;
      const buffer = await GstinService.readKycDocument(ref);
      await audit({ action: "ADMIN_KYC_DOCUMENT_VIEWED", actorType: "ADMIN", actorId: req.adminId, targetType: "KycDocument", targetId: ref, req });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "inline; filename=\"gst-certificate.pdf\"");
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
      res.status(200).send(buffer);
    } catch (error) {
      next(error);
    }
  }

  /** GET /api/admin/disputes */
  static async listDisputes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = paginationSchema.parse(req.query);
      const { items, nextCursor } = await AdminService.listDisputes(page);
      res.status(200).json({ success: true, data: { bookings: items, count: items.length, nextCursor } });
    } catch (error) {
      next(error);
    }
  }

  /** POST /api/admin/bookings/:id/resolve-dispute */
  static async resolveDispute(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = idParam.parse(req.params.id);
      const input = adminResolveDisputeSchema.parse(req.body);
      const booking = await BookingService.adminResolveDispute(id, req.adminId!, input);
      await audit({ action: "ADMIN_DISPUTE_RESOLVED", actorType: "ADMIN", actorId: req.adminId, targetType: "BookingRequest", targetId: id, req,
        metadata: { decision: input.decision, resolutionAmountPaise: input.resolutionAmountPaise } });
      res.status(200).json({
        success: true,
        data: { booking },
        message: `Dispute successfully resolved with decision: ${input.decision}.`,
      });
    } catch (error) {
      next(error);
    }
  }
}
