import { io, type Socket } from "socket.io-client";
import type { RealtimeEvents } from "@hostnexus/types";
import { AuthService } from "./auth";
import { API_BASE_URL } from "./api-client";

export type RealtimeEventName = keyof RealtimeEvents;
export type RealtimeSocket = Socket<{ [K in RealtimeEventName]: (payload: RealtimeEvents[K]) => void }>;

/** Auth failures after which we stop retrying until the next page load / login */
const MAX_AUTH_FAILURES = 3;

/**
 * Creates the authenticated notification socket (not yet connected).
 *
 * - The access token is fetched fresh on every (re)connect via the `auth` callback,
 *   so expiry-driven server disconnects recover with a refreshed token.
 * - Server-initiated disconnects and auth errors are not retried by socket.io itself;
 *   we reconnect explicitly with backoff, and give up if the session is truly gone.
 */
export function createRealtimeSocket(onStatus?: (connected: boolean) => void): { socket: RealtimeSocket; dispose: () => void } {
  const socket: RealtimeSocket = io(API_BASE_URL, {
    path: "/socket.io",
    transports: ["websocket", "polling"],
    autoConnect: false,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 30_000,
    auth: (cb) => {
      AuthService.getValidAccessToken()
        .then((token) => cb({ token: token ?? "" }))
        .catch(() => cb({ token: "" }));
    },
  });

  let authFailures = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  const scheduleReconnect = (delayMs: number) => {
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = setTimeout(() => {
      retryTimer = null;
      if (!socket.connected && AuthService.getRefreshToken()) socket.connect();
    }, delayMs);
  };

  socket.on("connect", () => {
    authFailures = 0;
    onStatus?.(true);
  });

  socket.on("disconnect", (reason) => {
    onStatus?.(false);
    // Token expired / session revoked on the server: reconnect with a refreshed token
    if (reason === "io server disconnect") scheduleReconnect(500);
  });

  socket.on("connect_error", (err: Error & { data?: { code?: string } }) => {
    onStatus?.(false);
    const code = err.data?.code;
    if (code === "INVALID_TOKEN" || code === "SESSION_REVOKED" || code === "MISSING_TOKEN") {
      authFailures += 1;
      if (authFailures <= MAX_AUTH_FAILURES) scheduleReconnect(1_000 * 2 ** authFailures);
    } else if (!socket.active) {
      // Middleware rejected for another reason (e.g. AUTH_UNAVAILABLE) — try again later
      scheduleReconnect(10_000);
    }
  });

  return {
    socket,
    dispose() {
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = null;
      socket.removeAllListeners();
      socket.close();
    },
  };
}
