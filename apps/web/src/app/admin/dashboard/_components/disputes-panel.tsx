"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Loader2, Scale, X } from "lucide-react";
import type { AdminDecision, Evidence } from "@hostnexus/types";
import { AdminAuthService, type AdminDispute } from "@/lib/admin-auth";
import { cn } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const inr = (paise: number | null | undefined) => `₹${((paise ?? 0) / 100).toLocaleString("en-IN")}`;
const fileUrl = (url: string) => (url.startsWith("http") ? url : `${API_BASE}${url}`);

type Filter = "NEEDS_DECISION" | "AWAITING_PARTY" | "RESOLVED" | "ALL";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "NEEDS_DECISION", label: "Needs decision" },
  { key: "AWAITING_PARTY", label: "Awaiting a party" },
  { key: "RESOLVED", label: "Resolved" },
  { key: "ALL", label: "All" },
];

const DECISIONS: Record<AdminDispute["kind"], { value: AdminDecision; label: string; hint: string; needsAmount?: "renter" | "owner" }[]> = {
  HANDOVER_ISSUE: [
    { value: "FULL_REFUND", label: "Full refund to renter", hint: "Booking cancelled; rent, transport and deposit all go back to the renter." },
    { value: "REJECT_ISSUE", label: "Reject the issue", hint: "Rent + transport paid to the owner; rental continues with the deposit held." },
    { value: "PARTIAL_REFUND", label: "Partial refund", hint: "Refund part of rent + transport; the rest goes to the owner and the rental continues.", needsAmount: "renter" },
  ],
  RETURN_CLAIM: [
    { value: "REFUND_RENTER", label: "Refund deposit to renter", hint: "Claim not upheld; the whole deposit goes back to the renter." },
    { value: "PAY_OWNER", label: "Uphold the claim", hint: "The owner gets the claimed amount (up to the deposit); the rest is refunded." },
    { value: "PARTIAL_SETTLEMENT", label: "Split the deposit", hint: "Choose how much of the deposit the owner gets.", needsAmount: "owner" },
    { value: "REJECT_CLAIM", label: "Reject as invalid", hint: "Same money outcome as a full refund, recorded as a rejected claim." },
  ],
};

function EvidenceColumn({ title, items, tone, empty }: { title: string; items: { url: string; notes?: string | null }[]; tone: string; empty: string }) {
  return (
    <div className={cn("rounded-xl border p-3 space-y-2", tone)}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-stone-600">{title}</p>
      {items.length === 0 ? (
        <p className="py-3 text-center text-[11px] text-stone-400">{empty}</p>
      ) : (
        <div className="grid grid-cols-2 gap-1.5">
          {items.map((e, i) => (
            <a key={i} href={fileUrl(e.url)} target="_blank" rel="noopener noreferrer" title={e.notes ?? undefined}>
              <img src={fileUrl(e.url)} alt={title} className="h-20 w-full rounded-lg border border-stone-200 object-cover hover:opacity-90" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function DisputeDetail({ dispute, onClose, onResolved }: { dispute: AdminDispute; onClose: () => void; onResolved: (msg: string) => void }) {
  const b = dispute.booking;
  const options = DECISIONS[dispute.kind];
  const [decision, setDecision] = useState<AdminDecision>(options[0].value);
  const [amountINR, setAmountINR] = useState<number>(0);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const chosen = options.find((o) => o.value === decision)!;
  const rentAndTransport = b.rentAmountPaise + b.transportFeePaise;
  const amountCap = chosen.needsAmount === "renter" ? rentAndTransport : b.securityDepositPaise;
  const byStage = (stage: Evidence["stage"]) =>
    (b.evidence ?? []).filter((e) => e.stage === stage).map((e) => ({ url: e.fileUrl, notes: e.notes }));
  const held = (b.paymentTransactions ?? []).reduce((s, t) => s + (t.direction === "IN" ? t.amountPaise : -t.amountPaise), 0);
  const resolved = dispute.status === "RESOLVED";

  const submit = async () => {
    setError("");
    const amountPaise = Math.round(amountINR * 100);
    if (chosen.needsAmount && (amountPaise <= 0 || amountPaise > amountCap)) {
      setError(`Enter an amount between ₹0.01 and ${inr(amountCap)}.`);
      return;
    }
    setSaving(true);
    try {
      await AdminAuthService.resolveDispute(b.id, {
        decision,
        resolutionAmountPaise: chosen.needsAmount ? amountPaise : undefined,
        resolutionNotes: notes.trim(),
      });
      onResolved(`Dispute resolved: ${chosen.label}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resolve the dispute");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-3 backdrop-blur-sm">
      <div className="my-6 w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-stone-200 bg-stone-50 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-stone-900">
              {dispute.kind === "HANDOVER_ISSUE" ? "Handover issue" : "Claim on the deposit"} · {b.resource?.name}
            </h2>
            <p className="text-xs text-stone-500">
              Renter <strong>{b.seeker?.name}</strong> · Owner <strong>{b.provider?.name}</strong> · {b.quantity} unit(s) ·{" "}
              {new Date(b.startDate).toLocaleDateString()} → {new Date(b.endDate).toLocaleDateString()} · Booking{" "}
              <span className="font-mono">{b.id}</span>
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-200 hover:text-stone-700" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-6">
          {/* Statements */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-4 text-xs text-stone-700 space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-sky-700">Renter</p>
              <p>{dispute.renterResponse || <span className="text-stone-400">No statement</span>}</p>
              {dispute.renterReason && <p className="text-stone-500">Reason: {dispute.renterReason}</p>}
              {b.receivedQuantity != null && <p>Received at handover: {b.receivedQuantity} of {b.quantity}</p>}
              {b.returnedQuantity != null && <p>Says returned: {b.returnedQuantity} of {b.quantity}</p>}
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 text-xs text-stone-700 space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                {dispute.raisedByRole === "SYSTEM" ? "System / Owner" : "Owner"}
              </p>
              {dispute.damageClaim && (
                <p>
                  <strong>{dispute.damageClaim.claimType}</strong> · claims {inr(dispute.damageClaim.claimedAmountPaise)}: {dispute.damageClaim.description}
                </p>
              )}
              <p>{dispute.ownerResponse || (!dispute.damageClaim && <span className="text-stone-400">No statement</span>)}</p>
              {b.ownerReceivedQuantity != null && <p>Counted on return: {b.ownerReceivedQuantity} of {b.quantity}</p>}
            </div>
          </div>

          {/* Side-by-side evidence */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <EvidenceColumn
              title="Listing snapshot"
              items={[
                ...(b.listingPhotosSnapshot ?? []).map((url) => ({ url })),
                ...(((b.damageDisclosureSnapshot as { damagePhotos?: string[] } | null)?.damagePhotos) ?? []).map((url) => ({ url, notes: "Disclosed damage" })),
              ]}
              tone="border-stone-200 bg-stone-50/60"
              empty="No photos"
            />
            <EvidenceColumn title="Owner at handover" items={byStage("HANDOVER")} tone="border-emerald-200 bg-emerald-50/40" empty="None" />
            <EvidenceColumn title="Renter receiving" items={byStage("RECEIVING")} tone="border-purple-200 bg-purple-50/40" empty="None" />
            <EvidenceColumn title="Renter return" items={byStage("RETURN")} tone="border-sky-200 bg-sky-50/40" empty="None" />
            <EvidenceColumn title="Owner claim" items={byStage("DAMAGE_CLAIM")} tone="border-rose-200 bg-rose-50/40" empty="None" />
            <EvidenceColumn title="Renter rebuttal" items={byStage("RENTER_REBUTTAL")} tone="border-amber-200 bg-amber-50/40" empty="None" />
          </div>

          {/* Money */}
          <div className="flex flex-wrap gap-x-6 gap-y-1 rounded-xl border border-stone-200 bg-stone-50 p-3 text-xs text-stone-700">
            <span>Rent {inr(b.rentAmountPaise)}</span>
            {b.transportFeePaise > 0 && <span>Transport {inr(b.transportFeePaise)}</span>}
            <span>Deposit {inr(b.securityDepositPaise)}</span>
            <span>Total paid {inr(b.totalAmountPaise)}</span>
            <span className="font-semibold">Still in escrow {inr(held)}</span>
          </div>

          {/* Decision */}
          {resolved ? (
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-xs text-green-900">
              <strong>Resolved ({dispute.adminDecision})</strong>
              {dispute.resolvedAt && ` on ${new Date(dispute.resolvedAt).toLocaleString()}`}: {dispute.resolutionNotes}
            </div>
          ) : (
            <div className="space-y-3 rounded-xl border border-stone-200 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-stone-500">Decision</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {options.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setDecision(o.value)}
                    className={cn(
                      "rounded-xl border p-3 text-left text-xs transition-all",
                      decision === o.value ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200 text-stone-700 hover:bg-stone-50"
                    )}
                  >
                    <span className="block font-bold">{o.label}</span>
                    <span className={cn("mt-1 block text-[11px]", decision === o.value ? "text-stone-300" : "text-stone-500")}>{o.hint}</span>
                  </button>
                ))}
              </div>

              {chosen.needsAmount && (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-stone-700">
                    {chosen.needsAmount === "renter" ? "Refund to renter (₹)" : "Owner's share of the deposit (₹)"} — max {inr(amountCap)}
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={amountCap / 100}
                    value={amountINR || ""}
                    onChange={(e) => setAmountINR(parseFloat(e.target.value) || 0)}
                    className="w-48 rounded-xl border border-stone-200 p-2 text-xs"
                  />
                </div>
              )}

              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What the evidence shows and why (shared with both parties)"
                className="w-full rounded-xl border border-stone-200 p-3 text-xs"
              />

              {error && <p className="text-xs text-rose-700">{error}</p>}

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={submit}
                  disabled={saving || notes.trim().length < 5}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Execute Settlement
                </button>
              </div>
            </div>
          )}

          {/* Timeline */}
          <details className="rounded-xl border border-stone-200 p-4">
            <summary className="cursor-pointer text-xs font-bold text-stone-700">Audit timeline ({b.timelineEvents?.length ?? 0})</summary>
            <ol className="mt-3 space-y-2">
              {(b.timelineEvents ?? []).map((e) => (
                <li key={e.id} className="text-xs text-stone-600">
                  <span className="font-semibold text-stone-800">{e.title}</span>{" "}
                  <span className="text-[10px] text-stone-400">{e.actorRole} · {new Date(e.createdAt).toLocaleString()}</span>
                  <p>{e.description}</p>
                </li>
              ))}
            </ol>
          </details>
        </div>
      </div>
    </div>
  );
}

export function DisputesPanel({ onToast }: { onToast: (msg: string, type: "success" | "error") => void }) {
  const [disputes, setDisputes] = useState<AdminDispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("NEEDS_DECISION");
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDisputes(await AdminAuthService.getDisputes("ALL"));
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Failed to load disputes", "error");
    } finally {
      setLoading(false);
    }
  }, [onToast]);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => disputes.filter((d) =>
    filter === "ALL" ? true
      : filter === "NEEDS_DECISION" ? d.status === "ESCALATED"
      : filter === "AWAITING_PARTY" ? d.status === "OPEN"
      : d.status === "RESOLVED"
  ), [disputes, filter]);

  const open = disputes.find((d) => d.id === openId) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex w-fit items-center gap-1 rounded-xl border border-stone-200 bg-white p-1 shadow-sm">
        {FILTERS.map((f) => {
          const count = disputes.filter((d) =>
            f.key === "ALL" ? true : f.key === "NEEDS_DECISION" ? d.status === "ESCALATED" : f.key === "AWAITING_PARTY" ? d.status === "OPEN" : d.status === "RESOLVED"
          ).length;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all",
                filter === f.key ? "bg-stone-900 text-white shadow-sm" : "text-stone-600 hover:bg-stone-50"
              )}
            >
              {f.label}
              <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-bold", filter === f.key ? "bg-white/20" : "bg-stone-100")}>{count}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-stone-100" />)}</div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-stone-300 bg-white py-16 text-center">
          <Scale className="h-10 w-10 text-stone-300" />
          <p className="mt-4 text-sm font-semibold text-stone-600">No disputes here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((d) => {
            const atStake = d.kind === "HANDOVER_ISSUE" ? d.booking.totalAmountPaise : d.damageClaim?.claimedAmountPaise ?? d.booking.securityDepositPaise;
            return (
              <button
                key={d.id}
                onClick={() => setOpenId(d.id)}
                className="flex w-full flex-wrap items-center gap-4 rounded-2xl border border-stone-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-stone-400"
              >
                <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl",
                  d.status === "RESOLVED" ? "bg-green-100" : d.status === "ESCALATED" ? "bg-rose-100" : "bg-amber-100")}>
                  {d.status === "RESOLVED" ? <CheckCircle2 className="h-5 w-5 text-green-600" />
                    : d.status === "ESCALATED" ? <AlertTriangle className="h-5 w-5 text-rose-600" />
                    : <Clock className="h-5 w-5 text-amber-600" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-stone-900">
                    {d.kind === "HANDOVER_ISSUE" ? "Handover issue" : d.damageClaim?.claimType ?? "Claim"} · {d.booking.resource?.name}
                  </p>
                  <p className="truncate text-xs text-stone-500">
                    {d.booking.seeker?.name} (renter) vs {d.booking.provider?.name} (owner) · opened {new Date(d.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="text-right text-xs">
                  <p className="font-bold text-stone-900">{inr(atStake)} at stake</p>
                  <p className="text-stone-500">
                    {d.status === "ESCALATED" ? "Needs your decision"
                      : d.status === "OPEN" ? `Waiting for ${d.kind === "HANDOVER_ISSUE" ? "owner" : "renter"}${d.responseDeadline ? ` until ${new Date(d.responseDeadline).toLocaleString()}` : ""}`
                      : `Resolved: ${d.adminDecision}`}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {open && (
        <DisputeDetail
          dispute={open}
          onClose={() => setOpenId(null)}
          onResolved={(msg) => {
            setOpenId(null);
            onToast(msg, "success");
            load();
          }}
        />
      )}
    </div>
  );
}
