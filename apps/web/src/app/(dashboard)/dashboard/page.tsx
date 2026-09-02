"use client";

import { useEffect, useState } from "react";
import { Package, Calendar, Clock, ShoppingBag, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { StatCard } from "@/components/dashboard/stat-card";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface DashboardStats {
  listedResources: number;
  incomingBookings: number;
  pendingRequests: number;
  myRequests: number;
}

function StatSkeleton({ index }: { index: number }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-stone-200 bg-white p-5 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.06)]",
        "animate-pulse"
      )}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-3">
          <div className="h-3 w-28 rounded bg-stone-200" />
          <div className="h-8 w-16 rounded bg-stone-200" />
          <div className="h-3 w-20 rounded bg-stone-200" />
        </div>
        <div className="h-11 w-11 rounded-xl bg-stone-200" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user, business } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const greeting = business?.name ?? user?.email?.split("@")[0] ?? "there";

  useEffect(() => {
    async function fetchStats() {
      const token = localStorage.getItem("hostnexus_token");
      if (!token) {
        setLoading(false);
        return;
      }

      const headers = { Authorization: `Bearer ${token}` };

      try {
        const [resourcesRes, incomingRes, outgoingRes] = await Promise.all([
          fetch(`${API_BASE}/api/resources`, { headers }),
          fetch(`${API_BASE}/api/bookings?type=incoming`, { headers }),
          fetch(`${API_BASE}/api/bookings?type=outgoing`, { headers }),
        ]);

        const [resourcesData, incomingData, outgoingData] = await Promise.all([
          resourcesRes.ok ? resourcesRes.json() : { data: { resources: [] } },
          incomingRes.ok ? incomingRes.json() : { data: { bookingRequests: [] } },
          outgoingRes.ok ? outgoingRes.json() : { data: { bookingRequests: [] } },
        ]);

        const resources: unknown[] = resourcesData?.data?.resources ?? [];
        const incoming: { status: string }[] = incomingData?.data?.bookingRequests ?? [];
        const outgoing: unknown[] = outgoingData?.data?.bookingRequests ?? [];

        setStats({
          listedResources: resources.length,
          incomingBookings: incoming.length,
          pendingRequests: incoming.filter((b) => b.status === "pending").length,
          myRequests: outgoing.length,
        });
      } catch {
        // Silently fall back to zeros so the page still renders
        setStats({ listedResources: 0, incomingBookings: 0, pendingRequests: 0, myRequests: 0 });
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  const statCards = stats
    ? [
        {
          label: "Listed Resources",
          value: String(stats.listedResources),
          icon: Package,
          iconBg: "bg-emerald-600",
        },
        {
          label: "Incoming Bookings",
          value: String(stats.incomingBookings),
          icon: Calendar,
          iconBg: "bg-violet-600",
        },
        {
          label: "Pending Requests",
          value: String(stats.pendingRequests),
          icon: Clock,
          iconBg: "bg-amber-600",
        },
        {
          label: "My Requests",
          value: String(stats.myRequests),
          icon: ShoppingBag,
          iconBg: "bg-sky-600",
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-stone-900">Dashboard Overview</h1>
          <p className="mt-1 text-sm text-stone-500">
            Welcome back, {greeting} 👋
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/dashboard/inventory/new")}
          className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_2px_8px_rgba(5,150,105,0.25)] transition-all hover:bg-emerald-700 active:scale-[0.98]"
        >
          List New Resource <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }, (_, i) => <StatSkeleton key={i} index={i} />)
          : statCards.map((stat, i) => (
              <StatCard key={stat.label} {...stat} index={i} />
            ))}
      </div>
    </div>
  );
}
