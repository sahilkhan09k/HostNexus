"use client";

import { useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Filters {
  categories: string[];
  location: string;
  priceMax: number;
  availability: "all" | "today" | "weekend" | "next7";
  capacityMin: number;
  ratingMin: number;
}

interface FilterSidebarProps {
  filters: Filters;
  onChange: (f: Filters) => void;
}

const CATEGORIES = [
  "Banquet Hall",
  "Commercial Kitchen",
  "AV Equipment",
  "Event Space",
  "Furniture & Fixtures",
  "Vehicle Fleet",
  "Parking",
  "Cold Storage",
];

const LOCATIONS = ["All Locations", "Koregaon Park", "Viman Nagar", "Bund Garden", "Andheri East", "Santacruz", "Bandra"];
const AVAILABILITY_OPTIONS = [
  { value: "all",     label: "Any time" },
  { value: "today",   label: "Today" },
  { value: "weekend", label: "This weekend" },
  { value: "next7",   label: "Next 7 days" },
] as const;

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-stone-100 py-4">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between text-sm font-semibold text-stone-800"
      >
        {title}
        <ChevronDown className={cn("h-4 w-4 text-stone-400 transition-transform duration-200", open && "rotate-180")} />
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}

export function FilterSidebar({ filters, onChange }: FilterSidebarProps) {
  const toggleCategory = (cat: string) => {
    const next = filters.categories.includes(cat)
      ? filters.categories.filter((c) => c !== cat)
      : [...filters.categories, cat];
    onChange({ ...filters, categories: next });
  };

  const activeCount =
    filters.categories.length +
    (filters.location ? 1 : 0) +
    (filters.priceMax < 100000 ? 1 : 0) +
    (filters.availability !== "all" ? 1 : 0) +
    (filters.capacityMin > 0 ? 1 : 0) +
    (filters.ratingMin > 0 ? 1 : 0);

  const reset = () =>
    onChange({ categories: [], location: "", priceMax: 100000, availability: "all", capacityMin: 0, ratingMin: 0 });

  return (
    <aside className="w-full rounded-2xl border border-stone-200 bg-white p-4 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.06)]">
      {/* Header */}
      <div className="flex items-center justify-between pb-3">
        <span className="text-sm font-bold text-stone-900">
          Filters {activeCount > 0 && (
            <span className="ml-1.5 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
              {activeCount}
            </span>
          )}
        </span>
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

      {/* Category */}
      <Section title="Resource Type">
        <div className="space-y-2">
          {CATEGORIES.map((cat) => (
            <label key={cat} className="flex cursor-pointer items-center gap-2.5">
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

      {/* Location */}
      <Section title="Location">
        <select
          value={filters.location}
          onChange={(e) => onChange({ ...filters, location: e.target.value })}
          className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        >
          {LOCATIONS.map((loc) => (
            <option key={loc} value={loc === "All Locations" ? "" : loc}>{loc}</option>
          ))}
        </select>
      </Section>

      {/* Availability */}
      <Section title="Availability">
        <div className="grid grid-cols-2 gap-2">
          {AVAILABILITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ ...filters, availability: opt.value })}
              className={cn(
                "rounded-lg border px-3 py-2 text-xs font-medium transition-all",
                filters.availability === opt.value
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                  : "border-stone-200 text-stone-500 hover:border-stone-300 hover:bg-stone-50"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </Section>

      {/* Max price */}
      <Section title="Max Price / Day">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs text-stone-400">Up to</span>
            <span className="text-xs font-bold text-stone-700">
              ₹{(filters.priceMax / 1000).toFixed(0)}K
            </span>
          </div>
          <input
            type="range"
            min={5000}
            max={100000}
            step={5000}
            value={filters.priceMax}
            onChange={(e) => onChange({ ...filters, priceMax: Number(e.target.value) })}
            className="w-full accent-emerald-600"
          />
          <div className="mt-1 flex justify-between text-[10px] text-stone-400">
            <span>₹5K</span><span>₹1L</span>
          </div>
        </div>
      </Section>

      {/* Min capacity */}
      <Section title="Min. Capacity (pax)" defaultOpen={false}>
        <div className="space-y-2">
          {[0, 50, 100, 200, 500].map((cap) => (
            <label key={cap} className="flex cursor-pointer items-center gap-2.5">
              <input
                type="radio"
                name="capacity"
                checked={filters.capacityMin === cap}
                onChange={() => onChange({ ...filters, capacityMin: cap })}
                className="h-4 w-4 accent-emerald-600"
              />
              <span className="text-sm text-stone-600">{cap === 0 ? "Any" : `${cap}+ pax`}</span>
            </label>
          ))}
        </div>
      </Section>

      {/* Rating */}
      <Section title="Minimum Rating" defaultOpen={false}>
        <div className="flex gap-2">
          {[0, 3, 4, 4.5].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => onChange({ ...filters, ratingMin: r })}
              className={cn(
                "flex-1 rounded-lg border py-1.5 text-xs font-medium transition-all",
                filters.ratingMin === r
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                  : "border-stone-200 text-stone-500 hover:bg-stone-50"
              )}
            >
              {r === 0 ? "Any" : `${r}★`}
            </button>
          ))}
        </div>
      </Section>
    </aside>
  );
}
