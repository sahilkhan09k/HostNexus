"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  X, Calendar, ShieldCheck, AlertTriangle, Info, Loader2,
  CheckCircle2, Lock, ArrowRight, MessageSquare, DollarSign,
  TrendingDown, Handshake,
} from "lucide-react";
import { createBookingRequest, makeNegotiationOffer } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  resource: {
    id: string;
    name: string;
    resourceType: string;
    location: string | null;
    rentAmountPaise?: number;
    securityDepositPaise?: number;
    quantity: number;
    photos?: string[];
    hasPreExistingDamage?: boolean;
    damageDescription?: string | null;
    damagePhotos?: string[];
    business?: { id: string; name: string };
  };
}

type Tab = "book" | "negotiate";

export function BookingModal({ isOpen, onClose, resource }: BookingModalProps) {
  const router = useRouter();

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date();
  dayAfter.setDate(dayAfter.getDate() + 3);

  const [tab, setTab] = useState<Tab>("book");

  // Shared booking fields
  const [startDate, setStartDate] = useState(tomorrow.toISOString().split("T")[0]);
  const [endDate, setEndDate]     = useState(dayAfter.toISOString().split("T")[0]);
  const [quantity, setQuantity]   = useState(1);
  const [specialRequests, setSpecialRequests] = useState("");
  const [acknowledgedInspection, setAcknowledgedInspection] = useState(false);

  // Negotiate-tab fields
  const [offerPerDayINR, setOfferPerDayINR] = useState<number>(
    Math.round((resource.rentAmountPaise ?? 0) / 100 * 0.9) || 0
  );
  const [offerMessage, setOfferMessage] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successState, setSuccessState] = useState<"booked" | "negotiated" | null>(null);

  if (!isOpen) return null;

  // ── Pricing calculations ─────────────────────────────────────
  const start    = new Date(startDate);
  const end      = new Date(endDate);
  const diffDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000));

  const listedDailyINR  = (resource.rentAmountPaise ?? 0) / 100;
  const depositINR      = (resource.securityDepositPaise ?? 0) / 100;
  const totalRentINR    = listedDailyINR * diffDays * quantity;
  const totalEscrowINR  = totalRentINR + depositINR;

  const offerTotalRentINR   = offerPerDayINR * diffDays * quantity;
  const offerTotalEscrowINR = offerTotalRentINR + depositINR;
  const savingINR           = totalRentINR - offerTotalRentINR;
  const savingPct           = listedDailyINR > 0
    ? Math.round((savingINR / totalRentINR) * 100)
    : 0;

  // ── Book at listed price ─────────────────────────────────────
  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acknowledgedInspection) {
      setErrorMessage("Please acknowledge the 1-hour handover inspection policy.");
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await createBookingRequest({
        resourceId:      resource.id,
        quantity,
        startDate:       new Date(startDate).toISOString(),
        endDate:         new Date(endDate).toISOString(),
        specialRequests: specialRequests.trim() || undefined,
      });
      setSuccessState("booked");
      setTimeout(() => router.push("/dashboard/bookings"), 1500);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to submit booking request");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Negotiate: create booking then attach first offer ────────
  const handleNegotiate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acknowledgedInspection) {
      setErrorMessage("Please acknowledge the inspection policy before negotiating.");
      return;
    }
    if (offerPerDayINR <= 0) {
      setErrorMessage("Please enter a valid offer amount.");
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      // 1. Create booking at listed price (status: BOOKING_REQUESTED)
      const booking = await createBookingRequest({
        resourceId:      resource.id,
        quantity,
        startDate:       new Date(startDate).toISOString(),
        endDate:         new Date(endDate).toISOString(),
        specialRequests: specialRequests.trim() || undefined,
      });

      // 2. Immediately open a negotiation with the proposed daily rate
      await makeNegotiationOffer(
        booking.id,
        Math.round(offerPerDayINR * 100),
        offerMessage.trim() || undefined
      );

      setSuccessState("negotiated");
      setTimeout(() => router.push("/dashboard/bookings"), 1800);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to submit negotiation");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Shared date + quantity row ────────────────────────────────
  const DateQuantityRow = () => (
    <div className="grid grid-cols-3 gap-3">
      <div>
        <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">Start Date</label>
        <input type="date" value={startDate} min={new Date().toISOString().split("T")[0]}
          onChange={e => setStartDate(e.target.value)}
          className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs text-stone-800 focus:outline-emerald-500" required />
      </div>
      <div>
        <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">End Date</label>
        <input type="date" value={endDate} min={startDate}
          onChange={e => setEndDate(e.target.value)}
          className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs text-stone-800 focus:outline-emerald-500" required />
      </div>
      <div>
        <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">Quantity</label>
        <input type="number" min="1" max={resource.quantity || 100} value={quantity}
          onChange={e => setQuantity(parseInt(e.target.value, 10) || 1)}
          className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs text-stone-800 focus:outline-emerald-500" required />
      </div>
    </div>
  );

  // ── Inspection acknowledgement ─────────────────────────────────
  const InspectionAck = () => (
    <div className="rounded-xl border border-stone-300 bg-stone-100/70 p-4 space-y-3">
      <div className="flex items-start gap-2.5">
        <Lock className="w-4 h-4 text-emerald-700 mt-0.5 shrink-0" />
        <p className="text-xs text-stone-700 leading-relaxed">
          <span className="font-bold text-stone-900">1-Hour Handover Inspection Policy:</span>{" "}
          Upon handover you have a strict <span className="font-bold text-emerald-700">1-hour window</span> to
          verify condition and report undisclosed issues. Silent expiry auto-accepts.
        </p>
      </div>
      <label className="flex items-center gap-2 cursor-pointer border-t border-stone-200 pt-3">
        <input type="checkbox" checked={acknowledgedInspection}
          onChange={e => setAcknowledgedInspection(e.target.checked)}
          className="w-4 h-4 accent-emerald-600" />
        <span className="text-xs font-semibold text-stone-900">
          I understand the 1-hour inspection and return terms.
        </span>
      </label>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-hidden my-8">

        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4 bg-stone-50/70">
          <div>
            <h2 className="text-lg font-bold text-stone-900">Rent this Resource</h2>
            <p className="text-xs text-stone-500">
              Listed by{" "}
              <span className="font-semibold text-stone-700">
                {resource.business?.name || "Verified Owner"}
              </span>
            </p>
          </div>
          <button type="button" onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Success states ── */}
        {successState === "booked" && (
          <div className="p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-stone-900">Booking Request Sent!</h3>
            <p className="text-xs text-stone-500 max-w-sm mx-auto">
              The owner will review and respond. Once accepted, you'll fund the escrow to begin the chain of custody.
            </p>
            <p className="text-xs text-stone-400">Redirecting to bookings…</p>
          </div>
        )}

        {successState === "negotiated" && (
          <div className="p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
              <Handshake className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-stone-900">Negotiation Started!</h3>
            <p className="text-xs text-stone-500 max-w-sm mx-auto">
              Your counter-offer has been sent to the owner. Track the negotiation thread in your Bookings dashboard.
            </p>
            <p className="text-xs text-stone-400">Redirecting to bookings…</p>
          </div>
        )}

        {!successState && (
          <>
            {/* ── Tab bar ── */}
            <div className="flex border-b border-stone-200">
              <button
                type="button"
                onClick={() => { setTab("book"); setErrorMessage(null); }}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-semibold transition-colors",
                  tab === "book"
                    ? "border-b-2 border-emerald-600 text-emerald-700 bg-emerald-50/60"
                    : "text-stone-500 hover:text-stone-800 hover:bg-stone-50"
                )}
              >
                <DollarSign className="w-4 h-4" />
                Book at Listed Price
              </button>
              <button
                type="button"
                onClick={() => { setTab("negotiate"); setErrorMessage(null); }}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-semibold transition-colors",
                  tab === "negotiate"
                    ? "border-b-2 border-amber-500 text-amber-700 bg-amber-50/60"
                    : "text-stone-500 hover:text-stone-800 hover:bg-stone-50"
                )}
              >
                <TrendingDown className="w-4 h-4" />
                Negotiate Price
              </button>
            </div>

            <div className="p-6 space-y-5">
              {errorMessage && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-800">
                  {errorMessage}
                </div>
              )}

              {/* ── Resource banner ── */}
              <div className="flex items-start gap-4 p-3.5 rounded-xl border border-stone-200 bg-stone-50/50">
                {resource.photos?.[0] ? (
                  <img src={resource.photos[0]} alt={resource.name}
                    className="w-16 h-16 rounded-lg object-cover border border-stone-200 shrink-0" />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-stone-200 shrink-0 flex items-center justify-center text-xs text-stone-400 font-bold">IMG</div>
                )}
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    {resource.resourceType}
                  </span>
                  <h4 className="text-sm font-bold text-stone-900 mt-1 truncate">{resource.name}</h4>
                  <p className="text-xs text-stone-500">{resource.location || "Location on confirmation"}</p>
                  {/* Listed price */}
                  <p className="mt-1 text-xs font-semibold text-stone-800">
                    Listed:{" "}
                    <span className="text-emerald-700">
                      ₹{listedDailyINR.toLocaleString()}/day
                    </span>
                    {depositINR > 0 && (
                      <span className="ml-2 text-stone-400">+ ₹{depositINR.toLocaleString()} deposit</span>
                    )}
                  </p>
                </div>
              </div>

              {/* ── Condition badge ── */}
              {resource.hasPreExistingDamage ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    Pre-Existing Wear Disclosed
                  </div>
                  <p className="text-xs text-amber-800">{resource.damageDescription || "Owner noted wear. Review before renting."}</p>
                  {resource.damagePhotos && resource.damagePhotos.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pt-1">
                      {resource.damagePhotos.map((p, i) => (
                        <img key={i} src={p} alt="wear" className="w-14 h-14 rounded-lg object-cover border border-amber-300 shrink-0" />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 flex items-center gap-2.5 text-xs text-emerald-900">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  Pristine Condition Declared — Zero pre-existing wear.
                </div>
              )}

              {/* ── BOOK TAB ── */}
              {tab === "book" && (
                <form onSubmit={handleBook} className="space-y-5">
                  <DateQuantityRow />

                  {/* Escrow summary */}
                  <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 space-y-2 text-xs">
                    <div className="flex justify-between text-stone-600">
                      <span>Rental ({diffDays}d × ₹{listedDailyINR.toLocaleString()} × {quantity} unit):</span>
                      <span className="font-semibold text-stone-800">₹{totalRentINR.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-emerald-700 font-medium">
                      <span>Refundable Deposit (Escrow):</span>
                      <span>₹{depositINR.toLocaleString()}</span>
                    </div>
                    <div className="border-t border-stone-200 pt-2 flex justify-between text-sm font-bold text-stone-900">
                      <span>Total Escrow:</span>
                      <span className="text-emerald-700">₹{totalEscrowINR.toLocaleString()}</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">Special Requests (optional)</label>
                    <textarea rows={2} value={specialRequests} onChange={e => setSpecialRequests(e.target.value)}
                      placeholder="Any specific requirements…"
                      className="w-full resize-none rounded-xl border border-stone-200 px-3 py-2 text-xs text-stone-800 focus:outline-emerald-500" />
                  </div>

                  <InspectionAck />

                  <div className="flex items-center justify-end gap-3 pt-1">
                    <button type="button" onClick={onClose} disabled={isSubmitting}
                      className="rounded-xl border border-stone-200 px-4 py-2.5 text-xs font-semibold text-stone-600 hover:bg-stone-50">
                      Cancel
                    </button>
                    <button type="submit" disabled={isSubmitting || !acknowledgedInspection}
                      className="flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors disabled:opacity-50">
                      {isSubmitting
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <><span>Submit Booking Request</span><ArrowRight className="w-3.5 h-3.5" /></>}
                    </button>
                  </div>
                </form>
              )}

              {/* ── NEGOTIATE TAB ── */}
              {tab === "negotiate" && (
                <form onSubmit={handleNegotiate} className="space-y-5">
                  <DateQuantityRow />

                  {/* Offer input */}
                  <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 space-y-4">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="w-4 h-4 text-amber-600" />
                      <p className="text-sm font-bold text-amber-900">Your Counter-Offer</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">
                          Your Offer (₹ / day) *
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm font-medium">₹</span>
                          <input
                            type="number" min="1" required
                            value={offerPerDayINR || ""}
                            onChange={e => setOfferPerDayINR(parseFloat(e.target.value) || 0)}
                            placeholder={String(Math.round(listedDailyINR * 0.85))}
                            className="w-full rounded-xl border border-amber-300 bg-white pl-7 pr-3 py-2.5 text-sm font-bold text-stone-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all"
                          />
                        </div>
                        <p className="mt-1 text-[10px] text-stone-400">
                          Listed: ₹{listedDailyINR.toLocaleString()}/day
                        </p>
                      </div>
                      <div className="rounded-xl border border-stone-200 bg-white p-3 space-y-1.5 text-xs">
                        <p className="font-semibold text-stone-700">Your offer summary</p>
                        <div className="flex justify-between text-stone-600">
                          <span>Rent ({diffDays}d × ₹{offerPerDayINR.toLocaleString()}):</span>
                          <span className="font-semibold">₹{offerTotalRentINR.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-stone-600">
                          <span>+ Deposit:</span>
                          <span>₹{depositINR.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between border-t border-stone-100 pt-1 text-sm font-bold text-stone-900">
                          <span>Total Escrow:</span>
                          <span className="text-amber-700">₹{offerTotalEscrowINR.toLocaleString()}</span>
                        </div>
                        {savingINR > 0 && (
                          <p className="text-emerald-600 font-semibold text-[11px]">
                            You save ₹{savingINR.toLocaleString()} ({savingPct}% off)
                          </p>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">
                        Message to Owner (optional)
                      </label>
                      <textarea rows={2} value={offerMessage} onChange={e => setOfferMessage(e.target.value)}
                        placeholder="e.g. We're a long-term client, happy to discuss a fair rate for 5+ days…"
                        className="w-full resize-none rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-800 focus:outline-amber-400 focus:border-amber-300" />
                    </div>

                    <div className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 text-[11px] text-sky-800">
                      <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-sky-600" />
                      <span>
                        A booking request is created at the listed price. Your counter-offer is sent to the owner, who can
                        accept, counter back, or reject. If they accept, the booking is confirmed at the negotiated rate.
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">Special Requests (optional)</label>
                    <textarea rows={2} value={specialRequests} onChange={e => setSpecialRequests(e.target.value)}
                      placeholder="Any specific requirements…"
                      className="w-full resize-none rounded-xl border border-stone-200 px-3 py-2 text-xs text-stone-800 focus:outline-emerald-500" />
                  </div>

                  <InspectionAck />

                  <div className="flex items-center justify-end gap-3 pt-1">
                    <button type="button" onClick={onClose} disabled={isSubmitting}
                      className="rounded-xl border border-stone-200 px-4 py-2.5 text-xs font-semibold text-stone-600 hover:bg-stone-50">
                      Cancel
                    </button>
                    <button type="submit" disabled={isSubmitting || !acknowledgedInspection || offerPerDayINR <= 0}
                      className="flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors disabled:opacity-50">
                      {isSubmitting
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <><MessageSquare className="w-3.5 h-3.5" /><span>Send Counter-Offer</span></>}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
