/**
 * End-to-end: real Express app + real Socket.IO server + socket.io-client, with
 * real signed JWTs and an in-memory notification table.
 * Covers REST authorization, WebSocket authentication, targeted delivery,
 * multiple tabs, cross-tab read sync, and reconnect after token expiry.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import type { AddressInfo } from "net";
import { createServer, type Server } from "http";
import jwt from "jsonwebtoken";
import { io as connect, type Socket as ClientSocket } from "socket.io-client";

const { store, users } = vi.hoisted(() => ({
  store: [] as any[],
  users: {
    "user-a": { verificationStatus: "VERIFIED", tokenVersion: 0, email: "a@example.com", ownerName: "A" },
    "user-b": { verificationStatus: "VERIFIED", tokenVersion: 0, email: "b@example.com", ownerName: "B" },
    "user-pending": { verificationStatus: "PENDING", tokenVersion: 0, email: "p@example.com", ownerName: "P" },
  } as Record<string, any>,
}));

vi.mock("../config/database.js", () => {
  let seq = 0;
  const matches = (n: any, where: any = {}) =>
    Object.entries(where).every(([k, v]) => n[k] === v);
  const notification = {
    create: vi.fn(async ({ data }: any) => {
      const now = new Date(Date.now() + seq);
      const row = { id: `n${++seq}`, read: false, readAt: null, emailStatus: "NOT_REQUIRED", createdAt: now, updatedAt: now, data: null, ...data };
      store.push(row);
      return row;
    }),
    findMany: vi.fn(async ({ where, take }: any) =>
      store.filter((n) => matches(n, where)).sort((a, b) => b.createdAt - a.createdAt).slice(0, take)
    ),
    findFirst: vi.fn(async ({ where }: any) => store.find((n) => matches(n, where)) ?? null),
    count: vi.fn(async ({ where }: any) => store.filter((n) => matches(n, where)).length),
    update: vi.fn(async ({ where, data }: any) => Object.assign(store.find((n) => n.id === where.id), data)),
    updateMany: vi.fn(async ({ where, data }: any) => {
      const rows = store.filter((n) => matches(n, where));
      rows.forEach((r) => Object.assign(r, data));
      return { count: rows.length };
    }),
  };
  const model = () => ({
    findUnique: vi.fn().mockResolvedValue(null), findFirst: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]), create: vi.fn(), update: vi.fn(),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }), count: vi.fn().mockResolvedValue(0),
  });
  return {
    prisma: {
      notification,
      user: { ...model(), findUnique: vi.fn(async ({ where }: any) => users[where.id] ?? null) },
      admin: model(), auditLog: model(), refreshToken: model(), bookingRequest: model(), resource: model(), upload: model(),
      $transaction: vi.fn(),
    },
    disconnectDatabase: vi.fn(),
  };
});

import { createApp } from "../app.js";
import { env } from "../config/env.js";
import { JWT_AUDIENCE, JWT_ISSUER } from "../services/auth.service.js";
import { NotificationService } from "../services/notifications/notification.service.js";
import { initRealtime, closeRealtime, getRealtimeServer } from "../services/notifications/realtime.service.js";

let server: Server;
let base: string;
const clients: ClientSocket[] = [];

function token(userId: string, opts: { expiresIn?: number; ver?: number; type?: string; secret?: string } = {}) {
  return jwt.sign(
    { sub: userId, type: opts.type ?? "access", ver: opts.ver ?? 0 },
    opts.secret ?? env.JWT_SECRET,
    { algorithm: "HS256", expiresIn: opts.expiresIn ?? 900, issuer: JWT_ISSUER, audience: JWT_AUDIENCE }
  );
}

const api = (path: string, userId?: string, init: RequestInit = {}) =>
  fetch(`${base}${path}`, {
    ...init,
    headers: { ...(userId ? { Authorization: `Bearer ${token(userId)}` } : {}), ...(init.headers ?? {}) },
  });

function socketFor(auth: Record<string, unknown> | ((cb: (d: object) => void) => void)): ClientSocket {
  const s = connect(base, { auth, transports: ["websocket"], reconnection: false, forceNew: true });
  clients.push(s);
  return s;
}

const connected = (s: ClientSocket) =>
  new Promise<void>((resolve, reject) => {
    s.once("connect", () => resolve());
    s.once("connect_error", reject);
  });

const connectError = (s: ClientSocket) =>
  new Promise<{ message: string; data?: { code: string } }>((resolve, reject) => {
    s.once("connect", () => reject(new Error("unexpectedly connected")));
    s.once("connect_error", (e: any) => resolve(e));
  });

const nextEvent = <T = any>(s: ClientSocket, event: string, ms = 1500) =>
  new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), ms);
    s.once(event, (payload: T) => { clearTimeout(t); resolve(payload); });
  });

const noEvent = (s: ClientSocket, event: string, ms = 300) =>
  new Promise<void>((resolve, reject) => {
    const handler = () => reject(new Error(`unexpected ${event}`));
    s.once(event, handler);
    setTimeout(() => { s.off(event, handler); resolve(); }, ms);
  });

beforeAll(async () => {
  server = createServer(createApp());
  initRealtime(server);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  clients.forEach((c) => c.close());
  await closeRealtime();
  await new Promise((r) => server.close(r));
});

beforeEach(() => {
  store.length = 0;
  clients.splice(0).forEach((c) => c.close());
});

async function seed(userId: string, title = "Hello") {
  return NotificationService.notify({ userId, type: "REVIEW_RECEIVED", title, message: "msg", data: { link: "/dashboard" } });
}

describe("REST /api/notifications", () => {
  it("requires authentication on every route", async () => {
    for (const [method, path] of [["GET", "/api/notifications"], ["GET", "/api/notifications/unread-count"],
      ["PATCH", "/api/notifications/read-all"], ["PATCH", "/api/notifications/n1/read"]]) {
      const res = await fetch(`${base}${path}`, { method });
      expect(res.status, `${method} ${path}`).toBe(401);
    }
  });

  it("rejects tokens from unverified accounts and forged tokens", async () => {
    const pending = await fetch(`${base}/api/notifications`, { headers: { Authorization: `Bearer ${token("user-pending")}` } });
    expect(pending.status).toBe(401);
    const forged = await fetch(`${base}/api/notifications`, { headers: { Authorization: `Bearer ${token("user-a", { secret: "x".repeat(40) })}` } });
    expect(forged.status).toBe(401);
  });

  it("lists only the caller's notifications with an unread count", async () => {
    await seed("user-a", "for A 1");
    await seed("user-a", "for A 2");
    await seed("user-b", "for B");

    const res = await api("/api/notifications", "user-a");
    const body: any = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.notifications.map((n: any) => n.title)).toEqual(["for A 2", "for A 1"]);
    expect(body.data.unreadCount).toBe(2);
    expect(JSON.stringify(body)).not.toContain("for B");
    expect(body.data.notifications[0]).not.toHaveProperty("userId");
    expect(body.data.notifications[0]).not.toHaveProperty("emailStatus");

    const count: any = await (await api("/api/notifications/unread-count", "user-b")).json();
    expect(count.data.unreadCount).toBe(1);
  });

  it("cannot mark another user's notification as read (404, unchanged)", async () => {
    const n = await seed("user-a");
    const res = await api(`/api/notifications/${n!.id}/read`, "user-b", { method: "PATCH" });
    expect(res.status).toBe(404);
    expect(store.find((r) => r.id === n!.id).read).toBe(false);
  });

  it("marks one, then all, of the caller's notifications as read", async () => {
    const n1 = await seed("user-a");
    await seed("user-a");
    await seed("user-b");

    const one = await api(`/api/notifications/${n1!.id}/read`, "user-a", { method: "PATCH" });
    expect(((await one.json()) as any).data.notification).toMatchObject({ id: n1!.id, read: true });

    const all: any = await (await api("/api/notifications/read-all", "user-a", { method: "PATCH" })).json();
    expect(all.data.updated).toBe(1);
    expect(store.filter((r) => r.userId === "user-b" && !r.read)).toHaveLength(1);
  });

  it("validates ids and pagination", async () => {
    expect((await api("/api/notifications/bad%20id!/read", "user-a", { method: "PATCH" })).status).toBe(400);
    expect((await api("/api/notifications?limit=100000", "user-a")).status).toBe(400);
  });

  it("offers no way for clients to create notifications", async () => {
    const res = await api("/api/notifications", "user-a", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "user-b", title: "spoof" }),
    });
    expect([404, 405]).toContain(res.status);
    expect(store).toHaveLength(0);
  });
});

describe("WebSocket", () => {
  it("rejects connections without a token, with a bad token, or for unverified users", async () => {
    expect((await connectError(socketFor({}))).data?.code).toBe("MISSING_TOKEN");
    expect((await connectError(socketFor({ token: "garbage" }))).data?.code).toBe("INVALID_TOKEN");
    expect((await connectError(socketFor({ token: token("user-a", { type: "refresh" }) }))).data?.code).toBe("INVALID_TOKEN");
    expect((await connectError(socketFor({ token: token("user-pending") }))).data?.code).toBe("SESSION_REVOKED");
    expect((await connectError(socketFor({ token: token("user-a", { ver: 7 }) }))).data?.code).toBe("SESSION_REVOKED");
  });

  it("ignores a client-supplied userId — identity comes only from the token", async () => {
    const s = socketFor({ token: token("user-b"), userId: "user-a" });
    await connected(s);
    const quiet = noEvent(s, "notification:new");
    await seed("user-a");
    await quiet;
  });

  it("delivers a new notification only to the recipient, on every tab, with toast policy", async () => {
    const a1 = socketFor({ token: token("user-a") });
    const a2 = socketFor({ token: token("user-a") });
    const b = socketFor({ token: token("user-b") });
    await Promise.all([connected(a1), connected(a2), connected(b)]);

    const got1 = nextEvent(a1, "notification:new");
    const got2 = nextEvent(a2, "notification:new");
    const quietB = noEvent(b, "notification:new");

    await NotificationService.notify({ userId: "user-a", type: "BOOKING_ACCEPTED", title: "Booking accepted", message: "Pay now" });

    const [p1, p2] = await Promise.all([got1, got2]);
    await quietB;
    expect(p1.notification).toMatchObject({ title: "Booking accepted", read: false });
    expect(p1.toast).toBe(true);
    expect(p2.notification.id).toBe(p1.notification.id);
  });

  it("syncs read state across the user's tabs", async () => {
    const tab1 = socketFor({ token: token("user-a") });
    const tab2 = socketFor({ token: token("user-a") });
    await Promise.all([connected(tab1), connected(tab2)]);
    const n = await seed("user-a");

    const read = nextEvent(tab2, "notification:read");
    await api(`/api/notifications/${n!.id}/read`, "user-a", { method: "PATCH" });
    expect(await read).toEqual({ ids: [n!.id], all: false });

    const readAll = nextEvent(tab1, "notification:read");
    await api("/api/notifications/read-all", "user-a", { method: "PATCH" });
    expect(await readAll).toEqual({ ids: [], all: true });
  });

  it("drops the socket when the access token expires, and reconnects with a fresh token", async () => {
    let calls = 0;
    const s = connect(base, {
      transports: ["websocket"],
      forceNew: true,
      reconnectionDelay: 50,
      reconnectionDelayMax: 100,
      // Called on every (re)connect, like the web client does with refreshed tokens
      auth: (cb) => cb({ token: token("user-a", { expiresIn: calls++ === 0 ? 1 : 900 }) }),
    });
    clients.push(s);
    await connected(s);

    const dropped = nextEvent<string>(s, "disconnect", 2500);
    expect(await dropped).toBe("io server disconnect");

    // Server-initiated disconnects are not retried automatically — the client reconnects explicitly
    s.connect();
    await connected(s);
    expect(calls).toBe(2);

    const got = nextEvent(s, "notification:new");
    await seed("user-a", "after reconnect");
    expect((await got).notification.title).toBe("after reconnect");
  });

  it("releases per-socket state on disconnect (no leaked rooms)", async () => {
    const s = socketFor({ token: token("user-b") });
    await connected(s);
    expect(getRealtimeServer()!.sockets.adapter.rooms.get("user:user-b")?.size).toBe(1);
    s.close();
    await new Promise((r) => setTimeout(r, 100));
    expect(getRealtimeServer()!.sockets.adapter.rooms.get("user:user-b")).toBeUndefined();
  });

  it("an offline user loses nothing — the notification is waiting in the list", async () => {
    await seed("user-b", "while offline");
    const body: any = await (await api("/api/notifications", "user-b")).json();
    expect(body.data.notifications[0].title).toBe("while offline");
  });
});
