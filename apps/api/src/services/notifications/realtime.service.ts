import type { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
import { Server, type Socket } from "socket.io";
import { allowedOrigins } from "../../config/env.js";
import { AuthService } from "../auth.service.js";
import { logger } from "../../utils/logger.js";

/**
 * Authenticated Socket.IO server for targeted, per-user pushes.
 *
 * - Clients authenticate with their access token in the handshake `auth` payload
 *   (never the query string, which ends up in proxy logs). Identity always comes from
 *   the verified token — clients cannot name a user id.
 * - Each socket joins `user:<id>`; all tabs/devices of a user share that room.
 * - Sockets are dropped when their access token expires; the client reconnects with
 *   a fresh one. So revoked sessions lose realtime access within the token lifetime.
 * - Clients never send events we act on; the server only emits.
 *
 * Scaling: with more than one API instance, add @socket.io/redis-adapter so emits
 * reach users connected to other instances.
 */

export const REALTIME_EVENTS = {
  NOTIFICATION_NEW: "notification:new",
  NOTIFICATION_READ: "notification:read",
  BOOKING_UPDATED: "booking:updated",
  NEGOTIATION_UPDATED: "negotiation:updated",
} as const;

export type RealtimeEvent = (typeof REALTIME_EVENTS)[keyof typeof REALTIME_EVENTS];

/** Upper bound on simultaneous sockets per user (tabs + devices) */
export const MAX_SOCKETS_PER_USER = 20;

let io: Server | null = null;
const expiryTimers = new Map<string, NodeJS.Timeout>();

export const userRoom = (userId: string) => `user:${userId}`;

interface SocketData {
  userId: string;
}

async function authenticateSocket(socket: Socket, next: (err?: Error) => void): Promise<void> {
  const token = (socket.handshake.auth as { token?: unknown } | undefined)?.token;
  if (typeof token !== "string" || token.length === 0 || token.length > 4096) {
    next(authError("MISSING_TOKEN"));
    return;
  }

  try {
    // Same checks as the REST `authenticate` middleware: signature, claims, VERIFIED account, not revoked
    const payload = await AuthService.verifyAccessToken(token);

    const room = io?.sockets.adapter.rooms.get(userRoom(payload.sub));
    if (room && room.size >= MAX_SOCKETS_PER_USER) {
      next(authError("TOO_MANY_CONNECTIONS"));
      return;
    }

    (socket.data as SocketData).userId = payload.sub;

    // jwt.verify already passed; decode only to read `exp` for the disconnect timer
    const exp = (jwt.decode(token) as { exp?: number } | null)?.exp;
    if (exp) {
      const ms = exp * 1000 - Date.now();
      // setTimeout overflows above ~24.8 days; access tokens live 15 minutes
      const timer = setTimeout(() => socket.disconnect(true), Math.max(0, Math.min(ms, 2 ** 31 - 1)));
      timer.unref();
      expiryTimers.set(socket.id, timer);
    }
    next();
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "INVALID_TOKEN" || code === "SESSION_REVOKED") {
      next(authError(code));
      return;
    }
    logger.error("Socket authentication error", { error: err instanceof Error ? err.message : String(err) });
    next(authError("AUTH_UNAVAILABLE"));
  }
}

/** Errors passed to next() are sent to the client as `connect_error` with this message + data. */
function authError(code: string): Error & { data: { code: string } } {
  const err = new Error("Unauthorized") as Error & { data: { code: string } };
  err.data = { code };
  return err;
}

function onConnection(socket: Socket): void {
  const { userId } = socket.data as SocketData;
  void socket.join(userRoom(userId));

  socket.on("disconnect", () => {
    const timer = expiryTimers.get(socket.id);
    if (timer) clearTimeout(timer);
    expiryTimers.delete(socket.id);
  });
}

export function initRealtime(httpServer: HttpServer): Server {
  if (io) return io;

  io = new Server(httpServer, {
    path: "/socket.io",
    cors: {
      origin: (origin, callback) => callback(null, !origin || allowedOrigins.includes(origin)),
      credentials: false, // Bearer token in the handshake, no cookies
    },
    // The server only pushes; clients have nothing large to send
    maxHttpBufferSize: 10_000,
    connectTimeout: 10_000,
    pingInterval: 25_000,
    pingTimeout: 20_000,
    serveClient: false,
  });

  io.use((socket, next) => void authenticateSocket(socket, next));
  io.on("connection", onConnection);

  logger.info("Realtime server ready", { path: "/socket.io" });
  return io;
}

/**
 * Pushes an event to every connected socket of one user. A no-op when the realtime
 * server isn't running (tests, scripts) or the user is offline — the notification
 * is still in the database and loads on their next visit.
 */
export function emitToUser(userId: string, event: RealtimeEvent, payload: unknown): void {
  if (!io) return;
  try {
    io.to(userRoom(userId)).emit(event, payload);
  } catch (err) {
    logger.error("Realtime emit failed", { event, error: err instanceof Error ? err.message : String(err) });
  }
}

/** Force-closes a user's sockets, e.g. after an admin rejects the account. */
export function disconnectUser(userId: string): void {
  io?.in(userRoom(userId)).disconnectSockets(true);
}

export async function closeRealtime(): Promise<void> {
  if (!io) return;
  const server = io;
  io = null;
  for (const timer of expiryTimers.values()) clearTimeout(timer);
  expiryTimers.clear();
  // Closes the sockets only; the HTTP server is closed by the caller
  server.disconnectSockets(true);
  server.removeAllListeners();
}

/** Test helper */
export function getRealtimeServer(): Server | null {
  return io;
}
