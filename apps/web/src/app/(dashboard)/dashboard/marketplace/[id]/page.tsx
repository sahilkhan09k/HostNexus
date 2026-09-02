"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft, MapPin, Package, Building2, Calendar,
  Users, Check, X, Loader2,
} from "lucide-react";
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

export default function ResourceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const resourceId = params?.id as string;

  const [resource, setResource] = useState<Resource | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Booking form state
  const [quantity, setQuantity] = useState(1);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");

  useEffect(() => {
    if (resourceId) {
      fetchResource();
    }
  }, [resourceId]);

  const fetchResource = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('hostnexus_token');

      if (!token) {
        setError('Not authenticated');
        return;
      }

      // For now, we'll fetch from /all endpoint and filter
      const response = await fetch(`${API_URL}/api/resources/all`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch resource');
      }

      const data = await response.json();
      const foundResource = data.data.resources.find((r: Resource) => r.id === resourceId);

      if (!foundResource) {
        setError('Resource not found');
        return;
      }

      setResource(foundResource);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load resource');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const token = localStorage.getItem('hostnexus_token');

      if (!token) {
        throw new Error('Not authenticated');
      }

      if (!startDate || !endDate) {
        throw new Error('Please select start and end dates');
      }

      const response = await fetch(`${API_URL}/api/bookings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resourceId,
          quantity,
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(endDate).toISOString(),
          specialRequests: specialRequests || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to create booking request');
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/dashboard/bookings');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (error && !resource) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
        <p className="text-sm font-medium text-rose-700">{error}</p>
        <button
          onClick={() => router.back()}
          className="mt-4 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
        >
          Go Back
        </button>
      </div>
    );
  }

  if (!resource) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-stone-500 hover:text-stone-800 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to marketplace
      </button>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Resource Details - Left Column (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header */}
          <div className="rounded-2xl border border-stone-200 bg-white p-6">
            <div className="flex items-start justify-between">
              <div>
                <span className="inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  {resource.resourceType}
                </span>
                <h1 className="mt-3 font-display text-3xl font-bold text-stone-900">
                  {resource.name}
                </h1>
                <div className="mt-3 flex items-center gap-4 text-sm text-stone-500">
                  <div className="flex items-center gap-1.5">
                    <Building2 className="h-4 w-4" />
                    <span className="font-medium">{resource.business?.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" />
                    <span>{resource.location || "Location TBD"}</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-stone-500">Available</p>
                <p className="mt-1 font-display text-2xl font-bold text-emerald-600">
                  {resource.quantity} {resource.unit}
                </p>
              </div>
            </div>
          </div>

          {/* Description */}
          {resource.description && (
            <div className="rounded-2xl border border-stone-200 bg-white p-6">
              <h2 className="font-display text-lg font-bold text-stone-900">Description</h2>
              <p className="mt-3 text-sm leading-relaxed text-stone-600">
                {resource.description}
              </p>
            </div>
          )}

          {/* Details Grid */}
          <div className="rounded-2xl border border-stone-200 bg-white p-6">
            <h2 className="font-display text-lg font-bold text-stone-900">Details</h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                  Resource Type
                </dt>
                <dd className="mt-1 text-sm font-medium text-stone-900">{resource.resourceType}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                  Status
                </dt>
                <dd className="mt-1">
                  <span className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                    resource.status === "available" 
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-stone-100 text-stone-600"
                  )}>
                    {resource.status === "available" ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <X className="h-3 w-3" />
                    )}
                    {resource.status}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                  Quantity Available
                </dt>
                <dd className="mt-1 text-sm font-medium text-stone-900">
                  {resource.quantity} {resource.unit}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                  Location
                </dt>
                <dd className="mt-1 text-sm font-medium text-stone-900">
                  {resource.location || "To be confirmed"}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Booking Form - Right Column (1/3) */}
        <div className="lg:col-span-1">
          <div className="sticky top-6 rounded-2xl border-2 border-emerald-200 bg-white p-6">
            {success ? (
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
                  <Check className="h-6 w-6 text-emerald-600" />
                </div>
                <h3 className="mt-4 font-display text-lg font-bold text-stone-900">
                  Request Sent!
                </h3>
                <p className="mt-2 text-sm text-stone-500">
                  The resource owner will review your request and respond soon.
                </p>
                <p className="mt-4 text-xs text-stone-400">
                  Redirecting to bookings...
                </p>
              </div>
            ) : (
              <>
                <h2 className="font-display text-lg font-bold text-stone-900">
                  Request to Rent
                </h2>
                <p className="mt-1 text-xs text-stone-500">
                  Fill in the details and submit your request
                </p>

                <form onSubmit={handleSubmitRequest} className="mt-6 space-y-4">
                  {/* Quantity */}
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-stone-500">
                      Quantity
                    </label>
                    <div className="relative">
                      <Package className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                      <input
                        type="number"
                        min="1"
                        max={resource.quantity}
                        required
                        value={quantity}
                        onChange={(e) => setQuantity(parseInt(e.target.value))}
                        className={cn(
                          "w-full rounded-xl border border-stone-200 bg-stone-50 py-2.5 pl-10 pr-4 text-sm",
                          "focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        )}
                      />
                    </div>
                    <p className="mt-1 text-xs text-stone-400">
                      Max: {resource.quantity} available
                    </p>
                  </div>

                  {/* Start Date */}
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-stone-500">
                      Start Date
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                      <input
                        type="date"
                        required
                        min={new Date().toISOString().split('T')[0]}
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className={cn(
                          "w-full rounded-xl border border-stone-200 bg-stone-50 py-2.5 pl-10 pr-4 text-sm",
                          "focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        )}
                      />
                    </div>
                  </div>

                  {/* End Date */}
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-stone-500">
                      End Date
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                      <input
                        type="date"
                        required
                        min={startDate || new Date().toISOString().split('T')[0]}
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className={cn(
                          "w-full rounded-xl border border-stone-200 bg-stone-50 py-2.5 pl-10 pr-4 text-sm",
                          "focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        )}
                      />
                    </div>
                  </div>

                  {/* Special Requests */}
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-stone-500">
                      Special Requests (Optional)
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Any specific requirements or questions..."
                      value={specialRequests}
                      onChange={(e) => setSpecialRequests(e.target.value)}
                      className={cn(
                        "w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm",
                        "focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20",
                        "resize-none"
                      )}
                    />
                  </div>

                  {/* Error Message */}
                  {error && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                      {error}
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={submitting}
                    className={cn(
                      "w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white",
                      "hover:bg-emerald-700 active:scale-[0.98]",
                      "transition-all duration-200",
                      "disabled:opacity-60 disabled:cursor-not-allowed",
                      "flex items-center justify-center gap-2"
                    )}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      "Submit Request"
                    )}
                  </button>

                  <p className="text-center text-xs text-stone-400">
                    You'll be notified when the owner responds
                  </p>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}