"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, CloudSun, Loader2, Package, Truck } from "lucide-react";
import {
  getBookingWeather,
  type AiWeatherDay,
  type BookingWeatherImpact,
  type BookingWeatherResult,
  type WeatherImpactLevel,
} from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface WeatherImpactPanelProps {
  resourceId: string;
  /** "YYYY-MM-DD", inclusive; the panel stays hidden until both are set */
  startDate: string;
  endDate: string;
  transportMode: "SELF" | "PROVIDER";
}

const LEVEL: Record<WeatherImpactLevel, { label: string; badge: string; row: string }> = {
  none:     { label: "No weather impact", badge: "bg-emerald-100 text-emerald-800", row: "" },
  low:      { label: "Low impact",        badge: "bg-sky-100 text-sky-800",         row: "border-sky-200 bg-sky-50/60 text-sky-900" },
  moderate: { label: "Moderate impact",   badge: "bg-amber-100 text-amber-800",     row: "border-amber-200 bg-amber-50/70 text-amber-900" },
  high:     { label: "High impact",       badge: "bg-rose-100 text-rose-800",       row: "border-rose-200 bg-rose-50/70 text-rose-900" },
};

const FAILURE: Record<Exclude<BookingWeatherResult, { ok: true }>["reason"], string> = {
  NO_LOCATION:     "The listing has no location, so the forecast can't be checked.",
  PLACE_NOT_FOUND: "Couldn't find the listing's location on the weather service.",
  UNAVAILABLE:     "The weather service is unavailable right now — try again shortly.",
  PAST_DATES:      "Pick dates from today onwards to see the forecast.",
};

const shortDay = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/**
 * Forecast for the dates the renter picked, and what it means for this rental
 * and for moving it. Advisory only — it never blocks the booking.
 */
export function WeatherImpactPanel({ resourceId, startDate, endDate, transportMode }: WeatherImpactPanelProps) {
  // The last answer and the request it answers; while the inputs differ from
  // `key`, the previous answer stays on screen with a spinner.
  const [answer, setAnswer] = useState<{ key: string; result?: BookingWeatherResult; error?: string } | null>(null);

  const ready = Boolean(startDate && endDate && endDate >= startDate);
  const key = `${resourceId}|${startDate}|${endDate}|${transportMode}`;

  useEffect(() => {
    if (!ready) return;
    const ctrl = new AbortController();
    // Wait for the renter to stop changing dates before asking the forecast
    const timer = setTimeout(() => {
      getBookingWeather(resourceId, startDate, endDate, transportMode, ctrl.signal)
        .then((result) => setAnswer({ key, result }))
        .catch((err) => {
          if (!ctrl.signal.aborted) setAnswer({ key, error: err instanceof Error ? err.message : "Weather check failed" });
        });
    }, 450);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [ready, key, resourceId, startDate, endDate, transportMode]);

  if (!ready) return null;

  const loading = answer?.key !== key;
  const result = answer?.result ?? null;
  const error = answer?.error ?? null;

  const shell = (children: React.ReactNode, badge?: React.ReactNode) => (
    <div className="rounded-xl border border-stone-200 p-4 space-y-3" aria-live="polite">
      <div className="flex items-center gap-2">
        <CloudSun className="w-4 h-4 text-emerald-600" />
        <p className="text-xs font-bold uppercase tracking-wide text-stone-700">
          Weather check{result?.ok ? ` · ${result.check.location}` : ""}
        </p>
        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-400" />}
        {badge && <span className="ml-auto">{badge}</span>}
      </div>
      {children}
    </div>
  );

  if (error) return shell(<p className="text-[11px] text-stone-500">{error}</p>);
  if (!result) return shell(<p className="text-[11px] text-stone-500">Checking the forecast for your dates…</p>);
  if (!result.ok) return shell(<p className="text-[11px] text-stone-500">{FAILURE[result.reason]}</p>);

  const c = result.check;
  const legDays = c.transport.relevant ? new Set(c.transport.dates) : new Set<string>();
  const rental = c.impacts.filter((i) => i.area === "rental");
  const transport = c.impacts.filter((i) => i.area === "transport");
  const level = LEVEL[c.overall];

  const badge = c.coverage === "none"
    ? <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-stone-100 text-stone-600">Forecast not out yet</span>
    : <span className={cn("text-[10px] font-semibold uppercase px-2 py-0.5 rounded", level.badge)}>{level.label}</span>;

  return shell(
    <>
      {c.days.length > 0 && <DayStrip days={c.days} legDays={legDays} />}

      {c.coverage === "none" && (
        <div className="space-y-2">
          <p className="text-[11px] text-stone-600">
            These dates are beyond the forecast (available up to {shortDay(c.horizonEnd)}). Check again closer to the date.
          </p>
          {c.lastYear && c.lastYear.length > 0 && (
            <>
              <p className="text-[10px] font-semibold uppercase text-stone-400">Same dates last year (observed, not a forecast)</p>
              <DayStrip days={c.lastYear} legDays={new Set()} muted />
            </>
          )}
        </div>
      )}

      {c.coverage === "partial" && (
        <p className="text-[11px] text-stone-500">
          The forecast only runs to {shortDay(c.horizonEnd)}; the later days of your booking aren&apos;t covered yet.
        </p>
      )}

      {c.coverage !== "none" && c.impacts.length === 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-[11px] text-emerald-900">
          <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-600" />
          <span>
            No weather issues expected for this {c.resourceType.toLowerCase()}
            {c.transport.relevant ? ` or its ${c.transport.mode === "PROVIDER" ? "delivery" : "pickup"} and return` : ""}.
          </span>
        </div>
      )}

      {rental.length > 0 && <ImpactGroup icon={<Package className="w-3.5 h-3.5" />} title="Impact on the rental" impacts={rental} />}
      {transport.length > 0 && (
        <ImpactGroup
          icon={<Truck className="w-3.5 h-3.5" />}
          title={c.transport.mode === "PROVIDER" ? "Impact on the owner's transport" : "Impact on your pickup & return"}
          impacts={transport}
        />
      )}

      <p className="text-[10px] text-stone-400">
        Forecast by {c.source} · advisory only, it doesn&apos;t change your booking.
        {legDays.size > 0 && <> <Truck className="inline w-3 h-3 -mt-0.5" /> marks the {c.transport.mode === "PROVIDER" ? "delivery" : "pickup"} and return days.</>}
      </p>
    </>,
    badge,
  );
}

function DayStrip({ days, legDays, muted }: { days: AiWeatherDay[]; legDays: Set<string>; muted?: boolean }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {days.map((d) => (
        <div
          key={d.date}
          className={cn(
            "shrink-0 w-[88px] rounded-lg border px-2 py-1.5 text-center",
            muted ? "border-stone-100 bg-stone-50 text-stone-500" : "border-stone-200 bg-white",
          )}
          title={d.summary}
        >
          <p className="text-[10px] font-semibold text-stone-500 flex items-center justify-center gap-1">
            {shortDay(d.date)}
            {legDays.has(d.date) && <Truck className="w-3 h-3 text-emerald-600" aria-label="transport day" />}
          </p>
          <p className="text-lg leading-6" aria-hidden>{d.emoji}</p>
          <p className="text-[11px] font-semibold text-stone-800 tabular-nums">{Math.round(d.tempMaxC)}° / {Math.round(d.tempMinC)}°</p>
          <p className="text-[10px] text-stone-500 tabular-nums">
            {d.precipMm > 0 ? `${d.precipMm} mm` : "Dry"}
            {d.precipProbability !== null && d.precipMm > 0 ? ` · ${d.precipProbability}%` : ""}
          </p>
        </div>
      ))}
    </div>
  );
}

function ImpactGroup({ icon, title, impacts }: { icon: React.ReactNode; title: string; impacts: BookingWeatherImpact[] }) {
  return (
    <div className="space-y-1.5">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-stone-500">{icon}{title}</p>
      {impacts.map((i, idx) => (
        <div key={idx} className={cn("flex items-start gap-2 rounded-lg border px-3 py-2 text-[11px]", LEVEL[i.level].row)}>
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">
              {i.title}
              <span className="ml-1.5 font-normal opacity-70">({LEVEL[i.level].label.toLowerCase()})</span>
            </p>
            <p className="mt-0.5 leading-relaxed">{i.detail}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
