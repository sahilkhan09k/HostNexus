"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, SlidersHorizontal, LayoutGrid, List,
  X, Package,
} from "lucide-react";
import { ResourceCard, type ResourceCardData } from "@/components/marketplace/resource-card";
import { FilterSidebar, DEFAULT_FILTERS, type Filters } from "@/components/marketplace/filter-sidebar";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const EASE = [0.22, 1, 0.36, 1] as const;

// ─── API type (same shape as public marketplace) ──────────────
interface ApiResource {
  id: string;
  name: string;
  resourceType: string;
  description: string | null;
  quantity: number;
  unit: string | null;
  location: string | null;
  isActive: boolean;
  rentAmountPaise?: number;
  securityDepositPaise?: number;
  photos?: string[];
  hasPreExistingDamage?: boolean;
  damageDescription?: string | null;
  damagePhotos?: string[];
  business: {
    id: string; name: string;
    city: string | null; state: string | null; businessType: string | null;
    ownerRating: number | null; reviewCount: number;
  };
}

const TYPE_STYLES: Record<string, { categoryColor: string; accentColor: string; imageBg: string }> = {
  "Banquet Hall":     { categoryColor: "bg-violet-100 text-violet-700", accentColor: "text-violet-600", imageBg: "bg-gradient-to-br from-violet-100 to-indigo-100" },
  "Event Space":      { categoryColor: "bg-rose-100 text-rose-700",     accentColor: "text-rose-600",   imageBg: "bg-gradient-to-br from-rose-100 to-pink-100"   },
  "Meeting Space":    { categoryColor: "bg-sky-100 text-sky-700",       accentColor: "text-sky-600",    imageBg: "bg-gradient-to-br from-sky-100 to-cyan-100"    },
  "Kitchen Facility": { categoryColor: "bg-amber-100 text-amber-700",   accentColor: "text-amber-600",  imageBg: "bg-gradient-to-br from-amber-100 to-orange-100"},
  "AV Equipment":     { categoryColor: "bg-sky-100 text-sky-700",       accentColor: "text-sky-600",    imageBg: "bg-gradient-to-br from-sky-100 to-blue-100"   },
  "Furniture":        { categoryColor: "bg-lime-100 text-lime-700",     accentColor: "text-lime-600",   imageBg: "bg-gradient-to-br from-lime-100 to-green-100" },
  "Vehicle":          { categoryColor: "bg-teal-100 text-teal-700",     accentColor: "text-teal-600",   imageBg: "bg-gradient-to-br from-teal-100 to-emerald-100"},
  "Staff/Manpower":   { categoryColor: "bg-indigo-100 text-indigo-700", accentColor: "text-indigo-600", imageBg: "bg-gradient-to-br from-indigo-100 to-purple-100"},
};
const DEFAULT_STYLE = { categoryColor: "bg-stone-100 text-stone-700", accentColor: "text-stone-600", imageBg: "bg-gradient-to-br from-stone-100 to-slate-100" };

function mapApiResource(r: ApiResource): ResourceCardData {
  const style = TYPE_STYLES[r.resourceType] ?? DEFAULT_STYLE;
  const loc = r.location || (r.business.city ? `${r.business.city}, ${r.business.state ?? ""}`.trim() : "India");
  return {
    id: r.id, category: r.resourceType,
    categoryColor: style.categoryColor, accentColor: style.accentColor,
    title: r.name, business: r.business.name, businessId: r.business.id,
    location: loc,
    price: r.rentAmountPaise ? `₹${(r.rentAmountPaise / 100).toLocaleString()}` : "Contact for pricing",
    unit: "", capacity: `${r.quantity} ${r.unit ?? "units"}`,
    rating: r.business.ownerRating ?? null, reviews: r.business.reviewCount ?? 0,
    available: r.isActive, availableText: r.isActive ? "Available" : "Unavailable",
    tags: [r.resourceType], imageBg: style.imageBg,
    rentAmountPaise: r.rentAmountPaise, securityDepositPaise: r.securityDepositPaise,
    photos: r.photos, hasPreExistingDamage: r.hasPreExistingDamage,
    damageDescription: r.damageDescription, damagePhotos: r.damagePhotos,
  };
}

const SORT_OPTIONS = [
  { value: "relevance",  label: "Most Relevant"    },
  { value: "price-asc",  label: "Price: Low → High" },
  { value: "price-desc", label: "Price: High → Low" },
  { value: "rating",     label: "Highest Rated"    },
];

// ─── Active filter chips ──────────────────────────────────────
function FilterChips({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
  const chips: { label: string; onRemove: () => void }[] = [];
  filters.categories.forEach(c =>
    chips.push({ label: c, onRemove: () => onChange({ ...filters, categories: filters.categories.filter(x => x !== c) }) })
  );
  if (filters.location) chips.push({ label: `📍 ${filters.location}`, onRemove: () => onChange({ ...filters, location: "" }) });
  if (filters.startDate && filters.endDate) chips.push({ label: `${filters.startDate} → ${filters.endDate}`, onRemove: () => onChange({ ...filters, startDate: "", endDate: "" }) });
  else if (filters.startDate) chips.push({ label: `From ${filters.startDate}`, onRemove: () => onChange({ ...filters, startDate: "", endDate: "" }) });
  if (filters.priceMin > 0 || filters.priceMax < 500000) chips.push({ label: `₹${(filters.priceMin/100).toLocaleString()}–₹${(filters.priceMax/100).toLocaleString()}`, onRemove: () => onChange({ ...filters, priceMin: 0, priceMax: 500000 }) });
  if (filters.ratingMin > 0) chips.push({ label: `${filters.ratingMin}★+`, onRemove: () => onChange({ ...filters, ratingMin: 0 }) });

  if (chips.length === 0) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {chips.map(({ label, onRemove }) => (
        <span key={label} className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 py-1 pl-3 pr-2 text-xs font-medium text-emerald-700">
          {label}
          <button type="button" onClick={onRemove} className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-emerald-200 transition-colors">
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}
      <button type="button" onClick={() => onChange(DEFAULT_FILTERS)} className="text-xs font-medium text-stone-400 underline underline-offset-2 hover:text-stone-600 transition-colors">
        Clear all
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────
export default function DashboardMarketplacePage() {
  const router = useRouter();
  const { fetchWithAuth } = useAuth();
  const [allResources, setAllResources] = useState<ResourceCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("relevance");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const fetchResources = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.set("startDate", new Date(filters.startDate + "T00:00:00").toISOString());
      if (filters.endDate)   params.set("endDate",   new Date(filters.endDate   + "T00:00:00").toISOString());
      const qs = params.toString();
      const res = await fetchWithAuth(`${API_BASE}/api/resources/all${qs ? `?${qs}` : ""}`);
      if (!res.ok) return;
      const data = await res.json();
      setAllResources((data?.data?.resources ?? []).map(mapApiResource));
    } catch { /* silent */ } finally { setLoading(false); }
  }, [fetchWithAuth, filters.startDate, filters.endDate]);

  useEffect(() => { fetchResources(); }, [fetchResources]);

  const filtered = useMemo(() => {
    let items = allResources;
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(r =>
        r.title.toLowerCase().includes(q) || r.business.toLowerCase().includes(q) ||
        r.location.toLowerCase().includes(q) || r.category.toLowerCase().includes(q)
      );
    }
    if (filters.categories.length) items = items.filter(r => filters.categories.includes(r.category));
    if (filters.location) items = items.filter(r => r.location.toLowerCase().includes(filters.location.toLowerCase()));
    if (filters.priceMin > 0) items = items.filter(r => (r.rentAmountPaise ?? 0) >= filters.priceMin);
    if (filters.priceMax < 500000) items = items.filter(r => (r.rentAmountPaise ?? 0) <= filters.priceMax);
    if (filters.ratingMin > 0) items = items.filter(r => (r.rating ?? 0) >= filters.ratingMin);

    if (sort === "price-asc")  items = [...items].sort((a, b) => (a.rentAmountPaise ?? 0) - (b.rentAmountPaise ?? 0));
    if (sort === "price-desc") items = [...items].sort((a, b) => (b.rentAmountPaise ?? 0) - (a.rentAmountPaise ?? 0));
    if (sort === "rating")     items = [...items].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    return items;
  }, [allResources, search, filters, sort]);

  const activeCount =
    filters.categories.length + (filters.location ? 1 : 0) + (filters.startDate ? 1 : 0) +
    (filters.priceMin > 0 || filters.priceMax < 500000 ? 1 : 0) + (filters.ratingMin > 0 ? 1 : 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-stone-900">Browse Resources</h1>
          <p className="mt-1 text-sm text-stone-500">Discover resources from verified businesses across India</p>
        </div>
        <span className="rounded-xl bg-stone-100 px-3 py-1.5 text-xs font-semibold text-stone-600 tabular-nums">
          {loading ? "…" : `${filtered.length} results`}
        </span>
      </div>

      {/* Search + controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input
            type="search" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search banquet halls, equipment, vehicles…"
            className="w-full rounded-xl border border-stone-200 bg-white py-2.5 pl-10 pr-4 text-sm text-stone-800 placeholder:text-stone-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
          />
          {search && (
            <button type="button" onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Mobile filter toggle */}
          <button
            type="button" onClick={() => setSidebarOpen(!sidebarOpen)}
            className={cn("flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all xl:hidden",
              activeCount > 0 ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
            )}
          >
            <SlidersHorizontal className="h-4 w-4" /> Filters
            {activeCount > 0 && <span className="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white">{activeCount}</span>}
          </button>
          <select value={sort} onChange={e => setSort(e.target.value)}
            className="rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-700 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <div className="flex overflow-hidden rounded-xl border border-stone-200 bg-white">
            {(["grid", "list"] as const).map(v => (
              <button key={v} type="button" onClick={() => setView(v)}
                className={cn("flex h-9 w-9 items-center justify-center transition-colors", view === v ? "bg-emerald-600 text-white" : "text-stone-400 hover:bg-stone-50")}
              >
                {v === "grid" ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content: sidebar + grid */}
      <div className="flex gap-5">
        {/* Sidebar — desktop, independent scroll */}
        <div className="hidden w-60 shrink-0 xl:block">
          <div className="sticky top-0 h-[calc(100vh-7rem)] overflow-y-auto pb-4">
            <FilterSidebar filters={filters} onChange={setFilters} />
          </div>
        </div>

        {/* Mobile sidebar drawer */}
        <AnimatePresence>
          {sidebarOpen && (
            <div className="fixed inset-0 z-50 xl:hidden">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
              <motion.div initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
                transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
                className="absolute inset-y-0 left-0 w-80 overflow-y-auto bg-[#FAFAFA] p-4 shadow-xl"
              >
                <div className="mb-4 flex items-center justify-between">
                  <span className="font-bold text-stone-900">Filters</span>
                  <button type="button" onClick={() => setSidebarOpen(false)} className="text-stone-400 hover:text-stone-600"><X className="h-5 w-5" /></button>
                </div>
                <FilterSidebar filters={filters} onChange={f => { setFilters(f); }} />
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Grid */}
        <div className="min-w-0 flex-1">
          <FilterChips filters={filters} onChange={setFilters} />

          {loading && (
            <div className={cn("grid gap-4", view === "grid" ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3" : "grid-cols-1")}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-64 animate-pulse rounded-2xl bg-stone-100" style={{ animationDelay: `${i * 60}ms` }} />
              ))}
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-white py-16 text-center">
              <Package className="h-10 w-10 text-stone-300" />
              <p className="mt-4 text-sm font-semibold text-stone-600">No resources found</p>
              <p className="mt-1 text-xs text-stone-400">
                {filters.startDate ? "No resources available on selected dates." : "Try adjusting your filters."}
              </p>
              <button type="button" onClick={() => { setSearch(""); setFilters(DEFAULT_FILTERS); }}
                className="mt-4 rounded-xl border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors">
                Clear all filters
              </button>
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <div className={cn("grid gap-4", view === "grid" ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3" : "grid-cols-1")}>
              {filtered.map((resource, i) => (
                <ResourceCard
                  key={resource.id} data={resource} index={i}
                  onViewDetails={id => router.push(`/dashboard/marketplace/${id}`)}
                  onBook={id => router.push(`/dashboard/marketplace/${id}`)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
