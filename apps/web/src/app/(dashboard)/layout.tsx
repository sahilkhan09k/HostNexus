import type { Metadata } from "next";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { Bell, Search } from "lucide-react";

export const metadata: Metadata = {
  title: "Dashboard — HostNexus",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-[#FAFAF9]">
      <DashboardSidebar />
      
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-16 items-center justify-between border-b border-stone-200 bg-white px-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              type="search"
              placeholder="Search resources, bookings, messages..."
              className="w-full rounded-xl border border-stone-200 bg-stone-50 py-2 pl-10 pr-4 text-sm text-stone-800 placeholder:text-stone-400 focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
            />
          </div>
          
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-stone-200 text-stone-400 transition-colors hover:bg-stone-50 hover:text-stone-600"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-[9px] font-bold text-white">
                3
              </span>
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
