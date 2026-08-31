"use client";

import { motion } from "framer-motion";
import { TrendingUp, DollarSign, Calendar, Star, Clock, CheckCircle, XCircle, ArrowRight, Package, MapPin } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { cn } from "@/lib/utils";

const STATS = [
  { label: "Total Revenue", value: "Rs4.2L", change: "+12.5%", changeType: "positive" as const, icon: DollarSign, iconBg: "bg-emerald-600" },
  { label: "Active Bookings", value: "17", change: "+3", changeType: "positive" as const, icon: Calendar, iconBg: "bg-violet-600" },
  { label: "Listed Resources", value: "8", change: "+2", changeType: "positive" as const, icon: Package, iconBg: "bg-sky-600" },
  { label: "Avg Rating", value: "4.8", change: "+0.1", changeType: "positive" as const, icon: Star, iconBg: "bg-amber-600" },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-stone-900">Dashboard Overview</h1>
          <p className="mt-1 text-sm text-stone-500">Welcome back, Rajesh</p>
        </div>
        <button type="button" className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_2px_8px_rgba(5,150,105,0.25)] transition-all hover:bg-emerald-700 active:scale-[0.98]">
          List New Resource <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map((stat, i) => (<StatCard key={stat.label} {...stat} index={i} />))}
      </div>
    </div>
  );
}