"use client";

import { useEffect, useState } from "react";
import {
  Package, Calendar, Clock, ShoppingBag, ArrowRight,
  Star, TrendingUp, TrendingDown, Award,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { StatCard } from "@/components/dashboard/stat-card";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const EASE = [0.22, 1, 0.36, 1] as const;

interface DashboardStats {
  listedResources: number;
  incomingBookings: number;
  pendingRequests: number;
  myRequests: number;
}

interface Reputation {
  asOwnerRating: number | null;
  asOwnerReviewCount: number;
  asRenterRating: number | null;
  asRenterReviewCount: number;
  overallRating: number | null;
  resourcesGiven: number;
  resourcesTaken: number;
  completedBookings: number;
  totalReviews: number;
}

function StatSkeleton({ index }: { index: number }) {
  return (
    <div
      className="rounded-2xl border border-stone-200 bg-white p-5 animate-pulse"
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

function RatingBadge({
  label, rating, count, color, index,
}: {
  label: string; rating: number | null; count: number; color: string; index: number;
}) {
  const stars = rating ?? 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.3 + index * 0.08, ease: EASE }}
      className="flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-5 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.06)]"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-stone-400">{label}</p>
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-full", color)}>
          <Award className="h-4 w-4 text-white" />
        </div>
      </div>

      {rating !== null ? (
        <>
          <div className="flex items-end gap-2">
            <span className="font-display text-4xl font-semibold tracking-tight tabular-nums text-stone-900">
              {rating.toFixed(1)}
            </span>
            <span className="mb-1 text-xs text-stone-400">/ 5.0</span>
          </div>
          {/* Star row */}
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={cn(
                  "h-3.5 w-3.5",
                  i < Math.round(stars)
                    ? "fill-amber-400 text-amber-400"
                    : "text-stone-200 fill-stone-200"
                )}
              />
            ))}
            <span className="ml-1.5 text-xs text-stone-400">
              {count} {count === 1 ? "review" : "reviews"}
            </span>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-1">
          <span className="font-display text-3xl font-semibold tabular-nums text-stone-300">—</span>
          <span className="text-xs text-stone-400">No reviews yet</span>
        </div>
      )}
    </motion.div>
  );
}

function ActivityRow({ label, value, icon: Icon, color }: {
  label: string; value: number; icon: React.FC<{ className?: string }>; color: string;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-3">
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-full", color)}>
          <Icon className="h-4 w-4 text-white" />
        </div>
        <span className="text-sm text-stone-600">{label}</span>
      </div>
      <span className="font-display text-xl font-medium text-stone-900 tabular-nums">{value}</span>
    </div>
  );
}

export default function DashboardPage() {
  const { user, business, fetchWithAuth } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [reputation, setReputation] = useState<Reputation | null>(null);
  const [loading, setLoading] = useState(true);

  const greeting = business?.name ?? user?.email?.split("@")[0] ?? "there";

  useEffect(() => {
    async function fetchStats() {
      try {
        const [resourcesRes, incomingRes, outgoingRes, repRes] = await Promise.all([
          fetchWithAuth(`${API_BASE}/api/resources`),
          fetchWithAuth(`${API_BASE}/api/bookings?type=incoming`),
          fetchWithAuth(`${API_BASE}/api/bookings?type=outgoing`),
          fetchWithAuth(`${API_BASE}/api/reviews/my-dashboard`),
        ]);

        const [resourcesData, incomingData, outgoingData, repData] = await Promise.all([
          resourcesRes.ok ? resourcesRes.json() : { data: { resources: [] } },
          incomingRes.ok ? incomingRes.json() : { data: { bookingRequests: [] } },
          outgoingRes.ok ? outgoingRes.json() : { data: { bookingRequests: [] } },
          repRes.ok ? repRes.json() : null,
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

        if (repData?.data?.reputation) {
          setReputation(repData.data.reputation as Reputation);
        }
      } catch {
        setStats({ listedResources: 0, incomingBookings: 0, pendingRequests: 0, myRequests: 0 });
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, [fetchWithAuth]);

  const statCards = stats
    ? [
        { label: "Listed Resources",  value: String(stats.listedResources),  icon: Package,      iconBg: "bg-emerald-600" },
        { label: "Incoming Bookings", value: String(stats.incomingBookings), icon: Calendar,     iconBg: "bg-stone-900"  },
        { label: "Pending Requests",  value: String(stats.pendingRequests),  icon: Clock,        iconBg: "bg-stone-900"   },
        { label: "My Requests",       value: String(stats.myRequests),       icon: ShoppingBag,  iconBg: "bg-stone-900"     },
      ]
    : [];

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-stone-900">Dashboard Overview</h1>
          <p className="mt-1 text-sm text-stone-500">Welcome back, {greeting} 👋</p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/dashboard/inventory/new")}
          className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_2px_8px_rgba(235,131,34,0.25)] transition-all hover:bg-emerald-700 active:scale-[0.98]"
        >
          List New Resource <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ── Activity stats ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }, (_, i) => <StatSkeleton key={i} index={i} />)
          : statCards.map((stat, i) => (
              <StatCard key={stat.label} {...stat} index={i} />
            ))}
      </div>

      {/* ── Reputation section ── */}
      <div>
        <div className="mb-4 flex items-center gap-2">
          <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
          <h2 className="text-base font-bold text-stone-900">Your Reputation</h2>
          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500">
            Based on completed bookings
          </span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => <StatSkeleton key={i} index={i} />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <RatingBadge
              index={0}
              label="Rating as Owner"
              rating={reputation?.asOwnerRating ?? null}
              count={reputation?.asOwnerReviewCount ?? 0}
              color="bg-emerald-600"
            />
            <RatingBadge
              index={1}
              label="Rating as Renter"
              rating={reputation?.asRenterRating ?? null}
              count={reputation?.asRenterReviewCount ?? 0}
              color="bg-stone-900"
            />
            {/* Activity summary card */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.5, ease: EASE }}
              className="rounded-2xl border border-stone-200 bg-white p-5 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.06)]"
            >
              <p className="mb-1 text-xs font-medium uppercase tracking-wider text-stone-400">
                Transaction History
              </p>
              <div className="divide-y divide-stone-100">
                <ActivityRow
                  label="Resources rented out"
                  value={reputation?.resourcesGiven ?? 0}
                  icon={TrendingUp}
                  color="bg-emerald-600"
                />
                <ActivityRow
                  label="Resources taken on rent"
                  value={reputation?.resourcesTaken ?? 0}
                  icon={TrendingDown}
                  color="bg-stone-900"
                />
                <ActivityRow
                  label="Completed bookings"
                  value={reputation?.completedBookings ?? 0}
                  icon={Award}
                  color="bg-stone-900"
                />
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
