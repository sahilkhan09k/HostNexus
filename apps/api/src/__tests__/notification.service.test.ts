/**
 * NotificationService: persistence, targeted realtime push, email policy,
 * failure isolation and per-user scoping of the notification center.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../config/database.js", () => ({
  prisma: {
    notification: {
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    user: { findUnique: vi.fn() },
    admin: { findMany: vi.fn() },
  },
}));

vi.mock("../services/notifications/realtime.service.js", () => ({
  emitToUser: vi.fn(),
  REALTIME_EVENTS: {
    NOTIFICATION_NEW: "notification:new",
    NOTIFICATION_READ: "notification:read",
    BOOKING_UPDATED: "booking:updated",
    NEGOTIATION_UPDATED: "negotiation:updated",
  },
}));

vi.mock("../services/notifications/email.service.js", () => ({
  EmailService: { send: vi.fn(), isEnabled: vi.fn(() => true) },
  maskEmail: (s: string) => s,
}));

import { prisma } from "../config/database.js";
import { NotificationService } from "../services/notifications/notification.service.js";
import { emitToUser } from "../services/notifications/realtime.service.js";
import { EmailService } from "../services/notifications/email.service.js";
import { HttpError } from "../utils/http-error.js";

const p = prisma as any;
const emit = emitToUser as unknown as ReturnType<typeof vi.fn>;
const send = EmailService.send as unknown as ReturnType<typeof vi.fn>;

/** Lets fire-and-forget email delivery finish */
const flush = () => new Promise((r) => setTimeout(r, 0));

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "n1",
    userId: "user-a",
    type: "BOOKING_REQUESTED",
    title: "New booking request",
    message: "Renter Co requested 2 × Chairs",
    data: { bookingId: "b1", link: "/dashboard/bookings?tab=incoming&booking=b1" },
    read: false,
    readAt: null,
    emailStatus: "PENDING",
    createdAt: new Date("2026-09-28T10:00:00Z"),
    updatedAt: new Date("2026-09-28T10:00:00Z"),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  p.notification.create.mockImplementation(async ({ data }: any) => row({ ...data }));
  p.notification.update.mockResolvedValue(row());
  p.user.findUnique.mockResolvedValue({ email: "owner@example.com", ownerName: "Asha" });
  send.mockResolvedValue("SENT");
});

describe("notify()", () => {
  it("persists, pushes to the recipient's room only, and emails important events", async () => {
    const dto = await NotificationService.notify({
      userId: "user-a",
      type: "BOOKING_REQUESTED",
      title: "New booking request",
      message: "Renter Co requested 2 × Chairs",
      data: { bookingId: "b1", link: "/dashboard/bookings?tab=incoming&booking=b1" },
    });
    await flush();

    expect(p.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "user-a", type: "BOOKING_REQUESTED", emailStatus: "PENDING" }),
    });
    expect(dto?.id).toBe("n1");
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith("user-a", "notification:new", expect.objectContaining({ toast: true }));

    expect(send).toHaveBeenCalledTimes(1);
    const [to, content] = send.mock.calls[0];
    expect(to).toBe("owner@example.com");
    expect(content.html).toContain("http://localhost:3000/dashboard/bookings?tab=incoming&amp;booking=b1");
    expect(p.notification.update).toHaveBeenCalledWith({ where: { id: "n1" }, data: { emailStatus: "SENT" } });
  });

  it("does not email in-app-only types and marks them NOT_REQUIRED", async () => {
    await NotificationService.notify({ userId: "user-a", type: "REVIEW_RECEIVED", title: "New review", message: "5/5" });
    await flush();
    expect(p.notification.create.mock.calls[0][0].data.emailStatus).toBe("NOT_REQUIRED");
    expect(send).not.toHaveBeenCalled();
  });

  it("sends silent (no toast) pushes for informational types", async () => {
    await NotificationService.notify({ userId: "user-a", type: "BOOKING_COMPLETED", title: "Done", message: "Done" });
    expect(emit).toHaveBeenCalledWith("user-a", "notification:new", expect.objectContaining({ toast: false }));
  });

  it("uses a known recipient address without a lookup", async () => {
    await NotificationService.notify({
      userId: "user-a", type: "BOOKING_ACCEPTED", title: "Accepted", message: "ok",
      email: { to: "known@example.com", recipientName: "Ravi" },
    });
    await flush();
    expect(p.user.findUnique).not.toHaveBeenCalled();
    expect(send.mock.calls[0][0]).toBe("known@example.com");
  });

  it("never throws when SMTP fails — the notification survives and the failure is recorded", async () => {
    send.mockRejectedValue(Object.assign(new Error("Greeting never received"), { code: "ETIMEDOUT" }));
    const dto = await NotificationService.notify({ userId: "user-a", type: "BOOKING_ACCEPTED", title: "Accepted", message: "ok" });
    await flush();
    expect(dto).not.toBeNull();
    expect(emit).toHaveBeenCalled();
    expect(p.notification.update).toHaveBeenCalledWith({ where: { id: "n1" }, data: { emailStatus: "FAILED" } });
  });

  it("records SKIPPED when email is not configured", async () => {
    send.mockResolvedValue("SKIPPED");
    await NotificationService.notify({ userId: "user-a", type: "BOOKING_ACCEPTED", title: "Accepted", message: "ok" });
    await flush();
    expect(p.notification.update).toHaveBeenCalledWith({ where: { id: "n1" }, data: { emailStatus: "SKIPPED" } });
  });

  it("never throws when the database insert fails, and still delivers the email", async () => {
    p.notification.create.mockRejectedValue(new Error("connection terminated"));
    const dto = await NotificationService.notify({ userId: "user-a", type: "BOOKING_ACCEPTED", title: "Accepted", message: "ok" });
    await flush();
    expect(dto).toBeNull();
    expect(emit).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["an unknown type", { type: "SPOOFED_TYPE" }],
    ["an absolute link (open redirect)", { data: { link: "https://evil.example/phish" } }],
    ["a protocol-relative link", { data: { link: "//evil.example" } }],
    ["unexpected data keys", { data: { bookingId: "b1", html: "<script>" } }],
    ["an empty title", { title: "  " }],
  ])("rejects %s without persisting or pushing", async (_label, override) => {
    const dto = await NotificationService.notify({
      userId: "user-a", type: "BOOKING_ACCEPTED", title: "Accepted", message: "ok", ...(override as object),
    } as any);
    expect(dto).toBeNull();
    expect(p.notification.create).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it("notifyMany isolates failures between recipients", async () => {
    p.notification.create
      .mockRejectedValueOnce(new Error("boom"))
      .mockImplementationOnce(async ({ data }: any) => row({ ...data, id: "n2" }));
    await NotificationService.notifyMany([
      { userId: "user-a", type: "DISPUTE_RESOLVED", title: "Resolved", message: "x" },
      { userId: "user-b", type: "DISPUTE_RESOLVED", title: "Resolved", message: "x" },
    ]);
    expect(emit).toHaveBeenCalledWith("user-b", "notification:new", expect.anything());
    expect(emit).not.toHaveBeenCalledWith("user-a", expect.anything(), expect.anything());
  });
});

describe("notification center scoping", () => {
  it("lists only the caller's notifications, newest first", async () => {
    p.notification.findMany.mockResolvedValue([row()]);
    const { items } = await NotificationService.list("user-a", { limit: 20 });
    expect(p.notification.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: "user-a" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 21,
    }));
    expect(items[0]).toMatchObject({ id: "n1", read: false, createdAt: "2026-09-28T10:00:00.000Z" });
  });

  it("filters unread when asked", async () => {
    p.notification.findMany.mockResolvedValue([]);
    await NotificationService.list("user-a", { limit: 20 }, { unreadOnly: true });
    expect(p.notification.findMany.mock.calls[0][0].where).toEqual({ userId: "user-a", read: false });
  });

  it("returns 404 when marking someone else's notification", async () => {
    p.notification.findFirst.mockResolvedValue(null);
    await expect(NotificationService.markRead("user-b", "n1")).rejects.toMatchObject({ statusCode: 404 });
    expect(p.notification.findFirst).toHaveBeenCalledWith({ where: { id: "n1", userId: "user-b" } });
    expect(p.notification.update).not.toHaveBeenCalled();
  });

  it("marks read, syncs other tabs, and is idempotent", async () => {
    p.notification.findFirst.mockResolvedValue(row());
    p.notification.update.mockResolvedValue(row({ read: true, readAt: new Date() }));
    const dto = await NotificationService.markRead("user-a", "n1");
    expect(dto.read).toBe(true);
    expect(emit).toHaveBeenCalledWith("user-a", "notification:read", { ids: ["n1"], all: false });

    p.notification.update.mockClear();
    p.notification.findFirst.mockResolvedValue(row({ read: true, readAt: new Date() }));
    await NotificationService.markRead("user-a", "n1");
    expect(p.notification.update).not.toHaveBeenCalled();
  });

  it("marks all of the caller's unread notifications", async () => {
    p.notification.updateMany.mockResolvedValue({ count: 3 });
    const count = await NotificationService.markAllRead("user-a");
    expect(count).toBe(3);
    expect(p.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-a", read: false },
      data: { read: true, readAt: expect.any(Date) },
    });
    expect(emit).toHaveBeenCalledWith("user-a", "notification:read", { ids: [], all: true });
  });

  it("markRead surfaces a typed HttpError", async () => {
    p.notification.findFirst.mockResolvedValue(null);
    await expect(NotificationService.markRead("user-a", "missing")).rejects.toBeInstanceOf(HttpError);
  });
});

describe("notifyAdmins()", () => {
  it("emails every admin and survives individual failures", async () => {
    p.admin.findMany.mockResolvedValue([{ email: "a1@x.com", name: "A1" }, { email: "a2@x.com", name: "A2" }]);
    send.mockRejectedValueOnce(new Error("mailbox full")).mockResolvedValueOnce("SENT");
    await expect(NotificationService.notifyAdmins("New KYC", "Review it")).resolves.toBeUndefined();
    expect(send).toHaveBeenCalledTimes(2);
  });
});
