"use client";

import { useEffect, useState } from "react";
import {
  Package,
  Calendar,
  CheckCircle2,
  Clock,
  Inbox,
  BarChart3,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Resource {
  id: string;
  resourceType: string;
}

interface BookingRequest {
  id: string;
  status: string;
  createdAt: string;
  resource: { name: string; resourceType: string } | null;
  seeker: { name: string } | null;
}

interface AnalyticsData {
  resources: Resource[];
  incoming: BookingRequest[];
  outgoing: BookingRequest[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function groupByKey<T>(arr: T[], getKey: (item: T) => string): Record<string, number> {
  return arr.reduce<Record<string, number>>((acc, item) => {
    const val = getKey(item);
    acc[val] = (acc[val] ?? 0) + 1;
    return acc;
  }, {});
}

const STATUS_META: Record<string, { label: string; dot: string; badge: string }> = {
  pending: {
    label: "Pending",
    dot: "bg-amber-400",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
  },
  accepted: {
    label: "Accepted",
    dot: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  rejected: {
    label: "Rejected",
    dot: "bg-rose-500",
    badge: "bg-rose-50 text-rose-700 border-rose-200",
  },
  cancelled: {
    label: "Cancelled",
    dot: "bg-stone-400",
    badge: "bg-stone-50 text-stone-600 border-stone-200",
  },
  completed: {
    label: "Completed",
    dot: "bg-sky-500",
    badge: "bg-sky-50 text-sky-700 border-sky-200",
  },
};

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? {
    label: status,
    dot: "bg-stone-400",
    badge: "bg-stone-50 text-stone-600 border-stone-200",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        meta.badge
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PulseSkeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-stone-100", className)} />;
}

function SummaryCardSkeleton() {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.06)]">
      <PulseSkeleton className="mb-3 h-9 w-9 rounded-xl" />
      <PulseSkeleton className="mb-2 h-7 w-16" />
      <PulseSkeleton className="h-3.5 w-28" />
    </div>
  );
}

// ─── Components ───────────────────────────────────────────────────────────────

interface SummaryCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  iconBg: string;
}

function SummaryCard({ label, value, icon: Icon, iconBg }: SummaryCardProps) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.06)]">
      <div className={cn("mb-3 flex h-9 w-9 items-center justify-center rounded-xl", iconBg)}>
        <Icon className="h-[18px] w-[18px] text-white" />
      </div>
      <p className="font-mono text-3xl font-extrabold tracking-tight text-stone-900">{value}</p>
      <p className="mt-1 text-sm text-stone-500">{label}</p>
    </div>
  );
}

interface InlineBarProps {
  label: string;
  count: number;
  max: number;
}

function InlineBar({ label, count, max }: InlineBarProps) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium capitalize text-stone-700">{label.replace(/_/g, " ")}</span>
        <span className="font-mono text-sm font-semibold text-stone-900">{count}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-stone-100">
        <div
          className="h-full rounded-full bg-emerald-600 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

interface StatusRowProps {
  status: string;
  count: number;
}

function StatusRow({ status, count }: StatusRowProps) {
  const meta = STATUS_META[status] ?? {
    label: status,
    dot: "bg-stone-400",
    badge: "",
  };
  return (
    <div className="flex items-center justify-between py-2.5">
      <div className="flex items-center gap-2.5">
        <span className={cn("h-2.5 w-2.5 rounded-full", meta.dot)} />
        <span className="text-sm font-medium capitalize text-stone-700">{meta.label}</span>
      </div>
      <span className="font-mono text-sm font-bold text-stone-900">{count}</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
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

        const [resourcesJson, incomingJson, outgoingJson] = await Promise.all([
          resourcesRes.ok ? resourcesRes.json() : null,
          incomingRes.ok ? incomingRes.json() : null,
          outgoingRes.ok ? outgoingRes.json() : null,
        ]);

        setData({
          resources: resourcesJson?.data?.resources ?? [],
          incoming: incomingJson?.data?.bookingRequests ?? [],
          outgoing: outgoingJson?.data?.bookingRequests ?? [],
        });
      } catch {
        setData({ resources: [], incoming: [], outgoing: [] });
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  // ── Derived metrics ──────────────────────────────────────────────────────
  const totalResources = data?.resources.length ?? 0;
  const totalIncoming = data?.incoming.length ?? 0;
  const acceptedCount = data?.incoming.filter((b) => b.status === "accepted").length ?? 0;
  const pendingCount = data?.incoming.filter((b) => b.status === "pending").length ?? 0;

  const resourcesByType = data
    ? groupByKey(data.resources, (r) => r.resourceType)
    : {};
  const maxResourceCount = Math.max(...Object.values(resourcesByType), 1);

  const statusCounts = data
    ? groupByKey(data.incoming, (b) => b.status)
    : {};
  const allStatuses = ["pending", "accepted", "rejected", "cancelled", "completed"];

  const recentActivity = data
    ? [...data.incoming]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5)
    : [];

  const hasResources = totalResources > 0;
  const hasIncoming = totalIncoming > 0;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-stone-900">Analytics</h1>
        <p className="mt-1 text-sm text-stone-500">Your resource and booking performance</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }, (_, i) => <SummaryCardSkeleton key={i} />)
        ) : (
          <>
            <SummaryCard
              label="Total Resources"
              value={totalResources}
              icon={Package}
              iconBg="bg-emerald-600"
            />
            <SummaryCard
              label="Incoming Bookings"
              value={totalIncoming}
              icon={Calendar}
              iconBg="bg-violet-600"
            />
            <SummaryCard
              label="Accepted Bookings"
              value={acceptedCount}
              icon={CheckCircle2}
              iconBg="bg-sky-600"
            />
            <SummaryCard
              label="Pending Requests"
              value={pendingCount}
              icon={Clock}
              iconBg="bg-amber-600"
            />
          </>
        )}
      </div>

      {/* Middle row — Resource breakdown + Booking status */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Resource Breakdown */}
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.06)]">
          <h2 className="mb-4 text-base font-semibold text-stone-900">Resources by Category</h2>

          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex justify-between">
                    <PulseSkeleton className="h-4 w-32" />
                    <PulseSkeleton className="h-4 w-8" />
                  </div>
                  <PulseSkeleton className="h-2 w-full" />
                </div>
              ))}
            </div>
          ) : !hasResources ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Package className="mb-3 h-10 w-10 text-stone-300" />
              <p className="text-sm font-medium text-stone-500">No resources listed yet</p>
              <p className="mt-1 text-xs text-stone-400">
                List your first resource to see the breakdown here
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(resourcesByType)
                .sort(([, a], [, b]) => b - a)
                .map(([type, count]) => (
                  <InlineBar key={type} label={type} count={count} max={maxResourceCount} />
                ))}
            </div>
          )}
        </div>

        {/* Booking Status Breakdown */}
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.06)]">
          <h2 className="mb-4 text-base font-semibold text-stone-900">Booking Status Breakdown</h2>

          {loading ? (
            <div className="divide-y divide-stone-100">
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-2.5">
                    <PulseSkeleton className="h-2.5 w-2.5 rounded-full" />
                    <PulseSkeleton className="h-4 w-20" />
                  </div>
                  <PulseSkeleton className="h-4 w-6" />
                </div>
              ))}
            </div>
          ) : !hasIncoming ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <BarChart3 className="mb-3 h-10 w-10 text-stone-300" />
              <p className="text-sm font-medium text-stone-500">No incoming bookings yet</p>
              <p className="mt-1 text-xs text-stone-400">
                Booking data will appear here once requests come in
              </p>
            </div>
          ) : (
            <div className="divide-y divide-stone-100">
              {allStatuses.map((status) => (
                <StatusRow key={status} status={status} count={statusCounts[status] ?? 0} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.06)]">
        <h2 className="mb-4 text-base font-semibold text-stone-900">Recent Activity</h2>

        {loading ? (
          <div className="divide-y divide-stone-100">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="flex items-center justify-between py-3.5">
                <div className="flex flex-col gap-1.5">
                  <PulseSkeleton className="h-4 w-48" />
                  <PulseSkeleton className="h-3.5 w-32" />
                </div>
                <div className="flex items-center gap-4">
                  <PulseSkeleton className="h-3.5 w-24" />
                  <PulseSkeleton className="h-6 w-20 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : recentActivity.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Inbox className="mb-3 h-10 w-10 text-stone-300" />
            <p className="text-sm font-medium text-stone-500">No recent activity</p>
            <p className="mt-1 text-xs text-stone-400">
              Incoming booking requests will show up here
            </p>
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {recentActivity.map((booking) => (
              <div
                key={booking.id}
                className="flex items-center justify-between gap-4 py-3.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-stone-900">
                    {booking.resource?.name ?? "Unknown resource"}
                  </p>
                  <p className="mt-0.5 text-xs text-stone-500">
                    from{" "}
                    <span className="font-medium text-stone-700">
                      {booking.seeker?.name ?? "Unknown"}
                    </span>
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <span className="hidden text-xs text-stone-400 sm:block">
                    {new Date(booking.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  <StatusBadge status={booking.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
