"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Search, SlidersHorizontal, LayoutGrid, List, MapPin, X } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { ResourceCard, type ResourceCardData } from "@/components/marketplace/resource-card";
import { FilterSidebar, type Filters } from "@/components/marketplace/filter-sidebar";
import { cn } from "@/lib/utils";

/* ── API types ── */
interface ApiResource {
  id: string;
  name: string;
  resourceType: string;
  description: string | null;
  quantity: number;
  unit: string | null;
  location: string | null;
  isActive: boolean;
  business: { id: string; name: string };
}

/* ── Color/gradient map by resourceType ── */
const TYPE_STYLES: Record<string, { categoryColor: string; accentColor: string; imageBg: string }> = {
  "Banquet Hall":     { categoryColor: "bg-violet-100 text-violet-700", accentColor: "text-violet-600", imageBg: "bg-gradient-to-br from-violet-100 to-indigo-100" },
  "Event Space":      { categoryColor: "bg-rose-100 text-rose-700",     accentColor: "text-rose-600",   imageBg: "bg-gradient-to-br from-rose-100 to-pink-100" },
  "Meeting Space":    { categoryColor: "bg-sky-100 text-sky-700",       accentColor: "text-sky-600",    imageBg: "bg-gradient-to-br from-sky-100 to-cyan-100" },
  "Kitchen Facility": { categoryColor: "bg-amber-100 text-amber-700",   accentColor: "text-amber-600",  imageBg: "bg-gradient-to-br from-amber-100 to-orange-100" },
  "AV Equipment":     { categoryColor: "bg-sky-100 text-sky-700",       accentColor: "text-sky-600",    imageBg: "bg-gradient-to-br from-sky-100 to-blue-100" },
  "Furniture":        { categoryColor: "bg-lime-100 text-lime-700",     accentColor: "text-lime-600",   imageBg: "bg-gradient-to-br from-lime-100 to-green-100" },
  "Vehicle":          { categoryColor: "bg-teal-100 text-teal-700",     accentColor: "text-teal-600",   imageBg: "bg-gradient-to-br from-teal-100 to-emerald-100" },
  "Staff/Manpower":   { categoryColor: "bg-indigo-100 text-indigo-700", accentColor: "text-indigo-600", imageBg: "bg-gradient-to-br from-indigo-100 to-purple-100" },
};
const DEFAULT_STYLE = {
  categoryColor: "bg-stone-100 text-stone-700",
  accentColor: "text-stone-600",
  imageBg: "bg-gradient-to-br from-stone-100 to-slate-100",
};

function mapApiResource(resource: ApiResource): ResourceCardData {
  const style = TYPE_STYLES[resource.resourceType] ?? DEFAULT_STYLE;
  return {
    id: resource.id,
    category: resource.resourceType,
    categoryColor: style.categoryColor,
    accentColor: style.accentColor,
    title: resource.name,
    business: resource.business.name,
    location: resource.location || "India",
    price: resource.unit ? `Per ${resource.unit}` : "Contact for pricing",
    unit: "",
    capacity: `${resource.quantity} ${resource.unit || "units"}`,
    rating: 4.5,
    reviews: 0,
    available: resource.isActive,
    availableText: resource.isActive ? "Available" : "Unavailable",
    tags: [resource.resourceType],
    imageBg: style.imageBg,
  };
}

const SORT_OPTIONS = [
  { value: "relevance", label: "Most Relevant" },
  { value: "price-asc",  label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "rating",     label: "Highest Rated" },
];

export default function MarketplacePage() {
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams?.get("q") ?? "");
  const [allResources, setAllResources] = useState<ResourceCardData[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [sort, setSort] = useState("relevance");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    categories: [],
    location: "",
    priceMax: 100000,
    availability: "all",
    capacityMin: 0,
    ratingMin: 0,
  });

  /* ── Fetch resources from API ── */
  useEffect(() => {
    const fetchResources = async () => {
      setDataLoading(true);
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
        const token = typeof window !== "undefined" ? localStorage.getItem("hostnexus_token") : null;
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch(`${apiBase}/api/resources/all`, { headers });
        if (!res.ok) return;
        const data = await res.json();
        const raw: ApiResource[] = data?.data?.resources ?? [];
        setAllResources(raw.map(mapApiResource));
      } catch {
        // silently fail — filtered will be empty
      } finally {
        setDataLoading(false);
      }
    };
    fetchResources();
  }, []);

  /* ── Filter + sort logic ── */
  const filtered = useMemo(() => {
    let items = allResources;

    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.business.toLowerCase().includes(q) ||
          r.location.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q)
      );
    }
    if (filters.categories.length) {
      items = items.filter((r) => filters.categories.includes(r.category));
    }
    if (filters.location) {
      items = items.filter((r) => r.location.toLowerCase().includes(filters.location.toLowerCase()));
    }
    if (filters.availability === "today" || filters.availability === "weekend") {
      items = items.filter((r) => r.available);
    }
    if (filters.ratingMin > 0) {
      items = items.filter((r) => r.rating >= filters.ratingMin);
    }

    if (sort === "price-asc") {
      items = [...items].sort((a, b) => parseInt(a.price.replace(/\D/g, "")) - parseInt(b.price.replace(/\D/g, "")));
    } else if (sort === "price-desc") {
      items = [...items].sort((a, b) => parseInt(b.price.replace(/\D/g, "")) - parseInt(a.price.replace(/\D/g, "")));
    } else if (sort === "rating") {
      items = [...items].sort((a, b) => b.rating - a.rating);
    }

    return items;
  }, [search, filters, sort, allResources]);

  const activeFilterCount =
    filters.categories.length +
    (filters.location ? 1 : 0) +
    (filters.priceMax < 100000 ? 1 : 0) +
    (filters.availability !== "all" ? 1 : 0) +
    (filters.capacityMin > 0 ? 1 : 0) +
    (filters.ratingMin > 0 ? 1 : 0);

  return (
    <div className="min-h-screen bg-[#FAFAF9]">
      <Navbar />

      {/* ── Search header ── */}
      <div className="border-b border-stone-200 bg-white pt-[68px]">
        <div className="mx-auto max-w-screen-xl px-5 py-5 md:px-10 lg:px-16">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* Search input */}
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search banquet halls, kitchens, AV equipment..."
                className="w-full rounded-xl border border-stone-200 bg-stone-50 py-3 pl-11 pr-4 text-sm text-stone-800 placeholder:text-stone-400 focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
              />
              {search && (
                <button type="button" onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Controls row */}
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
              <div className="flex items-center rounded-xl border border-stone-200 bg-white overflow-hidden">
                <button
                  type="button"
                  onClick={() => setView("grid")}
                  className={cn(
                    "flex h-10 w-10 items-center justify-center transition-colors",
                    view === "grid" ? "bg-emerald-600 text-white" : "text-stone-400 hover:bg-stone-50"
                  )}
                  aria-label="Grid view"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setView("list")}
                  className={cn(
                    "flex h-10 w-10 items-center justify-center transition-colors",
                    view === "list" ? "bg-emerald-600 text-white" : "text-stone-400 hover:bg-stone-50"
                  )}
                  aria-label="List view"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Result count */}
          <p className="mt-3 text-xs text-stone-400">
            Showing <span className="font-semibold text-stone-700">{filtered.length}</span> resources
            {search && <> matching &ldquo;<span className="font-medium text-stone-600">{search}</span>&rdquo;</>}
            {" · "}
            <span className="flex-inline items-center gap-1">
              <MapPin className="inline h-3 w-3 text-emerald-500" /> Pune &amp; Mumbai
            </span>
          </p>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="mx-auto max-w-screen-xl px-5 py-8 md:px-10 lg:px-16">
        <div className="flex gap-6">

          {/* ── Sidebar (desktop always visible, mobile slide-in) ── */}
          <div className={cn(
            "w-64 shrink-0",
            "hidden lg:block",
          )}>
            <div className="sticky top-24">
              <FilterSidebar filters={filters} onChange={setFilters} />
            </div>
          </div>

          {/* Mobile sidebar overlay */}
          {sidebarOpen && (
            <div className="fixed inset-0 z-40 lg:hidden">
              <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
                className="absolute inset-y-0 left-0 w-80 overflow-y-auto bg-[#FAFAF9] p-4 shadow-xl"
              >
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-base font-bold text-stone-900">Filters</span>
                  <button type="button" onClick={() => setSidebarOpen(false)} className="text-stone-400 hover:text-stone-600">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <FilterSidebar filters={filters} onChange={setFilters} />
              </motion.div>
            </div>
          )}

          {/* ── Resource grid ── */}
          <div className="flex-1 min-w-0">
            {dataLoading && (
              <div className={cn("grid gap-5 mb-8", "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3")}>
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={i} className="h-64 animate-pulse rounded-2xl bg-stone-100" />
                ))}
              </div>
            )}
            {!dataLoading && (filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-white py-20 text-center">
                <Search className="h-10 w-10 text-stone-300" />
                <p className="mt-4 text-base font-semibold text-stone-600">No resources found</p>
                <p className="mt-1 text-sm text-stone-400">Try adjusting your filters or search query</p>
                <button
                  type="button"
                  onClick={() => { setSearch(""); setFilters({ categories: [], location: "", priceMax: 100000, availability: "all", capacityMin: 0, ratingMin: 0 }); }}
                  className="mt-4 rounded-xl border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors"
                >
                  Clear all filters
                </button>
              </div>
            ) : (
              <div className={cn(
                "grid gap-5",
                view === "grid"
                  ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"
                  : "grid-cols-1"
              )}>
                {filtered.map((resource: ResourceCardData, i: number) => (
                  <ResourceCard
                    key={resource.id}
                    data={resource}
                    index={i}
                    onBook={(id) => console.log("Book:", id)}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
