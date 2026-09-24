import type { Request, Response, NextFunction } from "express";
import { BookingService } from "../services/booking.service.js";
import {
  createBookingRequestSchema,
  updateBookingStatusSchema,
  bookingQuerySchema,
  renterReceivingInspectionSchema,
  returnInitiationSchema,
  ownerReceiptSchema,
  ownerDamageClaimSchema,
  renterClaimResponseSchema,
  adminResolveDisputeSchema,
  razorpayVerifySchema,
} from "../schemas/booking.schema.js";

export class BookingController {
  // ─────────────────────────────────────────────────────────────────────
  // CRUD — Create / Read
  // ─────────────────────────────────────────────────────────────────────

  /** POST /api/bookings */
  static async createBookingRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId;
      if (!userId) {
        res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "User not authenticated" } });
        return;
      }

      const input = createBookingRequestSchema.parse(req.body);
      const bookingRequest = await BookingService.createBookingRequest(userId, input);

      res.status(201).json({ success: true, data: { bookingRequest } });
    } catch (error) {
      next(error);
    }
  }

  /** GET /api/bookings */
  static async getBookingRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId;
      if (!userId) {
        res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "User not authenticated" } });
        return;
      }

      const query = bookingQuerySchema.parse(req.query);
      const bookingRequests = await BookingService.getBookingRequests(userId, query);

      res.status(200).json({ success: true, data: { bookingRequests, count: bookingRequests.length } });
    } catch (error) {
      next(error);
    }
  }

  /** GET /api/bookings/:id */
  static async getBookingRequestById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId;
      const id     = req.params.id as string;

      if (!userId) {
        res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "User not authenticated" } });
        return;
      }

      const bookingRequest = await BookingService.getBookingRequestById(id);
      if (!bookingRequest) {
        res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Booking request not found" } });
        return;
      }

      res.status(200).json({ success: true, data: { bookingRequest } });
    } catch (error) {
      next(error);
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // STATUS TRANSITIONS
  // ─────────────────────────────────────────────────────────────────────

  /** PATCH /api/bookings/:id/status */
  static async updateBookingStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId;
      const id     = req.params.id as string;
      if (!userId) {
        res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "User not authenticated" } });
        return;
      }

      const input = updateBookingStatusSchema.parse(req.body);
      const bookingRequest = await BookingService.updateBookingStatus(id, userId, input);

      res.status(200).json({ success: true, data: { bookingRequest } });
    } catch (error) {
      next(error);
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // RAZORPAY PAYMENT — TWO-STEP FLOW
  // ─────────────────────────────────────────────────────────────────────

  /**
   * POST /api/bookings/:id/pay
   * Step 1 — Create a Razorpay order.
   * Returns { orderId, amount, currency, keyId } for the frontend checkout.
   */
  static async createPaymentOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId;
      const id     = req.params.id as string;
      if (!userId) {
        res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "User not authenticated" } });
        return;
      }

      const orderDetails = await BookingService.createPaymentOrder(id, userId);

      res.status(200).json({
        success: true,
        data: orderDetails,
        message: "Razorpay order created. Complete checkout to fund escrow.",
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/bookings/:id/pay/verify
   * Step 2 — Verify Razorpay payment signature and fund escrow.
   * Body: { razorpayOrderId, razorpayPaymentId, razorpaySignature }
   */
  static async verifyPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId;
      const id     = req.params.id as string;
      if (!userId) {
        res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "User not authenticated" } });
        return;
      }

      const { razorpayOrderId, razorpayPaymentId, razorpaySignature } =
        razorpayVerifySchema.parse(req.body);

      const booking = await BookingService.verifyAndFundEscrow(
        id,
        userId,
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature
      );

      res.status(200).json({
        success: true,
        data: { booking },
        message: "Payment verified. Escrow funded successfully.",
      });
    } catch (error) {
      next(error);
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // HANDOVER & INSPECTION
  // ─────────────────────────────────────────────────────────────────────

  /** POST /api/bookings/:id/handover */
  static async markHandover(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId;
      const id     = req.params.id as string;
      if (!userId) {
        res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "User not authenticated" } });
        return;
      }

      const booking = await BookingService.markHandover(id, userId);
      res.status(200).json({
        success: true,
        data: { booking },
        message: "Resource handover initiated. 1-hour inspection window active.",
      });
    } catch (error) {
      next(error);
    }
  }

  /** POST /api/bookings/:id/renter-inspection */
  static async renterInspection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId;
      const id     = req.params.id as string;
      if (!userId) {
        res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "User not authenticated" } });
        return;
      }

      const input   = renterReceivingInspectionSchema.parse(req.body);
      const booking = await BookingService.renterReceivingInspection(id, userId, input);

      res.status(200).json({
        success: true,
        data: { booking },
        message: input.status === "ACCEPTED"
          ? "Resource accepted. Rent released to owner."
          : "Handover issue reported. Dispute opened.",
      });
    } catch (error) {
      next(error);
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // RETURN FLOW
  // ─────────────────────────────────────────────────────────────────────

  /** POST /api/bookings/:id/return */
  static async initiateReturn(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId;
      const id     = req.params.id as string;
      if (!userId) {
        res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "User not authenticated" } });
        return;
      }

      const input   = returnInitiationSchema.parse(req.body);
      const booking = await BookingService.initiateReturn(id, userId, input);

      res.status(200).json({
        success: true,
        data: { booking },
        message: "Return initiated with evidence. Awaiting owner receipt confirmation.",
      });
    } catch (error) {
      next(error);
    }
  }

  /** POST /api/bookings/:id/owner-receipt */
  static async ownerReceipt(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId;
      const id     = req.params.id as string;
      if (!userId) {
        res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "User not authenticated" } });
        return;
      }

      const input   = ownerReceiptSchema.parse(req.body);
      const booking = await BookingService.ownerConfirmReceipt(id, userId, input);

      res.status(200).json({
        success: true,
        data: { booking },
        message: input.received
          ? "Physical receipt confirmed. 2-hour inspection window active."
          : "Return reported not received. Dispute filed; sent to Customer Care.",
      });
    } catch (error) {
      next(error);
    }
  }

  /** POST /api/bookings/:id/owner-accept-return */
  static async ownerAcceptReturn(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId;
      const id     = req.params.id as string;
      if (!userId) {
        res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "User not authenticated" } });
        return;
      }

      const booking = await BookingService.ownerAcceptReturn(id, userId, req.body.notes);
      res.status(200).json({
        success: true,
        data: { booking },
        message: "Return accepted. Security deposit refunded to renter.",
      });
    } catch (error) {
      next(error);
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // DAMAGE CLAIMS & DISPUTES
  // ─────────────────────────────────────────────────────────────────────

  /** POST /api/bookings/:id/damage-claim */
  static async ownerDamageClaim(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId;
      const id     = req.params.id as string;
      if (!userId) {
        res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "User not authenticated" } });
        return;
      }

      const input   = ownerDamageClaimSchema.parse(req.body);
      const booking = await BookingService.ownerSubmitDamageClaim(id, userId, input);

      res.status(200).json({
        success: true,
        data: { booking },
        message: "Damage claim submitted. Booking entered dispute status.",
      });
    } catch (error) {
      next(error);
    }
  }

  /** POST /api/bookings/:id/claim-response */
  static async renterRespondClaim(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId;
      const id     = req.params.id as string;
      if (!userId) {
        res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "User not authenticated" } });
        return;
      }

      const input   = renterClaimResponseSchema.parse(req.body);
      const booking = await BookingService.renterRespondClaim(id, userId, input);

      res.status(200).json({
        success: true,
        data: { booking },
        message: input.action === "ACCEPT"
          ? "Claim accepted and settled."
          : "Claim disputed. Sent to Customer Care.",
      });
    } catch (error) {
      next(error);
    }
  }

  /** POST /api/bookings/:id/resolve-dispute */
  static async adminResolveDispute(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId;
      const id     = req.params.id as string;
      if (!userId) {
        res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "User not authenticated" } });
        return;
      }

      const input   = adminResolveDisputeSchema.parse(req.body);
      const booking = await BookingService.adminResolveDispute(id, userId, input);

      res.status(200).json({
        success: true,
        data: { booking },
        message: `Dispute successfully resolved with decision: ${input.decision}.`,
      });
    } catch (error) {
      next(error);
    }
  }

  /** POST /api/bookings/:id/non-return */
  static async reportNonReturn(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId;
      const id     = req.params.id as string;
      if (!userId) {
        res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "User not authenticated" } });
        return;
      }

      const booking = await BookingService.reportNonReturn(id, userId);
      res.status(200).json({
        success: true,
        data: { booking },
        message: "Non-return reported. Dispute filed and sent to Customer Care.",
      });
    } catch (error) {
      next(error);
    }
  }
}
