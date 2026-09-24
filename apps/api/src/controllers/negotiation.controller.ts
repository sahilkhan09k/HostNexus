import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { NegotiationService } from "../services/negotiation.service.js";

const makeOfferSchema = z.object({
  offeredAmountPaise: z.number().int().min(1, "Offer must be > 0"),
  message: z.string().max(500).optional(),
});

const rejectSchema = z.object({
  reason: z.string().max(500).optional(),
});

export class NegotiationController {
  /** GET /api/negotiations/:bookingId */
  static async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const neg = await NegotiationService.getByBookingId(String(req.params.bookingId));
      res.status(200).json({ success: true, data: { negotiation: neg } });
    } catch (err) { next(err); }
  }

  /** POST /api/negotiations/:bookingId/offer */
  static async makeOffer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { offeredAmountPaise, message } = makeOfferSchema.parse(req.body);
      const offer = await NegotiationService.makeOffer(
        req.userId!, String(req.params.bookingId), offeredAmountPaise, message
      );
      res.status(201).json({ success: true, data: { offer }, message: "Offer submitted." });
    } catch (err) { next(err); }
  }

  /** POST /api/negotiations/:bookingId/accept */
  static async acceptOffer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const booking = await NegotiationService.acceptOffer(
        req.userId!, String(req.params.bookingId)
      );
      res.status(200).json({ success: true, data: { booking }, message: "Offer accepted. Booking confirmed at negotiated price." });
    } catch (err) { next(err); }
  }

  /** POST /api/negotiations/:bookingId/reject */
  static async rejectNegotiation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { reason } = rejectSchema.parse(req.body);
      await NegotiationService.rejectNegotiation(
        req.userId!, String(req.params.bookingId), reason
      );
      res.status(200).json({ success: true, data: null, message: "Negotiation rejected." });
    } catch (err) { next(err); }
  }
}
