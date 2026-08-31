"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Search, Filter, MoreVertical, Edit, Trash2, Eye, Package } from "lucide-react";
import { cn } from "@/lib/utils";

const MOCK_RESOURCES = [
  { id: "1", name: "Grand Ballroom", category: "Banquet Hall", capacity: 500, price: 45000, status: "active", bookings: 12, rating: 4.8 },
  { id: "2", name: "Industrial Kitchen", category: "Kitchen", capacity: 20, price: 8500, status: "active", bookings: 8, rating: 4.9 },
  { id: "3", name: "AV Equipment Bundle", category: "Equipment", capacity: 1, price: 12000, status: "active", bookings: 31, rating: 4.7 },
  { id: "4", name: "Rooftop Terrace", category: "Event Space", capacity: 150, price: 28000, status: "active", bookings: 6, rating: 4.6 },
  { id: "5", name: "Luxury Coach Fleet", category: "Transport", capacity: 45, price: 22000, status: "inactive", bookings: 0, rating: 0 },
  { id: "6", name: "Modular Furniture Set", category: "Furniture", capacity: 100, price: 15000, status: "active", bookings: 4, rating: 4.8 },
  { id: "7", name: "Conference Room A", category: "Meeting Space", capacity: 30, price: 5500, status: "active", bookings: 9, rating: 4.5 },
  { id: "8", name: "Catering Equipment", category: "Equipment", capacity: 1, price: 9500, status: "active", bookings: 7, rating: 4.7 },
];

export default function InventoryPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");

  const filteredResources = MOCK_RESOURCES.filter((r) => {
    const matchesSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === "all" || r.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-stone-900">Resource Inventory</h1>
          <p className="mt-1 text-sm text-stone-500">Manage your listed resources and availability</p>
        </div>
        <button
          type="button"
          className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_2px_8px_rgba(5,150,105,0.25)] transition-all hover:bg-emerald-700 active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" />
          List New Resource
        </button>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input
            type="search"
            placeholder="Search resources..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-stone-200 bg-white py-2.5 pl-10 pr-4 text-sm text-stone-800 placeholder:text-stone-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex rounded-xl border border-stone-200 bg-white p-1">
            <button
              type="button"
              onClick={() => setFilterStatus("all")}
              className={cn(
                "rounded-lg px-4 py-1.5 text-xs font-semibold transition-all",
                filterStatus === "all" ? "bg-emerald-600 text-white" : "text-stone-600 hover:bg-stone-50"
              )}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus("active")}
              className={cn(
                "rounded-lg px-4 py-1.5 text-xs font-semibold transition-all",
                filterStatus === "active" ? "bg-emerald-600 text-white" : "text-stone-600 hover:bg-stone-50"
              )}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus("inactive")}
              className={cn(
                "rounded-lg px-4 py-1.5 text-xs font-semibold transition-all",
                filterStatus === "inactive" ? "bg-emerald-600 text-white" : "text-stone-600 hover:bg-stone-50"
              )}
            >
              Inactive
            </button>
          </div>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-stone-200 text-stone-400 transition-colors hover:bg-stone-50 hover:text-stone-600"
          >
            <Filter className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white shadow-[0_2px_12px_-2px_rgba(0,0,0,0.06)]">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-stone-100">
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-stone-500">Resource</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-stone-500">Category</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-stone-500">Capacity</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-stone-500">Price/Day</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-stone-500">Bookings</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-stone-500">Rating</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-stone-500">Status</th>
                <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-stone-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredResources.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center">
                    <Package className="mx-auto h-12 w-12 text-stone-300" />
                    <p className="mt-3 text-sm font-medium text-stone-500">No resources found</p>
                    <p className="mt-1 text-xs text-stone-400">Try adjusting your search or filters</p>
                  </td>
                </tr>
              ) : (
                filteredResources.map((resource, i) => (
                  <motion.tr
                    key={resource.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.05 }}
                    className="transition-colors hover:bg-stone-50"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100">
                          <Package className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-stone-800">{resource.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-stone-600">{resource.category}</td>
                    <td className="px-5 py-4 text-sm text-stone-600">{resource.capacity}</td>
                    <td className="px-5 py-4 text-sm font-semibold text-stone-900">Rs{resource.price.toLocaleString()}</td>
                    <td className="px-5 py-4 text-sm text-stone-600">{resource.bookings}</td>
                    <td className="px-5 py-4 text-sm text-stone-600">{resource.rating > 0 ? resource.rating.toFixed(1) : "-"}</td>
                    <td className="px-5 py-4">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                          resource.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-stone-100 text-stone-500"
                        )}
                      >
                        {resource.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600">
                          <Eye className="h-4 w-4" />
                        </button>
                        <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-emerald-600">
                          <Edit className="h-4 w-4" />
                        </button>
                        <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-rose-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}