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
} from "../schemas/booking.schema.js";

export class BookingController {
  /**
   * Create a new booking request
   * POST /api/bookings
   */
  static async createBookingRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId;
      if (!userId) {
        res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "User not authenticated" } });
        return;
      }

      const input = createBookingRequestSchema.parse(req.body);
      const bookingRequest = await BookingService.createBookingRequest(userId, input);

      res.status(201).json({
        success: true,
        data: { bookingRequest },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all booking requests
   * GET /api/bookings
   */
  static async getBookingRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId;
      if (!userId) {
        res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "User not authenticated" } });
        return;
      }

      const query = bookingQuerySchema.parse(req.query);
      const bookingRequests = await BookingService.getBookingRequests(userId, query);

      res.status(200).json({
        success: true,
        data: { bookingRequests, count: bookingRequests.length },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get a booking request by ID
   * GET /api/bookings/:id
   */
  static async getBookingRequestById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId;
      const id = req.params.id as string;

      if (!userId) {
        res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "User not authenticated" } });
        return;
      }

      const bookingRequest = await BookingService.getBookingRequestById(id);
      if (!bookingRequest) {
        res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Booking request not found" } });
        return;
      }

      res.status(200).json({
        success: true,
        data: { bookingRequest },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update booking status (accept/reject/cancel)
   * PATCH /api/bookings/:id/status
   */
  static async updateBookingStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId;
      const id = req.params.id as string;
      if (!userId) {
        res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "User not authenticated" } });
        return;
      }

      const input = updateBookingStatusSchema.parse(req.body);
      const bookingRequest = await BookingService.updateBookingStatus(id, userId, input);

      res.status(200).json({
        success: true,
        data: { bookingRequest },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Fund Escrow
   * POST /api/bookings/:id/pay
   */
  static async payEscrow(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId;
      const id = req.params.id as string;
      if (!userId) {
        res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "User not authenticated" } });
        return;
      }

      const booking = await BookingService.payEscrow(id, userId);
      res.status(200).json({
        success: true,
        data: { booking },
        message: "Escrow funds held successfully.",
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Owner marks resource handed over
   * POST /api/bookings/:id/handover
   */
  static async markHandover(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId;
      const id = req.params.id as string;
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

  /**
   * Renter receiving inspection (Accept or Report Issue)
   * POST /api/bookings/:id/renter-inspection
   */
  static async renterInspection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId;
      const id = req.params.id as string;
      if (!userId) {
        res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "User not authenticated" } });
        return;
      }

      const input = renterReceivingInspectionSchema.parse(req.body);
      const booking = await BookingService.renterReceivingInspection(id, userId, input);

      res.status(200).json({
        success: true,
        data: { booking },
        message: input.status === "ACCEPTED" ? "Resource accepted. Rent released to owner." : "Handover issue reported. Dispute opened.",
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Renter initiates return
   * POST /api/bookings/:id/return
   */
  static async initiateReturn(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId;
      const id = req.params.id as string;
      if (!userId) {
        res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "User not authenticated" } });
        return;
      }

      const input = returnInitiationSchema.parse(req.body);
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

  /**
   * Owner confirms physical return receipt (Fake Return Protection)
   * POST /api/bookings/:id/owner-receipt
   */
  static async ownerReceipt(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId;
      const id = req.params.id as string;
      if (!userId) {
        res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "User not authenticated" } });
        return;
      }

      const input = ownerReceiptSchema.parse(req.body);
      const booking = await BookingService.ownerConfirmReceipt(id, userId, input);

      res.status(200).json({
        success: true,
        data: { booking },
        message: input.received ? "Physical receipt confirmed. 2-hour inspection window active." : "Return reported not received. Incident flagged for customer care.",
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Owner accepts return condition ("Everything is OK")
   * POST /api/bookings/:id/owner-accept-return
   */
  static async ownerAcceptReturn(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId;
      const id = req.params.id as string;
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

  /**
   * Owner submits return damage claim
   * POST /api/bookings/:id/damage-claim
   */
  static async ownerDamageClaim(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId;
      const id = req.params.id as string;
      if (!userId) {
        res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "User not authenticated" } });
        return;
      }

      const input = ownerDamageClaimSchema.parse(req.body);
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

  /**
   * Renter responds to damage claim (Accept or Dispute)
   * POST /api/bookings/:id/claim-response
   */
  static async renterRespondClaim(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId;
      const id = req.params.id as string;
      if (!userId) {
        res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "User not authenticated" } });
        return;
      }

      const input = renterClaimResponseSchema.parse(req.body);
      const booking = await BookingService.renterRespondClaim(id, userId, input);

      res.status(200).json({
        success: true,
        data: { booking },
        message: input.action === "ACCEPT" ? "Claim accepted and settled." : "Claim disputed. Sent to Customer Care.",
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Customer Care / Admin resolves dispute
   * POST /api/bookings/:id/resolve-dispute
   */
  static async adminResolveDispute(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId;
      const id = req.params.id as string;
      if (!userId) {
        res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "User not authenticated" } });
        return;
      }

      const input = adminResolveDisputeSchema.parse(req.body);
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

  /**
   * Report non-return
   * POST /api/bookings/:id/non-return
   */
  static async reportNonReturn(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId;
      const id = req.params.id as string;
      if (!userId) {
        res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "User not authenticated" } });
        return;
      }

      const booking = await BookingService.reportNonReturn(id, userId);
      res.status(200).json({
        success: true,
        data: { booking },
        message: "Non-return reported. Security deposit retained.",
      });
    } catch (error) {
      next(error);
    }
  }
}
