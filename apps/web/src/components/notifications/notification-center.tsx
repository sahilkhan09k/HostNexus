"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Loader2, RefreshCw } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { AppNotification } from "@hostnexus/types";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/contexts/notification-context";
import { notificationHref, timeAgo } from "@/lib/notifications";
import { NotificationIcon } from "./notification-icon";

/** Bell button with unread badge + dropdown notification center (top bar). */
export function NotificationCenter() {
  const router = useRouter();
  const {
    items, unreadCount, status, error, nextCursor, loadingMore, connected,
    refresh, loadMore, markRead, markAllRead,
  } = useNotifications();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const openItem = (n: AppNotification) => {
    if (!n.read) void markRead(n.id);
    const href = notificationHref(n);
    setOpen(false);
    if (href) router.push(href);
  };

  const badge = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        className={cn(
          "relative flex h-9 w-9 items-center justify-center rounded-full",
          "border border-stone-200 text-stone-500",
          "transition-colors hover:bg-stone-50 hover:text-stone-700",
          "focus:outline-none focus-visible:ring-[3px] focus-visible:ring-emerald-500/35",
          open && "bg-stone-50 text-stone-700"
        )}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span
            data-testid="notification-badge"
            className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-600 px-1 text-[9px] font-bold text-white"
          >
            {badge}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Notifications"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 top-11 z-50 flex max-h-[min(560px,calc(100vh-6rem))] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-stone-900">Notifications</h2>
                {!connected && status === "ready" && (
                  <p className="text-[11px] text-stone-400">Live updates paused — reconnecting…</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => void markAllRead()}
                disabled={unreadCount === 0}
                className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-50 disabled:cursor-default disabled:text-stone-300 disabled:hover:bg-transparent"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all as read
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" data-lenis-prevent>
              {status === "loading" || status === "idle" ? (
                <ul aria-label="Loading notifications" className="divide-y divide-stone-100">
                  {[0, 1, 2].map((i) => (
                    <li key={i} className="flex gap-3 px-4 py-3.5" data-testid="notification-skeleton">
                      <div className="h-9 w-9 animate-pulse rounded-full bg-stone-100" />
                      <div className="flex-1 space-y-2 pt-1">
                        <div className="h-3 w-2/3 animate-pulse rounded bg-stone-100" />
                        <div className="h-3 w-full animate-pulse rounded bg-stone-100" />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : status === "error" ? (
                <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
                  <p className="text-sm text-stone-500">{error ?? "Couldn't load notifications."}</p>
                  <button
                    type="button"
                    onClick={() => void refresh()}
                    className="flex items-center gap-1.5 rounded-full border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Try again
                  </button>
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-stone-100 text-stone-400">
                    <Bell className="h-5 w-5" />
                  </span>
                  <p className="text-sm font-medium text-stone-700">You&apos;re all caught up</p>
                  <p className="text-xs text-stone-400">Booking requests, offers and updates will appear here.</p>
                </div>
              ) : (
                <ul className="divide-y divide-stone-100">
                  {items.map((n) => (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => openItem(n)}
                        className={cn(
                          "flex w-full gap-3 px-4 py-3.5 text-left transition-colors hover:bg-stone-50 focus:bg-stone-50 focus:outline-none",
                          !n.read && "bg-emerald-50/40"
                        )}
                      >
                        <NotificationIcon type={n.type} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-start justify-between gap-2">
                            <span className={cn("text-sm text-stone-900", !n.read ? "font-semibold" : "font-medium")}>{n.title}</span>
                            <time dateTime={n.createdAt} className="shrink-0 pt-0.5 text-[11px] text-stone-400">{timeAgo(n.createdAt)}</time>
                          </span>
                          <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-stone-500">{n.message}</span>
                        </span>
                        {!n.read && (
                          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-label="Unread" />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {status === "ready" && error && items.length > 0 && (
                <p className="px-4 py-2 text-center text-xs text-rose-600">{error}</p>
              )}

              {nextCursor && status === "ready" && (
                <div className="border-t border-stone-100 p-2">
                  <button
                    type="button"
                    onClick={() => void loadMore()}
                    disabled={loadingMore}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:text-stone-400"
                  >
                    {loadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {loadingMore ? "Loading…" : "Load older notifications"}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
