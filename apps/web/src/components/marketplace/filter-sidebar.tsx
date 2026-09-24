"use client";

import { useState } from "react";
import { ChevronDown, X, CalendarDays, MapPin, Star, SlidersHorizontal, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────

export interface Filters {
  categories: string[];
  location: string;        // free-text city/area search
  priceMin: number;        // paise
  priceMax: number;        // paise
  startDate: string;       // "YYYY-MM-DD" or ""
  endDate: string;         // "YYYY-MM-DD" or ""
  ratingMin: number;       // 0–5
}

export const DEFAULT_FILTERS: Filters = {
  categories: [],
  location:   "",
  priceMin:   0,
  priceMax:   500000,   // ₹5,000 in paise
  startDate:  "",
  endDate:    "",
  ratingMin:  0,
};

interface FilterSidebarProps {
  filters: Filters;
  onChange: (f: Filters) => void;
}

// ─── Resource type list (mirrors the API schema) ──────────────
export const RESOURCE_TYPE_FILTERS = [
  "Banquet Hall",
  "Event Space",
  "Meeting Space",
  "Kitchen Facility",
  "AV Equipment",
  "Furniture",
  "Vehicle",
  "Staff/Manpower",
  "Catering Equipment",
  "Cold Storage",
  "Parking Space",
  "Tent/Canopy",
  "Generator/Power",
  "Decor Items",
  "Linen/Textile",
  "Other",
] as const;

// Popular cities for quick-pick chips
const CITY_CHIPS = ["Pune", "Mumbai", "Delhi", "Bengaluru", "Hyderabad", "Goa", "Chennai"];

// ─── Collapsible section ──────────────────────────────────────

function Section({
  title,
  icon: Icon,
  children,
  defaultOpen = true,
  badge,
}: {
  title: string;
  icon?: React.FC<{ className?: string }>;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: number;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-stone-100 py-4">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between text-sm font-semibold text-stone-800"
      >
        <span className="flex items-center gap-2">
          {Icon && <Icon className="h-3.5 w-3.5 text-stone-400" />}
          {title}
          {badge ? (
            <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
              {badge}
            </span>
          ) : null}
        </span>
        <ChevronDown className={cn("h-4 w-4 text-stone-400 transition-transform duration-200", open && "rotate-180")} />
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────

export function FilterSidebar({ filters, onChange }: FilterSidebarProps) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });

  const toggleCategory = (cat: string) => {
    const next = filters.categories.includes(cat)
      ? filters.categories.filter((c) => c !== cat)
      : [...filters.categories, cat];
    set({ categories: next });
  };

  const today = new Date().toISOString().split("T")[0];

  const activeCount =
    filters.categories.length +
    (filters.location ? 1 : 0) +
    (filters.priceMin > 0 || filters.priceMax < 500000 ? 1 : 0) +
    (filters.startDate ? 1 : 0) +
    (filters.ratingMin > 0 ? 1 : 0);

  const reset = () => onChange(DEFAULT_FILTERS);

  return (
    <aside className="w-full rounded-2xl border border-stone-200 bg-white p-4 pb-6 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.06)]">

      {/* Header */}
      <div className="flex items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-3.5 w-3.5 text-stone-500" />
          <span className="text-sm font-bold text-stone-900">Filters</span>
          {activeCount > 0 && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
              {activeCount}
            </span>
          )}
        </div>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={reset}
            className="flex items-center gap-1 text-xs font-medium text-stone-400 hover:text-stone-600 transition-colors"
          >
            <X className="h-3 w-3" /> Clear all
          </button>
        )}
      </div>

      {/* ── Date availability ── */}
      <Section title="Available Dates" icon={CalendarDays} badge={filters.startDate ? 1 : 0}>
        <div className="space-y-2.5">
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-stone-400">From</label>
            <input
              type="date"
              value={filters.startDate}
              min={today}
              onChange={(e) => {
                const v = e.target.value;
                set({
                  startDate: v,
                  // Auto-advance endDate if it's before new startDate
                  endDate: filters.endDate && filters.endDate < v ? v : filters.endDate,
                });
              }}
              className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-stone-400">To</label>
            <input
              type="date"
              value={filters.endDate}
              min={filters.startDate || today}
              onChange={(e) => set({ endDate: e.target.value })}
              disabled={!filters.startDate}
              className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            />
          </div>
          {filters.startDate && (
            <button
              type="button"
              onClick={() => set({ startDate: "", endDate: "" })}
              className="flex items-center gap-1 text-xs font-medium text-stone-400 hover:text-stone-600 transition-colors"
            >
              <X className="h-3 w-3" /> Clear dates
            </button>
          )}
        </div>
      </Section>

      {/* ── Resource type ── */}
      <Section title="Resource Type" icon={Tag} badge={filters.categories.length || undefined}>
        <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
          {RESOURCE_TYPE_FILTERS.map((cat) => (
            <label key={cat} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1 py-1 hover:bg-stone-50 transition-colors">
              <input
                type="checkbox"
                checked={filters.categories.includes(cat)}
                onChange={() => toggleCategory(cat)}
                className="h-4 w-4 rounded accent-emerald-600"
              />
              <span className="text-sm text-stone-600">{cat}</span>
            </label>
          ))}
        </div>
      </Section>

      {/* ── Location ── */}
      <Section title="Location" icon={MapPin} badge={filters.location ? 1 : undefined}>
        <div className="space-y-3">
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="City, area, or landmark…"
              value={filters.location}
              onChange={(e) => set({ location: e.target.value })}
              className="w-full rounded-xl border border-stone-200 bg-stone-50 py-2.5 pl-9 pr-8 text-sm text-stone-700 placeholder:text-stone-400 focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
            />
            {filters.location && (
              <button
                type="button"
                onClick={() => set({ location: "" })}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* City chips */}
          <div className="flex flex-wrap gap-1.5">
            {CITY_CHIPS.map((city) => (
              <button
                key={city}
                type="button"
                onClick={() => set({ location: filters.location === city ? "" : city })}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-medium transition-all",
                  filters.location === city
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                    : "border-stone-200 text-stone-500 hover:border-stone-300 hover:bg-stone-50"
                )}
              >
                {city}
              </button>
            ))}
          </div>
        </div>
      </Section>

      {/* ── Price range ── */}
      <Section
        title="Price / Day (₹)"
        icon={SlidersHorizontal}
        badge={filters.priceMin > 0 || filters.priceMax < 500000 ? 1 : undefined}
      >
        <div className="space-y-3">
          {/* Min / Max inputs */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-stone-400">Min (₹)</label>
              <input
                type="number"
                min={0}
                max={filters.priceMax / 100}
                value={filters.priceMin / 100}
                onChange={(e) => set({ priceMin: Math.min(Math.max(0, Number(e.target.value)) * 100, filters.priceMax) })}
                className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-stone-400">Max (₹)</label>
              <input
                type="number"
                min={filters.priceMin / 100}
                value={filters.priceMax / 100}
                onChange={(e) => set({ priceMax: Math.max(Number(e.target.value) * 100, filters.priceMin) })}
                className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
              />
            </div>
          </div>

          {/* Max slider */}
          <input
            type="range"
            min={0}
            max={500000}
            step={5000}
            value={filters.priceMax}
            onChange={(e) => set({ priceMax: Number(e.target.value) })}
            className="w-full accent-emerald-600"
          />
          <div className="flex justify-between text-[10px] text-stone-400">
            <span>₹0</span>
            <span className="font-semibold text-stone-600">
              Up to ₹{(filters.priceMax / 100).toLocaleString()}
            </span>
            <span>₹5,000</span>
          </div>

          {/* Quick presets */}
          <div className="flex flex-wrap gap-1.5">
            {[
              { label: "Under ₹5K",  min: 0,      max: 500000 },
              { label: "₹5K–₹15K",  min: 500000, max: 1500000 },
              { label: "₹15K–₹50K", min: 1500000, max: 5000000 },
              { label: "₹50K+",     min: 5000000, max: 99999900 },
            ].map(({ label, min, max }) => (
              <button
                key={label}
                type="button"
                onClick={() => set({ priceMin: min, priceMax: max })}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-medium transition-all",
                  filters.priceMin === min && filters.priceMax === max
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                    : "border-stone-200 text-stone-500 hover:border-stone-300 hover:bg-stone-50"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </Section>

      {/* ── Rating ── */}
      <Section title="Owner Rating" icon={Star} badge={filters.ratingMin > 0 ? 1 : undefined} defaultOpen={true}>
        <div className="flex gap-1.5">
          {[0, 3, 4, 4.5].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => set({ ratingMin: r })}
              className={cn(
                "flex-1 rounded-xl border py-2 text-xs font-semibold transition-all",
                filters.ratingMin === r
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                  : "border-stone-200 text-stone-500 hover:bg-stone-50"
              )}
            >
              {r === 0 ? "Any" : `${r}★+`}
            </button>
          ))}
        </div>
      </Section>
    </aside>
  );
}
