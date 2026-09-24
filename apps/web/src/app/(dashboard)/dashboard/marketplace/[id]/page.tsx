"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, CalendarDays, CheckCircle2, MapPin, ShieldCheck,
  Star, AlertTriangle, Loader2, ChevronLeft, ChevronRight,
  Building2, TrendingUp, TrendingDown, Award, Users, Package,
  ExternalLink, DollarSign,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const EASE = [0.22, 1, 0.36, 1] as const;

// ─── Types ────────────────────────────────────────────────────
interface AvailWindow { id: string; from: string; to: string; note: string | null; }
interface BookedRange { from: string; to: string; status: string; }
interface CalendarData { availableWindows: AvailWindow[]; bookedRanges: BookedRange[]; }

interface Reputation {
  asOwnerRating: number | null; asOwnerReviewCount: number;
  resourcesGiven: number; resourcesTaken: number; completedBookings: number;
  recentReviews: {
    rating: number; reviewerRole: string; comment: string | null; createdAt: string;
    reviewer: { id: string; name: string; businessType: string | null; city: string | null };
  }[];
}

interface ResourceDetail {
  id: string; name: string; description: string | null;
  resourceType: string; quantity: number; unit: string | null;
  location: string | null; isActive: boolean;
  rentAmountPaise: number; securityDepositPaise: number;
  photos: string[]; hasPreExistingDamage: boolean;
  damageDescription: string | null; damagePhotos: string[];
  availabilityWindows: { id: string; fromDate: string; toDate: string; note: string | null }[];
  business: { id: string; name: string; ownerId: string; city: string | null; state: string | null; businessType: string | null; };
}

// ─── Mini calendar ────────────────────────────────────────────
const WEEKDAYS = ["Su","Mo","Tu","We","Th","Fr","Sa"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
function isoDate(d: Date) { return d.toISOString().split("T")[0]; }

function MiniCalendar({ resourceId }: { resourceId: string }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [cal, setCal] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(false);
  const { fetchWithAuth } = useAuth();

  const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`;

  useEffect(() => {
    setLoading(true);
    fetchWithAuth(`${API_BASE}/api/resources/${resourceId}/availability/calendar?month=${monthStr}`)
      .then(r => r.json()).then(b => { if (b.success) setCal(b.data); })
      .catch(() => {}).finally(() => setLoading(false));
  }, [resourceId, monthStr, fetchWithAuth]);

  const prev = () => { if (month === 0) { setMonth(11); setYear(y => y-1); } else setMonth(m => m-1); };
  const next = () => { if (month === 11) { setMonth(0); setYear(y => y+1); } else setMonth(m => m+1); };

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i+1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const status = (day: number | null) => {
    if (!day) return "empty";
    const d = isoDate(new Date(year, month, day));
    if (d < isoDate(now)) return "past";
    const covered = cal?.availableWindows.some(w => d >= w.from && d <= w.to);
    if (!covered) return "unavailable";
    const booked = cal?.bookedRanges.some(b => d >= b.from && d <= b.to);
    return booked ? "booked" : "available";
  };

  const DAY: Record<string, string> = {
    empty: "", past: "text-stone-300 cursor-default",
    unavailable: "text-stone-300 bg-stone-50 cursor-default",
    available: "bg-emerald-50 text-emerald-800 font-semibold hover:bg-emerald-100 cursor-pointer",
    booked: "bg-rose-100 text-rose-600 line-through cursor-not-allowed",
  };

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <button onClick={prev} className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-stone-100 text-stone-500 transition-colors"><ChevronLeft className="h-4 w-4" /></button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-stone-900">{MONTHS[month]} {year}</span>
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-stone-400" />}
        </div>
        <button onClick={next} className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-stone-100 text-stone-500 transition-colors"><ChevronRight className="h-4 w-4" /></button>
      </div>
      <div className="mb-1 grid grid-cols-7">
        {WEEKDAYS.map(d => <div key={d} className="py-1 text-center text-[10px] font-bold uppercase text-stone-400">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => (
          <div key={i} className={cn("aspect-square flex items-center justify-center rounded-lg text-xs transition-colors", DAY[status(day)])}>
            {day ?? ""}
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 border-t border-stone-100 pt-3">
        {[{ color: "bg-emerald-100", label: "Available" }, { color: "bg-rose-100", label: "Booked" }, { color: "bg-stone-100", label: "Unavailable" }].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5 text-[10px] text-stone-500">
            <span className={cn("h-3 w-3 rounded-sm", color)} />{label}
          </div>
        ))}
      </div>
      {cal && cal.availableWindows.length === 0 && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> No availability windows set yet.
        </div>
      )}
    </div>
  );
}

// ─── Stars ────────────────────────────────────────────────────
function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={cn("h-3.5 w-3.5", i < Math.round(rating) ? "fill-amber-400 text-amber-400" : "fill-stone-200 text-stone-200")} />
      ))}
    </div>
  );
}

// ─── Owner card ───────────────────────────────────────────────
function OwnerCard({ businessId, businessName, city, state, businessType }: {
  businessId: string; businessName: string; city: string | null; state: string | null; businessType: string | null;
}) {
  const [rep, setRep] = useState<Reputation | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/reviews/business/${businessId}`)
      .then(r => r.json()).then(b => { if (b.success) setRep(b.data.reputation); }).catch(() => {});
  }, [businessId]);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 border border-emerald-200 text-base font-black text-emerald-700">
          {businessName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="font-bold text-stone-900 truncate text-sm">{businessName}</p>
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-stone-400 mt-0.5">
            {businessType && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{businessType}</span>}
            {(city || state) && <span className="flex items-center gap-1"><MapPin className="h-3 w-3 text-emerald-500" />{[city, state].filter(Boolean).join(", ")}</span>}
          </div>
        </div>
      </div>

      {rep && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-stone-500">Rating as Owner</span>
            {rep.asOwnerRating !== null ? (
              <div className="flex items-center gap-1.5">
                <Stars rating={rep.asOwnerRating} />
                <span className="text-xs font-bold text-stone-800">{rep.asOwnerRating.toFixed(1)}</span>
                <span className="text-[10px] text-stone-400">({rep.asOwnerReviewCount})</span>
              </div>
            ) : <span className="text-xs text-stone-400">No reviews yet</span>}
          </div>

          <div className="grid grid-cols-3 divide-x divide-stone-100 rounded-xl border border-stone-100 bg-stone-50">
            {[
              { label: "Rented Out", value: rep.resourcesGiven,    icon: TrendingUp,   color: "text-emerald-600" },
              { label: "Rented In",  value: rep.resourcesTaken,    icon: TrendingDown, color: "text-sky-600"     },
              { label: "Completed",  value: rep.completedBookings, icon: Award,        color: "text-violet-600"  },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="flex flex-col items-center gap-1 py-2.5">
                <Icon className={cn("h-3.5 w-3.5", color)} />
                <span className="font-mono text-sm font-extrabold text-stone-900 tabular-nums">{value}</span>
                <span className="text-[9px] text-stone-400 text-center">{label}</span>
              </div>
            ))}
          </div>

          {rep.recentReviews.length > 0 && (
            <div className="rounded-xl border border-stone-100 bg-stone-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1.5">Latest Review</p>
              <Stars rating={rep.recentReviews[0].rating} />
              {rep.recentReviews[0].comment && (
                <p className="mt-1.5 text-xs text-stone-600 leading-relaxed line-clamp-3">"{rep.recentReviews[0].comment}"</p>
              )}
              <p className="mt-1 text-[10px] text-stone-400">— {rep.recentReviews[0].reviewer.name}</p>
            </div>
          )}
        </div>
      )}

      <Link href={`/business/${businessId}`} target="_blank"
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-stone-200 py-2.5 text-xs font-semibold text-stone-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 transition-all">
        <Users className="h-3.5 w-3.5" /> View Full Profile <ExternalLink className="h-3 w-3 opacity-60" />
      </Link>
    </div>
  );
}

// ─── Booking form panel ───────────────────────────────────────
function BookingPanel({ resource }: { resource: ResourceDetail }) {
  const router = useRouter();
  const { fetchWithAuth } = useAuth();
  const [tab, setTab]     = useState<"book" | "negotiate">("book");
  const [qty, setQty]     = useState(1);
  const [start, setStart] = useState("");
  const [end, setEnd]     = useState("");
  const [notes, setNotes] = useState("");

  // Negotiate-only
  const [offerPerDay, setOfferPerDay] = useState<number>(
    Math.round(resource.rentAmountPaise / 100 * 0.9)
  );
  const [offerMsg, setOfferMsg] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess]   = useState<"booked" | "negotiated" | null>(null);
  const [error, setError]       = useState("");

  const today = new Date().toISOString().split("T")[0];
  const totalDays = start && end
    ? Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86_400_000))
    : null;

  const listedPerDay    = resource.rentAmountPaise / 100;
  const depositINR      = resource.securityDepositPaise / 100;
  const totalRent       = totalDays ? listedPerDay * totalDays * qty : null;
  const totalAmount     = totalRent !== null ? totalRent + depositINR : null;

  const offerTotalRent  = totalDays ? offerPerDay * totalDays * qty : null;
  const offerTotal      = offerTotalRent !== null ? offerTotalRent + depositINR : null;
  const savingINR       = offerTotalRent !== null && totalRent !== null ? totalRent - offerTotalRent : null;
  const savingPct       = savingINR !== null && totalRent ? Math.round((savingINR / totalRent) * 100) : 0;

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!start || !end) { setError("Please select start and end dates"); return; }
    setSubmitting(true); setError("");
    try {
      const res = await fetchWithAuth(`${API_BASE}/api/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resourceId: resource.id, quantity: qty,
          startDate: new Date(start + "T00:00:00").toISOString(),
          endDate:   new Date(end   + "T00:00:00").toISOString(),
          specialRequests: notes || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? "Failed to create request");
      }
      setSuccess("booked");
      setTimeout(() => router.push("/dashboard/bookings"), 1800);
    } catch (err: any) {
      setError(err.message ?? "Something went wrong");
    } finally { setSubmitting(false); }
  };

  const handleNegotiate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!start || !end) { setError("Please select start and end dates"); return; }
    if (offerPerDay <= 0) { setError("Please enter a valid offer amount"); return; }
    setSubmitting(true); setError("");
    try {
      // 1. Create booking at listed price
      const bookRes = await fetchWithAuth(`${API_BASE}/api/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resourceId: resource.id, quantity: qty,
          startDate: new Date(start + "T00:00:00").toISOString(),
          endDate:   new Date(end   + "T00:00:00").toISOString(),
          specialRequests: notes || undefined,
        }),
      });
      if (!bookRes.ok) {
        const body = await bookRes.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? "Failed to create booking");
      }
      const bookData = await bookRes.json();
      const bookingId = bookData.data.bookingRequest.id;

      // 2. Submit counter-offer
      const negRes = await fetchWithAuth(`${API_BASE}/api/negotiations/${bookingId}/offer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offeredAmountPaise: Math.round(offerPerDay * 100),
          message: offerMsg.trim() || undefined,
        }),
      });
      if (!negRes.ok) {
        const body = await negRes.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? "Offer failed");
      }
      setSuccess("negotiated");
      setTimeout(() => router.push("/dashboard/bookings"), 1800);
    } catch (err: any) {
      setError(err.message ?? "Something went wrong");
    } finally { setSubmitting(false); }
  };

  // ── Shared date + quantity inputs ──
  const DateQtyInputs = () => (
    <>
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-stone-500">Quantity</label>
        <input type="number" min="1" max={resource.quantity} value={qty} onChange={e => setQty(parseInt(e.target.value) || 1)}
          className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-sm focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all" />
        <p className="mt-1 text-[10px] text-stone-400">Max: {resource.quantity} {resource.unit ?? "units"}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-stone-500">Start Date</label>
          <input type="date" required min={today} value={start}
            onChange={e => { setStart(e.target.value); if (end && e.target.value > end) setEnd(""); }}
            className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-stone-500">End Date</label>
          <input type="date" required min={start || today} value={end} onChange={e => setEnd(e.target.value)}
            disabled={!start}
            className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed" />
        </div>
      </div>
    </>
  );

  if (success === "booked") {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
          <CheckCircle2 className="h-7 w-7 text-emerald-600" />
        </div>
        <p className="font-bold text-stone-900">Request Sent!</p>
        <p className="text-xs text-stone-500">Owner will review and respond. Redirecting…</p>
      </div>
    );
  }

  if (success === "negotiated") {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50">
          <DollarSign className="h-7 w-7 text-amber-600" />
        </div>
        <p className="font-bold text-stone-900">Counter-Offer Sent!</p>
        <p className="text-xs text-stone-500">Your offer is with the owner. Track the thread in Bookings. Redirecting…</p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {/* ── Tab switcher ── */}
      <div className="flex rounded-xl border border-stone-200 bg-stone-100 p-1 mb-5">
        <button
          type="button"
          onClick={() => { setTab("book"); setError(""); }}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all",
            tab === "book"
              ? "bg-white text-stone-900 shadow-sm"
              : "text-stone-500 hover:text-stone-700"
          )}
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          Book at Listed Price
        </button>
        <button
          type="button"
          onClick={() => { setTab("negotiate"); setError(""); }}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all",
            tab === "negotiate"
              ? "bg-amber-500 text-white shadow-sm"
              : "text-stone-500 hover:text-stone-700"
          )}
        >
          <TrendingDown className="h-3.5 w-3.5" />
          Negotiate Price
        </button>
      </div>

      {/* ── BOOK tab ── */}
      {tab === "book" && (
        <form onSubmit={handleBook} className="space-y-4">
          {/* Price summary */}
          <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-stone-500">Daily Rent</span>
              <span className="text-xl font-black text-stone-900">
                ₹{listedPerDay.toLocaleString()}
                <span className="text-xs font-normal text-stone-400"> / day</span>
              </span>
            </div>
            <div className="flex items-baseline justify-between border-t border-stone-200 pt-2 text-xs">
              <span className="text-stone-500">Security Deposit</span>
              <span className="font-bold text-emerald-700">₹{depositINR.toLocaleString()}</span>
            </div>
            {totalAmount !== null && (
              <div className="flex items-baseline justify-between border-t border-stone-200 pt-2 text-xs">
                <span className="font-semibold text-stone-700">Total ({totalDays}d rent + deposit)</span>
                <span className="font-black text-stone-900">₹{totalAmount.toLocaleString()}</span>
              </div>
            )}
          </div>

          <DateQtyInputs />

          {/* Notes */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-stone-500">Special Requests (optional)</label>
            <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any specific requirements…"
              className="w-full resize-none rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-sm placeholder:text-stone-400 focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all" />
          </div>

          {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-700">{error}</div>}

          <div className="flex items-start gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-[11px] text-emerald-800">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
            <span>No charge until the owner accepts. Funds held in escrow after acceptance.</span>
          </div>

          <button type="submit" disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-sm font-bold text-white shadow-[0_4px_16px_rgba(5,150,105,0.25)] hover:bg-emerald-700 transition-all active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Request to Book"}
          </button>
          <p className="text-center text-[10px] text-stone-400">You'll be notified when the owner responds</p>
        </form>
      )}

      {/* ── NEGOTIATE tab ── */}
      {tab === "negotiate" && (
        <form onSubmit={handleNegotiate} className="space-y-4">
          {/* Offer input + live summary */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-stone-600">
                Your Offer per Day (₹) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 font-medium text-sm">₹</span>
                <input
                  type="number" min="1" required
                  value={offerPerDay || ""}
                  onChange={e => setOfferPerDay(parseFloat(e.target.value) || 0)}
                  placeholder={String(Math.round(listedPerDay * 0.85))}
                  className="w-full rounded-xl border border-amber-300 bg-white pl-7 pr-3 py-2.5 text-base font-bold text-stone-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all"
                />
              </div>
              <p className="mt-1 text-[10px] text-stone-500">Listed price: <span className="font-semibold">₹{listedPerDay.toLocaleString()}/day</span></p>
            </div>

            {/* Live savings callout */}
            {offerPerDay > 0 && totalDays && (
              <div className="rounded-lg border border-amber-200 bg-white p-3 space-y-1.5 text-xs">
                <div className="flex justify-between text-stone-600">
                  <span>Offer rent ({totalDays}d × ₹{offerPerDay.toLocaleString()} × {qty}):</span>
                  <span className="font-semibold">₹{(offerTotalRent ?? 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span>+ Deposit:</span>
                  <span>₹{depositINR.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-bold text-stone-900 border-t border-stone-100 pt-1.5">
                  <span>Total Escrow:</span>
                  <span className="text-amber-700">₹{(offerTotal ?? 0).toLocaleString()}</span>
                </div>
                {savingINR !== null && savingINR > 0 && (
                  <p className="text-emerald-600 font-semibold text-[11px]">
                    You save ₹{savingINR.toLocaleString()} ({savingPct}% off listed)
                  </p>
                )}
                {savingINR !== null && savingINR < 0 && (
                  <p className="text-rose-500 text-[11px]">Your offer is above listed price — lower it to save.</p>
                )}
              </div>
            )}
          </div>

          <DateQtyInputs />

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-stone-500">Message to Owner (optional)</label>
            <textarea rows={2} value={offerMsg} onChange={e => setOfferMsg(e.target.value)}
              placeholder="e.g. We're a regular caterer, happy to do a long-term rate…"
              className="w-full resize-none rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-sm placeholder:text-stone-400 focus:border-amber-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all" />
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-stone-500">Special Requests (optional)</label>
            <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any specific requirements…"
              className="w-full resize-none rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-sm placeholder:text-stone-400 focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all" />
          </div>

          {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-700">{error}</div>}

          <div className="flex items-start gap-2 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2.5 text-[11px] text-sky-800">
            <TrendingDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-600" />
            <span>
              A booking request is created at listed price. Your counter-offer goes to the owner — they can accept, counter back, or decline. Track in Bookings.
            </span>
          </div>

          <button type="submit" disabled={submitting || offerPerDay <= 0}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-3.5 text-sm font-bold text-white shadow-[0_4px_16px_rgba(245,158,11,0.3)] hover:bg-amber-600 transition-all active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (
              <><TrendingDown className="h-4 w-4" /> Send Counter-Offer</>
            )}
          </button>
          <p className="text-center text-[10px] text-stone-400">Owner will be notified of your offer immediately</p>
        </form>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────
export default function DashboardResourceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { fetchWithAuth } = useAuth();

  const [resource, setResource] = useState<ResourceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [photoIdx, setPhotoIdx] = useState(0);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchWithAuth(`${API_BASE}/api/resources/${id}`)
      .then(r => r.json())
      .then(body => {
        if (body.success) setResource(body.data.resource);
        else throw new Error(body.error?.message ?? "Not found");
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id, fetchWithAuth]);

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>;
  if (error || !resource) return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <AlertTriangle className="h-10 w-10 text-rose-400" />
      <p className="font-semibold text-stone-800">{error ?? "Resource not found"}</p>
      <button onClick={() => router.back()} className="flex items-center gap-2 rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Go back
      </button>
    </div>
  );

  const photos = resource.photos ?? [];
  const photo  = photos[photoIdx] ?? null;
  const upcomingWindows = (resource.availabilityWindows ?? [])
    .filter(w => new Date(w.toDate) >= new Date()).slice(0, 2);

  return (
    <div className="space-y-6 pb-10">
      {/* Back */}
      <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-stone-500 hover:text-stone-800 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to marketplace
      </button>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">

        {/* ── Left: Gallery + Details (7 cols) ── */}
        <div className="lg:col-span-7 space-y-5">

          {/* Gallery */}
          <div className="space-y-3">
            <motion.div key={photoIdx} initial={{ opacity: 0.7 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}
              className="relative aspect-video overflow-hidden rounded-2xl border border-stone-200 bg-stone-100 shadow-sm">
              {photo ? (
                <img src={photo} alt={resource.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center gap-2 text-stone-400">
                  <Package className="h-10 w-10" /><span className="text-sm">No photos</span>
                </div>
              )}
              <span className="absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">{resource.resourceType}</span>
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
            {photos.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {photos.map((p, i) => (
                  <button key={i} type="button" onClick={() => setPhotoIdx(i)}
                    className={cn("h-16 w-20 shrink-0 overflow-hidden rounded-xl border-2 transition-all",
                      i === photoIdx ? "border-emerald-600 ring-2 ring-emerald-500/20" : "border-stone-200 opacity-60 hover:opacity-100"
                    )}>
                    <img src={p} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* About */}
          <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="font-display text-2xl font-bold text-stone-900">{resource.name}</h1>
                <div className="mt-1.5 flex flex-wrap items-center gap-3 text-sm text-stone-500">
                  <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{resource.business.name}</span>
                  {resource.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-emerald-500" />{resource.location}</span>}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs uppercase text-stone-400">Available</p>
                <p className="font-display text-xl font-bold text-emerald-600">{resource.quantity} {resource.unit ?? "units"}</p>
              </div>
            </div>

            {resource.description && (
              <p className="text-sm text-stone-600 leading-relaxed border-t border-stone-100 pt-4">
                {resource.description}
              </p>
            )}

            <div className="grid grid-cols-2 gap-3 border-t border-stone-100 pt-4 text-xs sm:grid-cols-3">
              {[
                { label: "Type",     value: resource.resourceType },
                { label: "Quantity", value: `${resource.quantity} ${resource.unit ?? "units"}` },
                { label: "Location", value: resource.location ?? "On request" },
              ].map(({ label, value }) => (
                <div key={label}>
                  <span className="block font-semibold uppercase tracking-wider text-stone-400">{label}</span>
                  <span className="mt-0.5 block font-semibold text-stone-800">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming availability windows */}
          {upcomingWindows.length > 0 && (
            <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-3">
              <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
                <CalendarDays className="h-4 w-4 text-emerald-600" />
                <h2 className="text-sm font-bold text-stone-900">Upcoming Availability</h2>
              </div>
              {upcomingWindows.map(w => (
                <div key={w.id} className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
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
          )}

          {/* Condition disclosure */}
          <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <h2 className="text-sm font-bold text-stone-900">Condition Disclosure</h2>
              </div>
              {resource.hasPreExistingDamage ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800"><AlertTriangle className="h-3 w-3" /> Disclosed Wear</span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800"><CheckCircle2 className="h-3 w-3" /> Pristine</span>
              )}
            </div>
            {resource.hasPreExistingDamage ? (
              <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-2 text-xs text-amber-900">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <div><span className="font-bold">Pre-Existing Wear:</span><p className="mt-1 leading-relaxed">{resource.damageDescription}</p></div>
                </div>
                {resource.damagePhotos?.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 pt-1">
                    {resource.damagePhotos.map((dp, i) => (
                      <div key={i} className="aspect-square overflow-hidden rounded-lg border border-amber-200">
                        <img src={dp} alt="" className="h-full w-full object-cover" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs text-emerald-900">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                <span><span className="font-semibold">Declared Pristine.</span> You verify condition on physical handover.</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Booking + Calendar + Owner (5 cols) ── */}
        <div className="lg:col-span-5">
          <div className="sticky top-6 space-y-5">

            {/* Booking form */}
            <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <BookingPanel resource={resource} />
            </div>

            {/* Calendar */}
            <div>
              <div className="mb-2 flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-stone-500" />
                <h2 className="text-sm font-bold text-stone-800">Availability Calendar</h2>
              </div>
              <MiniCalendar resourceId={resource.id} />
            </div>

            {/* Owner */}
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-stone-500" />
                <h2 className="text-sm font-bold text-stone-800">About the Owner</h2>
              </div>
              <OwnerCard
                businessId={resource.business.id} businessName={resource.business.name}
                city={resource.business.city} state={resource.business.state} businessType={resource.business.businessType}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
