"use client";

import { BarChart3, TrendingUp, TrendingDown } from "lucide-react";

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-stone-900">Analytics</h1>
        <p className="mt-1 text-sm text-stone-500">Track performance and revenue metrics</p>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center shadow-[0_2px_12px_-2px_rgba(0,0,0,0.06)]">
        <BarChart3 className="mx-auto h-16 w-16 text-stone-300" />
        <h2 className="mt-4 text-lg font-semibold text-stone-900">Analytics Dashboard Coming Soon</h2>
        <p className="mt-2 text-sm text-stone-500">
          Revenue trends, booking analytics, and performance metrics will be available here
        </p>
      </div>
    </div>
  );
}
