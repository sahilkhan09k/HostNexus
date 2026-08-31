"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Search, SlidersHorizontal, LayoutGrid, List, MapPin, X } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { ResourceCard, type ResourceCardData } from "@/components/marketplace/resource-card";
import { FilterSidebar, type Filters } from "@/components/marketplace/filter-sidebar";
import { cn } from "@/lib/utils";

/* ── Mock resource data ── */
const ALL_RESOURCES: ResourceCardData[] = [
  {
    id: "1",
    category: "Banquet Hall",
    categoryColor: "bg-violet-100 text-violet-700",
    accentColor: "text-violet-600",
    title: "Grand Ballroom",
    business: "JW Marriott Pune",
    location: "Koregaon Park",
    price: "₹45,000",
    unit: "/day",
    capacity: "500 pax",
    rating: 4.9,
    reviews: 38,
    available: true,
    availableText: "Available",
    tags: ["AC Indoor", "AV Included", "Catering"],
    imageBg: "bg-gradient-to-br from-violet-100 to-indigo-100",
  },
  {
    id: "2",
    category: "Commercial Kitchen",
    categoryColor: "bg-amber-100 text-amber-700",
    accentColor: "text-amber-600",
    title: "Industrial Production Kitchen",
    business: "Radisson Blu Pune",
    location: "Bund Garden Road",
    price: "₹8,500",
    unit: "/half-day",
    capacity: "12 staff",
    rating: 4.7,
    reviews: 24,
    available: true,
    availableText: "Available",
    tags: ["Industrial Oven", "Cold Storage", "FSSAI Licensed"],
    imageBg: "bg-gradient-to-br from-amber-100 to-orange-100",
  },
  {
    id: "3",
    category: "AV Equipment",
    categoryColor: "bg-sky-100 text-sky-700",
    accentColor: "text-sky-600",
    title: "Full AV Conference Bundle",
    business: "Fortune Hotels India",
    location: "Viman Nagar",
    price: "₹12,000",
    unit: "/day",
    capacity: "200 pax",
    rating: 4.8,
    reviews: 17,
    available: false,
    availableText: "Next Mon",
    tags: ["4K Projector", "Wireless Mics", "Dolby Sound"],
    imageBg: "bg-gradient-to-br from-sky-100 to-cyan-100",
  },
  {
    id: "4",
    category: "Event Space",
    categoryColor: "bg-rose-100 text-rose-700",
    accentColor: "text-rose-600",
    title: "Rooftop Terrace — 5,000 sq.ft",
    business: "Hyatt Regency Pune",
    location: "Nagar Road",
    price: "₹28,000",
    unit: "/day",
    capacity: "350 pax",
    rating: 4.9,
    reviews: 29,
    available: true,
    availableText: "Available",
    tags: ["Open Air", "City View", "Bar Setup"],
    imageBg: "bg-gradient-to-br from-rose-100 to-pink-100",
  },
  {
    id: "5",
    category: "Furniture & Fixtures",
    categoryColor: "bg-lime-100 text-lime-700",
    accentColor: "text-lime-600",
    title: "Premium Chair & Table Set ×200",
    business: "ITC Maratha Mumbai",
    location: "Andheri East",
    price: "₹6,000",
    unit: "/day",
    capacity: "200 pax",
    rating: 4.6,
    reviews: 41,
    available: true,
    availableText: "Available",
    tags: ["With Delivery", "Setup Included", "Banquet Style"],
    imageBg: "bg-gradient-to-br from-lime-100 to-green-100",
  },
  {
    id: "6",
    category: "Vehicle Fleet",
    categoryColor: "bg-teal-100 text-teal-700",
    accentColor: "text-teal-600",
    title: "Luxury Coach Fleet ×4 Buses",
    business: "Sahara Star Mumbai",
    location: "Santacruz",
    price: "₹22,000",
    unit: "/day",
    capacity: "160 seats",
    rating: 4.5,
    reviews: 12,
    available: false,
    availableText: "Fri onwards",
    tags: ["AC Coaches", "Licensed Driver", "GPS Tracked"],
    imageBg: "bg-gradient-to-br from-teal-100 to-emerald-100",
  },
  {
    id: "7",
    category: "Banquet Hall",
    categoryColor: "bg-violet-100 text-violet-700",
    accentColor: "text-violet-600",
    title: "Crystal Banquet Hall",
    business: "The Westin Pune",
    location: "Koregaon Park",
    price: "₹35,000",
    unit: "/day",
    capacity: "400 pax",
    rating: 4.8,
    reviews: 52,
    available: true,
    availableText: "Available",
    tags: ["AC Indoor", "Stage Setup", "Valet Parking"],
    imageBg: "bg-gradient-to-br from-purple-100 to-violet-100",
  },
  {
    id: "8",
    category: "Commercial Kitchen",
    categoryColor: "bg-amber-100 text-amber-700",
    accentColor: "text-amber-600",
    title: "Commissary Kitchen — 3,000 sq.ft",
    business: "Courtyard by Marriott",
    location: "Viman Nagar",
    price: "₹15,000",
    unit: "/day",
    capacity: "20 staff",
    rating: 4.5,
    reviews: 9,
    available: true,
    availableText: "Available",
    tags: ["Multiple Stations", "Loading Bay", "Halal Certified"],
    imageBg: "bg-gradient-to-br from-yellow-100 to-amber-100",
  },
  {
    id: "9",
    category: "Event Space",
    categoryColor: "bg-rose-100 text-rose-700",
    accentColor: "text-rose-600",
    title: "Heritage Lawns — 2 acres",
    business: "The Bund Garden Hotel",
    location: "Bund Garden",
    price: "₹40,000",
    unit: "/day",
    capacity: "600 pax",
    rating: 4.7,
    reviews: 33,
    available: true,
    availableText: "Available",
    tags: ["Outdoor", "Generator Backup", "Catering Kitchen"],
    imageBg: "bg-gradient-to-br from-green-100 to-emerald-100",
  },
];

const SORT_OPTIONS = [
  { value: "relevance", label: "Most Relevant" },
  { value: "price-asc",  label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "rating",     label: "Highest Rated" },
];

export default function MarketplacePage() {
  const [search, setSearch] = useState("");
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

  /* ── Filter + sort logic ── */
  const filtered = useMemo(() => {
    let items = ALL_RESOURCES;

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
  }, [search, filters, sort]);

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
            {filtered.length === 0 ? (
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
                {filtered.map((resource, i) => (
                  <ResourceCard
                    key={resource.id}
                    data={resource}
                    index={i}
                    onBook={(id) => console.log("Book:", id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
