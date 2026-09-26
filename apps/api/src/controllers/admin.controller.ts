import type { Request, Response, NextFunction } from "express";
import { AdminService } from "../services/admin.service.js";
import { BookingService } from "../services/booking.service.js";
import { PaymentService } from "../services/payment.service.js";
import { adminResolveDisputeSchema } from "../schemas/booking.schema.js";
import { z } from "zod";

const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const rejectSchema = z.object({
  notes: z.string().optional(),
});

const suspendSchema = z.object({
  reason: z.string().min(5, "Give a reason for the suspension"),
});

const markPaidSchema = z.object({
  utrReference: z.string().trim().min(6, "Enter the bank UTR / transaction reference"),
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

  /** PATCH /api/admin/users/:id/suspend */
  static async suspendUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { reason } = suspendSchema.parse(req.body);
      const user = await AdminService.suspendUser(String(req.params.id), reason);
      res.status(200).json({ success: true, data: { user }, message: "User suspended." });
    } catch (error) {
      next(error);
    }
  }

  /** PATCH /api/admin/users/:id/reinstate */
  static async reinstateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await AdminService.reinstateUser(String(req.params.id));
      res.status(200).json({ success: true, data: { user }, message: "User reinstated." });
    } catch (error) {
      next(error);
    }
  }

  /** GET /api/admin/disputes?status=OPEN|ESCALATED|RESOLVED|ALL */
  static async listDisputes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const status = typeof req.query.status === "string" ? req.query.status : "ALL";
      const disputes = await AdminService.listDisputes(status as any);
      res.status(200).json({ success: true, data: { disputes, count: disputes.length } });
    } catch (error) {
      next(error);
    }
  }

  /** POST /api/admin/disputes/:bookingId/resolve */
  static async resolveDispute(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = adminResolveDisputeSchema.parse(req.body);
      const booking = await BookingService.adminResolveDispute(String(req.params.bookingId), req.adminId!, input);
      res.status(200).json({ success: true, data: { booking }, message: `Dispute resolved: ${input.decision}.` });
    } catch (error) {
      next(error);
    }
  }

  /** GET /api/admin/transactions?direction=TO_OWNER|TO_RENTER&status=PENDING|FAILED|COMPLETED */
  static async listTransactions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const direction = typeof req.query.direction === "string" ? req.query.direction : undefined;
      const status    = typeof req.query.status === "string" ? req.query.status : undefined;
      const transactions = await PaymentService.listTransactions({ direction, status });
      res.status(200).json({ success: true, data: { transactions, count: transactions.length } });
    } catch (error) {
      next(error);
    }
  }

  /** POST /api/admin/transactions/:id/mark-paid — record the UTR of an owner payout */
  static async markPayoutPaid(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { utrReference } = markPaidSchema.parse(req.body);
      const transaction = await PaymentService.markPayoutPaid(String(req.params.id), req.adminId!, utrReference);
      res.status(200).json({ success: true, data: { transaction }, message: "Payout marked as paid." });
    } catch (error) {
      next(error);
    }
  }

  /** POST /api/admin/transactions/:id/retry — re-send a failed renter refund */
  static async retryRefund(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const transaction = await PaymentService.retryRefund(String(req.params.id));
      res.status(200).json({ success: true, data: { transaction } });
    } catch (error) {
      next(error);
    }
  }
}
