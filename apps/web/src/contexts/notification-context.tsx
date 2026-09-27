"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { AppNotification, RealtimeEvents } from "@hostnexus/types";
import { useAuth } from "@/contexts/auth-context";
import {
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications";
import { createRealtimeSocket, type RealtimeEventName } from "@/lib/realtime";

// ─── State ───────────────────────────────────────────────────────────────

export interface NotificationState {
  items: AppNotification[];
  unreadCount: number;
  nextCursor: string | null;
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  loadingMore: boolean;
}

export type NotificationAction =
  | { type: "LOADING" }
  | { type: "LOADED"; items: AppNotification[]; nextCursor: string | null; unreadCount: number }
  | { type: "LOADED_MORE"; items: AppNotification[]; nextCursor: string | null }
  | { type: "LOADING_MORE"; value: boolean }
  | { type: "ERROR"; error: string }
  | { type: "RECEIVED"; notification: AppNotification }
  | { type: "READ"; ids: string[]; all: boolean }
  | { type: "COUNT"; unreadCount: number }
  | { type: "RESET" };

export const initialNotificationState: NotificationState = {
  items: [],
  unreadCount: 0,
  nextCursor: null,
  status: "idle",
  error: null,
  loadingMore: false,
};

const MAX_ITEMS = 200;

export function notificationReducer(state: NotificationState, action: NotificationAction): NotificationState {
  switch (action.type) {
    case "LOADING":
      return { ...state, status: state.items.length ? state.status : "loading", error: null };
    case "LOADED":
      return { ...state, status: "ready", error: null, items: action.items, nextCursor: action.nextCursor, unreadCount: action.unreadCount };
    case "LOADING_MORE":
      return { ...state, loadingMore: action.value };
    case "LOADED_MORE": {
      const known = new Set(state.items.map((n) => n.id));
      return {
        ...state,
        loadingMore: false,
        items: [...state.items, ...action.items.filter((n) => !known.has(n.id))],
        nextCursor: action.nextCursor,
      };
    }
    case "ERROR":
      return { ...state, status: state.items.length ? "ready" : "error", error: action.error, loadingMore: false };
    case "RECEIVED": {
      // Duplicate delivery (reconnect, several tabs) must not double count
      if (state.items.some((n) => n.id === action.notification.id)) return state;
      return {
        ...state,
        items: [action.notification, ...state.items].slice(0, MAX_ITEMS),
        unreadCount: state.unreadCount + (action.notification.read ? 0 : 1),
      };
    }
    case "READ": {
      const now = new Date().toISOString();
      if (action.all) {
        return { ...state, unreadCount: 0, items: state.items.map((n) => (n.read ? n : { ...n, read: true, readAt: now })) };
      }
      const ids = new Set(action.ids);
      let flipped = 0;
      const items = state.items.map((n) => {
        if (!ids.has(n.id) || n.read) return n;
        flipped += 1;
        return { ...n, read: true, readAt: now };
      });
      return { ...state, items, unreadCount: Math.max(0, state.unreadCount - flipped) };
    }
    case "COUNT":
      return { ...state, unreadCount: action.unreadCount };
    case "RESET":
      return initialNotificationState;
  }
}

// ─── Context ─────────────────────────────────────────────────────────────

export interface ToastItem {
  key: string;
  notification: AppNotification;
}

type Listener<E extends RealtimeEventName> = (payload: RealtimeEvents[E]) => void;

interface NotificationContextValue extends NotificationState {
  connected: boolean;
  toasts: ToastItem[];
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  dismissToast: (key: string) => void;
  subscribe: <E extends RealtimeEventName>(event: E, listener: Listener<E>) => () => void;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

const TOAST_MS = 6_000;
const MAX_TOASTS = 3;
const PAGE_SIZE = 20;
/** Resync when the tab becomes visible again after this long (missed events while asleep) */
const STALE_MS = 30_000;

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const [state, dispatch] = useReducer(notificationReducer, initialNotificationState);
  const [connected, setConnected] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const listeners = useRef(new Map<RealtimeEventName, Set<(p: unknown) => void>>());
  const toastTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const lastSync = useRef(0);
  const cursorRef = useRef<string | null>(null);
  useEffect(() => {
    cursorRef.current = state.nextCursor;
  }, [state.nextCursor]);

  const refresh = useCallback(async () => {
    dispatch({ type: "LOADING" });
    try {
      const page = await fetchNotifications({ limit: PAGE_SIZE });
      lastSync.current = Date.now();
      dispatch({ type: "LOADED", items: page.notifications, nextCursor: page.nextCursor, unreadCount: page.unreadCount });
    } catch (err) {
      dispatch({ type: "ERROR", error: err instanceof Error ? err.message : "Failed to load notifications" });
    }
  }, []);

  const loadMore = useCallback(async () => {
    const cursor = cursorRef.current;
    if (!cursor) return;
    dispatch({ type: "LOADING_MORE", value: true });
    try {
      const page = await fetchNotifications({ cursor, limit: PAGE_SIZE });
      dispatch({ type: "LOADED_MORE", items: page.notifications, nextCursor: page.nextCursor });
    } catch (err) {
      dispatch({ type: "ERROR", error: err instanceof Error ? err.message : "Failed to load notifications" });
    }
  }, []);

  const syncCount = useCallback(async () => {
    try {
      dispatch({ type: "COUNT", unreadCount: await fetchUnreadCount() });
    } catch {
      // badge keeps its last known value
    }
  }, []);

  const dismissToast = useCallback((key: string) => {
    setToasts((prev) => prev.filter((t) => t.key !== key));
    const timer = toastTimers.current.get(key);
    if (timer) clearTimeout(timer);
    toastTimers.current.delete(key);
  }, []);

  const showToast = useCallback(
    (notification: AppNotification) => {
      const key = `${notification.id}-${Date.now()}`;
      // Oldest toasts make room for new ones; a timer firing for an already-dropped key is a no-op
      setToasts((prev) =>
        prev.some((t) => t.notification.id === notification.id) ? prev : [...prev, { key, notification }].slice(-MAX_TOASTS)
      );
      toastTimers.current.set(key, setTimeout(() => dismissToast(key), TOAST_MS));
    },
    [dismissToast]
  );

  const markRead = useCallback(async (id: string) => {
    dispatch({ type: "READ", ids: [id], all: false }); // optimistic
    try {
      await markNotificationRead(id);
    } catch {
      void syncCount(); // server is the source of truth
    }
  }, [syncCount]);

  const markAllRead = useCallback(async () => {
    dispatch({ type: "READ", ids: [], all: true });
    try {
      await markAllNotificationsRead();
    } catch {
      void refresh();
    }
  }, [refresh]);

  const subscribe = useCallback(<E extends RealtimeEventName>(event: E, listener: Listener<E>) => {
    const set = listeners.current.get(event) ?? new Set();
    set.add(listener as (p: unknown) => void);
    listeners.current.set(event, set);
    return () => {
      set.delete(listener as (p: unknown) => void);
    };
  }, []);

  // ── Socket lifecycle: one connection per signed-in user ────────────────
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    void refresh();
    const { socket, dispose } = createRealtimeSocket(setConnected);
    const fanOut = (event: RealtimeEventName, payload: unknown) =>
      listeners.current.get(event)?.forEach((fn) => {
        try {
          fn(payload);
        } catch (err) {
          console.error(`Realtime listener for ${event} failed`, err);
        }
      });

    let firstConnect = true;
    socket.on("connect", () => {
      // After a reconnect we may have missed events: resync from the server
      if (!firstConnect) void refresh();
      firstConnect = false;
    });

    socket.on("notification:new", (payload) => {
      if (!payload?.notification?.id) return;
      dispatch({ type: "RECEIVED", notification: payload.notification });
      if (payload.toast) showToast(payload.notification);
      fanOut("notification:new", payload);
    });

    socket.on("notification:read", (payload) => {
      dispatch({ type: "READ", ids: payload?.ids ?? [], all: Boolean(payload?.all) });
      // Ids outside the loaded page may have been unread too
      if (!payload?.all) void syncCount();
      fanOut("notification:read", payload);
    });

    socket.on("booking:updated", (payload) => fanOut("booking:updated", payload));
    socket.on("negotiation:updated", (payload) => fanOut("negotiation:updated", payload));

    socket.connect();

    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastSync.current > STALE_MS) void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    const timers = toastTimers.current;
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      dispose();
      setConnected(false);
      timers.forEach(clearTimeout);
      timers.clear();
      setToasts([]);
      dispatch({ type: "RESET" });
    };
  }, [isAuthenticated, user?.id, refresh, showToast, syncCount]);

  const value = useMemo<NotificationContextValue>(
    () => ({ ...state, connected, toasts, refresh, loadMore, markRead, markAllRead, dismissToast, subscribe }),
    [state, connected, toasts, refresh, loadMore, markRead, markAllRead, dismissToast, subscribe]
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within a NotificationProvider");
  return ctx;
}

/**
 * Runs `handler` for a realtime event (e.g. "booking:updated") while mounted.
 * The latest handler is always used, so it may read current component state.
 * Safe to call outside a NotificationProvider (does nothing).
 */
export function useRealtimeEvent<E extends RealtimeEventName>(event: E, handler: Listener<E>): void {
  const ctx = useContext(NotificationContext);
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  const subscribe = ctx?.subscribe;
  useEffect(() => {
    if (!subscribe) return;
    return subscribe(event, (payload) => ref.current(payload));
  }, [subscribe, event]);
}
