"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2, LayoutDashboard, Package, CalendarDays,
  MessageSquare, BarChart3, Settings, LogOut,
  ChevronLeft, ChevronRight, Sparkles,
  Store,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { AuthService } from "@/lib/auth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

const NAV_ITEMS = [
  { href: "/dashboard",             icon: LayoutDashboard, label: "Overview" },
  { href: "/dashboard/inventory",   icon: Package,         label: "My Listings" },
  { href: "/dashboard/marketplace", icon: Store,           label: "Browse Resources" },
  { href: "/dashboard/bookings",    icon: CalendarDays,    label: "Bookings",    isBookings: true },
  { href: "/dashboard/messages",    icon: MessageSquare,   label: "Messages",    isMessages: true },
  { href: "/dashboard/ai-concierge", icon: Sparkles,        label: "AI Concierge" },
  { href: "/dashboard/analytics",   icon: BarChart3,       label: "Analytics" },
  { href: "/dashboard/settings",    icon: Settings,        label: "Settings" },
];

function usePendingBookings() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const token = AuthService.getToken();
    if (!token) return;

    const fetchPending = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/bookings?type=incoming`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        const bookings: { status: string }[] = data.data?.bookings ?? data.data ?? [];
        const pending = bookings.filter((b) => b.status === "pending").length;
        setCount(pending);
      } catch {
        // silently fail — badge just won't show
      }
    };

    fetchPending();
    // Refresh every 60 s while the sidebar is mounted
    const interval = setInterval(fetchPending, 60_000);
    return () => clearInterval(interval);
  }, []);

  return count;
}

function useUnreadMessages() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const token = AuthService.getToken();
    if (!token) return;

    const fetchUnread = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/messages/unread`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        setCount(data.data?.count ?? 0);
      } catch {
        // silently fail — badge just won't show
      }
    };

    fetchUnread();
    // Refresh every 30 s for a reasonably fresh unread count
    const interval = setInterval(fetchUnread, 30_000);
    return () => clearInterval(interval);
  }, []);

  return count;
}

export function DashboardSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { user, business, logout } = useAuth();
  const pendingBookings = usePendingBookings();
  const unreadMessages = useUnreadMessages();

  const avatarInitial = (business?.name ?? user?.email ?? "?")[0].toUpperCase();
  const displayName = business?.name ?? "Loading...";
  const displayEmail = user?.email ?? "";

  return (
    <aside className={cn(
      "flex h-full flex-col border-r border-stone-200 bg-white transition-all duration-300",
      collapsed ? "w-[68px]" : "w-60"
    )}>
      {/* Logo */}
      <div className={cn("flex items-center border-b border-stone-100 px-4 py-4", collapsed ? "justify-center" : "justify-between")}>
        {!collapsed && (
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600">
              <Building2 className="h-3.5 w-3.5 text-white" strokeWidth={2.2} />
            </div>
            <span className="font-display text-base font-bold tracking-tight text-stone-900">
              Host<span className="text-emerald-600">Nexus</span>
            </span>
          </Link>
        )}
        {collapsed && (
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600">
            <Building2 className="h-3.5 w-3.5 text-white" strokeWidth={2.2} />
          </div>
        )}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="hidden rounded-lg p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 lg:flex"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            const badge = item.isBookings && pendingBookings > 0
              ? pendingBookings
              : item.isMessages && unreadMessages > 0
              ? unreadMessages
              : null;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150",
                    active
                      ? "bg-emerald-50 text-emerald-700"
                      : "text-stone-500 hover:bg-stone-50 hover:text-stone-800",
                    collapsed && "justify-center px-2"
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className={cn("h-4 w-4 shrink-0", active ? "text-emerald-600" : "")} />
                  {!collapsed && (
                    <>
                      <span className="flex-1">{item.label}</span>
                      {badge !== null && (
                        <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                          {badge}
                        </span>
                      )}
                    </>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User section */}
      <div className="border-t border-stone-100 p-3">
        <div className={cn("flex items-center gap-3 rounded-xl p-2", collapsed && "justify-center")}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
            {avatarInitial}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-stone-800">{displayName}</p>
              <p className="truncate text-[10px] text-stone-400">{displayEmail}</p>
            </div>
          )}
          {!collapsed && (
            <button
              type="button"
              onClick={logout}
              className="text-stone-400 hover:text-stone-600 transition-colors"
              aria-label="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
