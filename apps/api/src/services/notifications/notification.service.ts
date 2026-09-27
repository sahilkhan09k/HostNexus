import type { Notification, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../config/database.js";
import { appUrl } from "../../config/env.js";
import { notFound } from "../../utils/http-error.js";
import { logger } from "../../utils/logger.js";
import { pageArgs, toPage, type Pagination } from "../../utils/pagination.js";
import { EmailService, maskEmail } from "./email.service.js";
import { renderEmail } from "./email-templates.js";
import { emitToUser, REALTIME_EVENTS } from "./realtime.service.js";
import { NOTIFICATION_POLICIES, isNotificationType, type NotificationData, type NotificationType } from "./notification-types.js";

/**
 * NotificationService — the one entry point for telling a user something happened.
 *
 *   business event ──► notify()
 *                        ├─► persist Notification row      (notification center)
 *                        ├─► emit `notification:new`       (live badge + toast)
 *                        └─► send email, if the type's policy says so (async)
 *
 * notify() never throws: a notification failure must not fail or roll back the
 * business operation that triggered it. Call it after the operation has committed.
 */

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: NotificationData;
  /** Extra content used only for the email version */
  email?: {
    /** Known recipient address/name saves a lookup */
    to?: string;
    recipientName?: string | null;
    details?: Array<{ label: string; value: string }>;
    ctaLabel?: string;
  };
}

/** The shape sent to clients (REST and socket) */
export interface NotificationDto {
  id: string;
  type: string;
  title: string;
  message: string;
  data: NotificationData | null;
  read: boolean;
  readAt: string | null;
  createdAt: string;
}

const idString = z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/);

const notifyInputSchema = z.object({
  userId: idString,
  type: z.string().refine(isNotificationType, "Unknown notification type"),
  title: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(2000),
  data: z
    .object({
      // App-relative path only: "/dashboard/…", never "//evil.com" or "https://…"
      link: z.string().max(300).regex(/^\/(?!\/)[\w\-/?=&.%]*$/).optional(),
      bookingId: idString.optional(),
      resourceId: idString.optional(),
      businessId: idString.optional(),
      reviewId: idString.optional(),
      negotiationId: idString.optional(),
    })
    .strict()
    .optional(),
});

export function toDto(n: Notification): NotificationDto {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    message: n.message,
    data: (n.data as NotificationData | null) ?? null,
    read: n.read,
    readAt: n.readAt ? n.readAt.toISOString() : null,
    createdAt: n.createdAt.toISOString(),
  };
}

const DEFAULT_CTA = "Open in HostNexus";

export class NotificationService {
  /** Persist + push + (maybe) email. Never throws. */
  static async notify(input: NotifyInput): Promise<NotificationDto | null> {
    const parsed = notifyInputSchema.safeParse(input);
    if (!parsed.success) {
      logger.error("Invalid notification payload", { type: input.type, issues: parsed.error.issues.map((i) => i.message) });
      return null;
    }

    const policy = NOTIFICATION_POLICIES[input.type];

    let row: Notification;
    try {
      row = await prisma.notification.create({
        data: {
          userId: input.userId,
          type: input.type,
          title: input.title,
          message: input.message,
          data: (parsed.data.data ?? undefined) as Prisma.InputJsonValue | undefined,
          emailStatus: policy.email ? "PENDING" : "NOT_REQUIRED",
        },
      });
    } catch (err) {
      // Without a row there is nothing to show or mark read; important events still get their email
      logger.error("Failed to persist notification", { type: input.type, userId: input.userId, error: errMessage(err) });
      if (policy.email) void this.deliverEmail(null, input);
      return null;
    }

    const dto = toDto(row);
    emitToUser(input.userId, REALTIME_EVENTS.NOTIFICATION_NEW, { notification: dto, toast: policy.toast });

    if (policy.email) void this.deliverEmail(row.id, input);
    return dto;
  }

  /** Fan-out helper: notifications for several recipients, independent of each other. */
  static async notifyMany(inputs: NotifyInput[]): Promise<void> {
    await Promise.all(inputs.map((i) => this.notify(i)));
  }

  /** Sends the email and records the outcome on the notification row. Never throws. */
  private static async deliverEmail(notificationId: string | null, input: NotifyInput): Promise<void> {
    let status: "SENT" | "FAILED" | "SKIPPED" = "FAILED";
    try {
      let to = input.email?.to;
      let recipientName = input.email?.recipientName;
      if (!to) {
        const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { email: true, ownerName: true } });
        if (!user) throw new Error("Recipient not found");
        to = user.email;
        recipientName ??= user.ownerName;
      }

      const link = input.data?.link;
      const content = renderEmail({
        title: input.title,
        message: input.message,
        recipientName,
        details: input.email?.details,
        cta: link ? { label: input.email?.ctaLabel ?? DEFAULT_CTA, url: `${appUrl}${link}` } : undefined,
      });

      status = await EmailService.send(to, content, { type: input.type });
      if (status === "SKIPPED") {
        logger.info("Email skipped (not configured)", { type: input.type, to: maskEmail(to) });
      }
    } catch (err) {
      status = "FAILED";
      logger.error("Notification email failed", { type: input.type, notificationId, error: errMessage(err) });
    }

    if (!notificationId) return;
    try {
      await prisma.notification.update({ where: { id: notificationId }, data: { emailStatus: status } });
    } catch (err) {
      logger.warn("Could not record email status", { notificationId, error: errMessage(err) });
    }
  }

  /**
   * Email-only alert to every platform admin (admins are not users and have no
   * notification center). Used for work waiting in the admin console.
   */
  static async notifyAdmins(title: string, message: string, ctaPath = "/admin/dashboard"): Promise<void> {
    try {
      const admins = await prisma.admin.findMany({ select: { email: true, name: true } });
      const results = await Promise.allSettled(
        admins.map((a) =>
          EmailService.send(
            a.email,
            renderEmail({ title, message, recipientName: a.name, cta: { label: "Open admin console", url: `${appUrl}${ctaPath}` } }),
            { type: "ADMIN_ALERT" }
          )
        )
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed) logger.error("Admin alert email failed", { failed, total: admins.length });
    } catch (err) {
      logger.error("Admin alert failed", { error: errMessage(err) });
    }
  }

  // ── Notification center (always scoped to the caller) ──────────────────

  static async list(userId: string, page: Pagination, opts: { unreadOnly?: boolean } = {}) {
    const rows = await prisma.notification.findMany({
      where: { userId, ...(opts.unreadOnly ? { read: false } : {}) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...pageArgs(page),
    });
    const { items, nextCursor } = toPage(rows, page);
    return { items: items.map(toDto), nextCursor };
  }

  static async unreadCount(userId: string): Promise<number> {
    return prisma.notification.count({ where: { userId, read: false } });
  }

  /** Marks one of the caller's notifications read. 404 for anyone else's id. */
  static async markRead(userId: string, notificationId: string): Promise<NotificationDto> {
    const existing = await prisma.notification.findFirst({ where: { id: notificationId, userId } });
    if (!existing) throw notFound("Notification not found");

    const row = existing.read
      ? existing
      : await prisma.notification.update({ where: { id: existing.id }, data: { read: true, readAt: new Date() } });

    // Keep the user's other tabs/devices in sync
    emitToUser(userId, REALTIME_EVENTS.NOTIFICATION_READ, { ids: [row.id], all: false });
    return toDto(row);
  }

  static async markAllRead(userId: string): Promise<number> {
    const { count } = await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true, readAt: new Date() },
    });
    emitToUser(userId, REALTIME_EVENTS.NOTIFICATION_READ, { ids: [], all: true });
    return count;
  }
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
