"use client";

import { useState, useMemo, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, SlidersHorizontal, LayoutGrid, List,
  MapPin, X, CalendarDays, Tag, Star,
} from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { ResourceCard, type ResourceCardData } from "@/components/marketplace/resource-card";
import { FilterSidebar, DEFAULT_FILTERS, type Filters } from "@/components/marketplace/filter-sidebar";
import { BookingModal } from "@/components/marketplace/booking-modal";
import { cn } from "@/lib/utils";
import { AuthService } from "@/lib/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const EASE = [0.22, 1, 0.36, 1] as const;

// ─── API resource type ────────────────────────────────────────

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
    id: string;
    name: string;
    city: string | null;
    state: string | null;
    businessType: string | null;
    ownerRating: number | null;
    reviewCount: number;
  };
}

// ─── Color map ────────────────────────────────────────────────

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
  const locationStr = r.location || (r.business.city ? `${r.business.city}, ${r.business.state ?? ""}`.trim() : "India");
  return {
    id: r.id,
    category: r.resourceType,
    categoryColor: style.categoryColor,
    accentColor: style.accentColor,
    title: r.name,
    business: r.business.name,
    businessId: r.business.id,
    location: locationStr,
    price: r.rentAmountPaise ? `₹${(r.rentAmountPaise / 100).toLocaleString()}` : "Contact for pricing",
    unit: "",
    capacity: `${r.quantity} ${r.unit ?? "units"}`,
    rating: r.business.ownerRating ?? null,
    reviews: r.business.reviewCount ?? 0,
    available: r.isActive,
    availableText: r.isActive ? "Available" : "Unavailable",
    tags: [r.resourceType],
    imageBg: style.imageBg,
    rentAmountPaise: r.rentAmountPaise,
    securityDepositPaise: r.securityDepositPaise,
    photos: r.photos,
    hasPreExistingDamage: r.hasPreExistingDamage,
    damageDescription: r.damageDescription,
    damagePhotos: r.damagePhotos,
  };
}

const SORT_OPTIONS = [
  { value: "relevance",  label: "Most Relevant"      },
  { value: "price-asc",  label: "Price: Low → High"  },
  { value: "price-desc", label: "Price: High → Low"  },
  { value: "rating",     label: "Highest Rated"      },
];

// ─── Active filter chips ──────────────────────────────────────

function FilterChips({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
  const chips: { label: string; onRemove: () => void }[] = [];

  filters.categories.forEach((c) =>
    chips.push({ label: c, onRemove: () => onChange({ ...filters, categories: filters.categories.filter((x) => x !== c) }) })
  );
  if (filters.location)
    chips.push({ label: `📍 ${filters.location}`, onRemove: () => onChange({ ...filters, location: "" }) });
  if (filters.startDate && filters.endDate)
    chips.push({ label: `${filters.startDate} → ${filters.endDate}`, onRemove: () => onChange({ ...filters, startDate: "", endDate: "" }) });
  else if (filters.startDate)
    chips.push({ label: `From ${filters.startDate}`, onRemove: () => onChange({ ...filters, startDate: "", endDate: "" }) });
  if (filters.priceMin > 0 || filters.priceMax < 500000)
    chips.push({ label: `₹${(filters.priceMin / 100).toLocaleString()}–₹${(filters.priceMax / 100).toLocaleString()}`, onRemove: () => onChange({ ...filters, priceMin: 0, priceMax: 500000 }) });
  if (filters.ratingMin > 0)
    chips.push({ label: `${filters.ratingMin}★+`, onRemove: () => onChange({ ...filters, ratingMin: 0 }) });

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 pb-4">
      {chips.map(({ label, onRemove }) => (
        <motion.span
          key={label}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.15, ease: EASE }}
          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 py-1 pl-3 pr-2 text-xs font-medium text-emerald-700"
        >
          {label}
          <button
            type="button"
            onClick={onRemove}
            className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-emerald-200 transition-colors"
            aria-label={`Remove ${label} filter`}
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </motion.span>
      ))}
      <button
        type="button"
        onClick={() => onChange(DEFAULT_FILTERS)}
        className="text-xs font-medium text-stone-400 hover:text-stone-600 transition-colors underline underline-offset-2"
      >
        Clear all
      </button>
    </div>
  );
}

// ─── Main marketplace content ─────────────────────────────────

function MarketplaceContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [search, setSearch] = useState(searchParams?.get("q") ?? "");
  const [allResources, setAllResources] = useState<ResourceCardData[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [sort, setSort] = useState("relevance");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [selectedResource, setSelectedResource] = useState<ResourceCardData | null>(null);

  // ── Fetch — re-runs when date filters change (server-side date filtering) ──
  const fetchResources = useCallback(async () => {
    setDataLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.set("startDate", new Date(filters.startDate + "T00:00:00").toISOString());
      if (filters.endDate)   params.set("endDate",   new Date(filters.endDate   + "T00:00:00").toISOString());

      const qs = params.toString();
      const res = await AuthService.fetchWithAuth(
        `${API_BASE}/api/resources/all${qs ? `?${qs}` : ""}`
      );
      if (!res.ok) return;
      const data = await res.json();
      const raw: ApiResource[] = data?.data?.resources ?? [];
      setAllResources(raw.map(mapApiResource));
    } catch {
      // silently fail
    } finally {
      setDataLoading(false);
    }
  }, [filters.startDate, filters.endDate]);

  useEffect(() => { fetchResources(); }, [fetchResources]);

  // ── Client-side filter + sort (everything except dates, which are server-side) ──
  const filtered = useMemo(() => {
    let items = allResources;

    // Text search
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((r) =>
        r.title.toLowerCase().includes(q) ||
        r.business.toLowerCase().includes(q) ||
        r.location.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q)
      );
    }

    // Categories
    if (filters.categories.length)
      items = items.filter((r) => filters.categories.includes(r.category));

    // Location (free-text on the location string)
    if (filters.location) {
      const loc = filters.location.toLowerCase();
      items = items.filter((r) => r.location.toLowerCase().includes(loc));
    }

    // Price range (in paise)
    if (filters.priceMin > 0)
      items = items.filter((r) => (r.rentAmountPaise ?? 0) >= filters.priceMin);
    if (filters.priceMax < 500000)
      items = items.filter((r) => (r.rentAmountPaise ?? 0) <= filters.priceMax);

    // Rating
    if (filters.ratingMin > 0)
      items = items.filter((r) => (r.rating ?? 0) >= filters.ratingMin);

    // Sort
    if (sort === "price-asc")
      items = [...items].sort((a, b) => (a.rentAmountPaise ?? 0) - (b.rentAmountPaise ?? 0));
    else if (sort === "price-desc")
      items = [...items].sort((a, b) => (b.rentAmountPaise ?? 0) - (a.rentAmountPaise ?? 0));
    else if (sort === "rating")
      items = [...items].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));

    return items;
  }, [allResources, search, filters, sort]);

  const activeFilterCount =
    filters.categories.length +
    (filters.location ? 1 : 0) +
    (filters.startDate ? 1 : 0) +
    (filters.priceMin > 0 || filters.priceMax < 500000 ? 1 : 0) +
    (filters.ratingMin > 0 ? 1 : 0);

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <Navbar />

      {/* ── Search / controls header ── */}
      <div className="border-b border-stone-200 bg-white pt-[68px]">
        <div className="mx-auto max-w-screen-xl px-5 py-5 md:px-10 lg:px-16">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">

            {/* Search box */}
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search banquet halls, kitchens, AV equipment…"
                className="w-full rounded-xl border border-stone-200 bg-stone-50 py-3 pl-11 pr-4 text-sm text-stone-800 placeholder:text-stone-400 focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
              />
              {search && (
                <button type="button" onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2">
              {/* Mobile filter toggle */}
              <button
                type="button"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-all lg:hidden",
                  sidebarOpen || activeFilterCount > 0
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                    : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
                )}
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {/* Sort */}
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="rounded-xl border border-stone-200 bg-white px-3 py-3 text-sm text-stone-700 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>

              {/* View toggle */}
              <div className="flex overflow-hidden rounded-xl border border-stone-200 bg-white">
                {(["grid", "list"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setView(v)}
                    className={cn(
                      "flex h-10 w-10 items-center justify-center transition-colors",
                      view === v ? "bg-emerald-600 text-white" : "text-stone-400 hover:bg-stone-50"
                    )}
                    aria-label={`${v} view`}
                  >
                    {v === "grid" ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Result count */}
          <p className="mt-3 text-xs text-stone-400">
            {dataLoading ? (
              <span className="inline-block h-3 w-24 animate-pulse rounded bg-stone-200" />
            ) : (
              <>
                Showing{" "}
                <span className="font-semibold text-stone-700">{filtered.length}</span> resources
                {search && <> matching &ldquo;<span className="font-medium text-stone-600">{search}</span>&rdquo;</>}
                {filters.startDate && (
                  <span className="ml-1 inline-flex items-center gap-1">
                    <CalendarDays className="h-3 w-3 text-emerald-500" />
                    available {filters.startDate}{filters.endDate ? ` → ${filters.endDate}` : ""}
                  </span>
                )}
                <span className="ml-1">
                  · <MapPin className="inline h-3 w-3 text-emerald-500" /> Pan India
                </span>
              </>
            )}
          </p>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="mx-auto max-w-screen-xl px-5 py-8 md:px-10 lg:px-16">
        <div className="flex gap-6">

          {/* Desktop sidebar — independent scroll */}
          <div className="hidden w-64 shrink-0 lg:block">
            <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto rounded-2xl">
              <FilterSidebar filters={filters} onChange={setFilters} />
            </div>
          </div>

          {/* Mobile sidebar overlay */}
          <AnimatePresence>
            {sidebarOpen && (
              <div className="fixed inset-0 z-40 lg:hidden">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/30 backdrop-blur-sm"
                  onClick={() => setSidebarOpen(false)}
                />
                <motion.div
                  initial={{ x: "-100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "-100%" }}
                  transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
                  className="absolute inset-y-0 left-0 w-80 overflow-y-auto bg-[#FAFAFA] p-4 shadow-xl"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-base font-bold text-stone-900">Filters</span>
                    <button type="button" onClick={() => setSidebarOpen(false)} className="text-stone-400 hover:text-stone-600">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <FilterSidebar filters={filters} onChange={(f) => { setFilters(f); }} />
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Grid area */}
          <div className="min-w-0 flex-1">

            {/* Active filter chips */}
            <AnimatePresence>
              {activeFilterCount > 0 && (
                <FilterChips filters={filters} onChange={setFilters} />
              )}
            </AnimatePresence>

            {/* Loading skeletons */}
            {dataLoading && (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-72 animate-pulse rounded-2xl bg-stone-100" style={{ animationDelay: `${i * 60}ms` }} />
                ))}
              </div>
            )}

            {/* Empty state */}
            {!dataLoading && filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-white py-20 text-center">
                <Search className="h-10 w-10 text-stone-300" />
                <p className="mt-4 text-base font-semibold text-stone-600">No resources found</p>
                <p className="mt-1 text-sm text-stone-400">
                  {filters.startDate
                    ? "No resources are available for the selected dates."
                    : "Try adjusting your filters or search query."}
                </p>
                <button
                  type="button"
                  onClick={() => { setSearch(""); setFilters(DEFAULT_FILTERS); }}
                  className="mt-5 rounded-xl border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors"
                >
                  Clear all filters
                </button>
              </div>
            )}

            {/* Resource grid */}
            {!dataLoading && filtered.length > 0 && (
              <div className={cn(
                "grid gap-5",
                view === "grid" ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3" : "grid-cols-1"
              )}>
                {filtered.map((resource, i) => (
                  <ResourceCard
                    key={resource.id}
                    data={resource}
                    index={i}
                    onViewDetails={(id) => router.push(`/marketplace/${id}`)}
                    onBook={(id) => {
                      const target = allResources.find((r) => r.id === id);
                      if (target) setSelectedResource(target);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Booking modal */}
      {selectedResource && (
        <BookingModal
          isOpen
          onClose={() => setSelectedResource(null)}
          resource={{
            id:                   selectedResource.id,
            name:                 selectedResource.title,
            resourceType:         selectedResource.category,
            location:             selectedResource.location,
            rentAmountPaise:      selectedResource.rentAmountPaise,
            securityDepositPaise: selectedResource.securityDepositPaise,
            quantity:             10,
            photos:               selectedResource.photos,
            hasPreExistingDamage: selectedResource.hasPreExistingDamage,
            damageDescription:    selectedResource.damageDescription,
            damagePhotos:         selectedResource.damagePhotos,
            business: { id: selectedResource.businessId, name: selectedResource.business },
          }}
        />
      )}

      <Footer />
    </div>
  );
}

export default function MarketplacePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
      </div>
    }>
      <MarketplaceContent />
    </Suspense>
  );
}
