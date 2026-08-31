"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, MapPin, DollarSign, User } from "lucide-react";
import { cn } from "@/lib/utils";

const MOCK_BOOKINGS = [
  { id: "1", resource: "Grand Ballroom", client: "Radisson Blu Pune", date: "2026-09-02", time: "10:00 AM - 6:00 PM", amount: 45000, status: "confirmed" },
  { id: "2", resource: "Industrial Kitchen", client: "Hyatt Regency", date: "2026-09-01", time: "2:00 PM - 8:00 PM", amount: 8500, status: "confirmed" },
  { id: "3", resource: "AV Equipment Bundle", client: "Fortune Hotels", date: "2026-09-06", time: "9:00 AM - 5:00 PM", amount: 12000, status: "pending" },
  { id: "4", resource: "Rooftop Terrace", client: "The Westin Pune", date: "2026-09-07", time: "6:00 PM - 11:00 PM", amount: 28000, status: "pending" },
  { id: "5", resource: "Conference Room A", client: "ITC Maratha Mumbai", date: "2026-09-03", time: "9:00 AM - 1:00 PM", amount: 5500, status: "confirmed" },
];

export default function BookingsPage() {
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-stone-900">Bookings</h1>
          <p className="mt-1 text-sm text-stone-500">Manage your resource bookings and reservations</p>
        </div>
        <div className="flex rounded-xl border border-stone-200 bg-white p-1">
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-semibold transition-all",
              viewMode === "list" ? "bg-emerald-600 text-white" : "text-stone-600 hover:bg-stone-50"
            )}
          >
            List View
          </button>
          <button
            type="button"
            onClick={() => setViewMode("calendar")}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-semibold transition-all",
              viewMode === "calendar" ? "bg-emerald-600 text-white" : "text-stone-600 hover:bg-stone-50"
            )}
          >
            Calendar View
          </button>
        </div>
      </div>

      {viewMode === "list" ? (
        <div className="space-y-4">
          {MOCK_BOOKINGS.map((booking, i) => (
            <motion.div
              key={booking.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className="rounded-2xl border border-stone-200 bg-white p-5 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.06)] transition-all hover:shadow-[0_4px_16px_-2px_rgba(0,0,0,0.08)]"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex-1 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-base font-bold text-stone-900">{booking.resource}</h3>
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-stone-500">
                        <User className="h-3.5 w-3.5" />
                        {booking.client}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-semibold",
                        booking.status === "confirmed" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                      )}
                    >
                      {booking.status}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-4 text-sm text-stone-600">
                    <div className="flex items-center gap-1.5">
                      <CalendarIcon className="h-4 w-4 text-emerald-500" />
                      {new Date(booking.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-emerald-500" />
                      {booking.time}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <DollarSign className="h-4 w-4 text-emerald-500" />
                      Rs{booking.amount.toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded-xl border border-stone-200 px-4 py-2 text-sm font-semibold text-stone-700 transition-all hover:border-stone-300 hover:bg-stone-50"
                  >
                    View Details
                  </button>
                  {booking.status === "pending" && (
                    <button
                      type="button"
                      className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-emerald-700"
                    >
                      Accept
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.06)]">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-bold text-stone-900">September 2026</h2>
            <div className="flex gap-2">
              <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 text-stone-600 transition-colors hover:bg-stone-50">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 text-stone-600 transition-colors hover:bg-stone-50">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="text-center text-sm text-stone-500">
            <CalendarIcon className="mx-auto h-16 w-16 text-stone-300" />
            <p className="mt-4 font-medium">Calendar view coming soon</p>
            <p className="mt-1 text-xs">Full calendar integration with booking conflicts detection</p>
          </div>
        </div>
      )}
    </div>
  );
}