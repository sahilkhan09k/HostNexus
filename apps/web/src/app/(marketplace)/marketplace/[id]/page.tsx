"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, CalendarDays, CheckCircle2, MapPin, ShieldCheck,
  Star, AlertTriangle, Loader2, ChevronLeft, ChevronRight,
  Building2, TrendingUp, TrendingDown, Award, Clock, Users,
  Package, ExternalLink,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { BookingModal } from "@/components/marketplace/booking-modal";
import { AuthService } from "@/lib/auth";
import { cn } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const EASE = [0.22, 1, 0.36, 1] as const;

// ─── Types ────────────────────────────────────────────────────

interface AvailWindow { id: string; from: string; to: string; note: string | null; }
interface BookedRange { from: string; to: string; status: string; }

interface CalendarData {
  availableWindows: AvailWindow[];
  bookedRanges: BookedRange[];
}

interface Reputation {
  asOwnerRating: number | null;
  asOwnerReviewCount: number;
  resourcesGiven: number;
  resourcesTaken: number;
  completedBookings: number;
  totalReviews: number;
  recentReviews: {
    rating: number; reviewerRole: string; comment: string | null;
    createdAt: string;
    reviewer: { id: string; name: string; businessType: string | null; city: string | null };
  }[];
}

interface ResourceDetail {
  id: string;
  name: string;
  description: string | null;
  resourceType: string;
  quantity: number;
  unit: string | null;
  location: string | null;
  isActive: boolean;
  rentAmountPaise: number;
  securityDepositPaise: number;
  photos: string[];
  hasPreExistingDamage: boolean;
  damageDescription: string | null;
  damagePhotos: string[];
  availabilityWindows: { id: string; fromDate: string; toDate: string; note: string | null }[];
  business: {
    id: string; name: string; ownerId: string;
    city: string | null; state: string | null; businessType: string | null;
  };
}

// ─── Mini calendar ────────────────────────────────────────────

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function isoDate(d: Date) { return d.toISOString().split("T")[0]; }

function MiniCalendar({ resourceId }: { resourceId: string }) {
  const now = new Date();
  const [year, setYear]     = useState(now.getFullYear());
  const [month, setMonth]   = useState(now.getMonth()); // 0-indexed
  const [calData, setCalData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(false);

  const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`;

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/api/resources/${resourceId}/availability/calendar?month=${monthStr}`)
      .then(r => r.json())
      .then(body => { if (body.success) setCalData(body.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [resourceId, monthStr]);

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  // Build day grid
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  const getDayStatus = (day: number | null) => {
    if (!day) return "empty";
    const d = isoDate(new Date(year, month, day));
    const today = isoDate(now);
    if (d < today) return "past";

    // Check if within any availability window
    const covered = calData?.availableWindows.some(w => d >= w.from && d <= w.to);
    if (!covered) return "unavailable";

    // Check if booked
    const booked = calData?.bookedRanges.some(b => d >= b.from && d <= b.to);
    return booked ? "booked" : "available";
  };

  const DAY_STYLES: Record<string, string> = {
    empty:       "",
    past:        "text-stone-300 cursor-default",
    unavailable: "text-stone-300 cursor-default bg-stone-50",
    available:   "bg-green-50 text-green-800 font-semibold hover:bg-green-100 cursor-pointer",
    booked:      "bg-rose-100 text-rose-600 line-through cursor-not-allowed",
  };

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <button onClick={prevMonth} className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-stone-100 transition-colors text-stone-500">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-stone-900">{MONTHS[month]} {year}</h3>
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-stone-400" />}
        </div>
        <button onClick={nextMonth} className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-stone-100 transition-colors text-stone-500">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Weekday labels */}
      <div className="mb-1 grid grid-cols-7 gap-0.5">
        {WEEKDAYS.map(d => (
          <div key={d} className="py-1 text-center text-[10px] font-bold uppercase tracking-wider text-stone-400">{d}</div>
        ))}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          const status = getDayStatus(day);
          return (
            <div
              key={i}
              className={cn(
                "aspect-square flex items-center justify-center rounded-lg text-xs transition-colors",
                DAY_STYLES[status]
              )}
            >
              {day ?? ""}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-stone-100 pt-3">
        {[
          { color: "bg-green-100", label: "Available" },
          { color: "bg-rose-100",    label: "Booked" },
          { color: "bg-stone-100",   label: "Unavailable" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5 text-[10px] text-stone-500">
            <span className={cn("h-3 w-3 rounded-sm", color)} />
            {label}
          </div>
        ))}
      </div>

      {/* No windows notice */}
      {calData && calData.availableWindows.length === 0 && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Owner hasn't set availability windows yet. Contact them directly.
        </div>
      )}
    </div>
  );
}

// ─── Star row ─────────────────────────────────────────────────

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={cn("h-3.5 w-3.5", i < Math.round(rating) ? "fill-amber-400 text-amber-400" : "fill-stone-200 text-stone-200")} />
      ))}
    </div>
  );
}

// ─── Owner profile card ───────────────────────────────────────

function OwnerProfileCard({ businessId, businessName, city, state, businessType }: {
  businessId: string; businessName: string;
  city: string | null; state: string | null; businessType: string | null;
}) {
  const [rep, setRep] = useState<Reputation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/reviews/business/${businessId}`)
      .then(r => r.json())
      .then(body => { if (body.success) setRep(body.data.reputation as Reputation); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [businessId]);

  const memberSince = null; // not fetched here — keep card compact

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm space-y-4">
      {/* Business header */}
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 border border-emerald-200 text-lg font-black text-emerald-700">
          {businessName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="font-bold text-stone-900 truncate">{businessName}</p>
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-green-600" />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-stone-400 mt-0.5">
            {businessType && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{businessType}</span>}
            {(city || state) && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3 text-emerald-500" />
                {[city, state].filter(Boolean).join(", ")}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Reputation stats */}
      {loading ? (
        <div className="space-y-2">
          {[1,2].map(i => <div key={i} className="h-8 animate-pulse rounded-lg bg-stone-100" />)}
        </div>
      ) : rep ? (
        <div className="space-y-3">
          {/* Rating as owner */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-stone-500">Rating as Owner</span>
            {rep.asOwnerRating !== null ? (
              <div className="flex items-center gap-1.5">
                <Stars rating={rep.asOwnerRating} />
                <span className="text-xs font-bold text-stone-800 tabular-nums">{rep.asOwnerRating.toFixed(1)}</span>
                <span className="text-[10px] text-stone-400">({rep.asOwnerReviewCount})</span>
              </div>
            ) : (
              <span className="text-xs text-stone-400">No reviews yet</span>
            )}
          </div>

          {/* Transaction summary */}
          <div className="grid grid-cols-3 divide-x divide-stone-100 rounded-xl border border-stone-100 bg-stone-50">
            {[
              { label: "Rented Out", value: rep.resourcesGiven,    icon: TrendingUp,   color: "text-emerald-600" },
              { label: "Rented In",  value: rep.resourcesTaken,    icon: TrendingDown, color: "text-sky-600"     },
              { label: "Completed",  value: rep.completedBookings, icon: Award,        color: "text-violet-600"  },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="flex flex-col items-center gap-1 py-2.5">
                <Icon className={cn("h-3.5 w-3.5", color)} />
                <span className="text-base font-semibold text-stone-900 tabular-nums">{value}</span>
                <span className="text-[9px] text-stone-400 leading-none text-center">{label}</span>
              </div>
            ))}
          </div>

          {/* Recent review snippet */}
          {rep.recentReviews.length > 0 && (
            <div className="rounded-xl border border-stone-100 bg-stone-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2">Latest Review</p>
              <Stars rating={rep.recentReviews[0].rating} />
              {rep.recentReviews[0].comment && (
                <p className="mt-1.5 text-xs text-stone-600 leading-relaxed line-clamp-3">
                  "{rep.recentReviews[0].comment}"
                </p>
              )}
              <p className="mt-1.5 text-[10px] text-stone-400">
                — {rep.recentReviews[0].reviewer.name}
                {rep.recentReviews[0].reviewer.city && `, ${rep.recentReviews[0].reviewer.city}`}
              </p>
            </div>
          )}
        </div>
      ) : null}

      {/* Link to full profile */}
      <Link
        href={`/business/${businessId}`}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-stone-200 py-2.5 text-xs font-semibold text-stone-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 transition-all"
      >
        <Users className="h-3.5 w-3.5" />
        View Full Business Profile
        <ExternalLink className="h-3 w-3 opacity-60" />
      </Link>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function ResourceDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [resource, setResource]   = useState<ResourceDetail | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [photoIdx, setPhotoIdx]   = useState(0);
  const [bookingOpen, setBookingOpen] = useState(false);

  const fetchResource = useCallback(async () => {
    if (!id) return;
    setLoading(true); setError(null);
    try {
      const res = await AuthService.fetchWithAuth(`${API_BASE}/api/resources/${id}`);
      if (!res.ok) throw new Error("Resource not found");
      const body = await res.json();
      setResource(body.data.resource as ResourceDetail);
    } catch (e: any) {
      setError(e.message ?? "Failed to load resource");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchResource(); }, [fetchResource]);

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col">
        <Navbar />
        <div className="flex flex-1 items-center justify-center pt-24">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
        <Footer />
      </div>
    );
  }

  // ── Error ──
  if (error || !resource) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col">
        <Navbar />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 pt-24 text-center px-4">
          <div className="rounded-full bg-rose-50 p-4 text-rose-500">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <p className="text-base font-semibold text-stone-800">{error ?? "Resource not found"}</p>
          <Link href="/marketplace" className="flex items-center gap-2 rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to Marketplace
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const photos = resource.photos ?? [];
  const photo  = photos[photoIdx] ?? null;

  // Summarise available dates for the booking info strip
  const upcomingWindows = (resource.availabilityWindows ?? [])
    .filter(w => new Date(w.toDate) >= new Date())
    .slice(0, 2);

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col">
      <Navbar />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 pt-24 pb-16">

        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-xs text-stone-400">
          <Link href="/marketplace" className="hover:text-stone-700 transition-colors">Marketplace</Link>
          <span>/</span>
          <span className="text-stone-400">{resource.resourceType}</span>
          <span>/</span>
          <span className="font-medium text-stone-700 truncate max-w-[200px]">{resource.name}</span>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">

          {/* ── Left: Gallery + Details (7 cols) ── */}
          <div className="lg:col-span-7 space-y-6">

            {/* Photo gallery */}
            <div className="space-y-3">
              <motion.div
                key={photoIdx}
                initial={{ opacity: 0.7 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
                className="relative aspect-video overflow-hidden rounded-2xl border border-stone-200 bg-stone-100 shadow-sm"
              >
                {photo ? (
                  <img src={photo} alt={resource.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center gap-2 text-stone-400">
                    <Package className="h-10 w-10" />
                    <span className="text-sm">No photos available</span>
                  </div>
                )}
                {/* Type badge */}
                <span className="absolute left-3 top-3 rounded-full bg-black/60 backdrop-blur-sm px-3 py-1 text-xs font-semibold text-white">
                  {resource.resourceType}
                </span>
                {/* Condition badge */}
                {resource.hasPreExistingDamage ? (
                  <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-amber-500/90 px-2.5 py-1 text-[10px] font-semibold text-white">
                    <AlertTriangle className="h-3 w-3" /> Disclosed Wear
                  </span>
                ) : (
                  <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-emerald-600/90 px-2.5 py-1 text-[10px] font-semibold text-white">
                    <ShieldCheck className="h-3 w-3" /> Pristine
                  </span>
                )}
              </motion.div>

              {/* Thumbnails */}
              {photos.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {photos.map((p, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setPhotoIdx(i)}
                      className={cn(
                        "h-16 w-20 shrink-0 overflow-hidden rounded-xl border-2 transition-all",
                        i === photoIdx
                          ? "border-emerald-600 ring-2 ring-emerald-500/20"
                          : "border-stone-200 opacity-60 hover:opacity-100"
                      )}
                    >
                      <img src={p} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* About */}
            <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
              <h2 className="border-b border-stone-100 pb-3 text-base font-bold text-stone-900">About this Resource</h2>
              <p className="text-sm text-stone-600 leading-relaxed whitespace-pre-line">
                {resource.description || "No description provided."}
              </p>
              <div className="grid grid-cols-2 gap-3 border-t border-stone-100 pt-4 text-xs sm:grid-cols-3">
                {[
                  { label: "Quantity",      value: `${resource.quantity} ${resource.unit ?? "units"}` },
                  { label: "Location",      value: resource.location ?? "On request" },
                  { label: "Owner",         value: resource.business.name },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <span className="block font-semibold uppercase tracking-wider text-stone-400">{label}</span>
                    <span className="mt-0.5 block font-semibold text-stone-800">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Availability windows (owner-declared) */}
            {upcomingWindows.length > 0 && (
              <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-3">
                <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
                  <CalendarDays className="h-5 w-5 text-emerald-600" />
                  <h2 className="text-base font-bold text-stone-900">Upcoming Availability</h2>
                </div>
                <div className="space-y-2">
                  {upcomingWindows.map((w) => (
                    <div key={w.id} className="flex items-center gap-3 rounded-xl border border-green-100 bg-green-50 px-4 py-3">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                      <div>
                        <p className="text-sm font-semibold text-stone-800">
                          {new Date(w.fromDate + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                          {" → "}
                          {new Date(w.toDate + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                        </p>
                        {w.note && <p className="text-xs text-stone-400">{w.note}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Condition disclosure */}
            <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-green-600" />
                  <h2 className="text-base font-bold text-stone-900">Chain of Custody: Condition Disclosure</h2>
                </div>
                {resource.hasPreExistingDamage ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                    <AlertTriangle className="h-3 w-3" /> Disclosed Wear
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
                    <CheckCircle2 className="h-3 w-3" /> Pristine
                  </span>
                )}
              </div>

              {resource.hasPreExistingDamage ? (
                <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                  <div className="flex items-start gap-2 text-xs text-amber-900">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <div>
                      <span className="font-bold">Pre-Existing Wear:</span>
                      <p className="mt-1 leading-relaxed">{resource.damageDescription}</p>
                    </div>
                  </div>
                  {resource.damagePhotos?.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 pt-1 sm:grid-cols-4">
                      {resource.damagePhotos.map((dp, i) => (
                        <div key={i} className="aspect-square overflow-hidden rounded-lg border border-amber-200">
                          <img src={dp} alt={`Damage ${i + 1}`} className="h-full w-full object-cover" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-xl border border-green-100 bg-green-50 p-4 text-xs text-green-900">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                  <span>
                    <span className="font-semibold">Declared Pristine.</span> No pre-existing damage — you verify upon handover.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ── Right: Booking panel + Calendar + Owner (5 cols) ── */}
          <div className="lg:col-span-5 space-y-5">

            {/* Sticky booking card */}
            <div className="sticky top-24 space-y-5">

              {/* Price + CTA card */}
              <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-5">
                <div>
                  <p className="text-xs font-medium text-stone-400">{resource.business.name}</p>
                  <h1 className="mt-0.5 font-display text-2xl font-semibold leading-snug text-stone-900">{resource.name}</h1>
                  {resource.location && (
                    <div className="mt-1.5 flex items-center gap-1 text-xs text-stone-400">
                      <MapPin className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      {resource.location}
                    </div>
                  )}
                </div>

                {/* Pricing */}
                <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs font-semibold uppercase text-stone-400">Daily Rent</span>
                    <span className="text-2xl font-black text-stone-900">
                      ₹{(resource.rentAmountPaise / 100).toLocaleString()}
                      <span className="text-xs font-normal text-stone-400"> / day</span>
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between border-t border-stone-200 pt-2 text-xs">
                    <span className="text-stone-500">Refundable Deposit</span>
                    <span className="font-bold text-emerald-700">
                      ₹{(resource.securityDepositPaise / 100).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Escrow note */}
                <div className="flex items-start gap-2 rounded-xl border border-green-100 bg-green-50 p-3 text-xs text-green-900">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                  <ul className="space-y-0.5 text-[11px] text-stone-600">
                    <li>Rent held in escrow, released only after handover inspection</li>
                    <li><span className="font-semibold">1-hour</span> renter inspection window on receipt</li>
                    <li>Deposit auto-refunded 2h after return if no damage claimed</li>
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={() => setBookingOpen(true)}
                  disabled={!resource.isActive}
                  className={cn(
                    "flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-white transition-all active:scale-[0.99]",
                    resource.isActive
                      ? "bg-emerald-600 hover:bg-emerald-700 shadow-[0_4px_16px_rgba(235,131,34,0.25)]"
                      : "bg-stone-300 cursor-not-allowed"
                  )}
                >
                  {resource.isActive ? "Request to Book Resource" : "Currently Unavailable"}
                </button>

                <p className="text-center text-[11px] text-stone-400">
                  No charge until the owner accepts your request.
                </p>
              </div>

              {/* Availability Calendar */}
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-stone-500" />
                  <h2 className="text-sm font-bold text-stone-800">Availability Calendar</h2>
                </div>
                <MiniCalendar resourceId={resource.id} />
              </div>

              {/* Owner profile */}
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-stone-500" />
                  <h2 className="text-sm font-bold text-stone-800">About the Owner</h2>
                </div>
                <OwnerProfileCard
                  businessId={resource.business.id}
                  businessName={resource.business.name}
                  city={resource.business.city}
                  state={resource.business.state}
                  businessType={resource.business.businessType}
                />
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Booking modal */}
      <BookingModal
        isOpen={bookingOpen}
        onClose={() => setBookingOpen(false)}
        resource={{
          id:                   resource.id,
          name:                 resource.name,
          resourceType:         resource.resourceType,
          location:             resource.location,
          rentAmountPaise:      resource.rentAmountPaise,
          securityDepositPaise: resource.securityDepositPaise,
          quantity:             resource.quantity,
          photos:               resource.photos,
          hasPreExistingDamage: resource.hasPreExistingDamage,
          damageDescription:    resource.damageDescription,
          damagePhotos:         resource.damagePhotos,
          business: { id: resource.business.id, name: resource.business.name },
        }}
      />

      <Footer />
    </div>
  );
}
