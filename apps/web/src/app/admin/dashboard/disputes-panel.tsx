"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Scale, ShieldAlert } from "lucide-react";
import { AdminAuthService, type DisputedBooking, type DisputeDecision } from "@/lib/admin-auth";
import { mediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

const DECISIONS: { key: DisputeDecision; label: string; hint: string }[] = [
  { key: "REFUND_RENTER", label: "Refund renter", hint: "Full security deposit back to the renter" },
  { key: "PAY_OWNER", label: "Pay owner", hint: "Full security deposit to the owner" },
  { key: "PARTIAL_SETTLEMENT", label: "Partial settlement", hint: "Split the deposit" },
  { key: "REJECT_CLAIM", label: "Reject claim", hint: "Claim dismissed; deposit refunded" },
];

const inr = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN")}`;

function ResolveForm({ booking, onDone }: { booking: DisputedBooking; onDone: (msg: string, ok: boolean) => void }) {
  const [decision, setDecision] = useState<DisputeDecision>("REFUND_RENTER");
  const [ownerShareINR, setOwnerShareINR] = useState(0);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const deposit = booking.securityDepositPaise;

  const submit = async () => {
    setSubmitting(true);
    try {
      await AdminAuthService.resolveDispute(booking.id, {
        decision,
        resolutionNotes: notes.trim(),
        ...(decision === "PARTIAL_SETTLEMENT" ? { resolutionAmountPaise: Math.round(ownerShareINR * 100) } : {}),
      });
      onDone("Dispute resolved.", true);
    } catch (err) {
      onDone(err instanceof Error ? err.message : "Could not resolve dispute", false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3 border-t border-stone-100 pt-4">
      <div className="grid grid-cols-2 gap-2">
        {DECISIONS.map((d) => (
          <button
            key={d.key}
            type="button"
            onClick={() => setDecision(d.key)}
            className={cn(
              "rounded-xl border p-3 text-left transition-all",
              decision === d.key ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200 bg-white hover:bg-stone-50"
            )}
          >
            <p className="text-xs font-bold">{d.label}</p>
            <p className={cn("text-[11px]", decision === d.key ? "text-white/70" : "text-stone-500")}>{d.hint}</p>
          </button>
        ))}
      </div>

      {decision === "PARTIAL_SETTLEMENT" && (
        <label className="block text-xs font-medium text-stone-600">
          Owner&apos;s share (₹, max {inr(deposit)})
          <input
            type="number"
            min={0}
            max={deposit / 100}
            value={ownerShareINR || ""}
            onChange={(e) => setOwnerShareINR(Math.min(Number(e.target.value) || 0, deposit / 100))}
            className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
          />
          <span className="mt-1 block text-[11px] text-stone-500">
            Remainder ({inr(Math.max(0, deposit - Math.round(ownerShareINR * 100)))}) is refunded to the renter.
          </span>
        </label>
      )}

      <label className="block text-xs font-medium text-stone-600">
        Resolution notes (visible in the booking timeline)
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          maxLength={2000}
          className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
        />
      </label>

      <button
        type="button"
        disabled={submitting || notes.trim().length < 5}
        onClick={submit}
        className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50"
      >
        {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        Record decision
      </button>
    </div>
  );
}

export function DisputesPanel({ onChanged, showToast }: { onChanged: () => void; showToast: (msg: string, type: "success" | "error") => void }) {
  const [disputes, setDisputes] = useState<DisputedBooking[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const load = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    AdminAuthService.getDisputes()
      .then((list) => {
        if (!cancelled) setDisputes(list);
      })
      .catch((err) => {
        if (cancelled) return;
        showToast(err instanceof Error ? err.message : "Failed to load disputes", "error");
        setDisputes([]);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey, showToast]);

  if (!disputes) {
    return <div className="h-24 animate-pulse rounded-2xl bg-stone-100" />;
  }

  if (disputes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-white py-16 text-center">
        <Scale className="h-10 w-10 text-stone-300" />
        <p className="mt-4 text-sm font-semibold text-stone-600">No open disputes</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {disputes.map((b) => {
        const claim = b.damageClaims[0];
        const dispute = b.disputes[0];
        return (
          <div key={b.id} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-stone-900">{b.resource.name}</p>
                <p className="text-xs text-stone-500">
                  Owner: {b.provider.name} · Renter: {b.seeker.name} · Deposit {inr(b.securityDepositPaise)} · {b.financialStatus}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpenId(openId === b.id ? null : b.id)}
                className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50"
              >
                {openId === b.id ? "Close" : "Review & resolve"}
              </button>
            </div>

            {claim && (
              <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                <p className="flex items-center gap-1 font-bold"><ShieldAlert className="h-3.5 w-3.5" /> {claim.claimType} — claimed {inr(claim.claimedAmountPaise)}</p>
                <p className="mt-1">{claim.description}</p>
                {dispute?.renterResponse && (
                  <p className="mt-2 text-stone-700"><span className="font-semibold">Renter ({dispute.renterReason ?? "response"}):</span> {dispute.renterResponse}</p>
                )}
              </div>
            )}

            {openId === b.id && (
              <div className="mt-4 space-y-4">
                {b.evidence.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {b.evidence.map((e) => (
                      // eslint-disable-next-line @next/next/no-img-element -- evidence served from the API origin
                      <img key={e.id} src={mediaUrl(e.fileUrl)} alt={e.stage} title={`${e.stage}${e.notes ? `: ${e.notes}` : ""}`}
                        className="h-20 w-full rounded-lg border border-stone-200 object-cover" />
                    ))}
                  </div>
                )}
                <ResolveForm
                  booking={b}
                  onDone={(msg, ok) => {
                    showToast(msg, ok ? "success" : "error");
                    if (ok) {
                      setOpenId(null);
                      load();
                      onChanged();
                    }
                  }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
