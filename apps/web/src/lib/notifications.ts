import { AuthService } from "./auth";
import { API_BASE_URL } from "./api-client";
import type { AppNotification, NotificationListResponse } from "@hostnexus/types";

// ─────────────────────────────────────────
// Notification center REST calls
// ─────────────────────────────────────────

async function unwrap<T>(res: Response, fallback: string): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || fallback);
  }
  const body = await res.json();
  return body.data as T;
}

export async function fetchNotifications(opts: { cursor?: string | null; limit?: number } = {}): Promise<NotificationListResponse> {
  const params = new URLSearchParams({ limit: String(opts.limit ?? 20) });
  if (opts.cursor) params.set("cursor", opts.cursor);
  const res = await AuthService.fetchWithAuth(`${API_BASE_URL}/api/notifications?${params.toString()}`);
  return unwrap<NotificationListResponse>(res, "Failed to load notifications");
}

export async function fetchUnreadCount(): Promise<number> {
  const res = await AuthService.fetchWithAuth(`${API_BASE_URL}/api/notifications/unread-count`);
  return (await unwrap<{ unreadCount: number }>(res, "Failed to load notifications")).unreadCount;
}

export async function markNotificationRead(id: string): Promise<AppNotification> {
  const res = await AuthService.fetchWithAuth(`${API_BASE_URL}/api/notifications/${encodeURIComponent(id)}/read`, {
    method: "PATCH",
  });
  return (await unwrap<{ notification: AppNotification }>(res, "Failed to update notification")).notification;
}

export async function markAllNotificationsRead(): Promise<number> {
  const res = await AuthService.fetchWithAuth(`${API_BASE_URL}/api/notifications/read-all`, { method: "PATCH" });
  return (await unwrap<{ updated: number }>(res, "Failed to update notifications")).updated;
}

/**
 * Where clicking a notification should go. Only app-relative paths are followed —
 * never absolute or protocol-relative URLs — so a notification can't become an open redirect.
 */
export function notificationHref(n: Pick<AppNotification, "data">): string | null {
  const link = n.data?.link;
  if (typeof link === "string" && /^\/(?!\/)/.test(link) && !link.includes("\\")) return link;
  if (n.data?.bookingId) return `/dashboard/bookings?booking=${encodeURIComponent(n.data.bookingId)}`;
  return null;
}

/** "just now", "5m ago", "3h ago", "2d ago", then a date */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const s = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  if (s < 7 * 86400) return `${Math.round(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
