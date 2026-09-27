import type { Request, Response, NextFunction } from "express";
import { BookingWeatherService } from "../services/booking-weather.service.js";

export class BookingWeatherController {
  /**
   * GET /api/resources/:id/weather-impact?startDate=&endDate=&transport=SELF|PROVIDER — public
   * Forecast for the listing's city on the chosen dates and what it means for
   * the rental and its transport. Weather failures come back as `{ ok: false, reason }`.
   */
  static async check(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const resourceId = String(req.params.id);
      const startDate  = String(req.query.startDate ?? "");
      const endDate    = String(req.query.endDate ?? "");
      if (!startDate || !endDate) {
        res.status(400).json({ success: false, error: { code: "MISSING_DATES", message: "startDate and endDate are required" } });
        return;
      }
      const mode = String(req.query.transport ?? "").toUpperCase() === "PROVIDER" ? "PROVIDER" : "SELF";
      const result = await BookingWeatherService.check(resourceId, startDate, endDate, mode);
      res.status(200).json({ success: true, data: result });
    } catch (err) { next(err); }
  }
}
