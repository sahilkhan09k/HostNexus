import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { ReviewService } from "../services/review.service.js";

const submitReviewSchema = z.object({
  bookingId: z.string().min(1),
  rating:    z.number().int().min(1).max(5),
  comment:   z.string().max(1000).optional(),
});

export class ReviewController {
  /** POST /api/reviews */
  static async submit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      const input  = submitReviewSchema.parse(req.body);
      const review = await ReviewService.submitReview(userId, input);
      res.status(201).json({ success: true, data: { review } });
    } catch (err) { next(err); }
  }

  /** GET /api/reviews/business/:id  — public reputation profile */
  static async getBusinessProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const profile = await ReviewService.getBusinessProfile(id);
      res.status(200).json({ success: true, data: profile });
    } catch (err) { next(err); }
  }

  /** GET /api/reviews/my-dashboard  — current user's own reputation */
  static async getMyReputation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;
      const { BusinessService } = await import("../services/business.service.js");
      const biz = await BusinessService.getBusinessByUserId(userId);
      if (!biz) { res.status(404).json({ success: false, error: { code: "NO_BUSINESS", message: "No business found" } }); return; }
      const { getBusinessReputation } = await import("../services/review.service.js");
      const reputation = await getBusinessReputation(biz.id);
      res.status(200).json({ success: true, data: { businessId: biz.id, reputation } });
    } catch (err) { next(err); }
  }
}
