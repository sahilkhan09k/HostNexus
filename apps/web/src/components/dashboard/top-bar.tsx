"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { NotificationCenter } from "@/components/notifications/notification-center";

export function TopBar() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

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
            "w-full rounded-full border border-stone-200 bg-stone-50 py-2.5 pl-10 pr-4",
            "text-sm text-stone-800 placeholder:text-stone-400",
            "focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-[3px] focus:ring-emerald-500/35",
            "transition-all"
          )}
        />
      </div>

      <div className="flex items-center gap-3">
        <NotificationCenter />
      </div>
    </header>
  );
}
