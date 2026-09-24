import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { AvailabilityService } from "../services/availability.service.js";

const windowSchema = z.object({
  fromDate: z.string().datetime({ message: "fromDate must be ISO datetime" }),
  toDate:   z.string().datetime({ message: "toDate must be ISO datetime" }),
  note:     z.string().max(200).optional(),
});

const setWindowsSchema = z.object({
  windows: z.array(windowSchema).max(52, "Maximum 52 windows"),
});

export class AvailabilityController {
  /** GET /api/resources/:id/availability  — public */
  static async getWindows(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const resourceId = String(req.params.id);
      const windows = await AvailabilityService.getWindows(resourceId);
      res.status(200).json({ success: true, data: { windows } });
    } catch (err) { next(err); }
  }

  /** PUT /api/resources/:id/availability  — owner only, replaces all windows */
  static async setWindows(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId     = req.userId!;
      const resourceId = String(req.params.id);
      const { windows } = setWindowsSchema.parse(req.body);
      const result = await AvailabilityService.setWindows(userId, resourceId, windows);
      res.status(200).json({ success: true, data: { windows: result } });
    } catch (err) { next(err); }
  }

  /** DELETE /api/availability/:windowId  — owner only */
  static async deleteWindow(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId   = req.userId!;
      const windowId = String(req.params.windowId);
      await AvailabilityService.deleteWindow(userId, windowId);
      res.status(200).json({ success: true, data: { message: "Window deleted" } });
    } catch (err) { next(err); }
  }

  /** GET /api/resources/:id/availability/check?startDate=&endDate=  — public */
  static async checkAvailability(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const resourceId = String(req.params.id);
      const startDate  = String(req.query.startDate ?? "");
      const endDate    = String(req.query.endDate ?? "");
      if (!startDate || !endDate) {
        res.status(400).json({ success: false, error: { code: "MISSING_DATES", message: "startDate and endDate are required" } });
        return;
      }
      const result = await AvailabilityService.checkAvailability(resourceId, startDate, endDate);
      res.status(200).json({ success: true, data: result });
    } catch (err) { next(err); }
  }

  /** GET /api/resources/:id/availability/calendar?month=YYYY-MM  — public */
  static async getCalendar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const resourceId = String(req.params.id);
      const month      = String(req.query.month ?? "");
      if (!month) {
        res.status(400).json({ success: false, error: { code: "MISSING_MONTH", message: "month param required (YYYY-MM)" } });
        return;
      }
      const result = await AvailabilityService.getUnavailableDates(resourceId, month);
      res.status(200).json({ success: true, data: result });
    } catch (err) { next(err); }
  }
}
