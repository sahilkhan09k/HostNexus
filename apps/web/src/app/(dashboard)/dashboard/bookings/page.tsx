"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Calendar, Clock, MapPin, Package, Building2, Check, X,
  ChevronRight, Loader2, AlertCircle, FileText, XCircle, MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface BookingRequest {
  id: string;
  quantity: number;
  startDate: string;
  endDate: string;
  totalDays: number | null;
  specialRequests: string | null;
  status: string;
  proposedPrice: number | null;
  finalPrice: number | null;
  rejectionReason: string | null;
  createdAt: string;
  resource: {
    id: string;
    name: string;
    resourceType: string;
    location: string | null;
  };
  seeker: {
    id: string;
    name: string;
  };
  provider: {
    id: string;
    name: string;
  };
}

const STATUS_COLORS = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  accepted: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-rose-50 text-rose-700 border-rose-200",
  cancelled: "bg-stone-50 text-stone-700 border-stone-200",
  completed: "bg-blue-50 text-blue-700 border-blue-200",
};

export default function BookingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"incoming" | "outgoing">("incoming");
  const [bookings, setBookings] = useState<BookingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<{ bookingId: string; resourceName: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    fetchBookings();
  }, [activeTab]);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      setError("");
      const token = localStorage.getItem('hostnexus_token');

      if (!token) {
        setError('Not authenticated');
        return;
      }

      const response = await fetch(`${API_URL}/api/bookings?type=${activeTab}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch bookings');
      }

      const data = await response.json();
      setBookings(data.data.bookingRequests || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (bookingId: string, status: "accepted" | "rejected" | "cancelled", reason?: string) => {
    try {
      setActionLoading(bookingId);
      const token = localStorage.getItem('hostnexus_token');

      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${API_URL}/api/bookings/${bookingId}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status,
          rejectionReason: reason,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to update booking');
      }

      // Refresh bookings
      await fetchBookings();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update booking');
    } finally {
      setActionLoading(null);
    }
  };

  const handleMessage = async (otherBusinessId: string) => {
    const token = localStorage.getItem("hostnexus_token");
    if (!token) return;
    try {
      await fetch(`${API_URL}/api/messages/conversations`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ otherBusinessId }),
      });
      router.push("/dashboard/messages");
    } catch {
      router.push("/dashboard/messages");
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-stone-900">Bookings</h1>
        <p className="mt-1 text-sm text-stone-500">Manage incoming and outgoing booking requests</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-stone-200">
        <button
          onClick={() => setActiveTab("incoming")}
          className={cn(
            "px-4 py-2.5 text-sm font-semibold transition-all",
            activeTab === "incoming"
              ? "border-b-2 border-emerald-600 text-emerald-600"
              : "text-stone-500 hover:text-stone-800"
          )}
        >
          Incoming Requests
          {activeTab === "incoming" && bookings.length > 0 && (
            <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
              {bookings.filter(b => b.status === 'pending').length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("outgoing")}
          className={cn(
            "px-4 py-2.5 text-sm font-semibold transition-all",
            activeTab === "outgoing"
              ? "border-b-2 border-emerald-600 text-emerald-600"
              : "text-stone-500 hover:text-stone-800"
          )}
        >
          My Requests
          {activeTab === "outgoing" && bookings.length > 0 && (
            <span className="ml-2 rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-700">
              {bookings.length}
            </span>
          )}
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-rose-600" />
            <p className="text-sm font-medium text-rose-700">{error}</p>
          </div>
          <button
            onClick={fetchBookings}
            className="mt-3 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Bookings List */}
      {bookings.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-stone-200 bg-stone-50 p-12 text-center">
          <Package className="mx-auto h-12 w-12 text-stone-300" />
          <h3 className="mt-4 font-display text-lg font-semibold text-stone-900">
            {activeTab === "incoming" ? "No incoming requests" : "No outgoing requests"}
          </h3>
          <p className="mt-2 text-sm text-stone-500">
            {activeTab === "incoming"
              ? "When businesses request your resources, they'll appear here"
              : "Bookings you've requested from other businesses will appear here"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((booking) => (
            <motion.div
              key={booking.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-stone-200 bg-white p-6"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {/* Resource Name */}
                  <div className="flex items-center gap-3">
                    <h3 className="font-display text-lg font-bold text-stone-900">
                      {booking.resource.name}
                    </h3>
                    <span
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-semibold capitalize",
                        STATUS_COLORS[booking.status as keyof typeof STATUS_COLORS]
                      )}
                    >
                      {booking.status}
                    </span>
                  </div>

                  {/* Resource Type */}
                  <p className="mt-1 text-sm text-stone-500">{booking.resource.resourceType}</p>

                  {/* Business Info */}
                  <div className="mt-3 flex items-center gap-2 text-sm text-stone-600">
                    <Building2 className="h-4 w-4" />
                    <span className="font-medium">
                      {activeTab === "incoming" 
                        ? `Requested by ${booking.seeker.name}` 
                        : `From ${booking.provider.name}`}
                    </span>
                  </div>

                  {/* Details Grid */}
                  <div className="mt-4 grid gap-4 sm:grid-cols-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                        Dates
                      </p>
                      <div className="mt-1 flex items-center gap-1.5 text-sm text-stone-900">
                        <Calendar className="h-4 w-4 text-stone-400" />
                        {formatDate(booking.startDate)} - {formatDate(booking.endDate)}
                      </div>
                      {booking.totalDays && (
                        <p className="mt-1 text-xs text-stone-500">{booking.totalDays} days</p>
                      )}
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                        Quantity
                      </p>
                      <div className="mt-1 flex items-center gap-1.5 text-sm text-stone-900">
                        <Package className="h-4 w-4 text-stone-400" />
                        {booking.quantity}
                      </div>
                    </div>

                    {booking.resource.location && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                          Location
                        </p>
                        <div className="mt-1 flex items-center gap-1.5 text-sm text-stone-900">
                          <MapPin className="h-4 w-4 text-stone-400" />
                          {booking.resource.location}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Special Requests */}
                  {booking.specialRequests && (
                    <div className="mt-4 rounded-xl bg-stone-50 p-3">
                      <div className="flex items-start gap-2">
                        <FileText className="h-4 w-4 shrink-0 text-stone-400" />
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                            Special Requests
                          </p>
                          <p className="mt-1 text-sm text-stone-700">{booking.specialRequests}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Rejection Reason */}
                  {booking.rejectionReason && (
                    <div className="mt-4 rounded-xl bg-rose-50 p-3">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-rose-600">
                            Rejection Reason
                          </p>
                          <p className="mt-1 text-sm text-rose-700">{booking.rejectionReason}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Created Date */}
                  <p className="mt-4 text-xs text-stone-400">
                    Requested on {formatDate(booking.createdAt)}
                  </p>
                </div>

                {/* Actions */}
                <div className="ml-6 flex flex-col gap-2 shrink-0">
                  {booking.status === "pending" && activeTab === "incoming" && (
                    <>
                      <button
                        onClick={() => handleStatusUpdate(booking.id, "accepted")}
                        disabled={actionLoading === booking.id}
                        className={cn(
                          "flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white",
                          "hover:bg-emerald-700 active:scale-[0.98]",
                          "transition-all duration-200",
                          "disabled:opacity-60 disabled:cursor-not-allowed"
                        )}
                      >
                        {actionLoading === booking.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                        Accept
                      </button>
                      <button
                        onClick={() => setRejectModal({ bookingId: booking.id, resourceName: booking.resource.name })}
                        disabled={actionLoading === booking.id}
                        className={cn(
                          "flex items-center gap-2 rounded-xl border-2 border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-600",
                          "hover:bg-rose-50 active:scale-[0.98]",
                          "transition-all duration-200",
                          "disabled:opacity-60 disabled:cursor-not-allowed"
                        )}
                      >
                        <X className="h-4 w-4" />
                        Reject
                      </button>
                    </>
                  )}
                  {booking.status === "pending" && activeTab === "outgoing" && (
                    <button
                      onClick={() => handleStatusUpdate(booking.id, "cancelled")}
                      disabled={actionLoading === booking.id}
                      className={cn(
                        "flex items-center gap-2 rounded-xl border-2 border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-600",
                        "hover:bg-stone-50 active:scale-[0.98]",
                        "transition-all duration-200",
                        "disabled:opacity-60 disabled:cursor-not-allowed"
                      )}
                    >
                      {actionLoading === booking.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                      Cancel
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleMessage(activeTab === "incoming" ? booking.seeker.id : booking.provider.id)}
                    className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-all"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    {activeTab === "incoming" ? "Message Requester" : "Message Provider"}
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Reject Modal */}
      <AnimatePresence>
        {rejectModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center"
            onClick={() => { setRejectModal(null); setRejectReason(""); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="bg-white border border-stone-200 rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-1">
                <h2 className="font-display text-lg font-bold text-stone-900">
                  Reject Booking Request
                </h2>
                <button
                  onClick={() => { setRejectModal(null); setRejectReason(""); }}
                  className="rounded-lg p-1 text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-all"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>
              <p className="text-sm text-stone-500 mt-1 mb-5">
                Optionally provide a reason for rejecting the booking for &ldquo;{rejectModal.resourceName}&rdquo;.
              </p>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500 mb-1.5">
                  Reason (optional)
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  placeholder="e.g., Already booked for that date"
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-sm text-stone-800 placeholder:text-stone-400 focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all resize-none"
                />
              </div>

              <div className="flex gap-3 justify-end mt-6">
                <button
                  onClick={() => { setRejectModal(null); setRejectReason(""); }}
                  className="rounded-xl border border-stone-200 bg-white px-5 py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!rejectModal) return;
                    await handleStatusUpdate(rejectModal.bookingId, "rejected", rejectReason || undefined);
                    setRejectModal(null);
                    setRejectReason("");
                  }}
                  disabled={actionLoading === rejectModal.bookingId}
                  className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 text-sm font-semibold transition-all flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {actionLoading === rejectModal.bookingId ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  Confirm Reject
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}