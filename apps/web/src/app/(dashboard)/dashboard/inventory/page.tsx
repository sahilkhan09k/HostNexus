"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, Edit, Trash2, Eye, Package, CheckCircle2, AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface Resource {
  id: string;
  name: string;
  resourceType: string;
  quantity: number;
  status: string;
  location: string | null;
  isActive: boolean;
  createdAt: string;
}

type Toast = {
  id: string;
  type: "success" | "error" | "info";
  message: string;
};

export default function InventoryPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: Toast["type"], message: string) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  useEffect(() => {
    fetchResources();
  }, []);

  const fetchResources = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("hostnexus_token");

      if (!token) {
        setError("Not authenticated");
        return;
      }

      const response = await fetch(`${API_URL}/api/resources`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch resources");
      }

      const data = await response.json();
      setResources(data.data.resources);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load resources");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (resource: Resource) => {
    const confirmed = window.confirm(
      "Delete this resource? This cannot be undone."
    );
    if (!confirmed) return;

    const token = localStorage.getItem("hostnexus_token");
    if (!token) {
      addToast("error", "Not authenticated. Please log in again.");
      return;
    }

    // Optimistic update
    setDeletingId(resource.id);
    setResources((prev) => prev.filter((r) => r.id !== resource.id));

    try {
      const response = await fetch(`${API_URL}/api/resources/${resource.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete resource");
      }

      addToast("success", "Resource deleted successfully.");
    } catch (err) {
      // Rollback optimistic update
      setResources((prev) => {
        const exists = prev.find((r) => r.id === resource.id);
        if (exists) return prev;
        return [...prev, resource].sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      });
      addToast(
        "error",
        err instanceof Error ? err.message : "Failed to delete resource."
      );
    } finally {
      setDeletingId(null);
    }
  };

  const handleEdit = (resource: Resource) => {
    router.push(`/dashboard/inventory/${resource.id}/edit`);
  };

  const handlePreview = (resource: Resource) => {
    router.push(`/dashboard/marketplace/${resource.id}`);
  };

  const filteredResources = resources.filter((r) => {
    const matchesSearch = r.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesStatus =
      filterStatus === "all" ||
      (filterStatus === "active" && r.isActive) ||
      (filterStatus === "inactive" && !r.isActive);
    return matchesSearch && matchesStatus;
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
          onClick={fetchResources}
          className="mt-4 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast notifications */}
      <div
        aria-live="polite"
        className="fixed right-4 top-4 z-50 flex flex-col gap-2"
      >
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium shadow-lg backdrop-blur-md",
                toast.type === "success" &&
                  "border-emerald-200 bg-emerald-50 text-emerald-800",
                toast.type === "error" &&
                  "border-rose-200 bg-rose-50 text-rose-800",
                toast.type === "info" &&
                  "border-amber-200 bg-amber-50 text-amber-800"
              )}
            >
              {toast.type === "success" && (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              )}
              {toast.type === "error" && (
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              )}
              {toast.type === "info" && (
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
              )}
              <span>{toast.message}</span>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="ml-2 shrink-0 opacity-60 transition-opacity hover:opacity-100"
                aria-label="Dismiss notification"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-stone-900">
            Resource Inventory
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            Manage your listed resources and availability
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/dashboard/inventory/new")}
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
                filterStatus === "all"
                  ? "bg-emerald-600 text-white"
                  : "text-stone-600 hover:bg-stone-50"
              )}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus("active")}
              className={cn(
                "rounded-lg px-4 py-1.5 text-xs font-semibold transition-all",
                filterStatus === "active"
                  ? "bg-emerald-600 text-white"
                  : "text-stone-600 hover:bg-stone-50"
              )}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus("inactive")}
              className={cn(
                "rounded-lg px-4 py-1.5 text-xs font-semibold transition-all",
                filterStatus === "inactive"
                  ? "bg-emerald-600 text-white"
                  : "text-stone-600 hover:bg-stone-50"
              )}
            >
              Inactive
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white shadow-[0_2px_12px_-2px_rgba(0,0,0,0.06)]">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-stone-100">
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-stone-500">
                  Resource
                </th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-stone-500">
                  Category
                </th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-stone-500">
                  Quantity
                </th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-stone-500">
                  Location
                </th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-stone-500">
                  Status
                </th>
                <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-stone-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredResources.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center">
                    <Package className="mx-auto h-12 w-12 text-stone-300" />
                    <p className="mt-3 text-sm font-medium text-stone-500">
                      No resources found
                    </p>
                    <p className="mt-1 text-xs text-stone-400">
                      Try adjusting your search or filters
                    </p>
                  </td>
                </tr>
              ) : (
                filteredResources.map((resource, i) => (
                  <motion.tr
                    key={resource.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.05 }}
                    className={cn(
                      "transition-colors hover:bg-stone-50",
                      deletingId === resource.id && "pointer-events-none opacity-50"
                    )}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100">
                          <Package className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-stone-800">
                            {resource.name}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-stone-600">
                      {resource.resourceType}
                    </td>
                    <td className="px-5 py-4 text-sm text-stone-600">
                      {resource.quantity}
                    </td>
                    <td className="px-5 py-4 text-sm text-stone-600">
                      {resource.location || "-"}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                          resource.isActive
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-stone-100 text-stone-500"
                        )}
                      >
                        {resource.isActive ? "active" : "inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handlePreview(resource)}
                          aria-label={`Preview ${resource.name}`}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEdit(resource)}
                          aria-label={`Edit ${resource.name}`}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-emerald-600"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(resource)}
                          disabled={deletingId === resource.id}
                          aria-label={`Delete ${resource.name}`}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
                        >
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

      <div className="text-center text-sm text-stone-500">
        Showing {filteredResources.length} of {resources.length} resources
      </div>
    </div>
  );
}
