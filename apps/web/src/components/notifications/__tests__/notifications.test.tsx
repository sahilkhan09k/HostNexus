import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AppNotification } from "@hostnexus/types";

// ── Mocks ────────────────────────────────────────────────────────────────

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace }) }));

vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ isAuthenticated: true, user: { id: "user-a" } }),
}));

const api = vi.hoisted(() => ({
  fetchNotifications: vi.fn(),
  fetchUnreadCount: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}));
vi.mock("@/lib/notifications", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/notifications")>()),
  ...api,
}));

/** Scriptable stand-in for the Socket.IO client */
const fake = vi.hoisted(() => {
  const handlers = new Map<string, Array<(p?: unknown) => void>>();
  let onStatus: ((c: boolean) => void) | undefined;
  const socket = {
    on: (event: string, fn: (p?: unknown) => void) => {
      handlers.set(event, [...(handlers.get(event) ?? []), fn]);
      return socket;
    },
    connect: () => {
      onStatus?.(true);
      handlers.get("connect")?.forEach((fn) => fn());
    },
  };
  return {
    handlers,
    socket,
    dispose: vi.fn(),
    setStatus: (fn?: (c: boolean) => void) => (onStatus = fn),
    serverEmit: (event: string, payload?: unknown) => handlers.get(event)?.forEach((fn) => fn(payload)),
  };
});
vi.mock("@/lib/realtime", () => ({
  createRealtimeSocket: (onStatus?: (c: boolean) => void) => {
    fake.setStatus(onStatus);
    return { socket: fake.socket, dispose: fake.dispose };
  },
}));

import { NotificationProvider, notificationReducer, initialNotificationState, useRealtimeEvent } from "@/contexts/notification-context";
import { NotificationCenter } from "../notification-center";
import { NotificationToasts } from "../notification-toasts";
import { notificationHref, timeAgo } from "@/lib/notifications";

// ── Helpers ──────────────────────────────────────────────────────────────

function n(overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id: "n1",
    type: "BOOKING_REQUESTED",
    title: "New booking request",
    message: "Event Co requested 40 × Banquet Chairs",
    data: { bookingId: "b1", link: "/dashboard/bookings?tab=incoming&booking=b1" },
    read: false,
    readAt: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function page(items: AppNotification[], unreadCount = items.filter((i) => !i.read).length, nextCursor: string | null = null) {
  return { notifications: items, count: items.length, nextCursor, unreadCount };
}

function renderUi() {
  return render(
    <NotificationProvider>
      <NotificationCenter />
      <NotificationToasts />
    </NotificationProvider>
  );
}

const bell = () => screen.getByRole("button", { name: /notifications/i });
const openPanel = async () => {
  await userEvent.click(bell());
  return screen.findByRole("dialog", { name: "Notifications" });
};

beforeEach(() => {
  vi.clearAllMocks();
  fake.handlers.clear();
  api.fetchNotifications.mockResolvedValue(page([]));
  api.fetchUnreadCount.mockResolvedValue(0);
  api.markNotificationRead.mockImplementation(async (id: string) => n({ id, read: true }));
  api.markAllNotificationsRead.mockResolvedValue(0);
});

// ── Notification center ──────────────────────────────────────────────────

describe("NotificationCenter", () => {
  it("shows a loading state, then the empty state", async () => {
    let resolve!: (v: unknown) => void;
    api.fetchNotifications.mockReturnValue(new Promise((r) => (resolve = r)));
    renderUi();
    const panel = await openPanel();
    expect(within(panel).getAllByTestId("notification-skeleton")).toHaveLength(3);

    await act(async () => resolve(page([])));
    expect(await within(panel).findByText("You're all caught up")).toBeInTheDocument();
    expect(screen.queryByTestId("notification-badge")).not.toBeInTheDocument();
  });

  it("shows an error state with retry", async () => {
    api.fetchNotifications.mockRejectedValueOnce(new Error("Network down")).mockResolvedValueOnce(page([n()]));
    renderUi();
    const panel = await openPanel();
    expect(await within(panel).findByText("Network down")).toBeInTheDocument();

    await userEvent.click(within(panel).getByRole("button", { name: /try again/i }));
    expect(await within(panel).findByText("New booking request")).toBeInTheDocument();
  });

  it("renders the list with unread badge and unread markers", async () => {
    api.fetchNotifications.mockResolvedValue(page([n(), n({ id: "n2", title: "Offer accepted", type: "NEGOTIATION_ACCEPTED", read: true })]));
    renderUi();
    expect(await screen.findByTestId("notification-badge")).toHaveTextContent("1");
    expect(bell()).toHaveAccessibleName("Notifications, 1 unread");

    const panel = await openPanel();
    expect(within(panel).getByText("New booking request")).toBeInTheDocument();
    expect(within(panel).getByText("Offer accepted")).toBeInTheDocument();
    expect(within(panel).getAllByLabelText("Unread")).toHaveLength(1);
  });

  it("caps the badge at 99+", async () => {
    api.fetchNotifications.mockResolvedValue(page([n()], 250));
    renderUi();
    expect(await screen.findByTestId("notification-badge")).toHaveTextContent("99+");
  });

  it("clicking a notification marks it read and opens the related page", async () => {
    api.fetchNotifications.mockResolvedValue(page([n()]));
    renderUi();
    const panel = await openPanel();
    await userEvent.click(await within(panel).findByText("New booking request"));

    expect(api.markNotificationRead).toHaveBeenCalledWith("n1");
    expect(push).toHaveBeenCalledWith("/dashboard/bookings?tab=incoming&booking=b1");
    await waitFor(() => expect(screen.queryByTestId("notification-badge")).not.toBeInTheDocument());
  });

  it("never navigates to an external link", async () => {
    api.fetchNotifications.mockResolvedValue(page([n({ data: { link: "https://evil.example" } })]));
    renderUi();
    const panel = await openPanel();
    await userEvent.click(await within(panel).findByText("New booking request"));
    expect(push).not.toHaveBeenCalled();
  });

  it("mark all as read clears the badge", async () => {
    api.fetchNotifications.mockResolvedValue(page([n(), n({ id: "n2" })]));
    renderUi();
    expect(await screen.findByTestId("notification-badge")).toHaveTextContent("2");
    const panel = await openPanel();
    await userEvent.click(within(panel).getByRole("button", { name: /mark all as read/i }));
    expect(api.markAllNotificationsRead).toHaveBeenCalled();
    expect(screen.queryByTestId("notification-badge")).not.toBeInTheDocument();
    expect(within(panel).queryAllByLabelText("Unread")).toHaveLength(0);
  });

  it("loads older notifications with the cursor", async () => {
    api.fetchNotifications
      .mockResolvedValueOnce(page([n()], 1, "n1"))
      .mockResolvedValueOnce(page([n({ id: "n0", title: "Older one", read: true })], 1, null));
    renderUi();
    const panel = await openPanel();
    await userEvent.click(await within(panel).findByRole("button", { name: /load older/i }));
    expect(api.fetchNotifications).toHaveBeenLastCalledWith({ cursor: "n1", limit: 20 });
    expect(await within(panel).findByText("Older one")).toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: /load older/i })).not.toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    renderUi();
    await openPanel();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});

// ── Realtime ─────────────────────────────────────────────────────────────

describe("realtime delivery", () => {
  it("a pushed notification updates the badge, list and shows a toast", async () => {
    renderUi();
    await waitFor(() => expect(api.fetchNotifications).toHaveBeenCalled());

    act(() => fake.serverEmit("notification:new", { notification: n({ id: "live-1", title: "Booking accepted", type: "BOOKING_ACCEPTED" }), toast: true }));

    expect(await screen.findByTestId("notification-badge")).toHaveTextContent("1");
    const toast = await screen.findByRole("status");
    expect(within(toast).getByText("Booking accepted")).toBeInTheDocument();
    expect(within(toast).getByRole("button", { name: /pay now/i })).toBeInTheDocument();

    const panel = await openPanel();
    expect(within(panel).getByText("Booking accepted")).toBeInTheDocument();
  });

  it("the toast action marks read and navigates", async () => {
    renderUi();
    await waitFor(() => expect(api.fetchNotifications).toHaveBeenCalled());
    act(() => fake.serverEmit("notification:new", { notification: n({ id: "live-2" }), toast: true }));

    await userEvent.click(await screen.findByRole("button", { name: /view request/i }));
    expect(api.markNotificationRead).toHaveBeenCalledWith("live-2");
    expect(push).toHaveBeenCalledWith("/dashboard/bookings?tab=incoming&booking=b1");
  });

  it("toasts can be dismissed", async () => {
    renderUi();
    await waitFor(() => expect(api.fetchNotifications).toHaveBeenCalled());
    act(() => fake.serverEmit("notification:new", { notification: n({ id: "live-3" }), toast: true }));
    await userEvent.click(await screen.findByRole("button", { name: /dismiss notification/i }));
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  });

  it("silent notifications update the badge without a popup", async () => {
    renderUi();
    await waitFor(() => expect(api.fetchNotifications).toHaveBeenCalled());
    act(() => fake.serverEmit("notification:new", { notification: n({ id: "quiet", type: "BOOKING_COMPLETED" }), toast: false }));
    expect(await screen.findByTestId("notification-badge")).toHaveTextContent("1");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("duplicate deliveries are counted once", async () => {
    renderUi();
    await waitFor(() => expect(api.fetchNotifications).toHaveBeenCalled());
    act(() => {
      fake.serverEmit("notification:new", { notification: n({ id: "dup" }), toast: false });
      fake.serverEmit("notification:new", { notification: n({ id: "dup" }), toast: false });
    });
    expect(await screen.findByTestId("notification-badge")).toHaveTextContent("1");
  });

  it("read events from another tab update this tab", async () => {
    api.fetchNotifications.mockResolvedValue(page([n(), n({ id: "n2" })]));
    api.fetchUnreadCount.mockResolvedValue(1);
    renderUi();
    expect(await screen.findByTestId("notification-badge")).toHaveTextContent("2");

    act(() => fake.serverEmit("notification:read", { ids: ["n1"], all: false }));
    await waitFor(() => expect(screen.getByTestId("notification-badge")).toHaveTextContent("1"));

    act(() => fake.serverEmit("notification:read", { ids: [], all: true }));
    await waitFor(() => expect(screen.queryByTestId("notification-badge")).not.toBeInTheDocument());
  });

  it("resyncs from the server after a reconnect", async () => {
    renderUi();
    await waitFor(() => expect(api.fetchNotifications).toHaveBeenCalledTimes(1));
    act(() => fake.serverEmit("connect"));
    await waitFor(() => expect(api.fetchNotifications).toHaveBeenCalledTimes(2));
  });

  it("forwards domain events to subscribers", async () => {
    const onBooking = vi.fn();
    function Listener() {
      useRealtimeEvent("booking:updated", onBooking);
      return null;
    }
    render(
      <NotificationProvider>
        <Listener />
      </NotificationProvider>
    );
    await waitFor(() => expect(api.fetchNotifications).toHaveBeenCalled());
    act(() => fake.serverEmit("booking:updated", { bookingId: "b1", event: "ACCEPTED" }));
    expect(onBooking).toHaveBeenCalledWith({ bookingId: "b1", event: "ACCEPTED" });
  });

  it("closes the socket on unmount (logout)", async () => {
    const { unmount } = renderUi();
    await waitFor(() => expect(api.fetchNotifications).toHaveBeenCalled());
    unmount();
    expect(fake.dispose).toHaveBeenCalled();
  });
});

// ── Pure helpers ─────────────────────────────────────────────────────────

describe("notificationReducer", () => {
  const loaded = notificationReducer(initialNotificationState, {
    type: "LOADED", items: [n(), n({ id: "n2", read: true })], nextCursor: null, unreadCount: 1,
  });

  it("never lets the count go negative or double-decrement", () => {
    const once = notificationReducer(loaded, { type: "READ", ids: ["n1"], all: false });
    const twice = notificationReducer(once, { type: "READ", ids: ["n1", "n2"], all: false });
    expect(once.unreadCount).toBe(0);
    expect(twice.unreadCount).toBe(0);
  });

  it("keeps an error but shows existing items", () => {
    const s = notificationReducer(loaded, { type: "ERROR", error: "boom" });
    expect(s.status).toBe("ready");
    expect(s.error).toBe("boom");
  });

  it("dedupes load-more pages", () => {
    const s = notificationReducer(loaded, { type: "LOADED_MORE", items: [n({ id: "n2" }), n({ id: "n3" })], nextCursor: null });
    expect(s.items.map((i) => i.id)).toEqual(["n1", "n2", "n3"]);
  });
});

describe("notificationHref", () => {
  it.each([
    [{ link: "/dashboard/bookings?booking=b1" }, "/dashboard/bookings?booking=b1"],
    [{ link: "https://evil.example" }, null],
    [{ link: "//evil.example" }, null],
    [{ link: "/\\evil.example" }, null],
    [{ link: "javascript:alert(1)" }, null],
    [{ bookingId: "b 1" }, "/dashboard/bookings?booking=b%201"],
    [null, null],
  ])("%o → %s", (data, expected) => {
    expect(notificationHref({ data: data as AppNotification["data"] })).toBe(expected);
  });
});

describe("timeAgo", () => {
  const now = Date.parse("2026-09-28T12:00:00Z");
  it.each([
    ["2026-09-28T11:59:50Z", "just now"],
    ["2026-09-28T11:55:00Z", "5m ago"],
    ["2026-09-28T09:00:00Z", "3h ago"],
    ["2026-09-26T12:00:00Z", "2d ago"],
  ])("%s → %s", (iso, expected) => {
    expect(timeAgo(iso, now)).toBe(expected);
  });
});
