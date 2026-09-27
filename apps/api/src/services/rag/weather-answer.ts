import { isRainy, type DailyWeather, type WeatherLookup, type WeatherReport } from "./weather.service.js";

/**
 * Chat replies for weather questions. Markdown kept to what the chat renders
 * (###/#### headings, bullets, bold, "> " callouts). The structured report is
 * also returned so the web chat can draw a forecast card.
 */

const ITEM_LABELS: Record<string, string> = {
  tent: "tents",
  generator: "a generator",
  cold_storage: "cold storage",
  banquet_hall: "a banquet hall",
  lawn: "a lawn",
};

export function dayLabel(iso: string, long = false) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", {
    weekday: "short", day: "numeric", month: long ? "long" : "short", timeZone: "UTC",
  });
}

function rangeLabel(start: string, end: string) {
  return start === end ? dayLabel(start, true) : `${dayLabel(start)} – ${dayLabel(end)}`;
}

function placeLabel(r: WeatherReport) {
  const region = [r.place.state !== r.place.name ? r.place.state : undefined, r.place.country].filter(Boolean).join(", ");
  return `**${r.place.name}**${region ? `, ${region}` : ""}`;
}

function rainText(d: DailyWeather) {
  const parts: string[] = [];
  if (d.precipProbability !== null) parts.push(`${d.precipProbability}% chance of rain`);
  if (d.precipMm > 0) parts.push(`${d.precipMm} mm`);
  if (parts.length === 0) return "no rain expected";
  return parts.join(", ");
}

export function dayLine(d: DailyWeather) {
  return `**${dayLabel(d.date)}** — ${d.emoji} ${d.summary} · ${Math.round(d.tempMinC)}–${Math.round(d.tempMaxC)}°C · 🌧️ ${rainText(d)} · 💨 ${d.windMaxKmh} km/h`;
}

export function composeWeatherReply(r: WeatherReport): string {
  const lines: string[] = [];
  lines.push(`### 🌦️ Weather in ${placeLabel(r)} — ${rangeLabel(r.requestedStart, r.requestedEnd)}`);
  lines.push("");

  if (r.current) {
    const c = r.current;
    const bits = [
      `${c.emoji} ${c.summary}, **${Math.round(c.tempC)}°C**${c.feelsLikeC !== null ? ` (feels like ${Math.round(c.feelsLikeC)}°C)` : ""}`,
      c.humidity !== null ? `humidity ${c.humidity}%` : "",
      `wind ${c.windKmh} km/h`,
      r.airQuality ? `air quality **${r.airQuality.label}** (AQI ${r.airQuality.usAqi})` : "",
    ].filter(Boolean);
    lines.push(`**Right now:** ${bits.join(" · ")}`);
    lines.push("");
  }

  if (r.days.length > 0) {
    lines.push(`#### ${r.days.length === 1 ? "Forecast" : `${r.days.length}-day forecast`}`);
    for (const d of r.days) lines.push(`* ${dayLine(d)}`);
    if (r.requestedEnd > r.horizonEnd) {
      lines.push("");
      lines.push(`Forecasts only go as far as **${dayLabel(r.horizonEnd, true)}**, so later days aren't shown yet.`);
    }
    lines.push("");
    lines.push("#### Planning advice for your event");
    for (const a of r.advice) lines.push(`* ${a.level === "warning" ? "⚠️" : a.level === "caution" ? "👉" : "✅"} ${a.text}`);
  } else {
    // Every requested day is beyond the forecast
    const checkFrom = shiftDays(r.requestedStart, -(daysBetween(r.today, r.horizonEnd)));
    lines.push(
      `The forecast for **${rangeLabel(r.requestedStart, r.requestedEnd)}** isn't available yet — reliable forecasts only go up to **${dayLabel(r.horizonEnd, true)}**. ` +
      `Ask me again from around **${dayLabel(checkFrom, true)}**.`
    );
    if (r.lastYear && r.lastYear.length > 0) {
      lines.push("");
      lines.push(`#### Same dates last year (observed, not a forecast)`);
      for (const d of r.lastYear) lines.push(`* ${dayLine(d)}`);
      const wet = r.lastYear.filter((d) => isRainy(d) === "likely").length;
      const total = r.lastYear.length;
      lines.push("");
      lines.push(
        wet > 0
          ? `> ${total === 1 ? "That day was wet" : `${wet} of those ${total} days were wet`} last year — worth budgeting for a covered backup (tent or indoor hall).`
          : `> ${total === 1 ? "That day was" : "Those dates were"} dry last year, but that's no guarantee — check the real forecast closer to the day.`
      );
    }
  }

  lines.push("");
  lines.push(
    r.days.length > 0
      ? `_Source: ${r.source} forecast. Forecasts more than 3–4 days out can change — check again closer to the event._`
      : `_Source: Open-Meteo historical archive (last year's observations)._`
  );
  return lines.join("\n");
}

/** Short weather block appended to an inventory answer for outdoor bookings. */
export function composeWeatherNote(r: WeatherReport): string {
  const lines = [``, `#### 🌦️ Weather in ${placeLabel(r)} for your dates`];
  if (r.days.length === 0) {
    lines.push(`* Forecast not available yet — it covers up to ${dayLabel(r.horizonEnd, true)}. Ask "will it rain in ${r.place.name} on ${dayLabel(r.requestedStart)}?" nearer the date.`);
    return lines.join("\n");
  }
  for (const d of r.days.slice(0, 5)) lines.push(`* ${dayLine(d)}`);
  const top = r.advice[0];
  if (top) lines.push(`* ${top.level === "warning" ? "⚠️" : top.level === "caution" ? "👉" : "✅"} ${top.text}`);
  return lines.join("\n");
}

export function composeWeatherFailure(result: Extract<WeatherLookup, { ok: false }>): string {
  switch (result.reason) {
    case "NO_LOCATION":
      return (
        `### 🌦️ Which city?\n\n` +
        `Tell me where your event is and I'll check the live forecast — for example *"Will it rain in Pune on 28th October?"* or *"Weather in Mumbai this weekend"*.`
      );
    case "PLACE_NOT_FOUND":
      return `### 🌦️ Place not found\n\nI couldn't find **${result.place}** on the map. Try the nearest city name, e.g. *"weather in Pune tomorrow"*.`;
    case "PAST_DATES":
      return `### 🌦️ Those dates have passed\n\nI can only give forecasts for today and upcoming days. Ask about a date from today onwards.`;
    default:
      return (
        `### 🌦️ Weather service unavailable\n\n` +
        `I couldn't reach the weather providers for **${result.place ?? "that place"}** just now, so I won't guess. Please try again in a few minutes.`
      );
  }
}

/** Follow-ups that turn the weather into a concrete next step on the marketplace. */
export function weatherFollowUps(r: WeatherReport | undefined, placeName?: string): string[] {
  const ups: string[] = [];
  const where = r?.place.name ?? placeName;
  const when = r ? ` on ${dayLabel(r.requestedStart)}` : "";
  for (const a of r?.advice ?? []) {
    const on = a.date ? ` on ${dayLabel(a.date)}` : when;
    if (a.itemKey && ITEM_LABELS[a.itemKey] && where) ups.push(`Find ${ITEM_LABELS[a.itemKey]} in ${where}${on}`);
  }
  if (where) {
    ups.push(`Find a banquet hall in ${where}${when}`);
    ups.push(r && r.days.length > 1 ? `Will it rain in ${where} tomorrow?` : `Weather in ${where} this weekend`);
  }
  return [...new Set(ups)].slice(0, 3);
}

// ─── helpers ─────────────────────────────────────────────────────────────

function daysBetween(a: string, b: string) {
  return Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86_400_000);
}

function shiftDays(iso: string, n: number) {
  return new Date(new Date(`${iso}T00:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);
}
