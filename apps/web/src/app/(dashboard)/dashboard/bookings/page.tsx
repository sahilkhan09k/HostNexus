"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Calendar,
  Clock,
  MapPin,
  Package,
  Building2,
  Check,
  X,
  ChevronRight,
  Loader2,
  AlertCircle,
  FileText,
  XCircle,
  MessageSquare,
  ShieldCheck,
  AlertTriangle,
  DollarSign,
  Camera,
  ArrowRight,
  History,
  CheckCircle2,
  HelpCircle,
  Sparkles,
  Scale,
  TrendingDown,
  Handshake,
  RefreshCw,
  KeyRound,
  Receipt,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { ImageUploader } from "@/components/ui/image-uploader";
import { PaymentCancelledError } from "@/lib/razorpay";
import {
  getBookingRequests,
  getBookingRequestById,
  updateBookingStatus,
  payForBooking,
  markHandover,
  respondToHandoverIssue,
  submitRenterInspection,
  initiateReturn,
  submitOwnerReceipt,
  submitOwnerAcceptReturn,
  submitOwnerDamageClaim,
  submitRenterClaimResponse,
  makeNegotiationOffer,
  acceptNegotiationOffer,
  rejectNegotiation,
  type Negotiation,
  type NegotiationOffer,
} from "@/lib/api-client";
import type { BookingRequestWithDetails, ClaimType, DisputeReason, PaymentTransaction } from "@hostnexus/types";

const inr = (paise: number | null | undefined) => `₹${((paise ?? 0) / 100).toLocaleString("en-IN")}`;

/** The deadline that currently drives a booking forward, if any. */
function activeDeadline(b: BookingRequestWithDetails, isOwner: boolean): { label: string; at: string; note: string } | null {
  const dispute = b.disputes?.[0];
  switch (b.bookingStatus) {
    case "BOOKING_ACCEPTED":
      if (b.financialStatus === "PENDING_PAYMENT" && b.paymentDeadline) {
        return { label: isOwner ? "Renter must pay within" : "Pay within", at: b.paymentDeadline, note: "Unpaid bookings are cancelled automatically." };
      }
      if (b.financialStatus === "FUNDS_HELD" && b.handoverDeadline) {
        return { label: isOwner ? "Hand over within" : "Owner must hand over within", at: b.handoverDeadline, note: "If the owner misses this, the renter is refunded in full." };
      }
      return null;
    case "HANDOVER_INSPECTION":
      return b.renterInspectionDeadline
        ? { label: isOwner ? "Renter inspection ends in" : "Inspect within", at: b.renterInspectionDeadline, note: "No report by then = accepted; rent goes to the owner." }
        : null;
    case "RETURN_INITIATED":
      return b.ownerReceiptDeadline
        ? { label: isOwner ? "Confirm receipt within" : "Owner must confirm within", at: b.ownerReceiptDeadline, note: "Receipt is confirmed automatically after this." }
        : null;
    case "OWNER_INSPECTION":
      return b.ownerInspectionDeadline
        ? { label: isOwner ? "Inspect return within" : "Owner inspection ends in", at: b.ownerInspectionDeadline, note: "No claim by then = deposit refunded to the renter." }
        : null;
    case "DISPUTED":
      if (dispute?.status === "OPEN" && dispute.responseDeadline) {
        const ownerMustAnswer = dispute.kind === "HANDOVER_ISSUE";
        return {
          label: ownerMustAnswer === isOwner ? "Respond within" : `${ownerMustAnswer ? "Owner" : "Renter"} must respond within`,
          at: dispute.responseDeadline,
          note: ownerMustAnswer
            ? "No owner response = renter refunded in full."
            : "No renter response = claim accepted.",
        };
      }
      return null;
    default:
      return null;
  }
}

function DeadlineChip({ label, at, note }: { label: string; at: string; note: string }) {
  const t = useCountdown(at);
  const days = Math.floor(t.hours / 24);
  const text = t.isExpired
    ? "Expired — processing"
    : days > 0
    ? `${days}d ${t.hours % 24}h ${String(t.minutes).padStart(2, "0")}m`
    : `${String(t.hours).padStart(2, "0")}:${String(t.minutes).padStart(2, "0")}:${String(t.seconds).padStart(2, "0")}`;
  return (
    <span
      title={`${note} Deadline: ${new Date(at).toLocaleString()}`}
      className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-900"
    >
      <Clock className="w-3.5 h-3.5 text-amber-600" />
      {label} <span className="font-mono">{text}</span>
    </span>
  );
}

const TX_LABELS: Record<string, string> = {
  ESCROW_DEPOSIT: "Paid into escrow",
  FULL_REFUND: "Full refund to renter",
  RENT_REFUND: "Rent refund to renter",
  DEPOSIT_REFUND: "Deposit refund to renter",
  RENT_PAYOUT: "Rent + transport payout to owner",
  DAMAGE_PAYOUT: "Deposit payout to owner",
};

function txStatus(t: PaymentTransaction): { text: string; cls: string } {
  if (t.direction === "IN") return { text: "Received", cls: "text-green-700 bg-green-50" };
  if (t.status === "COMPLETED") {
    return t.direction === "TO_OWNER"
      ? { text: `Paid · UTR ${t.utrReference ?? "—"}`, cls: "text-green-700 bg-green-50" }
      : { text: "Refunded via Razorpay", cls: "text-green-700 bg-green-50" };
  }
  if (t.status === "FAILED") return { text: "Refund retrying", cls: "text-rose-700 bg-rose-50" };
  return t.direction === "TO_OWNER"
    ? { text: "Payout queued", cls: "text-amber-800 bg-amber-50" }
    : { text: "Refund processing", cls: "text-amber-800 bg-amber-50" };
}

// Countdown timer helper hook
function useCountdown(targetDate: string | null | undefined) {
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number; isExpired: boolean }>({
    hours: 0,
    minutes: 0,
    seconds: 0,
    isExpired: false,
  });

  useEffect(() => {
    if (!targetDate) return;

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const target = new Date(targetDate).getTime();
      const diff = target - now;

      if (diff <= 0) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0, isExpired: true });
        clearInterval(interval);
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft({ hours, minutes, seconds, isExpired: false });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [targetDate]);

  return timeLeft;
}

export default function BookingsPage() {
  const { user, business } = useAuth();
  const router = useRouter();
  const myBusinessId = business?.id;

  const [activeTab, setActiveTab] = useState<"incoming" | "outgoing" | "disputes">("incoming");
  const [bookings, setBookings] = useState<BookingRequestWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Detail Modal / Chain of Custody drawer
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<BookingRequestWithDetails | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Action Modals State
  const [rejectModal, setRejectModal] = useState<{ id: string; name: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const [cancelModal, setCancelModal] = useState<{ id: string; name: string; asOwner: boolean; funded: boolean } | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  // Owner handover: renter's code + condition photos
  const [handoverModal, setHandoverModal] = useState<{ id: string; name: string } | null>(null);
  const [handoverCode, setHandoverCode] = useState("");
  const [handoverPhotos, setHandoverPhotos] = useState<string[]>([]);
  const [handoverNotes, setHandoverNotes] = useState("");

  const [handoverIssueModal, setHandoverIssueModal] = useState(false);
  const [handoverIssueText, setHandoverIssueText] = useState("");
  const [handoverIssuePhotos, setHandoverIssuePhotos] = useState<string[]>([]);
  const [receivedQty, setReceivedQty] = useState<number>(0);

  // Owner's answer to a renter's handover issue
  const [contestModal, setContestModal] = useState<{ id: string } | null>(null);
  const [contestNotes, setContestNotes] = useState("");

  const [returnModal, setReturnModal] = useState(false);
  const [returnNotes, setReturnNotes] = useState("");
  const [returnPhotos, setReturnPhotos] = useState<string[]>([]);
  const [returnedQty, setReturnedQty] = useState<number>(0);

  const [receiptModal, setReceiptModal] = useState<{ id: string; booked: number; returned: number } | null>(null);
  const [receiptQty, setReceiptQty] = useState<number>(0);

  const [damageClaimModal, setDamageClaimModal] = useState(false);
  const [claimType, setClaimType] = useState<ClaimType>("DAMAGE");
  const [claimAmountINR, setClaimAmountINR] = useState<number>(0);
  const [claimDesc, setClaimDesc] = useState("");
  const [claimPhotos, setClaimPhotos] = useState<string[]>([]);

  const [renterDisputeModal, setRenterDisputeModal] = useState(false);
  const [renterDisputeReason, setRenterDisputeReason] = useState<DisputeReason>("PRE_EXISTING_DAMAGE");
  const [renterDisputeNotes, setRenterDisputeNotes] = useState("");
  const [renterDisputePhotos, setRenterDisputePhotos] = useState<string[]>([]);

  // ── Negotiation state ─────────────────────────────────────────
  const [negotiateModal, setNegotiateModal] = useState(false);
  const [negotiateAmountINR, setNegotiateAmountINR] = useState<number>(0);
  const [negotiateMessage, setNegotiateMessage] = useState("");

  useEffect(() => {
    fetchBookings();
  }, [activeTab]);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      setError("");
      const query: Record<string, string> = activeTab === "disputes" ? {} : { type: activeTab };
      const data = await getBookingRequests(query);
      if (activeTab === "disputes") {
        setBookings(data.filter((b) => b.bookingStatus === "DISPUTED"));
      } else {
        setBookings(data);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load bookings");
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (id: string) => {
    setSelectedBookingId(id);
    setDetailLoading(true);
    try {
      const data = await getBookingRequestById(id);
      setSelectedBooking(data);
    } catch (err) {
      console.error("Failed to load booking detail", err);
    } finally {
      setDetailLoading(false);
    }
  };

  const refreshDetail = async () => {
    if (!selectedBookingId) return;
    try {
      const data = await getBookingRequestById(selectedBookingId);
      setSelectedBooking(data);
      fetchBookings();
    } catch (err) {
      console.error(err);
    }
  };

  // ── Actions ──────────────────────────────────────────────────
  const handleAccept = async (id: string) => {
    setActionLoading(id);
    try {
      await updateBookingStatus(id, "accepted");
      await fetchBookings();
      if (selectedBookingId === id) refreshDetail();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectModal) return;
    setActionLoading(rejectModal.id);
    try {
      await updateBookingStatus(rejectModal.id, "rejected", rejectReason);
      setRejectModal(null);
      setRejectReason("");
      await fetchBookings();
      if (selectedBookingId === rejectModal.id) refreshDetail();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelConfirm = async () => {
    if (!cancelModal) return;
    setActionLoading(cancelModal.id);
    try {
      await updateBookingStatus(cancelModal.id, "cancelled", cancelReason.trim() || undefined);
      if (selectedBookingId === cancelModal.id) refreshDetail();
      setCancelModal(null);
      setCancelReason("");
      await fetchBookings();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handlePayEscrow = async (b: BookingRequestWithDetails) => {
    setActionLoading(b.id);
    try {
      await payForBooking(b.id, {
        description: `${b.resource.name} · ${b.totalDays ?? 1} day(s) · rent + deposit${b.transportFeePaise > 0 ? " + transport" : ""}`,
        prefill: { name: user?.ownerName ?? undefined, email: user?.email, contact: user?.phone ?? undefined },
      });
      await fetchBookings();
      if (selectedBookingId === b.id) refreshDetail();
    } catch (err: any) {
      if (!(err instanceof PaymentCancelledError)) alert(err.message);
      // Refresh either way: the API may have refunded a late payment or found an earlier one.
      await fetchBookings();
    } finally {
      setActionLoading(null);
    }
  };

  const handleSubmitHandover = async () => {
    if (!handoverModal) return;
    setActionLoading("handover-submit");
    try {
      await markHandover(handoverModal.id, {
        handoverCode: handoverCode.trim(),
        evidenceUrls: handoverPhotos,
        notes: handoverNotes.trim() || undefined,
      });
      if (selectedBookingId === handoverModal.id) refreshDetail();
      setHandoverModal(null);
      setHandoverCode("");
      setHandoverPhotos([]);
      setHandoverNotes("");
      await fetchBookings();
    } catch (err: any) {
      alert(err.message);
      await fetchBookings(); // attempts left may have changed
    } finally {
      setActionLoading(null);
    }
  };

  const handleAcceptHandover = async (b: BookingRequestWithDetails) => {
    setActionLoading(b.id);
    try {
      await submitRenterInspection(b.id, {
        status: "ACCEPTED",
        receivedQuantity: b.quantity,
        notes: `All ${b.quantity} unit(s) received and condition accepted`,
      });
      await fetchBookings();
      if (selectedBookingId === b.id) refreshDetail();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReportHandoverIssue = async () => {
    if (!selectedBooking) return;
    setActionLoading("handover-issue");
    try {
      await submitRenterInspection(selectedBooking.id, {
        status: "REPORTED_ISSUE",
        receivedQuantity: receivedQty,
        issueDescription: handoverIssueText,
        evidenceUrls: handoverIssuePhotos,
      });
      setHandoverIssueModal(false);
      setHandoverIssueText("");
      setHandoverIssuePhotos([]);
      await refreshDetail();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleAcceptIssue = async (id: string) => {
    if (!confirm("Accept the renter's issue? The renter is refunded in full, the booking is cancelled and you collect the item back.")) return;
    setActionLoading(id);
    try {
      await respondToHandoverIssue(id, { action: "ACCEPT" });
      await fetchBookings();
      if (selectedBookingId === id) refreshDetail();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleContestIssue = async () => {
    if (!contestModal) return;
    setActionLoading("contest-issue");
    try {
      await respondToHandoverIssue(contestModal.id, { action: "CONTEST", notes: contestNotes.trim() });
      if (selectedBookingId === contestModal.id) refreshDetail();
      setContestModal(null);
      setContestNotes("");
      await fetchBookings();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleInitiateReturn = async () => {
    if (!selectedBooking) return;
    setActionLoading("return-submit");
    try {
      await initiateReturn(selectedBooking.id, {
        returnedQuantity: returnedQty,
        notes: returnNotes,
        returnEvidenceUrls: returnPhotos,
      });
      setReturnModal(false);
      setReturnNotes("");
      setReturnPhotos([]);
      await refreshDetail();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleOwnerConfirmReceipt = async (id: string, received: boolean, receivedQuantity?: number) => {
    if (!received && !confirm("Report that nothing was returned? This files a claim on the full deposit and the renter will be asked to respond.")) return;
    setActionLoading(id);
    try {
      await submitOwnerReceipt(id, { received, receivedQuantity });
      setReceiptModal(null);
      await fetchBookings();
      if (selectedBookingId === id) refreshDetail();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleOwnerAcceptReturn = async (id: string) => {
    setActionLoading(id);
    try {
      await submitOwnerAcceptReturn(id, "Pristine return condition verified");
      await fetchBookings();
      if (selectedBookingId === id) refreshDetail();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleOwnerDamageClaim = async () => {
    if (!selectedBooking) return;
    setActionLoading("damage-claim");
    try {
      await submitOwnerDamageClaim(selectedBooking.id, {
        claimType,
        description: claimDesc,
        claimedAmountPaise: Math.round(claimAmountINR * 100),
        evidenceUrls: claimPhotos,
      });
      setDamageClaimModal(false);
      setClaimDesc("");
      setClaimPhotos([]);
      setClaimAmountINR(0);
      await refreshDetail();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRenterAcceptClaim = async (id: string) => {
    setActionLoading(id);
    try {
      await submitRenterClaimResponse(id, { action: "ACCEPT" });
      await refreshDetail();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRenterDisputeClaim = async () => {
    if (!selectedBooking) return;
    setActionLoading("renter-dispute");
    try {
      await submitRenterClaimResponse(selectedBooking.id, {
        action: "DISPUTE",
        reason: renterDisputeReason,
        rebuttalNotes: renterDisputeNotes,
        rebuttalEvidenceUrls: renterDisputePhotos,
      });
      setRenterDisputeModal(false);
      setRenterDisputeNotes("");
      setRenterDisputePhotos([]);
      await refreshDetail();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // ── Negotiation handlers ─────────────────────────────────────

  const handleMakeCounterOffer = async () => {
    if (!selectedBooking) return;
    setActionLoading("negotiate-offer");
    try {
      await makeNegotiationOffer(
        selectedBooking.id,
        Math.round(negotiateAmountINR * 100),
        negotiateMessage.trim() || undefined
      );
      setNegotiateModal(false);
      setNegotiateAmountINR(0);
      setNegotiateMessage("");
      await refreshDetail();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleAcceptOffer = async (bookingId: string) => {
    setActionLoading("negotiate-accept");
    try {
      await acceptNegotiationOffer(bookingId);
      await fetchBookings();
      if (selectedBookingId === bookingId) refreshDetail();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectNegotiation = async (bookingId: string) => {
    setActionLoading("negotiate-reject");
    try {
      await rejectNegotiation(bookingId, "Negotiation ended");
      await fetchBookings();
      if (selectedBookingId === bookingId) refreshDetail();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Status badge styling helper
  const getBookingStatusBadge = (status: string) => {
    switch (status) {
      case "BOOKING_REQUESTED":
        return <span className="rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-0.5 text-xs font-semibold">Booking Requested</span>;
      case "BOOKING_ACCEPTED":
        return <span className="rounded-full bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 text-xs font-semibold">Accepted (Awaiting Escrow)</span>;
      case "HANDOVER_INSPECTION":
        return <span className="rounded-full bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-0.5 text-xs font-semibold animate-pulse">1-Hr Receiving Inspection</span>;
      case "ACTIVE":
        return <span className="rounded-full bg-green-50 text-green-700 border border-green-200 px-2.5 py-0.5 text-xs font-semibold">Active Rental</span>;
      case "RETURN_INITIATED":
        return <span className="rounded-full bg-sky-50 text-sky-700 border border-sky-200 px-2.5 py-0.5 text-xs font-semibold">Return Initiated</span>;
      case "OWNER_INSPECTION":
        return <span className="rounded-full bg-amber-50 text-amber-800 border border-amber-300 px-2.5 py-0.5 text-xs font-semibold animate-pulse">2-Hr Return Inspection</span>;
      case "DISPUTED":
        return <span className="rounded-full bg-rose-50 text-rose-800 border border-rose-300 px-2.5 py-0.5 text-xs font-semibold">Disputed (Under Review)</span>;
      case "COMPLETED":
        return <span className="rounded-full bg-green-100 text-green-800 border border-green-200 px-2.5 py-0.5 text-xs font-semibold">Completed & Settled</span>;
      case "CANCELLED":
        return <span className="rounded-full bg-stone-100 text-stone-600 border border-stone-200 px-2.5 py-0.5 text-xs font-semibold">Cancelled</span>;
      default:
        return <span className="rounded-full bg-stone-100 text-stone-600 px-2.5 py-0.5 text-xs">{status}</span>;
    }
  };

  const getFinancialBadge = (status: string) => {
    switch (status) {
      case "PENDING_PAYMENT":
        return <span className="text-[11px] font-semibold text-stone-500 bg-stone-100 px-2 py-0.5 rounded">Unfunded</span>;
      case "NO_PAYMENT":
        return <span className="text-[11px] font-semibold text-stone-500 bg-stone-100 px-2 py-0.5 rounded">No Payment Taken</span>;
      case "FUNDS_HELD":
        return <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">Full Payment Held in Escrow</span>;
      case "RENT_RELEASED":
        return <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">Rent Released · Deposit Held</span>;
      case "FULLY_REFUNDED":
        return <span className="text-[11px] font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200">Fully Refunded to Renter</span>;
      case "DEPOSIT_REFUNDED":
        return <span className="text-[11px] font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200">Deposit 100% Refunded</span>;
      case "DEPOSIT_TO_OWNER":
        return <span className="text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">Deposit Settled to Owner</span>;
      case "PARTIAL_SETTLEMENT":
        return <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">Partial Settlement Executed</span>;
      default:
        return null;
    }
  };

  // Timers for selected booking
  const renterTimer = useCountdown(selectedBooking?.renterInspectionDeadline);
  const ownerTimer = useCountdown(selectedBooking?.ownerInspectionDeadline);

  // The viewer's role comes from the booking itself, not from the tab it is shown under
  const roleOf = (b: BookingRequestWithDetails) => {
    const isOwner = myBusinessId ? b.providerId === myBusinessId : activeTab === "incoming";
    const isRenter = myBusinessId ? b.seekerId === myBusinessId : activeTab === "outgoing";
    return { isOwner, isRenter };
  };
  const selectedRole = selectedBooking ? roleOf(selectedBooking) : { isOwner: false, isRenter: false };
  const selectedDispute = selectedBooking?.disputes?.[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-stone-900">Rental Bookings & Chain of Custody</h1>
          <p className="text-xs text-stone-500 mt-1">
            Manage commercial rentals, inspection windows, evidence trails, and escrow releases.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1 rounded-xl bg-stone-100 p-1 border border-stone-200">
          <button
            type="button"
            onClick={() => setActiveTab("incoming")}
            className={cn(
              "rounded-lg px-4 py-1.5 text-xs font-semibold transition-all",
              activeTab === "incoming"
                ? "bg-white text-stone-900 shadow-xs"
                : "text-stone-600 hover:text-stone-900"
            )}
          >
            Incoming (Owner View)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("outgoing")}
            className={cn(
              "rounded-lg px-4 py-1.5 text-xs font-semibold transition-all",
              activeTab === "outgoing"
                ? "bg-white text-stone-900 shadow-xs"
                : "text-stone-600 hover:text-stone-900"
            )}
          >
            Outgoing (Renter View)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("disputes")}
            className={cn(
              "rounded-lg px-4 py-1.5 text-xs font-semibold transition-all flex items-center gap-1.5",
              activeTab === "disputes"
                ? "bg-rose-600 text-white shadow-xs"
                : "text-rose-700 hover:bg-rose-50"
            )}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Disputes & Customer Care</span>
          </button>
        </div>
      </div>

      {/* Bookings List */}
      {loading ? (
        <div className="p-12 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      ) : bookings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-12 text-center">
          <Package className="w-10 h-10 text-stone-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-stone-800">No {activeTab} rentals found</h3>
          <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
            {activeTab === "incoming"
              ? "You don't have any rental requests from other businesses yet."
              : activeTab === "outgoing"
              ? "You haven't requested any resource rentals yet."
              : "No active dispute cases under customer care review."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {bookings.map((b) => {
            const { isOwner, isRenter } = roleOf(b);
            const deadline = activeDeadline(b, isOwner);
            const dispute = b.disputes?.[0];
            const days = b.totalDays || 1;
            const rentINR = (b.rentAmountPaise || 0) / 100;
            const depositINR = (b.securityDepositPaise || 0) / 100;
            const totalINR = (b.totalAmountPaise || 0) / 100;
            const transportINR = (b.transportFeePaise || 0) / 100;

            return (
              <div
                key={b.id}
                className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm hover:border-emerald-300 transition-all space-y-4"
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-3">
                  <div className="flex flex-wrap items-center gap-3">
                    {getBookingStatusBadge(b.bookingStatus)}
                    {getFinancialBadge(b.financialStatus)}
                    {deadline && <DeadlineChip {...deadline} />}
                  </div>
                  <span className="text-xs text-stone-400">
                    Booked {new Date(b.createdAt).toLocaleDateString()}
                  </span>
                </div>

                {/* RENTER: handover code — shown only to the renter, only while handover is pending */}
                {isRenter && b.bookingStatus === "BOOKING_ACCEPTED" && b.financialStatus === "FUNDS_HELD" && b.handoverCode && (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                    <KeyRound className="w-5 h-5 text-emerald-700 shrink-0" />
                    <div className="flex-1 text-xs text-emerald-900">
                      <strong>Your handover code.</strong> Give it to the owner (or their driver) only when the item is physically in
                      front of you. Your 1-hour inspection starts when they enter it.
                    </div>
                    <span className="font-mono text-2xl font-bold tracking-[0.3em] text-emerald-800">{b.handoverCode}</span>
                  </div>
                )}

                {b.bookingStatus === "CANCELLED" && b.rejectionReason && (
                  <p className="text-xs text-stone-500">
                    <strong>{b.cancelledBy === "OWNER" ? "Cancelled by owner" : b.cancelledBy === "SYSTEM" ? "Closed automatically" : "Cancelled"}:</strong>{" "}
                    {b.rejectionReason}
                  </p>
                )}

                {/* Resource & Commercial Info */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-stone-400">Resource</span>
                    <h4 className="text-sm font-bold text-stone-900">{b.resource.name}</h4>
                    <p className="text-stone-500">{b.resource.resourceType} · {b.quantity} unit(s)</p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-stone-400">Party</span>
                    <p className="text-stone-900 font-semibold">
                      {isOwner ? `Renter: ${b.seeker.name}` : `Owner: ${b.provider.name}`}
                    </p>
                    <p className="text-stone-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-stone-400" />
                      {new Date(b.startDate).toLocaleDateString()} &rarr; {new Date(b.endDate).toLocaleDateString()} ({days}d)
                    </p>
                  </div>

                  <div className="space-y-1 md:text-right">
                    <span className="text-[10px] uppercase font-bold text-stone-400">Financial Escrow</span>
                    <div className="text-sm font-bold text-stone-900">
                      Total: ₹{totalINR.toLocaleString()}
                    </div>
                    <p className="text-[11px] text-stone-500">
                      Rent: ₹{rentINR.toLocaleString()} + Deposit: ₹{depositINR.toLocaleString()}
                      {b.transportMode === "PROVIDER" && <> + Transport: ₹{transportINR.toLocaleString()}</>}
                    </p>
                    <p className="text-[11px] text-stone-500">
                      {b.transportMode === "PROVIDER"
                        ? `Transport: ${isOwner ? "you deliver" : "owner delivers"} · ${b.transportDistanceKm ?? 0} km × ₹${((b.transportRatePerKmPaise || 0) / 100).toLocaleString()}/km`
                        : `Transport: ${isOwner ? "renter arranges own" : "you arrange your own"}`}
                    </p>
                  </div>
                </div>

                {/* Card Action Row */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-stone-100">
                  <button
                    type="button"
                    onClick={() => openDetail(b.id)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline"
                  >
                    <span>View Chain of Custody & Evidence</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* OWNER: Accept / Reject Booking */}
                    {isOwner && b.bookingStatus === "BOOKING_REQUESTED" && (
                      <>
                        {/* If there's an open negotiation with a pending offer from renter, show negotiation actions */}
                        {b.negotiation?.status === "OPEN" && (() => {
                          const pendingOffer = b.negotiation!.offers.find((o: any) => o.status === "PENDING");
                          const isMyTurn = pendingOffer && pendingOffer.proposerRole === "SEEKER";
                          
                          if (isMyTurn) {
                            return (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleAcceptOffer(b.id)}
                                  disabled={actionLoading === "negotiate-accept"}
                                  className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-xs font-bold text-white shadow-xs flex items-center gap-1.5"
                                >
                                  <Handshake className="w-3.5 h-3.5" />
                                  Accept Negotiated Price (₹{(pendingOffer!.offeredAmountPaise / 100).toLocaleString()}/d)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    openDetail(b.id);
                                    setNegotiateAmountINR(Math.round((pendingOffer!.offeredAmountPaise / 100) * 1.1));
                                    setNegotiateModal(true);
                                  }}
                                  className="px-3 py-1.5 rounded-lg border border-amber-300 bg-white text-xs font-semibold text-amber-700 hover:bg-amber-50"
                                >
                                  Counter
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRejectNegotiation(b.id)}
                                  disabled={actionLoading === "negotiate-reject"}
                                  className="px-3 py-1.5 rounded-lg border border-stone-200 text-xs font-medium text-stone-600 hover:bg-stone-50"
                                >
                                  Reject Negotiation
                                </button>
                              </>
                            );
                          } else if (pendingOffer) {
                            return (
                              <span className="text-xs text-stone-500 bg-stone-100 px-3 py-1.5 rounded-lg">
                                ⏳ Awaiting renter's response to your counter-offer
                              </span>
                            );
                          }
                          return null;
                        })()}

                        {/* Standard accept/decline if no active negotiation turn */}
                        {(!b.negotiation || b.negotiation.status !== "OPEN" || !b.negotiation.offers.find((o: any) => o.status === "PENDING" && o.proposerRole === "SEEKER")) && (
                          <>
                            <button
                              type="button"
                              onClick={() => setRejectModal({ id: b.id, name: b.resource.name })}
                              disabled={actionLoading === b.id}
                              className="px-3 py-1.5 rounded-lg border border-stone-200 text-xs font-medium text-stone-600 hover:bg-stone-50"
                            >
                              Decline
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAccept(b.id)}
                              disabled={actionLoading === b.id}
                              className="px-4 py-1.5 rounded-lg bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700 shadow-xs"
                            >
                              Accept at Listed Price
                            </button>
                          </>
                        )}
                      </>
                    )}

                    {/* RENTER: Negotiation waiting state */}
                    {isRenter && b.bookingStatus === "BOOKING_REQUESTED" && b.negotiation?.status === "OPEN" && (() => {
                      const pendingOffer = b.negotiation!.offers.find((o: any) => o.status === "PENDING");
                      const isMyTurn = pendingOffer && pendingOffer.proposerRole === "PROVIDER";
                      
                      if (isMyTurn) {
                        return (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleAcceptOffer(b.id)}
                              disabled={actionLoading === "negotiate-accept"}
                              className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-xs font-bold text-white shadow-xs"
                            >
                              Accept (₹{(pendingOffer!.offeredAmountPaise / 100).toLocaleString()}/d)
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                openDetail(b.id);
                                setNegotiateAmountINR(Math.round((pendingOffer!.offeredAmountPaise / 100) * 0.95));
                                setNegotiateModal(true);
                              }}
                              className="px-3 py-1.5 rounded-lg border border-amber-300 bg-white text-xs font-semibold text-amber-700 hover:bg-amber-50"
                            >
                              Counter
                            </button>
                          </div>
                        );
                      } else if (pendingOffer) {
                        return (
                          <span className="text-xs text-stone-500 bg-stone-100 px-3 py-1.5 rounded-lg flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 animate-pulse" />
                            Awaiting owner's response…
                          </span>
                        );
                      }
                      return null;
                    })()}

                    {/* RENTER: cancel before handover (full refund if paid) */}
                    {isRenter && (b.bookingStatus === "BOOKING_REQUESTED" || b.bookingStatus === "BOOKING_ACCEPTED") && (
                      <button
                        type="button"
                        onClick={() => setCancelModal({ id: b.id, name: b.resource.name, asOwner: false, funded: b.financialStatus === "FUNDS_HELD" })}
                        disabled={actionLoading === b.id}
                        className="px-3 py-1.5 rounded-lg border border-stone-200 text-xs font-medium text-stone-600 hover:bg-stone-50"
                      >
                        Cancel Booking
                      </button>
                    )}

                    {/* RENTER: Pay Escrow via Razorpay Checkout */}
                    {isRenter && b.bookingStatus === "BOOKING_ACCEPTED" && b.financialStatus === "PENDING_PAYMENT" && (
                      <button
                        type="button"
                        onClick={() => handlePayEscrow(b)}
                        disabled={actionLoading === b.id}
                        className="px-4 py-1.5 rounded-lg bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700 shadow-xs flex items-center gap-1.5 disabled:opacity-60"
                      >
                        {actionLoading === b.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <DollarSign className="w-3.5 h-3.5" />}
                        <span>Pay into Escrow (₹{totalINR.toLocaleString()})</span>
                      </button>
                    )}

                    {/* OWNER: cancel after accepting (renter refunded, counts on your profile) */}
                    {isOwner && b.bookingStatus === "BOOKING_ACCEPTED" && (
                      <button
                        type="button"
                        onClick={() => setCancelModal({ id: b.id, name: b.resource.name, asOwner: true, funded: b.financialStatus === "FUNDS_HELD" })}
                        disabled={actionLoading === b.id}
                        className="px-3 py-1.5 rounded-lg border border-stone-200 text-xs font-medium text-stone-600 hover:bg-stone-50"
                      >
                        Cancel Booking
                      </button>
                    )}

                    {/* OWNER: waiting for payment */}
                    {isOwner && b.bookingStatus === "BOOKING_ACCEPTED" && b.financialStatus === "PENDING_PAYMENT" && (
                      <span className="text-xs text-stone-500 bg-stone-100 px-3 py-1.5 rounded-lg">Waiting for the renter to pay</span>
                    )}

                    {/* OWNER: Verified handover (renter's code + condition photos) */}
                    {isOwner && b.bookingStatus === "BOOKING_ACCEPTED" && b.financialStatus === "FUNDS_HELD" && (
                      <button
                        type="button"
                        onClick={() => setHandoverModal({ id: b.id, name: b.resource.name })}
                        disabled={actionLoading === b.id}
                        className="px-4 py-1.5 rounded-lg bg-purple-600 text-xs font-semibold text-white hover:bg-purple-700 shadow-xs flex items-center gap-1.5"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        Hand Over (Enter Renter&apos;s Code)
                      </button>
                    )}

                    {/* RENTER: 1-Hour Receiving Inspection Actions */}
                    {isRenter && b.bookingStatus === "HANDOVER_INSPECTION" && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            openDetail(b.id);
                            setReceivedQty(b.quantity);
                            setHandoverIssueModal(true);
                          }}
                          className="px-3 py-1.5 rounded-lg border border-rose-300 bg-rose-50 text-xs font-medium text-rose-700 hover:bg-rose-100"
                        >
                          Report Issue / Short Delivery
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAcceptHandover(b)}
                          disabled={actionLoading === b.id}
                          className="px-4 py-1.5 rounded-lg bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700 shadow-xs"
                        >
                          All {b.quantity} Received — Accept
                        </button>
                      </>
                    )}

                    {/* OWNER: respond to a renter's handover issue */}
                    {isOwner && b.bookingStatus === "DISPUTED" && dispute?.kind === "HANDOVER_ISSUE" && dispute.status === "OPEN" && (
                      <>
                        <button
                          type="button"
                          onClick={() => setContestModal({ id: b.id })}
                          className="px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-xs font-medium text-stone-700 hover:bg-stone-50"
                        >
                          Contest (Send to Admin)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAcceptIssue(b.id)}
                          disabled={actionLoading === b.id}
                          className="px-4 py-1.5 rounded-lg bg-rose-600 text-xs font-semibold text-white hover:bg-rose-700 shadow-xs"
                        >
                          Accept Issue (Refund Renter)
                        </button>
                      </>
                    )}

                    {/* Dispute waiting on the other side or on admin */}
                    {b.bookingStatus === "DISPUTED" && dispute?.status === "ESCALATED" && (
                      <span className="text-xs text-rose-800 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                        <Scale className="w-3.5 h-3.5" />
                        With HostNexus admin for a decision
                      </span>
                    )}

                    {/* RENTER: Active Rental -> Initiate Return */}
                    {isRenter && b.bookingStatus === "ACTIVE" && (
                      <button
                        type="button"
                        onClick={() => {
                          openDetail(b.id);
                          setReturnedQty(b.quantity);
                          setReturnModal(true);
                        }}
                        className="px-4 py-1.5 rounded-lg bg-sky-600 text-xs font-semibold text-white hover:bg-sky-700 shadow-xs"
                      >
                        Mark Returned (Upload Evidence)
                      </button>
                    )}

                    {/* OWNER: Fake Return Protection Confirmation */}
                    {isOwner && b.bookingStatus === "RETURN_INITIATED" && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleOwnerConfirmReceipt(b.id, false)}
                          disabled={actionLoading === b.id}
                          className="px-3 py-1.5 rounded-lg border border-rose-300 bg-rose-50 text-xs font-medium text-rose-700 hover:bg-rose-100"
                        >
                          Not Received!
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const returned = b.returnedQuantity ?? b.quantity;
                            setReceiptQty(returned);
                            setReceiptModal({ id: b.id, booked: b.quantity, returned });
                          }}
                          disabled={actionLoading === b.id}
                          className="px-4 py-1.5 rounded-lg bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700 shadow-xs"
                        >
                          Count &amp; Confirm Receipt (Starts 2h Window)
                        </button>
                      </>
                    )}

                    {/* OWNER: 2-Hour Return Inspection Actions */}
                    {isOwner && b.bookingStatus === "OWNER_INSPECTION" && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            openDetail(b.id);
                            setDamageClaimModal(true);
                          }}
                          className="px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-xs font-medium text-amber-800 hover:bg-amber-100"
                        >
                          File Damage Claim
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOwnerAcceptReturn(b.id)}
                          disabled={actionLoading === b.id}
                          className="px-4 py-1.5 rounded-lg bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700 shadow-xs"
                        >
                          Everything OK (Release Deposit)
                        </button>
                      </>
                    )}

                    {/* RENTER: respond to an owner's return claim */}
                    {isRenter && b.bookingStatus === "DISPUTED" && dispute?.kind === "RETURN_CLAIM" && dispute.status === "OPEN" && (
                      <button
                        type="button"
                        onClick={() => openDetail(b.id)}
                        className="px-4 py-1.5 rounded-lg bg-rose-600 text-xs font-bold text-white hover:bg-rose-700 shadow-xs"
                      >
                        Review &amp; Respond to Claim
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Chain of Custody & Evidence Inspector Drawer / Modal ────── */}
      {selectedBookingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-4xl rounded-2xl bg-white shadow-2xl overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4 bg-stone-50/80 shrink-0">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-6 h-6 text-emerald-600" />
                <div>
                  <h2 className="text-base font-bold text-stone-900">
                    Digital Chain of Custody: {selectedBooking?.resource?.name || "Booking"}
                  </h2>
                  <p className="text-xs text-stone-500">
                    Booking ID: <span className="font-mono">{selectedBooking?.id}</span> · Snapshot Terms v2.0
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBookingId(null)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200/60"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {detailLoading || !selectedBooking ? (
                <div className="py-16 flex justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                </div>
              ) : (
                <>
                  {/* Status Bar & Active Inspection Window Countdown */}
                  <div className="rounded-2xl border border-stone-200 bg-stone-50/60 p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {getBookingStatusBadge(selectedBooking.bookingStatus)}
                        {getFinancialBadge(selectedBooking.financialStatus)}
                      </div>

                      {/* Renter Inspection Timer */}
                      {selectedBooking.bookingStatus === "HANDOVER_INSPECTION" && (
                        <div className="rounded-xl border border-purple-200 bg-purple-50 px-3.5 py-1.5 text-xs text-purple-900 font-medium flex items-center gap-2">
                          <Clock className="w-4 h-4 text-purple-600 animate-spin" />
                          <span>
                            Renter Inspection Window:{" "}
                            <span className="font-mono font-bold text-purple-700">
                              {renterTimer.isExpired
                                ? "Window Expired (Auto-Accept Pending)"
                                : `${String(renterTimer.minutes).padStart(2, "0")}:${String(renterTimer.seconds).padStart(2, "0")}`}
                            </span>
                          </span>
                        </div>
                      )}

                      {/* Owner Return Inspection Timer */}
                      {selectedBooking.bookingStatus === "OWNER_INSPECTION" && (
                        <div className="rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-1.5 text-xs text-amber-900 font-medium flex items-center gap-2">
                          <Clock className="w-4 h-4 text-amber-600 animate-spin" />
                          <span>
                            Owner Return Window:{" "}
                            <span className="font-mono font-bold text-amber-800">
                              {ownerTimer.isExpired
                                ? "Window Expired (Auto-Refund Pending)"
                                : `${String(ownerTimer.hours).padStart(2, "0")}:${String(ownerTimer.minutes).padStart(2, "0")}:${String(ownerTimer.seconds).padStart(2, "0")}`}
                            </span>
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="text-xs text-stone-600 flex flex-wrap gap-x-6 gap-y-1 pt-1 border-t border-stone-200/60">
                      <span>Owner: <strong>{selectedBooking.provider.name}</strong></span>
                      <span>Renter: <strong>{selectedBooking.seeker.name}</strong></span>
                      <span>Total Escrow: <strong>₹{((selectedBooking.totalAmountPaise || 0) / 100).toLocaleString()}</strong> (Rent: ₹{((selectedBooking.rentAmountPaise || 0) / 100).toLocaleString()} + Deposit: ₹{((selectedBooking.securityDepositPaise || 0) / 100).toLocaleString()}{selectedBooking.transportMode === "PROVIDER" && <> + Transport: ₹{((selectedBooking.transportFeePaise || 0) / 100).toLocaleString()}</>})</span>
                      <span>
                        Transport: <strong>
                          {selectedBooking.transportMode === "PROVIDER"
                            ? `Owner delivers (${selectedBooking.transportDistanceKm ?? 0} km × ₹${((selectedBooking.transportRatePerKmPaise || 0) / 100).toLocaleString()}/km)`
                            : "Renter arranges own"}
                        </strong>
                      </span>
                    </div>
                  </div>

                  {/* SIDE-BY-SIDE 4-STAGE EVIDENCE INSPECTOR */}
                  <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs space-y-4">
                    <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
                      <Camera className="w-5 h-5 text-emerald-600" />
                      <h3 className="text-sm font-bold text-stone-900">Side-by-Side Digital Evidence Chain</h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                      {/* Stage 1: Pre-Rental Listing Condition */}
                      <div className="rounded-xl border border-stone-200 bg-stone-50/50 p-3 flex flex-col space-y-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                          1. Pre-Rental Listing
                        </span>
                        <div className="text-xs text-stone-700 min-h-[38px]">
                          {selectedBooking.damageDisclosureSnapshot?.hasPreExistingDamage ? (
                            <span className="text-amber-800 font-medium">
                              Disclosed Wear: {String(selectedBooking.damageDisclosureSnapshot.damageDescription || "")}
                            </span>
                          ) : (
                            <span className="text-green-700 font-medium flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Declared Pristine
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-1.5 pt-1">
                          {selectedBooking.listingPhotosSnapshot && selectedBooking.listingPhotosSnapshot.length > 0 ? (
                            selectedBooking.listingPhotosSnapshot.map((url, i) => (
                              <img key={i} src={url} alt="Listing" className="w-full h-16 object-cover rounded-lg border border-stone-200" />
                            ))
                          ) : (
                            <span className="text-[11px] text-stone-400 col-span-2 py-4 text-center">No photos</span>
                          )}
                        </div>
                      </div>

                      {/* Stage 2: Owner's condition photos at the verified handover */}
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-3 flex flex-col space-y-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                          2. Owner at Handover
                        </span>
                        <div className="text-xs text-stone-700 min-h-[38px]">
                          {selectedBooking.handoverInitiatedAt ? (
                            <span className="text-emerald-900 font-medium">
                              Code-verified {new Date(selectedBooking.handoverInitiatedAt).toLocaleString()} · {selectedBooking.quantity} unit(s)
                            </span>
                          ) : (
                            <span className="text-stone-400">Not handed over yet</span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-1.5 pt-1">
                          {selectedBooking.evidence?.filter((e) => e.stage === "HANDOVER").map((e, i) => (
                            <img key={i} src={e.fileUrl} alt="Handover" className="w-full h-16 object-cover rounded-lg border border-emerald-300" />
                          ))}
                        </div>
                      </div>

                      {/* Stage 3: Renter Receiving Photos */}
                      <div className="rounded-xl border border-purple-200 bg-purple-50/30 p-3 flex flex-col space-y-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700">
                          3. Renter Receiving
                        </span>
                        <div className="text-xs text-stone-700 min-h-[38px]">
                          {selectedBooking.receivedQuantity != null ? (
                            <span className={cn("font-medium", selectedBooking.receivedQuantity < selectedBooking.quantity ? "text-rose-700" : "text-purple-900")}>
                              Received {selectedBooking.receivedQuantity} of {selectedBooking.quantity}
                              {selectedBooking.evidence?.some((e) => e.stage === "RECEIVING") ? " · photos uploaded" : ""}
                            </span>
                          ) : (
                            <span className="text-stone-400">Awaiting receiving inspection</span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-1.5 pt-1">
                          {selectedBooking.evidence?.filter((e) => e.stage === "RECEIVING").map((e, i) => (
                            <img key={i} src={e.fileUrl} alt="Receiving" className="w-full h-16 object-cover rounded-lg border border-purple-300" />
                          ))}
                        </div>
                      </div>

                      {/* Stage 3: Return Evidence */}
                      <div className="rounded-xl border border-sky-200 bg-sky-50/30 p-3 flex flex-col space-y-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700">
                          4. Return
                        </span>
                        <div className="text-xs text-stone-700 min-h-[38px]">
                          {selectedBooking.returnedQuantity != null ? (
                            <span className="text-sky-900 font-medium">
                              Renter returned {selectedBooking.returnedQuantity} of {selectedBooking.quantity}
                              {selectedBooking.ownerReceivedQuantity != null && (
                                <> · owner counted {selectedBooking.ownerReceivedQuantity}</>
                              )}
                            </span>
                          ) : (
                            <span className="text-stone-400">Awaiting return</span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-1.5 pt-1">
                          {selectedBooking.evidence?.filter((e) => e.stage === "RETURN").map((e, i) => (
                            <img key={i} src={e.fileUrl} alt="Return" className="w-full h-16 object-cover rounded-lg border border-sky-300" />
                          ))}
                        </div>
                      </div>

                      {/* Stage 4: Owner Damage Claim Photos */}
                      <div className="rounded-xl border border-rose-200 bg-rose-50/30 p-3 flex flex-col space-y-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700">
                          5. Owner Claim
                        </span>
                        <div className="text-xs text-stone-700 min-h-[38px]">
                          {selectedBooking.damageClaims && selectedBooking.damageClaims.length > 0 ? (
                            <span className="text-rose-900 font-bold">
                              Claim: ₹{((selectedBooking.damageClaims[0].claimedAmountPaise || 0) / 100).toLocaleString()} ({selectedBooking.damageClaims[0].claimType})
                            </span>
                          ) : (
                            <span className="text-green-700">No damage claimed</span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-1.5 pt-1">
                          {selectedBooking.evidence?.filter((e) => e.stage === "DAMAGE_CLAIM").map((e, i) => (
                            <img key={i} src={e.fileUrl} alt="Damage" className="w-full h-16 object-cover rounded-lg border border-rose-300" />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* HANDOVER ISSUE PANEL (raised by the renter; the owner answers) */}
                  {selectedDispute?.kind === "HANDOVER_ISSUE" && (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-5 h-5 text-rose-600" />
                          <h3 className="text-sm font-bold text-rose-900">Handover Issue Reported by Renter</h3>
                        </div>
                        <span className="rounded-full bg-rose-600 text-white px-2.5 py-0.5 text-xs font-bold">
                          {selectedDispute.status === "OPEN" ? "Awaiting owner" : selectedDispute.status === "ESCALATED" ? "With admin" : "Resolved"}
                        </span>
                      </div>
                      <p className="text-xs text-rose-800">
                        <strong>Renter:</strong> {selectedDispute.renterResponse}
                        {selectedBooking.receivedQuantity != null && selectedBooking.receivedQuantity < selectedBooking.quantity && (
                          <> (received {selectedBooking.receivedQuantity} of {selectedBooking.quantity})</>
                        )}
                      </p>
                      <p className="text-[11px] text-rose-700">
                        The whole payment ({inr(selectedBooking.totalAmountPaise)}) stays in escrow until this is settled.
                      </p>
                      {selectedDispute.ownerResponse && (
                        <p className="text-xs text-stone-800 bg-white p-3 rounded-xl border border-stone-200">
                          <strong>Owner:</strong> {selectedDispute.ownerResponse}
                        </p>
                      )}
                      {selectedDispute.status === "RESOLVED" && selectedDispute.resolutionNotes && (
                        <p className="text-xs text-stone-800 bg-white p-3 rounded-xl border border-stone-200">
                          <strong>Outcome ({selectedDispute.adminDecision}):</strong> {selectedDispute.resolutionNotes}
                        </p>
                      )}
                      {selectedRole.isOwner && selectedDispute.status === "OPEN" && selectedBooking.bookingStatus === "DISPUTED" && (
                        <div className="flex flex-wrap items-center gap-3 pt-2">
                          <button
                            type="button"
                            onClick={() => handleAcceptIssue(selectedBooking.id)}
                            className="px-4 py-2 rounded-xl bg-rose-600 text-xs font-bold text-white hover:bg-rose-700"
                          >
                            Accept Issue — Refund Renter in Full
                          </button>
                          <button
                            type="button"
                            onClick={() => setContestModal({ id: selectedBooking.id })}
                            className="px-4 py-2 rounded-xl border border-stone-300 bg-white text-xs font-bold text-stone-700 hover:bg-stone-50"
                          >
                            Contest &amp; Send to Admin
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* RETURN CLAIM PANEL (raised by the owner; the renter answers) */}
                  {selectedDispute?.kind === "RETURN_CLAIM" && selectedBooking.damageClaims && selectedBooking.damageClaims.length > 0 && (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-5 h-5 text-rose-600" />
                          <h3 className="text-sm font-bold text-rose-900">
                            Claim on the Security Deposit
                          </h3>
                        </div>
                        <span className="rounded-full bg-rose-600 text-white px-2.5 py-0.5 text-xs font-bold">
                          {inr(selectedBooking.damageClaims[0].claimedAmountPaise)} claimed ·{" "}
                          {selectedDispute.status === "OPEN" ? "awaiting renter" : selectedDispute.status === "ESCALATED" ? "with admin" : "resolved"}
                        </span>
                      </div>

                      <p className="text-xs text-rose-800">
                        <strong>{selectedDispute.raisedByRole === "SYSTEM" ? "System" : "Owner"} ({selectedBooking.damageClaims[0].claimType}):</strong>{" "}
                        {selectedBooking.damageClaims[0].description}
                      </p>

                      {selectedDispute.renterResponse && (
                        <p className="text-xs text-stone-800 bg-white p-3 rounded-xl border border-stone-200">
                          <strong>Renter Response:</strong> {selectedDispute.renterResponse}
                        </p>
                      )}
                      {selectedDispute.status === "RESOLVED" && selectedDispute.resolutionNotes && (
                        <p className="text-xs text-stone-800 bg-white p-3 rounded-xl border border-stone-200">
                          <strong>Outcome ({selectedDispute.adminDecision}):</strong> {selectedDispute.resolutionNotes}
                        </p>
                      )}

                      {/* Renter Claim Response Buttons */}
                      {selectedRole.isRenter && selectedBooking.bookingStatus === "DISPUTED" && selectedDispute.status === "OPEN" && (
                        <div className="flex items-center gap-3 pt-2">
                          <button
                            type="button"
                            onClick={() => handleRenterAcceptClaim(selectedBooking.id)}
                            className="px-4 py-2 rounded-xl bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700"
                          >
                            Accept Deduction (₹{((selectedBooking.damageClaims[0].claimedAmountPaise || 0) / 100).toLocaleString()})
                          </button>
                          <button
                            type="button"
                            onClick={() => setRenterDisputeModal(true)}
                            className="px-4 py-2 rounded-xl border border-rose-300 bg-white text-xs font-bold text-rose-700 hover:bg-rose-50"
                          >
                            Dispute Claim &amp; Submit Evidence
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── NEGOTIATION PANEL ──────────────────────────────────── */}
                  {selectedBooking.negotiation && selectedBooking.negotiation.status === "OPEN" && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 space-y-4">
                      <div className="flex items-center justify-between border-b border-amber-200/60 pb-3">
                        <div className="flex items-center gap-2">
                          <Handshake className="w-5 h-5 text-amber-600" />
                          <h3 className="text-sm font-bold text-amber-900">Active Price Negotiation</h3>
                        </div>
                        <span className="rounded-full bg-amber-600 text-white px-2.5 py-0.5 text-xs font-bold flex items-center gap-1">
                          <RefreshCw className="w-3 h-3" />
                          {selectedBooking.negotiation.offers.length} Offer{selectedBooking.negotiation.offers.length !== 1 ? "s" : ""}
                        </span>
                      </div>

                      {/* Offer thread (chronological) */}
                      <div className="space-y-3">
                        {selectedBooking.negotiation.offers.map((offer: NegotiationOffer, idx: number) => {
                          const isSeeker = offer.proposerRole === "SEEKER";
                          const myBusinessId = (user as any)?.business?.id;
                          const isMyOffer = myBusinessId && offer.proposer.id === myBusinessId;
                          
                          return (
                            <div
                              key={offer.id}
                              className={cn(
                                "rounded-xl border p-3.5 space-y-2",
                                offer.status === "PENDING"
                                  ? "border-amber-300 bg-white shadow-xs"
                                  : "border-stone-200 bg-stone-50/70"
                              )}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className={cn(
                                    "text-xs font-bold",
                                    isSeeker ? "text-sky-700" : "text-emerald-700"
                                  )}>
                                    {isSeeker ? "Renter" : "Owner"}: {offer.proposer.name}
                                  </span>
                                  <span className={cn(
                                    "text-[10px] font-semibold px-2 py-0.5 rounded uppercase",
                                    offer.status === "PENDING" && "bg-amber-100 text-amber-800",
                                    offer.status === "COUNTERED" && "bg-stone-100 text-stone-600",
                                    offer.status === "ACCEPTED" && "bg-green-100 text-green-800",
                                    offer.status === "REJECTED" && "bg-rose-100 text-rose-800"
                                  )}>
                                    {offer.status.replace("_", " ")}
                                  </span>
                                </div>
                                <span className="text-base font-bold text-stone-900">
                                  ₹{(offer.offeredAmountPaise / 100).toLocaleString()}<span className="text-xs text-stone-500 font-normal">/day</span>
                                </span>
                              </div>

                              {offer.message && (
                                <p className="text-xs text-stone-700 bg-white rounded-lg p-2 border border-stone-100">
                                  "{offer.message}"
                                </p>
                              )}

                              <p className="text-[10px] text-stone-400">
                                {new Date(offer.createdAt).toLocaleString()}
                              </p>
                            </div>
                          );
                        })}
                      </div>

                      {/* Action buttons for pending offer */}
                      {(() => {
                        const pendingOffer = selectedBooking.negotiation!.offers.find((o: NegotiationOffer) => o.status === "PENDING");
                        if (!pendingOffer) return null;

                        const isRenter = selectedBooking.seekerId === (user as any)?.business?.id;
                        const isOwner  = selectedBooking.providerId === (user as any)?.business?.id;
                        const isMyTurn = (isRenter && pendingOffer.proposerRole === "PROVIDER") ||
                                         (isOwner && pendingOffer.proposerRole === "SEEKER");

                        return (
                          <div className="pt-3 border-t border-amber-200/60 space-y-3">
                            {isMyTurn ? (
                              <>
                                <p className="text-xs text-stone-700 font-medium">
                                  {pendingOffer.proposerRole === "SEEKER"
                                    ? "The renter proposed a counter-offer. You can accept, counter back, or reject."
                                    : "The owner countered. You can accept, counter back, or reject."}
                                </p>
                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleAcceptOffer(selectedBooking.id)}
                                    disabled={actionLoading === "negotiate-accept"}
                                    className="px-4 py-2 rounded-xl bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs disabled:opacity-50"
                                  >
                                    ✓ Accept Offer (₹{(pendingOffer.offeredAmountPaise / 100).toLocaleString()}/day)
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setNegotiateAmountINR(Math.round((pendingOffer.offeredAmountPaise / 100) * 1.05));
                                      setNegotiateModal(true);
                                    }}
                                    className="px-4 py-2 rounded-xl border border-amber-300 bg-white text-xs font-semibold text-amber-800 hover:bg-amber-50"
                                  >
                                    <TrendingDown className="w-3.5 h-3.5 inline mr-1" />
                                    Make Counter-Offer
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRejectNegotiation(selectedBooking.id)}
                                    disabled={actionLoading === "negotiate-reject"}
                                    className="px-3 py-2 rounded-xl border border-stone-200 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
                                  >
                                    ✕ End Negotiation
                                  </button>
                                </div>
                              </>
                            ) : (
                              <p className="text-xs text-stone-500 bg-white rounded-lg p-3 border border-stone-200">
                                ⏳ Waiting for {pendingOffer.proposerRole === "SEEKER" ? "owner" : "renter"} to respond to your offer…
                              </p>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* ESCROW LEDGER — every rupee in and out, with real refund / payout status */}
                  {selectedBooking.paymentTransactions && selectedBooking.paymentTransactions.length > 0 && (
                    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs space-y-3">
                      <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
                        <Receipt className="w-5 h-5 text-emerald-600" />
                        <h3 className="text-sm font-bold text-stone-900">Escrow Ledger</h3>
                      </div>
                      <ul className="divide-y divide-stone-100">
                        {selectedBooking.paymentTransactions.map((t) => {
                          const st = txStatus(t);
                          return (
                            <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
                              <span className="text-stone-700">{TX_LABELS[t.type] ?? t.type}</span>
                              <span className="flex items-center gap-2">
                                <span className={cn("rounded px-2 py-0.5 text-[10px] font-semibold", st.cls)}>{st.text}</span>
                                <span className={cn("font-mono font-bold", t.direction === "IN" ? "text-stone-900" : "text-stone-600")}>
                                  {t.direction === "IN" ? "+" : "−"}{inr(t.amountPaise)}
                                </span>
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                      {(() => {
                        const lines = selectedBooking.paymentTransactions!;
                        const held = lines.reduce((s, t) => s + (t.direction === "IN" ? t.amountPaise : -t.amountPaise), 0);
                        return (
                          <p className="text-[11px] text-stone-500 pt-1 border-t border-stone-100">
                            Still held in escrow: <strong className="text-stone-800">{inr(held)}</strong>. Refunds go back to the
                            original payment method through Razorpay; owner payouts are settled by HostNexus to the owner&apos;s bank.
                          </p>
                        );
                      })()}
                    </div>
                  )}

                  {/* VISUAL AUDIT TIMELINE */}
                  <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs space-y-4">
                    <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
                      <History className="w-5 h-5 text-emerald-600" />
                      <h3 className="text-sm font-bold text-stone-900">Immutable Audit Timeline</h3>
                    </div>

                    <div className="space-y-4 relative pl-4 border-l-2 border-stone-200 ml-2">
                      {selectedBooking.timelineEvents && selectedBooking.timelineEvents.length > 0 ? (
                        selectedBooking.timelineEvents.map((evt, idx) => (
                          <div key={idx} className="relative space-y-1">
                            <div className="absolute -left-[23px] top-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-4 ring-white" />
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-stone-900">{evt.title}</span>
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-stone-100 text-stone-500 font-semibold">
                                {evt.actorRole}
                              </span>
                              <span className="text-[10px] text-stone-400">
                                {new Date(evt.createdAt).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-xs text-stone-600 leading-relaxed">{evt.description}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-stone-400">No events recorded yet.</p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Handover Issue Modal (Renter) ─────────────────────────── */}
      {handoverIssueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-stone-900">Report Handover Defect / Discrepancy</h3>
            <p className="text-xs text-stone-500">
              Upload photos and describe the problem. The whole payment stays in escrow; the owner has 24 hours to accept
              (you are refunded in full) or contest (HostNexus admin decides).
            </p>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Units actually received (booked: {selectedBooking?.quantity ?? 0})
              </label>
              <input
                type="number"
                min={0}
                max={selectedBooking?.quantity ?? 0}
                value={receivedQty}
                onChange={(e) => setReceivedQty(Math.max(0, Math.min(selectedBooking?.quantity ?? 0, parseInt(e.target.value) || 0)))}
                className="w-32 rounded-xl border border-stone-200 p-2 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Issue Description *</label>
              <textarea
                rows={3}
                value={handoverIssueText}
                onChange={(e) => setHandoverIssueText(e.target.value)}
                placeholder="Describe why you cannot accept the resource..."
                className="w-full rounded-xl border border-stone-200 p-3 text-xs"
              />
            </div>

            <ImageUploader
              value={handoverIssuePhotos}
              onChange={setHandoverIssuePhotos}
              label="Damage Evidence Photos *"
            />

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setHandoverIssueModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReportHandoverIssue}
                disabled={actionLoading === "handover-issue" || handoverIssueText.trim().length < 10 || handoverIssuePhotos.length === 0}
                className="px-5 py-2 rounded-xl bg-rose-600 text-xs font-semibold text-white hover:bg-rose-700"
              >
                {actionLoading === "handover-issue" ? "Submitting..." : "Submit Discrepancy & Reject"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Return Submission Modal (Renter) ───────────────────────── */}
      {returnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-stone-900">Initiate Resource Return</h3>
            <p className="text-xs text-stone-500">
              Upload return evidence photos to establish the physical condition of the resource upon returning it.
              The owner has 24 hours to confirm receipt, after which it is confirmed automatically.
            </p>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Units you are returning (booked: {selectedBooking?.quantity ?? 0})
              </label>
              <input
                type="number"
                min={1}
                max={selectedBooking?.quantity ?? 1}
                value={returnedQty}
                onChange={(e) => setReturnedQty(Math.max(1, Math.min(selectedBooking?.quantity ?? 1, parseInt(e.target.value) || 1)))}
                className="w-32 rounded-xl border border-stone-200 p-2 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Return Notes</label>
              <textarea
                rows={2}
                value={returnNotes}
                onChange={(e) => setReturnNotes(e.target.value)}
                placeholder="e.g. Returned to Andheri warehouse, handed over intact to security manager..."
                className="w-full rounded-xl border border-stone-200 p-3 text-xs"
              />
            </div>

            <ImageUploader
              value={returnPhotos}
              onChange={setReturnPhotos}
              label="Return Evidence Photos *"
              description="Capture clean, intact photos before handover"
            />

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setReturnModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleInitiateReturn}
                disabled={actionLoading === "return-submit" || returnPhotos.length === 0}
                className="px-5 py-2 rounded-xl bg-sky-600 text-xs font-semibold text-white hover:bg-sky-700"
              >
                {actionLoading === "return-submit" ? "Submitting..." : "Submit Return Evidence"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Owner Damage Claim Modal ───────────────────────────────── */}
      {damageClaimModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-stone-900">File Return Damage Claim</h3>
            <p className="text-xs text-stone-500">
              Upload photographic evidence and enter estimated repair or replacement costs.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Claim Type</label>
                <select
                  value={claimType}
                  onChange={(e) => setClaimType(e.target.value as ClaimType)}
                  className="w-full rounded-xl border border-stone-200 p-2 text-xs"
                >
                  <option value="DAMAGE">Physical Damage / Broken</option>
                  <option value="MISSING_ITEM">Missing Item</option>
                  <option value="MISSING_QUANTITY">Missing Quantity</option>
                  <option value="WRONG_ITEM_RETURNED">Wrong Item Returned</option>
                  <option value="SEVERE_STAIN">Severe Stain / Spill</option>
                  <option value="OTHER">Other Defect</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Claim Amount (₹ INR) *</label>
                <input
                  type="number"
                  min="1"
                  value={claimAmountINR || ""}
                  onChange={(e) => setClaimAmountINR(parseFloat(e.target.value) || 0)}
                  placeholder="e.g. 1500"
                  className="w-full rounded-xl border border-stone-200 p-2 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Description of Damage *</label>
              <textarea
                rows={3}
                value={claimDesc}
                onChange={(e) => setClaimDesc(e.target.value)}
                placeholder="Detail the newly discovered damage..."
                className="w-full rounded-xl border border-stone-200 p-3 text-xs"
              />
            </div>

            <ImageUploader
              value={claimPhotos}
              onChange={setClaimPhotos}
              label="Live Damage Photos *"
              description="Capture close-up photos of the damage"
            />

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setDamageClaimModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleOwnerDamageClaim}
                disabled={actionLoading === "damage-claim" || !claimDesc.trim() || claimAmountINR <= 0}
                className="px-5 py-2 rounded-xl bg-amber-600 text-xs font-semibold text-white hover:bg-amber-700"
              >
                {actionLoading === "damage-claim" ? "Filing..." : "Submit Claim"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Renter Dispute Response Modal ──────────────────────────── */}
      {renterDisputeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-stone-900">Dispute Owner&apos;s Damage Claim</h3>
            <p className="text-xs text-stone-500">
              Provide rebuttal rationale and upload evidence photos (e.g. pre-existing photos or return photos showing intact condition).
            </p>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Reason for Dispute</label>
              <select
                value={renterDisputeReason}
                onChange={(e) => setRenterDisputeReason(e.target.value as DisputeReason)}
                className="w-full rounded-xl border border-stone-200 p-2 text-xs"
              >
                <option value="PRE_EXISTING_DAMAGE">Pre-Existing Wear (Already Disclosed)</option>
                <option value="NOT_CAUSED_BY_RENTER">Damage Was Not Caused by Me</option>
                <option value="AFTER_RETURN">Damage Occurred After Return Handover</option>
                <option value="NORMAL_WEAR_TEAR">Normal Wear and Tear</option>
                <option value="INCORRECT_AMOUNT">Claim Amount is Exaggerated</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Rebuttal Explanation</label>
              <textarea
                rows={3}
                value={renterDisputeNotes}
                onChange={(e) => setRenterDisputeNotes(e.target.value)}
                placeholder="Explain why this claim is invalid..."
                className="w-full rounded-xl border border-stone-200 p-3 text-xs"
              />
            </div>

            <ImageUploader
              value={renterDisputePhotos}
              onChange={setRenterDisputePhotos}
              label="Rebuttal Photos / Evidence"
            />

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setRenterDisputeModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRenterDisputeClaim}
                disabled={actionLoading === "renter-dispute"}
                className="px-5 py-2 rounded-xl bg-rose-600 text-xs font-semibold text-white hover:bg-rose-700"
              >
                {actionLoading === "renter-dispute" ? "Submitting..." : "Submit Dispute to Customer Care"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cancel Modal (renter before handover / owner after accepting) ── */}
      {cancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-stone-900">Cancel Booking</h3>
            <p className="text-xs text-stone-500">
              Cancel the booking for <strong>{cancelModal.name}</strong>?{" "}
              {cancelModal.funded
                ? "The renter's full payment will be refunded through Razorpay."
                : "No payment has been taken yet."}
              {cancelModal.asOwner && " Cancelling after accepting is shown on your business profile."}
            </p>
            <textarea
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder={cancelModal.asOwner ? "e.g. The item broke down and can't be delivered…" : "Reason (optional)"}
              className="w-full rounded-xl border border-stone-200 p-3 text-xs"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCancelModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600"
              >
                Keep Booking
              </button>
              <button
                type="button"
                onClick={handleCancelConfirm}
                disabled={actionLoading === cancelModal.id || (cancelModal.asOwner && !cancelReason.trim())}
                className="px-4 py-2 rounded-xl bg-rose-600 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {actionLoading === cancelModal.id ? "Cancelling..." : "Cancel Booking"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Verified Handover Modal (Owner) ─────────────────────────── */}
      {handoverModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-2 text-purple-700">
              <KeyRound className="w-5 h-5" />
              <h3 className="text-base font-bold text-stone-900">Hand Over {handoverModal.name}</h3>
            </div>
            <p className="text-xs text-stone-500">
              Photograph the item&apos;s condition in front of the renter, then ask them for their 6-digit handover code.
              Entering it proves the handover happened and starts their 1-hour inspection window.
            </p>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Renter&apos;s handover code *</label>
              <input
                inputMode="numeric"
                maxLength={6}
                value={handoverCode}
                onChange={(e) => setHandoverCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="••••••"
                className="w-40 rounded-xl border border-stone-300 px-3 py-2 text-center font-mono text-lg tracking-[0.3em]"
              />
            </div>

            <ImageUploader
              value={handoverPhotos}
              onChange={setHandoverPhotos}
              label="Condition photos at handover *"
              description="Every unit, any existing marks, serial numbers"
            />

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Notes</label>
              <textarea
                rows={2}
                value={handoverNotes}
                onChange={(e) => setHandoverNotes(e.target.value)}
                placeholder="e.g. 50 chairs counted with the renter's manager, all clean"
                className="w-full rounded-xl border border-stone-200 p-3 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setHandoverModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitHandover}
                disabled={actionLoading === "handover-submit" || handoverCode.length !== 6 || handoverPhotos.length === 0}
                className="px-5 py-2 rounded-xl bg-purple-600 text-xs font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
              >
                {actionLoading === "handover-submit" ? "Verifying..." : "Verify Code & Hand Over"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Contest Handover Issue Modal (Owner) ────────────────────── */}
      {contestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-stone-900">Contest the Renter&apos;s Issue</h3>
            <p className="text-xs text-stone-500">
              HostNexus admin will compare your handover photos with the renter&apos;s photos and decide. The payment stays in
              escrow until then.
            </p>
            <textarea
              rows={4}
              value={contestNotes}
              onChange={(e) => setContestNotes(e.target.value)}
              placeholder="Explain why the item was delivered as listed (min. 10 characters)…"
              className="w-full rounded-xl border border-stone-200 p-3 text-xs"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setContestModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleContestIssue}
                disabled={actionLoading === "contest-issue" || contestNotes.trim().length < 10}
                className="px-4 py-2 rounded-xl bg-stone-900 text-xs font-semibold text-white hover:bg-stone-800 disabled:opacity-50"
              >
                {actionLoading === "contest-issue" ? "Sending..." : "Send to Admin"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Return Receipt Count Modal (Owner) ──────────────────────── */}
      {receiptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-stone-900">Confirm Return Receipt</h3>
            <p className="text-xs text-stone-500">
              Count what physically came back. The renter says they returned {receiptModal.returned} of {receiptModal.booked} unit(s).
              If fewer arrived, you can file a missing-quantity claim during the 2-hour inspection.
            </p>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Units received *</label>
              <input
                type="number"
                min={1}
                max={receiptModal.booked}
                value={receiptQty}
                onChange={(e) => setReceiptQty(Math.max(1, Math.min(receiptModal.booked, parseInt(e.target.value) || 1)))}
                className="w-32 rounded-xl border border-stone-200 p-2 text-xs"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReceiptModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleOwnerConfirmReceipt(receiptModal.id, true, receiptQty)}
                disabled={actionLoading === receiptModal.id}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                Confirm {receiptQty} Received
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reject Modal (Owner) ──────────────────────────────────── */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-stone-900">Decline Booking Request</h3>
            <p className="text-xs text-stone-500">
              Provide a reason for declining the booking for <strong>{rejectModal.name}</strong>.
            </p>

            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Dates conflict with scheduled maintenance..."
              className="w-full rounded-xl border border-stone-200 p-3 text-xs"
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectConfirm}
                disabled={actionLoading === rejectModal.id}
                className="px-4 py-2 rounded-xl bg-rose-600 text-xs font-semibold text-white hover:bg-rose-700"
              >
                Decline Request
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Negotiation Counter-Offer Modal ───────────────────────── */}
      {negotiateModal && selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-2 text-amber-600">
              <TrendingDown className="w-5 h-5" />
              <h3 className="text-base font-bold text-stone-900">Make Counter-Offer</h3>
            </div>
            <p className="text-xs text-stone-500">
              Propose a new daily rental rate for <strong>{selectedBooking.resource.name}</strong>.
            </p>

            <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 text-xs space-y-1">
              <div className="flex justify-between text-stone-600">
                <span>Listed Price:</span>
                <span className="font-semibold">₹{((selectedBooking.rentAmountPaise ?? 0) / (selectedBooking.totalDays || 1) / 100).toLocaleString()}/day</span>
              </div>
              {selectedBooking.negotiation?.offers && selectedBooking.negotiation.offers.length > 0 && (
                <div className="flex justify-between text-amber-700 font-medium">
                  <span>Last Offer:</span>
                  <span>₹{(selectedBooking.negotiation.offers[selectedBooking.negotiation.offers.length - 1].offeredAmountPaise / 100).toLocaleString()}/day</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Your Counter-Offer (₹/day) *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm font-medium">₹</span>
                <input
                  type="number"
                  min="1"
                  required
                  value={negotiateAmountINR || ""}
                  onChange={(e) => setNegotiateAmountINR(parseFloat(e.target.value) || 0)}
                  placeholder="Enter amount"
                  className="w-full rounded-xl border border-stone-300 bg-white pl-7 pr-3 py-2.5 text-sm font-bold text-stone-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Message (optional)</label>
              <textarea
                rows={2}
                value={negotiateMessage}
                onChange={(e) => setNegotiateMessage(e.target.value)}
                placeholder="Explain your rationale…"
                className="w-full rounded-xl border border-stone-200 p-2.5 text-xs resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => {
                  setNegotiateModal(false);
                  setNegotiateAmountINR(0);
                  setNegotiateMessage("");
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleMakeCounterOffer}
                disabled={actionLoading === "negotiate-offer" || negotiateAmountINR <= 0}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-xs font-bold text-white shadow-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                {actionLoading === "negotiate-offer" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <Handshake className="w-3.5 h-3.5" />
                    <span>Send Offer</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}