"use client";

import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, X } from "lucide-react";
import { useNotifications } from "@/contexts/notification-context";
import { notificationHref } from "@/lib/notifications";
import { NotificationIcon } from "./notification-icon";

const ACTION_LABELS: Record<string, string> = {
  BOOKING_REQUESTED: "View request",
  BOOKING_ACCEPTED: "Pay now",
  HANDOVER_STARTED: "Inspect now",
  RETURN_INITIATED: "Confirm receipt",
  DAMAGE_CLAIM_FILED: "Respond",
  NEGOTIATION_OFFER: "Respond to offer",
};

/** Realtime popups for incoming notifications (top-right, auto-dismissing). */
export function NotificationToasts() {
  const router = useRouter();
  const { toasts, dismissToast, markRead } = useNotifications();

  return (
    <div
      aria-live="polite"
      aria-relevant="additions"
      className="pointer-events-none fixed right-4 top-4 z-[60] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2"
    >
      <AnimatePresence initial={false}>
        {toasts.map(({ key, notification: n }) => {
          const href = notificationHref(n);
          return (
            <motion.div
              key={key}
              layout
              role="status"
              initial={{ opacity: 0, y: -12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 24, scale: 0.96 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-auto flex gap-3 rounded-2xl border border-stone-200 bg-white/95 p-4 shadow-lg backdrop-blur-md"
            >
              <NotificationIcon type={n.type} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-stone-900">{n.title}</p>
                <p className="mt-0.5 line-clamp-3 text-xs leading-relaxed text-stone-500">{n.message}</p>
                {href && (
                  <button
                    type="button"
                    onClick={() => {
                      void markRead(n.id);
                      dismissToast(key);
                      router.push(href);
                    }}
                    className="mt-2.5 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
                  >
                    {ACTION_LABELS[n.type] ?? "View"}
                    <ArrowRight className="h-3 w-3" />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismissToast(key)}
                className="-mr-1 -mt-1 h-6 w-6 shrink-0 rounded-full text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
                aria-label="Dismiss notification"
              >
                <X className="mx-auto h-3.5 w-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
