import type { Request, Response, NextFunction } from "express";
import { BookingService } from "../services/booking.service.js";
import { createBookingRequestSchema, updateBookingStatusSchema, bookingQuerySchema } from "../schemas/booking.schema.js";

export class BookingController {
  /**
   * Create a new booking request
   * POST /api/bookings
   */
  static async createBookingRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "User not authenticated",
          },
        });
        return;
      }

      // Validate input
      const input = createBookingRequestSchema.parse(req.body);

      // Create booking request
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
        res.status(401).json({
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "User not authenticated",
          },
        });
        return;
      }

      // Validate query parameters
      const query = bookingQuerySchema.parse(req.query);

      // Get booking requests
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
      const { id } = req.params;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "User not authenticated",
          },
        });
        return;
      }

      if (!id || typeof id !== "string") {
        res.status(400).json({
          success: false,
          error: {
            code: "INVALID_BOOKING_ID",
            message: "Valid booking ID is required",
          },
        });
        return;
      }

      // Verify access
      const hasAccess = await BookingService.verifyBookingAccess(id, userId);

      if (!hasAccess) {
        res.status(403).json({
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "You do not have access to this booking",
          },
        });
        return;
      }

      const bookingRequest = await BookingService.getBookingRequestById(id);

      if (!bookingRequest) {
        res.status(404).json({
          success: false,
          error: {
            code: "BOOKING_NOT_FOUND",
            message: "Booking request not found",
          },
        });
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
   * Update booking status (accept/reject/cancel/complete)
   * PATCH /api/bookings/:id/status
   */
  static async updateBookingStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId;
      const { id } = req.params;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "User not authenticated",
          },
        });
        return;
      }

      if (!id || typeof id !== "string") {
        res.status(400).json({
          success: false,
          error: {
            code: "INVALID_BOOKING_ID",
            message: "Valid booking ID is required",
          },
        });
        return;
      }

      // Validate input
      const input = updateBookingStatusSchema.parse(req.body);

      // Update booking status
      const bookingRequest = await BookingService.updateBookingStatus(id, userId, input);

      res.status(200).json({
        success: true,
        data: { bookingRequest },
      });
    } catch (error) {
      next(error);
    }
  }
}
