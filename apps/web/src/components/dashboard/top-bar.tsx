"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Bell, Search } from "lucide-react";
import { AuthService } from "@/lib/auth";
import { cn } from "@/lib/utils";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export function TopBar() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingCount, setPendingCount] = useState(0);

  const fetchPendingCount = useCallback(async () => {
    const token = AuthService.getToken();
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/bookings?type=incoming`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      // Count bookings with status PENDING
      const bookings: { status: string }[] = data?.data?.bookings ?? data?.data ?? [];
      const pending = Array.isArray(bookings)
        ? bookings.filter((b) => b.status === "PENDING").length
        : 0;
      setPendingCount(pending);
    } catch {
      // silently ignore — badge simply won't show
    }
  }, []);

  useEffect(() => {
    fetchPendingCount();
  }, [fetchPendingCount]);

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && searchQuery.trim()) {
      router.push(`/dashboard/marketplace?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-stone-200 bg-white px-6">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          placeholder="Search resources, bookings, messages..."
          className={cn(
            "w-full rounded-xl border border-stone-200 bg-stone-50 py-2 pl-10 pr-4",
            "text-sm text-stone-800 placeholder:text-stone-400",
            "focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20",
            "transition-all"
          )}
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          className={cn(
            "relative flex h-9 w-9 items-center justify-center rounded-xl",
            "border border-stone-200 text-stone-400",
            "transition-colors hover:bg-stone-50 hover:text-stone-600"
          )}
          aria-label={pendingCount > 0 ? `${pendingCount} pending notifications` : "Notifications"}
        >
          <Bell className="h-4 w-4" />
          {pendingCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-[9px] font-bold text-white">
              {pendingCount > 99 ? "99+" : pendingCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
