"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, type Easing } from "framer-motion";
import {
  ShieldCheck, Clock, CheckCircle2, XCircle, Users, Package,
  CalendarDays, LogOut, Eye, ChevronDown, ChevronUp,
  ExternalLink, AlertTriangle, RefreshCw, Loader2, X, FileText,
  Ban, RotateCcw, Scale, Banknote,
} from "lucide-react";
import { AdminAuthService, type PendingUser, type AdminSummary } from "@/lib/admin-auth";
import { cn } from "@/lib/utils";
import { DisputesPanel } from "./_components/disputes-panel";
import { PayoutsPanel } from "./_components/payouts-panel";

const EASE: Easing = [0.22, 1, 0.36, 1];

type Tab = "PENDING" | "VERIFIED" | "REJECTED" | "SUSPENDED";
type Section = "BUSINESSES" | "DISPUTES" | "PAYOUTS";
type ActionState = { id: string; type: "approve" | "reject" | "suspend" | "reinstate" } | null;

const STATUS_CONFIG: Record<Tab, {
  label: string;
  icon: React.FC<{ className?: string }>;
  color: string;
  bg: string;
  border: string;
}> = {
  PENDING:  { label: "Pending",  icon: Clock,         color: "text-amber-600",   bg: "bg-amber-100",   border: "border-amber-200"  },
  VERIFIED: { label: "Verified", icon: CheckCircle2,  color: "text-green-600", bg: "bg-green-100", border: "border-green-200" },
  REJECTED: { label: "Rejected", icon: XCircle,       color: "text-rose-600",    bg: "bg-rose-100",    border: "border-rose-200"   },
  SUSPENDED: { label: "Suspended", icon: Ban,         color: "text-stone-700",   bg: "bg-stone-200",   border: "border-stone-300"  },
};

function StatCard({ label, value, icon: Icon, color, bg }: {
  label: string; value: number; icon: React.FC<{ className?: string }>; color: string; bg: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", bg as string)}>
        <Icon className={cn("h-5 w-5", color as string)} />
      </div>
      <div>
        <p className="text-2xl font-bold tabular-nums text-stone-900">{value}</p>
        <p className="text-xs text-stone-500">{label}</p>
      </div>
    </div>
  );
}

function DocLink({ url, label }: { url: string | null; label: string }) {
  if (!url) return <span className="text-xs text-stone-400 italic">Not provided</span>;

  // If it's a server-relative URL, prepend the API base
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
  const href = url.startsWith("http") ? url : `${API_BASE}${url}`;

  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-xs font-medium text-stone-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 transition-all">
      <FileText className="h-3 w-3" /> {label} <ExternalLink className="h-2.5 w-2.5 opacity-60" />
    </a>
  );
}

function UserRow({
  user,
  onApprove,
  onReject,
  onSuspend,
  onReinstate,
  actionState,
}: {
  user: PendingUser;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onSuspend: (user: PendingUser) => void;
  onReinstate: (id: string) => void;
  actionState: ActionState;
}) {
  const [expanded, setExpanded] = useState(false);
  const biz = user.businesses[0];
  const cfg = STATUS_CONFIG[user.verificationStatus];
  const Icon = cfg.icon;
  const isActing = actionState?.id === user.id;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.22, ease: EASE }}
      className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm"
    >
      {/* Row header */}
      <div className="flex items-center gap-4 p-4">
        {/* Avatar */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-sm font-bold text-stone-600">
          {(user.ownerName ?? user.email).charAt(0).toUpperCase()}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-stone-900">
              {user.ownerName ?? "—"}
            </p>
            <span className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
              cfg.bg as string, cfg.color as string
            )}>
              <Icon className="h-2.5 w-2.5" />
              {cfg.label}
            </span>
          </div>
          <p className="truncate text-xs text-stone-500">{user.email}</p>
          {biz && (
            <p className="mt-0.5 truncate text-xs text-stone-400">
              {biz.name} · {biz.businessType ?? "—"} · {biz.city}, {biz.state}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-2">
          {user.verificationStatus === "PENDING" && (
            <>
              <button
                onClick={() => onApprove(user.id)}
                disabled={isActing}
                className={cn(
                  "flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white",
                  "hover:bg-emerald-700 transition-all active:scale-[0.97]",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {isActing && actionState?.type === "approve"
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : <CheckCircle2 className="h-3 w-3" />}
                Approve
              </button>
              <button
                onClick={() => onReject(user.id)}
                disabled={isActing}
                className={cn(
                  "flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700",
                  "hover:bg-rose-100 transition-all active:scale-[0.97]",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {isActing && actionState?.type === "reject"
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : <XCircle className="h-3 w-3" />}
                Reject
              </button>
            </>
          )}

          {user.openBookings > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
              {user.openBookings} open booking{user.openBookings === 1 ? "" : "s"}
            </span>
          )}

          {user.verificationStatus === "VERIFIED" && (
            <button
              onClick={() => onSuspend(user)}
              disabled={isActing}
              className="flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50"
            >
              {isActing && actionState?.type === "suspend" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Ban className="h-3 w-3" />}
              Suspend
            </button>
          )}

          {user.verificationStatus === "SUSPENDED" && (
            <button
              onClick={() => onReinstate(user.id)}
              disabled={isActing}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {isActing && actionState?.type === "reinstate" ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
              Reinstate
            </button>
          )}

          <button
            onClick={() => setExpanded((e) => !e)}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-stone-200 text-stone-400 hover:bg-stone-50 hover:text-stone-600 transition-colors"
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Expanded details */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: EASE }}
            className="overflow-hidden border-t border-stone-100"
          >
            <div className="grid grid-cols-1 gap-6 p-5 sm:grid-cols-2">
              {/* Business address */}
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-stone-400">
                  Business Details
                </p>
                <div className="space-y-1 text-xs text-stone-600">
                  <p><span className="font-medium text-stone-700">Name:</span> {biz?.name ?? "—"}</p>
                  <p><span className="font-medium text-stone-700">Type:</span> {biz?.businessType ?? "—"}</p>
                  <p><span className="font-medium text-stone-700">Address:</span> {biz?.addressLine ?? "—"}</p>
                  <p><span className="font-medium text-stone-700">City / State:</span> {biz?.city}, {biz?.state} — {biz?.pincode}</p>
                  <p><span className="font-medium text-stone-700">Phone:</span> {user.phone ?? "—"}</p>
                  <p><span className="font-medium text-stone-700">Registered:</span>{" "}
                    {new Date(user.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </p>
                </div>
              </div>

              {/* KYC documents */}
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-stone-400">
                  KYC Documents
                </p>
                <div className="space-y-2">
                  <div>
                    <p className="mb-1 text-xs font-medium text-stone-600">GST Certificate</p>
                    <DocLink url={user.gstCertificateUrl} label="View GST Doc" />
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium text-stone-600">GSTIN</p>
                    {user.gstin ? (
                      <p className="font-mono text-xs text-stone-800">{user.gstin}</p>
                    ) : (
                      <DocLink url={user.aadhaarUrl} label="View Aadhaar" />
                    )}
                  </div>
                </div>

                {user.verificationNotes && (
                  <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-rose-600">
                      {user.verificationStatus === "SUSPENDED" ? "Suspension Reason" : "Rejection Reason"}
                    </p>
                    <p className="mt-1 text-xs text-rose-700">{user.verificationNotes}</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function RejectModal({
  userId,
  onConfirm,
  onCancel,
}: {
  userId: string;
  onConfirm: (id: string, notes: string) => void;
  onCancel: () => void;
}) {
  const [notes, setNotes] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2, ease: EASE }}
        className="w-full max-w-md overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-600" />
            <h2 className="text-sm font-bold text-stone-900">Reject Application</h2>
          </div>
          <button onClick={onCancel} className="text-stone-400 hover:text-stone-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5">
          <p className="mb-4 text-sm text-stone-600">
            Provide a reason for rejection. This will be shown to the user if they contact support.
          </p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="e.g. GST certificate is invalid or expired. Please resubmit with a valid document."
            className="w-full resize-none rounded-xl border border-stone-200 bg-stone-50 p-3 text-sm text-stone-800 placeholder:text-stone-400 focus:border-rose-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 transition-all"
          />
        </div>

        <div className="flex gap-2 border-t border-stone-100 px-5 py-4">
          <button onClick={onCancel}
            className="flex-1 rounded-xl border border-stone-200 py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors">
            Cancel
          </button>
          <button onClick={() => onConfirm(userId, notes)}
            className="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 transition-colors">
            Confirm Rejection
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function SuspendModal({
  user,
  onConfirm,
  onCancel,
}: {
  user: PendingUser;
  onConfirm: (id: string, reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2, ease: EASE }}
        className="w-full max-w-md overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <Ban className="h-4 w-4 text-stone-700" />
            <h2 className="text-sm font-bold text-stone-900">Suspend {user.businesses[0]?.name ?? user.email}</h2>
          </div>
          <button onClick={onCancel} className="text-stone-400 hover:text-stone-600"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3 p-5">
          <p className="text-sm text-stone-600">
            They are signed out on their next request and their listings disappear from the marketplace.
          </p>
          {user.openBookings > 0 && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <strong>{user.openBookings} booking{user.openBookings === 1 ? " is" : "s are"} still in progress.</strong> The other
              party can&apos;t finish them with this business while it is suspended; resolve them from the Disputes tab if needed.
            </p>
          )}
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Reason (shown to the user when they try to sign in)"
            className="w-full resize-none rounded-xl border border-stone-200 bg-stone-50 p-3 text-sm"
          />
        </div>
        <div className="flex gap-2 border-t border-stone-100 px-5 py-4">
          <button onClick={onCancel} className="flex-1 rounded-xl border border-stone-200 py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-50">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(user.id, reason.trim())}
            disabled={reason.trim().length < 5}
            className="flex-1 rounded-xl bg-stone-900 py-2.5 text-sm font-semibold text-white hover:bg-stone-800 disabled:opacity-50"
          >
            Suspend Account
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [admin, setAdmin] = useState(AdminAuthService.getAdmin());
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [tab, setTab] = useState<Tab>("PENDING");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionState, setActionState] = useState<ActionState>(null);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<PendingUser | null>(null);
  const [section, setSection] = useState<Section>("BUSINESSES");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // Guard: redirect to login if no token
  useEffect(() => {
    if (!AdminAuthService.isLoggedIn()) router.replace("/admin/login");
  }, [router]);

  // Stable identity: the panels load data in effects that depend on it
  const showToast = useCallback((msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [sum, userList] = await Promise.all([
        AdminAuthService.getSummary(),
        AdminAuthService.getUsers(tab),
      ]);
      setSummary(sum);
      setUsers(userList);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load";
      if (msg.toLowerCase().includes("token") || msg.toLowerCase().includes("admin")) {
        AdminAuthService.clearAdmin();
        router.replace("/admin/login");
      }
      showToast(msg, "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab, router]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleApprove = async (id: string) => {
    setActionState({ id, type: "approve" });
    try {
      await AdminAuthService.approveUser(id);
      showToast("User approved successfully.", "success");
      await loadData(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Approval failed", "error");
    } finally {
      setActionState(null);
    }
  };

  const handleRejectConfirm = async (id: string, notes: string) => {
    setRejectTarget(null);
    setActionState({ id, type: "reject" });
    try {
      await AdminAuthService.rejectUser(id, notes || undefined);
      showToast("User rejected.", "success");
      await loadData(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Rejection failed", "error");
    } finally {
      setActionState(null);
    }
  };

  const handleSuspendConfirm = async (id: string, reason: string) => {
    setSuspendTarget(null);
    setActionState({ id, type: "suspend" });
    try {
      await AdminAuthService.suspendUser(id, reason);
      showToast("Account suspended.", "success");
      await loadData(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Suspension failed", "error");
    } finally {
      setActionState(null);
    }
  };

  const handleReinstate = async (id: string) => {
    setActionState({ id, type: "reinstate" });
    try {
      await AdminAuthService.reinstateUser(id);
      showToast("Account reinstated.", "success");
      await loadData(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Reinstate failed", "error");
    } finally {
      setActionState(null);
    }
  };

  const handleLogout = () => {
    AdminAuthService.clearAdmin();
    router.push("/admin/login");
  };

  const TABS: { key: Tab; label: string; count: number | undefined }[] = [
    { key: "PENDING",  label: "Pending Review", count: summary?.pending },
    { key: "VERIFIED", label: "Verified",        count: summary?.verified },
    { key: "REJECTED", label: "Rejected",        count: summary?.rejected },
    { key: "SUSPENDED", label: "Suspended",      count: summary?.suspended },
  ];

  const SECTIONS: { key: Section; label: string; icon: React.FC<{ className?: string }>; badge?: number }[] = [
    { key: "BUSINESSES", label: "Businesses", icon: Users },
    { key: "DISPUTES", label: "Disputes", icon: Scale, badge: summary?.openDisputes },
    { key: "PAYOUTS", label: "Payouts & Refunds", icon: Banknote, badge: (summary?.pendingPayouts ?? 0) + (summary?.failedRefunds ?? 0) },
  ];

  return (
    <div className="min-h-screen bg-[#F8F8F7]">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.2, ease: EASE }}
            className={cn(
              "fixed right-4 top-4 z-[100] flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium shadow-lg",
              toast.type === "success"
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-rose-200 bg-rose-50 text-rose-800"
            )}
          >
            {toast.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reject modal */}
      <AnimatePresence>
        {rejectTarget && (
          <RejectModal
            userId={rejectTarget}
            onConfirm={handleRejectConfirm}
            onCancel={() => setRejectTarget(null)}
          />
        )}
        {suspendTarget && (
          <SuspendModal
            user={suspendTarget}
            onConfirm={handleSuspendConfirm}
            onCancel={() => setSuspendTarget(null)}
          />
        )}
      </AnimatePresence>

      {/* Topbar */}
      <header className="sticky top-0 z-40 border-b border-stone-200 bg-white/90 backdrop-blur-md">
        <div className="app-container flex h-14 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-900">
              <ShieldCheck className="h-4 w-4 text-white" />
            </div>
            <div>
              <span className="text-sm font-bold text-stone-900">HostNexus Admin</span>
              <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-700">
                Internal
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-stone-500 sm:block">
              {admin?.name ?? admin?.email}
            </span>
            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 text-stone-500 hover:bg-stone-50 transition-colors"
              aria-label="Refresh"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="app-container py-8">
        {/* Page title */}
        <div className="mb-6">
          <h1 className="font-display text-3xl font-semibold text-stone-900">
            HostNexus Operations
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            Verify businesses, decide disputes, and settle escrow payouts.
          </p>
        </div>

        {/* Section switcher */}
        <div className="mb-6 flex flex-wrap items-center gap-2">
          {SECTIONS.map(({ key, label, icon: SIcon, badge }) => (
            <button
              key={key}
              onClick={() => setSection(key)}
              className={cn(
                "flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all",
                section === key ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
              )}
            >
              <SIcon className="h-4 w-4" />
              {label}
              {!!badge && (
                <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-bold", section === key ? "bg-white/20" : "bg-rose-100 text-rose-700")}>
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {section === "DISPUTES" && <DisputesPanel onToast={showToast} />}
        {section === "PAYOUTS" && <PayoutsPanel onToast={showToast} />}

        {section === "BUSINESSES" && (<>

        {/* Summary stats */}
        {loading && !summary ? (
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-stone-100" />
            ))}
          </div>
        ) : summary && (
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
            <StatCard label="Pending Review"    value={summary.pending}        icon={Clock}       color="text-amber-600"   bg="bg-amber-100"   />
            <StatCard label="Verified"          value={summary.verified}       icon={CheckCircle2} color="text-green-600" bg="bg-green-100" />
            <StatCard label="Rejected"          value={summary.rejected}       icon={XCircle}     color="text-rose-600"    bg="bg-rose-100"    />
            <StatCard label="Total Resources"   value={summary.totalResources} icon={Package}     color="text-sky-600"     bg="bg-sky-100"     />
            <StatCard label="Total Bookings"    value={summary.totalBookings}  icon={CalendarDays} color="text-violet-600"  bg="bg-violet-100"  />
          </div>
        )}

        {/* Tabs */}
        <div className="mb-5 flex items-center gap-1 rounded-xl border border-stone-200 bg-white p-1 shadow-sm w-fit">
          {TABS.map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all",
                tab === key
                  ? "bg-stone-900 text-white shadow-sm"
                  : "text-stone-600 hover:bg-stone-50"
              )}
            >
              {label}
              {count !== undefined && (
                <span className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                  tab === key ? "bg-white/20 text-white" : "bg-stone-100 text-stone-600"
                )}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* User list */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-stone-100" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-white py-16 text-center">
            <Users className="h-10 w-10 text-stone-300" />
            <p className="mt-4 text-sm font-semibold text-stone-600">No {tab.toLowerCase()} accounts</p>
            <p className="mt-1 text-xs text-stone-400">
              {tab === "PENDING" ? "All applications have been reviewed." : "Nothing here yet."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {users.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  onApprove={handleApprove}
                  onReject={(id) => setRejectTarget(id)}
                  onSuspend={(u) => setSuspendTarget(u)}
                  onReinstate={handleReinstate}
                  actionState={actionState}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
        </>)}
      </main>
    </div>
  );
}
