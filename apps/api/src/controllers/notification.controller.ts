import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { NotificationService } from "../services/notifications/notification.service.js";
import { paginationSchema } from "../utils/pagination.js";

const listQuery = paginationSchema.extend({
  unread: z.enum(["true", "false"]).optional(),
});

const idParam = z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/);

/** Every handler is scoped to req.userId from the verified access token. */
export class NotificationController {
  /** GET /api/notifications?limit=&cursor=&unread=true */
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { unread, ...page } = listQuery.parse(req.query);
      const userId = req.userId!;
      const [{ items, nextCursor }, unreadCount] = await Promise.all([
        NotificationService.list(userId, page, { unreadOnly: unread === "true" }),
        NotificationService.unreadCount(userId),
      ]);
      res.status(200).json({ success: true, data: { notifications: items, count: items.length, nextCursor, unreadCount } });
    } catch (error) {
      next(error);
    }
  }

  /** GET /api/notifications/unread-count */
  static async unreadCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const unreadCount = await NotificationService.unreadCount(req.userId!);
      res.status(200).json({ success: true, data: { unreadCount } });
    } catch (error) {
      next(error);
    }
  }

  /** PATCH /api/notifications/:id/read */
  static async markRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = idParam.parse(req.params.id);
      const notification = await NotificationService.markRead(req.userId!, id);
      res.status(200).json({ success: true, data: { notification } });
    } catch (error) {
      next(error);
    }
  }

  /** PATCH /api/notifications/read-all */
  static async markAllRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const updated = await NotificationService.markAllRead(req.userId!);
      res.status(200).json({ success: true, data: { updated } });
    } catch (error) {
      next(error);
    }
  }
}
