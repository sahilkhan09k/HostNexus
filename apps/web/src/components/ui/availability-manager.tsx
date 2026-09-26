"use client";

import { useState, useEffect, useCallback, useImperativeHandle, forwardRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarDays, Plus, Trash2, AlertCircle, CheckCircle2,
  Info, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AuthService } from "@/lib/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const EASE = [0.22, 1, 0.36, 1] as const;

// ─── Types ────────────────────────────────────────────────────

export interface AvailabilityWindow {
  id?: string;       // undefined for local-only (not yet saved)
  fromDate: string;  // "YYYY-MM-DD"
  toDate: string;
  note: string;
}

export interface AvailabilityManagerHandle {
  /** Call after resource is created/saved to persist windows to the API */
  saveToApi: (resourceId: string) => Promise<void>;
}

interface Props {
  /** If provided, loads existing windows on mount and saves to this resourceId */
  resourceId?: string;
  /** Called whenever the local list changes — parent can use for dirty tracking */
  onChange?: (windows: AvailabilityWindow[]) => void;
}

const INPUT = cn(
  "w-full rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-sm text-stone-800",
  "placeholder:text-stone-400 focus:border-emerald-400 focus:bg-white focus:outline-none",
  "focus:ring-2 focus:ring-emerald-500/20 transition-all"
);

function today() {
  return new Date().toISOString().split("T")[0];
}
function plusDays(base: string, n: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

// ─── Component ────────────────────────────────────────────────

const AvailabilityManager = forwardRef<AvailabilityManagerHandle, Props>(
  function AvailabilityManager({ resourceId, onChange }, ref) {
    const [windows, setWindows]       = useState<AvailabilityWindow[]>([]);
    const [loading, setLoading]       = useState(!!resourceId);
    const [saving, setSaving]         = useState(false);
    const [saveError, setSaveError]   = useState<string | null>(null);
    const [savedOk, setSavedOk]       = useState(false);

    // Add-window form state
    const [fromDate, setFromDate] = useState(today());
    const [toDate,   setToDate]   = useState(plusDays(today(), 7));
    const [note,     setNote]     = useState("");
    const [addError, setAddError] = useState<string | null>(null);

    // ── Load existing windows when editing ─────────────────────
    useEffect(() => {
      if (!resourceId) { setLoading(false); return; }
      AuthService.fetchWithAuth(`${API_BASE}/api/resources/${resourceId}/availability`)
        .then(r => r.json())
        .then(body => {
          if (body.success) {
            const loaded: AvailabilityWindow[] = (body.data.windows as any[]).map(w => ({
              id:       w.id,
              fromDate: w.fromDate.split("T")[0],
              toDate:   w.toDate.split("T")[0],
              note:     w.note ?? "",
            }));
            setWindows(loaded);
            onChange?.(loaded);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [resourceId]);

    // ── Expose saveToApi to parent ─────────────────────────────
    const saveToApi = useCallback(async (rid: string) => {
      setSaving(true);
      setSaveError(null);
      try {
        const payload = windows.map(w => ({
          fromDate: new Date(w.fromDate).toISOString(),
          toDate:   new Date(w.toDate).toISOString(),
          note:     w.note || undefined,
        }));
        const res = await AuthService.fetchWithAuth(
          `${API_BASE}/api/resources/${rid}/availability`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ windows: payload }),
          }
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error?.message ?? "Failed to save availability");
        }
        const body = await res.json();
        // Sync IDs back from server
        const saved: AvailabilityWindow[] = (body.data.windows as any[]).map(w => ({
          id:       w.id,
          fromDate: w.fromDate.split("T")[0],
          toDate:   w.toDate.split("T")[0],
          note:     w.note ?? "",
        }));
        setWindows(saved);
        onChange?.(saved);
        setSavedOk(true);
        setTimeout(() => setSavedOk(false), 3000);
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "Save failed");
        throw err; // re-throw so parent can handle
      } finally {
        setSaving(false);
      }
    }, [windows, onChange]);

    useImperativeHandle(ref, () => ({ saveToApi }), [saveToApi]);

    // ── Add a window locally ───────────────────────────────────
    const addWindow = () => {
      setAddError(null);
      if (!fromDate || !toDate) { setAddError("Both dates are required"); return; }
      if (new Date(toDate) < new Date(fromDate)) {
        setAddError("End date must be on or after start date");
        return;
      }
      // Check no exact duplicate
      const exists = windows.some(w => w.fromDate === fromDate && w.toDate === toDate);
      if (exists) { setAddError("A window with these exact dates already exists"); return; }

      const next = [...windows, { fromDate, toDate, note: note.trim() }];
      setWindows(next);
      onChange?.(next);
      setNote("");
      setFromDate(today());
      setToDate(plusDays(today(), 7));
    };

    // ── Remove a window locally ────────────────────────────────
    const removeWindow = (index: number) => {
      const next = windows.filter((_, i) => i !== index);
      setWindows(next);
      onChange?.(next);
    };

    // ── Format display ─────────────────────────────────────────
    const fmt = (d: string) =>
      new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
      });

    const days = (from: string, to: string) => {
      const diff = (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000;
      return Math.round(diff) + 1;
    };

    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-5">
        {/* Header */}
        <div className="border-b border-stone-100 pb-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-emerald-600" />
            <h2 className="text-base font-semibold text-stone-900">Availability Windows</h2>
          </div>
          <p className="mt-0.5 text-xs text-stone-500">
            Define the date ranges when this resource is available for booking.
            Renters can only book within these windows.
          </p>
        </div>

        {/* Info note */}
        <div className="flex items-start gap-2.5 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-800">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-600" />
          <span>
            You can add multiple windows (e.g. Mon–Fri every week).
            Days already booked by an accepted booking will show as unavailable to new renters automatically.
          </span>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-2">
            {[1, 2].map(i => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-stone-100" />
            ))}
          </div>
        )}

        {/* Existing windows list */}
        {!loading && (
          <AnimatePresence initial={false}>
            {windows.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-stone-300 py-8 text-center"
              >
                <CalendarDays className="h-8 w-8 text-stone-300" />
                <p className="text-sm font-medium text-stone-500">No availability windows yet</p>
                <p className="text-xs text-stone-400">
                  Add at least one window below so renters can book this resource.
                </p>
              </motion.div>
            ) : (
              <div className="space-y-2">
                {windows.map((w, i) => (
                  <motion.div
                    key={`${w.fromDate}-${w.toDate}-${i}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.2, ease: EASE }}
                    className="flex items-center gap-3 rounded-xl border border-green-100 bg-green-50/60 px-4 py-3"
                  >
                    <CalendarDays className="h-4 w-4 shrink-0 text-green-600" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-stone-800">
                        {fmt(w.fromDate)} → {fmt(w.toDate)}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-stone-400">
                        <Clock className="h-3 w-3" />
                        {days(w.fromDate, w.toDate)} days
                        {w.note && <span className="truncate">· {w.note}</span>}
                        {!w.id && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                            unsaved
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeWindow(i)}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-stone-400 hover:bg-rose-50 hover:text-rose-500 transition-colors"
                      aria-label="Remove window"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </motion.div>
                ))}
              </div>
            )}
          </AnimatePresence>
        )}

        {/* Add new window form */}
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
            Add Availability Window
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-600">From Date *</label>
              <input
                type="date"
                value={fromDate}
                min={today()}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  if (e.target.value > toDate) setToDate(plusDays(e.target.value, 1));
                }}
                className={cn(INPUT, "bg-white")}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-600">To Date *</label>
              <input
                type="date"
                value={toDate}
                min={fromDate}
                onChange={(e) => setToDate(e.target.value)}
                className={cn(INPUT, "bg-white")}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-stone-600">
              Note <span className="text-stone-400">(optional)</span>
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Weekdays only, morning pickup"
              maxLength={200}
              className={cn(INPUT, "bg-white")}
            />
          </div>

          {addError && (
            <div className="flex items-center gap-2 text-xs text-rose-600">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {addError}
            </div>
          )}

          <button
            type="button"
            onClick={addWindow}
            className={cn(
              "flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50",
              "px-4 py-2 text-sm font-semibold text-emerald-700",
              "hover:bg-emerald-100 transition-colors active:scale-[0.98]"
            )}
          >
            <Plus className="h-4 w-4" />
            Add Window
          </button>
        </div>

        {/* Save feedback (shown when editing and windows are saved inline) */}
        <AnimatePresence>
          {saveError && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              {saveError}
            </motion.div>
          )}
          {savedOk && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Availability saved successfully
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quick inline save button (only shown on edit page) */}
        {resourceId && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => saveToApi(resourceId)}
              disabled={saving}
              className={cn(
                "flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white",
                "shadow-[0_2px_8px_rgba(235,131,34,0.25)] hover:bg-emerald-700 transition-all active:scale-[0.98]",
                "disabled:opacity-60 disabled:cursor-not-allowed"
              )}
            >
              {saving ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Save Availability
            </button>
          </div>
        )}
      </div>
    );
  }
);

export default AvailabilityManager;
