import { Router, type IRouter } from "express";
import { NotificationController } from "../controllers/notification.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { notificationLimiter } from "../middleware/rate-limit.js";

const router: IRouter = Router();

// Notifications belong to the signed-in user only; there is no create endpoint —
// notifications are produced by server-side business events.
router.use(authenticate);
router.use(notificationLimiter);

router.get("/", NotificationController.list);
router.get("/unread-count", NotificationController.unreadCount);
// Registered before "/:id/read" so "read-all" is never treated as an id
router.patch("/read-all", NotificationController.markAllRead);
router.patch("/:id/read", NotificationController.markRead);

export default router;
