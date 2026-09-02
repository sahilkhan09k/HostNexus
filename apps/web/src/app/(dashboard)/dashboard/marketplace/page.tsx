"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Search, Filter, MapPin, Store, Package, Building2, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface Resource {
  id: string;
  businessId: string;
  name: string;
  description: string | null;
  resourceType: string;
  quantity: number;
  unit: string | null;
  status: string;
  location: string | null;
  isActive: boolean;
  createdAt: string;
  business?: {
    id: string;
    name: string;
  };
}

const RESOURCE_TYPES = [
  "All Categories",
  "Banquet Hall",
  "Event Space",
  "Meeting Space",
  "Kitchen Facility",
  "Vehicle",
  "AV Equipment",
  "Catering Equipment",
  "Crockery/Cutlery",
  "Cold Storage",
  "Furniture",
  "Tent/Canopy",
  "Staff/Manpower",
  "Parking Space",
  "Generator/Power",
  "Linen/Textile",
  "Decor Items",
  "Equipment",
  "Other",
];

export default function MarketplacePage() {
  const { user } = useAuth();
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All Categories");

  useEffect(() => {
    fetchAllResources();
  }, []);

  const fetchAllResources = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('hostnexus_token');
      
      if (!token) {
        setError('Not authenticated');
        return;
      }

      const response = await fetch(`${API_URL}/api/resources/all`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch resources');
      }

      const data = await response.json();
      setResources(data.data.resources || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load marketplace');
    } finally {
      setLoading(false);
    }
  };

  const filteredResources = resources.filter((r) => {
    const matchesSearch = 
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = 
      selectedCategory === "All Categories" || 
      r.resourceType === selectedCategory;
    return matchesSearch && matchesCategory && r.isActive;
  });

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
        <p className="text-sm font-medium text-rose-700">{error}</p>
        <button
          onClick={fetchAllResources}
          className="mt-4 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-stone-900">Browse Resources</h1>
        <p className="mt-1 text-sm text-stone-500">
          Discover and rent resources from hospitality businesses across India
        </p>
      </div>

      {/* Search & Filters */}
      <div className="space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Search banquet halls, equipment, vehicles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(
              "w-full rounded-xl border border-stone-200 bg-white py-3 pl-11 pr-4 text-sm",
              "placeholder:text-stone-400",
              "focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            )}
          />
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {RESOURCE_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => setSelectedCategory(type)}
              className={cn(
                "shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition-all",
                selectedCategory === type
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              )}
            >
              {type}
            </button>
          ))}
        </div>

        {/* Results Count */}
        <div className="flex items-center justify-between text-sm">
          <p className="text-stone-500">
            <span className="font-semibold text-stone-900">{filteredResources.length}</span> resources available
          </p>
        </div>
      </div>

      {/* Resource Grid */}
      {filteredResources.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-stone-200 bg-stone-50 p-12 text-center">
          <Package className="mx-auto h-12 w-12 text-stone-300" />
          <h3 className="mt-4 font-display text-lg font-semibold text-stone-900">No resources found</h3>
          <p className="mt-2 text-sm text-stone-500">
            Try adjusting your search or filters
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredResources.map((resource, i) => (
            <Link key={resource.id} href={`/dashboard/marketplace/${resource.id}`}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.3 }}
                className={cn(
                  "group relative overflow-hidden rounded-2xl border border-stone-200 bg-white p-5",
                  "hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-500/5",
                  "transition-all duration-200 cursor-pointer"
                )}
              >
                {/* Resource Type Badge */}
                <div className="mb-3 flex items-center justify-between">
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    {resource.resourceType}
                  </span>
                  <button 
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    className="text-stone-400 hover:text-emerald-600 transition-colors"
                  >
                    <Heart className="h-4 w-4" />
                  </button>
                </div>

                {/* Resource Name */}
                <h3 className="font-display text-base font-bold text-stone-900 line-clamp-1">
                  {resource.name}
                </h3>

                {/* Description */}
                {resource.description && (
                  <p className="mt-2 text-xs text-stone-500 line-clamp-2">
                    {resource.description}
                  </p>
                )}

                {/* Business Info */}
                <div className="mt-3 flex items-center gap-2 text-xs text-stone-500">
                  <Building2 className="h-3.5 w-3.5" />
                  <span className="font-medium truncate">
                    {resource.business?.name || "Business Name"}
                  </span>
                </div>

                {/* Location & Quantity */}
                <div className="mt-3 flex items-center justify-between border-t border-stone-100 pt-3">
                  <div className="flex items-center gap-1.5 text-xs text-stone-500">
                    <MapPin className="h-3.5 w-3.5" />
                    <span className="truncate">{resource.location || "Location TBD"}</span>
                  </div>
                  <span className="text-xs font-semibold text-stone-700">
                    {resource.quantity} {resource.unit || "available"}
                  </span>
                </div>

                {/* View Details Button */}
                <div
                  className={cn(
                    "mt-4 w-full rounded-xl bg-emerald-600 py-2.5 text-center text-sm font-semibold text-white",
                    "hover:bg-emerald-700 active:scale-[0.98]",
                    "transition-all duration-200"
                  )}
                >
                  View Details
                </div>
              </motion.div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}