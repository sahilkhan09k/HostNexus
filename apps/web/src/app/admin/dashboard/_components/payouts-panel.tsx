"use client";

import { useCallback, useEffect, useState } from "react";
import { Banknote, Loader2, RefreshCw, Undo2 } from "lucide-react";
import { AdminAuthService, type AdminTransaction } from "@/lib/admin-auth";
import { cn } from "@/lib/utils";

const inr = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN")}`;

type View = "PAYOUTS_PENDING" | "PAYOUTS_PAID" | "REFUNDS_FAILED" | "REFUNDS_ALL";

const VIEWS: { key: View; label: string; filter: { direction: "TO_OWNER" | "TO_RENTER"; status?: string } }[] = [
  { key: "PAYOUTS_PENDING", label: "Owner payouts to send", filter: { direction: "TO_OWNER", status: "PENDING" } },
  { key: "PAYOUTS_PAID", label: "Payouts sent", filter: { direction: "TO_OWNER", status: "COMPLETED" } },
  { key: "REFUNDS_FAILED", label: "Failed refunds", filter: { direction: "TO_RENTER", status: "FAILED" } },
  { key: "REFUNDS_ALL", label: "All refunds", filter: { direction: "TO_RENTER" } },
];

const TYPE_LABEL: Record<string, string> = {
  RENT_PAYOUT: "Rent + transport",
  DAMAGE_PAYOUT: "From deposit",
  FULL_REFUND: "Full refund",
  RENT_REFUND: "Rent refund",
  DEPOSIT_REFUND: "Deposit refund",
};

function PayoutRow({ t, onDone, onToast }: { t: AdminTransaction; onDone: () => void; onToast: (m: string, type: "success" | "error") => void }) {
  const [utr, setUtr] = useState("");
  const [busy, setBusy] = useState(false);
  const isPayout = t.direction === "TO_OWNER";

  const act = async () => {
    setBusy(true);
    try {
      if (isPayout) {
        await AdminAuthService.markPayoutPaid(t.id, utr);
        onToast(`Payout of ${inr(t.amountPaise)} marked as paid.`, "success");
      } else {
        await AdminAuthService.retryRefund(t.id);
        onToast("Refund re-sent to Razorpay.", "success");
      }
      onDone();
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Action failed", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", isPayout ? "bg-emerald-100" : "bg-sky-100")}>
        {isPayout ? <Banknote className="h-5 w-5 text-emerald-700" /> : <Undo2 className="h-5 w-5 text-sky-700" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-stone-900">
          {inr(t.amountPaise)} · {TYPE_LABEL[t.type] ?? t.type} {isPayout ? `→ ${t.booking.provider.name}` : `→ ${t.booking.seeker.name}`}
        </p>
        <p className="truncate text-xs text-stone-500">
          {t.booking.resource.name} · booking <span className="font-mono">{t.booking.id}</span> · queued {new Date(t.createdAt).toLocaleString()}
        </p>
        {t.status === "COMPLETED" && (
          <p className="text-xs text-green-700">
            {isPayout ? `Paid · UTR ${t.utrReference}` : `Refunded · ${t.razorpayRefundId}`}
            {t.processedAt && ` · ${new Date(t.processedAt).toLocaleString()}`}
          </p>
        )}
        {t.status === "FAILED" && <p className="text-xs text-rose-700">Failed: {t.failureReason}</p>}
        {(t.status === "PENDING" || t.status === "PROCESSING") && !isPayout && <p className="text-xs text-amber-700">Processing with Razorpay…</p>}
      </div>

      {isPayout && t.status === "PENDING" && (
        <div className="flex items-center gap-2">
          <input
            value={utr}
            onChange={(e) => setUtr(e.target.value)}
            placeholder="Bank UTR / reference"
            className="w-48 rounded-xl border border-stone-200 px-3 py-2 text-xs"
          />
          <button
            onClick={act}
            disabled={busy || utr.trim().length < 6}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-3 w-3 animate-spin" />}
            Mark Paid
          </button>
        </div>
      )}
      {!isPayout && t.status === "FAILED" && (
        <button
          onClick={act}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-xl border border-stone-300 px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          Retry Refund
        </button>
      )}
    </div>
  );
}

export function PayoutsPanel({ onToast }: { onToast: (msg: string, type: "success" | "error") => void }) {
  const [view, setView] = useState<View>("PAYOUTS_PENDING");
  const [rows, setRows] = useState<AdminTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await AdminAuthService.getTransactions(VIEWS.find((v) => v.key === view)!.filter));
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Failed to load transactions", "error");
    } finally {
      setLoading(false);
    }
  }, [view, onToast]);

  useEffect(() => { load(); }, [load]);

  const total = rows.reduce((s, r) => s + r.amountPaise, 0);

  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-sm text-stone-500">
        Renter refunds go back automatically through the Razorpay Refunds API and are retried if they fail. Owner payouts are
        queued here: send the money from the platform account, then record the bank UTR to mark each one paid.
      </p>
      <div className="flex w-fit flex-wrap items-center gap-1 rounded-xl border border-stone-200 bg-white p-1 shadow-sm">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition-all",
              view === v.key ? "bg-stone-900 text-white shadow-sm" : "text-stone-600 hover:bg-stone-50"
            )}
          >
            {v.label}
          </button>
        ))}
      </div>

      {!loading && rows.length > 0 && (
        <p className="text-xs text-stone-500">{rows.length} item(s) · {inr(total)}</p>
      )}

      {loading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-stone-100" />)}</div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-stone-300 bg-white py-16 text-center">
          <Banknote className="h-10 w-10 text-stone-300" />
          <p className="mt-4 text-sm font-semibold text-stone-600">Nothing here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((t) => <PayoutRow key={t.id} t={t} onDone={load} onToast={onToast} />)}
        </div>
      )}
    </div>
  );
}
