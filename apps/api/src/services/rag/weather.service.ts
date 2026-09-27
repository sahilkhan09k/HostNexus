import { todayIst } from "../booking-rules.js";
import { parseDateRange, titleCase, type Location } from "./request-parser.js";

/**
 * Live weather for the AI Concierge.
 *
 * Every number shown comes from a real forecast provider — nothing is
 * invented. Open-Meteo is tried first (16-day daily forecast, rain
 * probability, air quality); when it fails or is rate-limited the MET Norway
 * forecast (~9 days) is used instead. Results are cached in memory so a
 * conversation doesn't re-fetch the same city on every message.
 *
 * Set WEATHER_OFFLINE=1 to disable network lookups (the test suite does this).
 */

// ─── Types ───────────────────────────────────────────────────────────────

export interface Place {
  name: string;
  state?: string;
  /** Only set outside India */
  country?: string;
  latitude: number;
  longitude: number;
}

export interface DailyWeather {
  /** IST calendar day, "YYYY-MM-DD" */
  date: string;
  summary: string;
  emoji: string;
  tempMaxC: number;
  tempMinC: number;
  precipMm: number;
  /** % chance of rain; null when the provider doesn't give one */
  precipProbability: number | null;
  windMaxKmh: number;
  uvIndexMax: number | null;
  thunder: boolean;
}

export interface CurrentWeather {
  tempC: number;
  feelsLikeC: number | null;
  humidity: number | null;
  windKmh: number;
  summary: string;
  emoji: string;
}

export interface AirQuality {
  usAqi: number;
  pm25: number | null;
  label: string;
}

export interface WeatherAdvice {
  level: "good" | "caution" | "warning";
  text: string;
  /** Catalog item that helps (e.g. "tent"), used for follow-up searches */
  itemKey?: string;
  /** First day it applies to, so the follow-up search is for that day */
  date?: string;
}

export interface WeatherReport {
  place: Place;
  source: string;
  fetchedAt: string;
  /** Today in IST when the report was made */
  today: string;
  /** What was asked, inclusive IST days */
  requestedStart: string;
  requestedEnd: string;
  /** Last day the provider forecasts */
  horizonEnd: string;
  current?: CurrentWeather;
  airQuality?: AirQuality;
  /** Forecast days inside the requested range */
  days: DailyWeather[];
  /** Observed weather on the same dates last year, when the dates are beyond the forecast */
  lastYear?: DailyWeather[];
  advice: WeatherAdvice[];
}

interface Forecast {
  source: string;
  fetchedAt: string;
  current?: CurrentWeather;
  days: DailyWeather[];
}

export type WeatherLookup =
  | { ok: true; report: WeatherReport }
  | { ok: false; reason: "NO_LOCATION" | "PLACE_NOT_FOUND" | "UNAVAILABLE" | "PAST_DATES"; place?: string };

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

// ─── Query understanding ─────────────────────────────────────────────────

const WEATHER_WORDS =
  /\b(weather|forecast|rain(?:s|ing|y|fall)?|monsoon|temperatures?|temp|hot|cold(?!\s+storage)|humid(?:ity)?|sunny|cloudy|storms?|stormy|thunder\w*|lightning|windy|winds?|heat ?waves?|aqi|air quality|pollution|smog|climate|umbrella|drizzle|showers?|snow(?:ing)?|fog(?:gy)?|degrees?|celsius)\b/;

/** Mentions of the outdoors, where weather matters for a rental */
export const OUTDOOR_WORDS = /\b(outdoors?|open[- ]air|open lawn|poolside|beach|rooftop|terrace)\b/;

export function isWeatherQuery(message: string): boolean {
  return WEATHER_WORDS.test(message.toLowerCase());
}

const DAY_MS = 86_400_000;
const addDays = (iso: string, n: number) => new Date(new Date(`${iso}T00:00:00Z`).getTime() + n * DAY_MS).toISOString().slice(0, 10);

/**
 * Dates asked about in a weather question. Adds the weather-style phrases the
 * rental parser doesn't need ("this weekend", "next week", "next 3 days").
 */
export function parseWeatherDates(message: string, now: Date = new Date()): { start: string; end: string } | undefined {
  const lower = message.toLowerCase();
  const today = todayIst(now).toISOString().slice(0, 10);
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0 Sun … 6 Sat

  if (/\bday after tomorrow\b/.test(lower)) {
    const d = addDays(today, 2);
    return { start: d, end: d };
  }
  if (/\b(?:this |the |coming )?weekend\b/.test(lower)) {
    const toSat = (6 - dow + 7) % 7;
    const start = dow === 0 ? today : addDays(today, /\bnext weekend\b/.test(lower) ? toSat + 7 : toSat);
    return { start, end: dow === 0 ? today : addDays(start, 1) };
  }
  if (/\bnext week\b/.test(lower)) {
    const toMon = ((1 - dow + 7) % 7) || 7;
    const start = addDays(today, toMon);
    return { start, end: addDays(start, 6) };
  }
  const nextN = lower.match(/\b(?:next|coming)\s+(\d{1,2}|two|three|four|five|six|seven|ten)\s+days\b/);
  if (nextN) {
    const words: Record<string, number> = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, ten: 10 };
    const n = /^\d+$/.test(nextN[1]) ? +nextN[1] : words[nextN[1]];
    return { start: today, end: addDays(today, Math.max(1, Math.min(n, 16)) - 1) };
  }
  if (/\b(this week|week ahead)\b/.test(lower)) return { start: today, end: addDays(today, 6) };
  if (/\b(tonight|right now|currently|now)\b/.test(lower)) return { start: today, end: today };

  const range = parseDateRange(message, now);
  return range ? { start: range.start, end: range.end } : undefined;
}

// ─── Codes and labels ────────────────────────────────────────────────────

/** WMO weather interpretation codes (used by Open-Meteo) */
const WMO: Record<number, [string, string]> = {
  0: ["Clear sky", "☀️"], 1: ["Mainly clear", "🌤️"], 2: ["Partly cloudy", "⛅"], 3: ["Overcast", "☁️"],
  45: ["Fog", "🌫️"], 48: ["Freezing fog", "🌫️"],
  51: ["Light drizzle", "🌦️"], 53: ["Drizzle", "🌦️"], 55: ["Heavy drizzle", "🌧️"],
  56: ["Freezing drizzle", "🌧️"], 57: ["Freezing drizzle", "🌧️"],
  61: ["Light rain", "🌦️"], 63: ["Rain", "🌧️"], 65: ["Heavy rain", "🌧️"],
  66: ["Freezing rain", "🌧️"], 67: ["Freezing rain", "🌧️"],
  71: ["Light snow", "🌨️"], 73: ["Snow", "🌨️"], 75: ["Heavy snow", "❄️"], 77: ["Snow grains", "🌨️"],
  80: ["Rain showers", "🌦️"], 81: ["Heavy showers", "🌧️"], 82: ["Violent showers", "⛈️"],
  85: ["Snow showers", "🌨️"], 86: ["Heavy snow showers", "❄️"],
  95: ["Thunderstorm", "⛈️"], 96: ["Thunderstorm with hail", "⛈️"], 99: ["Thunderstorm with heavy hail", "⛈️"],
};

function wmo(code: number): { summary: string; emoji: string; thunder: boolean } {
  const [summary, emoji] = WMO[code] ?? ["Unsettled", "🌥️"];
  return { summary, emoji, thunder: code >= 95 };
}

/**
 * MET Norway symbol codes → label, ranked so a day is described by its worst
 * weather. First match wins, so "lightrain" is tested before "rain" and
 * "partlycloudy" before "cloudy".
 */
const MET_SYMBOLS: Array<[RegExp, string, string, number]> = [
  [/thunder/, "Thunderstorm", "⛈️", 9],
  [/heavyrain/, "Heavy rain", "🌧️", 8],
  [/heavysleet|heavysnow/, "Heavy snow", "❄️", 8],
  [/lightrain/, "Light rain", "🌦️", 5],
  [/rain/, "Rain", "🌧️", 7],
  [/sleet|snow/, "Snow", "🌨️", 6],
  [/fog/, "Fog", "🌫️", 4],
  [/partlycloudy/, "Partly cloudy", "⛅", 2],
  [/cloudy/, "Overcast", "☁️", 3],
  [/fair/, "Mainly clear", "🌤️", 1],
  [/clearsky/, "Clear sky", "☀️", 0],
];

function metSymbol(code: string | undefined) {
  const c = (code ?? "").replace(/_(day|night|polartwilight)$/, "");
  const hit = MET_SYMBOLS.find(([re]) => re.test(c));
  const [, summary, emoji, rank] = hit ?? [null, "Unsettled", "🌥️", 1];
  return { summary, emoji, rank, thunder: /thunder/.test(c) };
}

export function aqiLabel(aqi: number): string {
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Moderate";
  if (aqi <= 150) return "Unhealthy for sensitive groups";
  if (aqi <= 200) return "Unhealthy";
  if (aqi <= 300) return "Very unhealthy";
  return "Hazardous";
}

// ─── Service ─────────────────────────────────────────────────────────────

const FORECAST_TTL_MS = 30 * 60_000;
const AIR_TTL_MS = 60 * 60_000;
const HTTP_TIMEOUT_MS = 8_000;
const USER_AGENT = "HostNexus/1.0 (event rental concierge; https://github.com/sahilkhan09k/HostNexus)";

/** Canonical names that geocode badly on their own (states, merged cities) */
const GEO_QUERY: Record<string, string> = {
  goa: "Panaji",
  "pimpri chinchwad": "Pimpri",
  "navi mumbai": "Navi Mumbai",
};

/** Lower-case, accents stripped: "Panāji" → "panaji" */
const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const round1 = (n: number) => Math.round(n * 10) / 10;
const toIstDay = (d: Date) => todayIst(d).toISOString().slice(0, 10);

export class WeatherService {
  private static fetcher: Fetcher | undefined;
  private static geoCache = new Map<string, Place | null>();
  private static forecastCache = new Map<string, { at: number; value: Forecast }>();
  private static airCache = new Map<string, { at: number; value: AirQuality | undefined }>();

  /** Tests inject a fake fetch; pass undefined to restore the real one. */
  static setFetcher(fn: Fetcher | undefined) {
    this.fetcher = fn;
    this.clearCache();
  }

  static clearCache() {
    this.geoCache.clear();
    this.forecastCache.clear();
    this.airCache.clear();
  }

  private static async getJson(url: string, headers: Record<string, string> = {}): Promise<any> {
    if (!this.fetcher && process.env.WEATHER_OFFLINE === "1") throw new Error("Weather lookups are disabled (WEATHER_OFFLINE=1)");
    const doFetch = this.fetcher ?? fetch;
    const res = await doFetch(url, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT, ...headers },
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    });
    const body: any = await res.json().catch(() => null);
    // Open-Meteo reports rate limits and bad requests as { error: true, reason }
    if (!res.ok || !body || body.error) {
      throw new Error(`${new URL(url).host} ${res.status}${body?.reason ? `: ${body.reason}` : ""}`);
    }
    return body;
  }

  /**
   * Full weather answer for a place and date range. `start`/`end` default to
   * the next 7 days. Never throws: failures come back as a reason.
   */
  static async lookup(location: Location, range?: { start: string; end: string }, now: Date = new Date()): Promise<WeatherLookup> {
    const today = toIstDay(now);
    const start = range?.start ?? today;
    const end = range?.end ?? addDays(today, 6);
    if (end < today) return { ok: false, reason: "PAST_DATES", place: location.label };

    const place = await this.geocode(location);
    if (!place) return { ok: false, reason: "PLACE_NOT_FOUND", place: location.label };

    let forecast: Forecast;
    try {
      forecast = await this.forecast(place);
    } catch (err) {
      console.warn("Weather forecast unavailable:", err instanceof Error ? err.message : err);
      return { ok: false, reason: "UNAVAILABLE", place: place.name };
    }

    const from = start < today ? today : start;
    const days = forecast.days.filter((d) => d.date >= from && d.date <= end).slice(0, 10);
    const horizonEnd = forecast.days.length > 0 ? forecast.days[forecast.days.length - 1].date : today;
    const includesToday = from === today;

    const [airQuality, lastYear] = await Promise.all([
      includesToday ? this.airQuality(place) : Promise.resolve(undefined),
      days.length === 0 ? this.lastYear(place, from, end) : Promise.resolve(undefined),
    ]);

    const current = includesToday ? forecast.current : undefined;
    return {
      ok: true,
      report: {
        place,
        source: forecast.source,
        fetchedAt: forecast.fetchedAt,
        today,
        requestedStart: from,
        requestedEnd: end,
        horizonEnd,
        current,
        airQuality,
        days,
        lastYear,
        advice: adviseForEvent(days, airQuality),
      },
    };
  }

  /**
   * Resolve a place name to coordinates, preferring India (so "Goa" isn't
   * Genoa): Open-Meteo's geocoder restricted to India, then OpenStreetMap
   * (knows localities like Hinjewadi), then Open-Meteo worldwide.
   * Cached, including "not found"; a network failure is not cached.
   */
  static async geocode(location: Location): Promise<Place | null> {
    const canonical = (location.city ?? location.label).toLowerCase().trim();
    const name = GEO_QUERY[canonical] ?? titleCase(canonical);
    const key = name.toLowerCase();
    if (this.geoCache.has(key)) return this.geoCache.get(key)!;

    let place: Place | null | undefined;
    let failures = 0;
    const attempts: Array<() => Promise<Place | null>> = [
      () => this.openMeteoGeocode(name, "IN"),
      () => this.nominatimGeocode(name),
      () => this.openMeteoGeocode(name),
    ];
    for (const attempt of attempts) {
      try {
        place = await attempt();
        if (place) break;
      } catch (err) {
        failures++;
        console.warn("Geocoding attempt failed:", err instanceof Error ? err.message : err);
      }
    }
    if (!place && failures === attempts.length) return null;
    // Name it the way the user did ("Goa", "Hinjewadi"), not the geocoder's pick ("Panaji", "Wakad")
    if (place) place = { ...place, name: titleCase(location.city ?? location.label) };
    this.geoCache.set(key, place ?? null);
    return place ?? null;
  }

  /**
   * Open-Meteo's geocoder matches loosely ("Goa" → a Rajasthan village), so a
   * hit is only trusted when its name is exactly what was asked or it is a
   * real city (50k+ people); otherwise OpenStreetMap is asked instead.
   */
  private static async openMeteoGeocode(name: string, countryCode?: string): Promise<Place | null> {
    const data = await this.getJson(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=10&language=en&format=json` +
      (countryCode ? `&countryCode=${countryCode}` : "")
    );
    const results: any[] = Array.isArray(data.results) ? data.results : [];
    const wanted = plain(name);
    const best = results
      .filter((r) => typeof r.latitude === "number" && typeof r.longitude === "number" && r.feature_code !== "AIRP")
      .filter((r) => plain(r.name ?? "") === wanted || (r.population ?? 0) >= 50_000)
      .sort((a, b) => (b.population ?? 0) - (a.population ?? 0))[0];
    if (!best) return null;
    return {
      name: best.name,
      state: best.admin1 ?? undefined,
      country: best.country_code && best.country_code !== "IN" ? best.country : undefined,
      latitude: best.latitude,
      longitude: best.longitude,
    };
  }

  private static async nominatimGeocode(name: string): Promise<Place | null> {
    const data = await this.getJson(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(name)}&countrycodes=in&format=jsonv2&limit=1&addressdetails=1`
    );
    const hit = Array.isArray(data) ? data[0] : undefined;
    if (!hit) return null;
    return {
      name: hit.address?.city ?? hit.address?.town ?? hit.address?.suburb ?? hit.name ?? name,
      state: hit.address?.state,
      latitude: parseFloat(hit.lat),
      longitude: parseFloat(hit.lon),
    };
  }

  private static cacheKey(place: Place) {
    return `${place.latitude.toFixed(2)},${place.longitude.toFixed(2)}`;
  }

  /** Daily forecast from Open-Meteo, falling back to MET Norway. */
  static async forecast(place: Place): Promise<Forecast> {
    const key = this.cacheKey(place);
    const hit = this.forecastCache.get(key);
    if (hit && Date.now() - hit.at < FORECAST_TTL_MS) return hit.value;

    let value: Forecast;
    try {
      value = await this.openMeteo(place);
    } catch (err) {
      console.warn("Open-Meteo forecast failed, using MET Norway:", err instanceof Error ? err.message : err);
      value = await this.metNorway(place);
    }
    this.forecastCache.set(key, { at: Date.now(), value });
    return value;
  }

  private static async openMeteo(place: Place): Promise<Forecast> {
    const apiKey = process.env.OPEN_METEO_API_KEY;
    const host = apiKey ? "https://customer-api.open-meteo.com" : "https://api.open-meteo.com";
    const params = new URLSearchParams({
      latitude: String(place.latitude),
      longitude: String(place.longitude),
      daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,uv_index_max",
      current: "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m",
      timezone: "Asia/Kolkata",
      forecast_days: "16",
      ...(apiKey ? { apikey: apiKey } : {}),
    });
    const data = await this.getJson(`${host}/v1/forecast?${params}`);
    const d = data.daily;
    if (!d?.time?.length) throw new Error("Open-Meteo returned no daily data");

    const days: DailyWeather[] = d.time.map((date: string, i: number) => {
      const w = wmo(d.weather_code?.[i] ?? -1);
      return {
        date,
        ...w,
        tempMaxC: round1(d.temperature_2m_max[i]),
        tempMinC: round1(d.temperature_2m_min[i]),
        precipMm: round1(d.precipitation_sum?.[i] ?? 0),
        precipProbability: d.precipitation_probability_max?.[i] ?? null,
        windMaxKmh: Math.round(d.wind_speed_10m_max?.[i] ?? 0),
        uvIndexMax: d.uv_index_max?.[i] ?? null,
      };
    }).filter((x: DailyWeather) => Number.isFinite(x.tempMaxC) && Number.isFinite(x.tempMinC));

    const c = data.current;
    const current: CurrentWeather | undefined = c && typeof c.temperature_2m === "number"
      ? {
          tempC: round1(c.temperature_2m),
          feelsLikeC: typeof c.apparent_temperature === "number" ? round1(c.apparent_temperature) : null,
          humidity: typeof c.relative_humidity_2m === "number" ? Math.round(c.relative_humidity_2m) : null,
          windKmh: Math.round(c.wind_speed_10m ?? 0),
          ...wmo(c.weather_code ?? -1),
        }
      : undefined;

    return { source: "Open-Meteo", fetchedAt: new Date().toISOString(), current, days };
  }

  /** MET Norway hourly/6-hourly series, rolled up into IST calendar days. */
  private static async metNorway(place: Place): Promise<Forecast> {
    const data = await this.getJson(
      `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${place.latitude.toFixed(4)}&lon=${place.longitude.toFixed(4)}`
    );
    const series: any[] = data?.properties?.timeseries ?? [];
    if (series.length === 0) throw new Error("MET Norway returned no forecast");

    const byDay = new Map<string, { temps: number[]; winds: number[]; precip: number; rank: number; symbol: ReturnType<typeof metSymbol> }>();
    let coveredUntil = 0;
    for (const entry of series) {
      const t = new Date(entry.time);
      const day = toIstDay(t);
      const inst = entry.data?.instant?.details ?? {};
      let bucket = byDay.get(day);
      if (!bucket) {
        bucket = { temps: [], winds: [], precip: 0, rank: -1, symbol: metSymbol(undefined) };
        byDay.set(day, bucket);
      }
      if (typeof inst.air_temperature === "number") bucket.temps.push(inst.air_temperature);
      if (typeof inst.wind_speed === "number") bucket.winds.push(inst.wind_speed * 3.6);

      // Rain: use the 1-hour block where the series is hourly, the 6-hour block after that, never both
      const period = entry.data?.next_1_hours ?? entry.data?.next_6_hours;
      if (period && t.getTime() >= coveredUntil) {
        bucket.precip += period.details?.precipitation_amount ?? 0;
        coveredUntil = t.getTime() + (entry.data?.next_1_hours ? 1 : 6) * 3_600_000;
      }
      const sym = metSymbol(period?.summary?.symbol_code ?? entry.data?.next_12_hours?.summary?.symbol_code);
      if (period?.summary?.symbol_code && sym.rank > bucket.rank) {
        bucket.rank = sym.rank;
        bucket.symbol = sym;
      }
    }

    // A day needs readings across it to have a meaningful max/min (drop the ragged last day)
    const days: DailyWeather[] = [...byDay.entries()]
      .filter(([, b]) => b.temps.length >= 3)
      .map(([date, b]) => ({
        date,
        summary: b.symbol.summary,
        emoji: b.symbol.emoji,
        thunder: b.symbol.thunder,
        tempMaxC: round1(Math.max(...b.temps)),
        tempMinC: round1(Math.min(...b.temps)),
        precipMm: round1(b.precip),
        precipProbability: null,
        windMaxKmh: Math.round(Math.max(0, ...b.winds)),
        uvIndexMax: null,
      }));

    const first = series[0];
    const inst = first.data?.instant?.details ?? {};
    const sym = metSymbol(first.data?.next_1_hours?.summary?.symbol_code ?? first.data?.next_6_hours?.summary?.symbol_code);
    const current: CurrentWeather | undefined = typeof inst.air_temperature === "number"
      ? {
          tempC: round1(inst.air_temperature),
          feelsLikeC: null,
          humidity: typeof inst.relative_humidity === "number" ? Math.round(inst.relative_humidity) : null,
          windKmh: Math.round((inst.wind_speed ?? 0) * 3.6),
          summary: sym.summary,
          emoji: sym.emoji,
        }
      : undefined;

    return { source: "MET Norway", fetchedAt: data?.properties?.meta?.updated_at ?? new Date().toISOString(), current, days };
  }

  /** Current US AQI; undefined when unavailable (never guessed). */
  static async airQuality(place: Place): Promise<AirQuality | undefined> {
    const key = this.cacheKey(place);
    const hit = this.airCache.get(key);
    if (hit && Date.now() - hit.at < AIR_TTL_MS) return hit.value;
    let value: AirQuality | undefined;
    try {
      const data = await this.getJson(
        `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${place.latitude}&longitude=${place.longitude}&current=us_aqi,pm2_5&timezone=Asia%2FKolkata`
      );
      const aqi = data.current?.us_aqi;
      if (typeof aqi === "number") {
        value = { usAqi: Math.round(aqi), pm25: typeof data.current.pm2_5 === "number" ? round1(data.current.pm2_5) : null, label: aqiLabel(aqi) };
      }
    } catch (err) {
      console.warn("Air quality unavailable:", err instanceof Error ? err.message : err);
    }
    this.airCache.set(key, { at: Date.now(), value });
    return value;
  }

  /** Observed weather on the same dates one year earlier — a hint for dates beyond the forecast. */
  static async lastYear(place: Place, start: string, end: string): Promise<DailyWeather[] | undefined> {
    const shift = (iso: string) => `${+iso.slice(0, 4) - 1}${iso.slice(4)}`;
    const lastEnd = end > addDays(start, 9) ? addDays(start, 9) : end;
    try {
      const data = await this.getJson(
        `https://archive-api.open-meteo.com/v1/archive?latitude=${place.latitude}&longitude=${place.longitude}` +
        `&start_date=${shift(start)}&end_date=${shift(lastEnd)}` +
        `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max&timezone=Asia%2FKolkata`
      );
      const d = data.daily;
      if (!d?.time?.length) return undefined;
      return d.time.map((date: string, i: number) => ({
        date,
        ...wmo(d.weather_code?.[i] ?? -1),
        tempMaxC: round1(d.temperature_2m_max[i]),
        tempMinC: round1(d.temperature_2m_min[i]),
        precipMm: round1(d.precipitation_sum?.[i] ?? 0),
        precipProbability: null,
        windMaxKmh: Math.round(d.wind_speed_10m_max?.[i] ?? 0),
        uvIndexMax: null,
      })).filter((x: DailyWeather) => Number.isFinite(x.tempMaxC));
    } catch (err) {
      console.warn("Last year's weather unavailable:", err instanceof Error ? err.message : err);
      return undefined;
    }
  }
}

// ─── Event advice ────────────────────────────────────────────────────────

export function isRainy(d: DailyWeather): "likely" | "possible" | null {
  const p = d.precipProbability;
  if ((p !== null && p >= 60) || d.precipMm >= 5 || d.thunder) return "likely";
  if ((p !== null && p >= 30) || d.precipMm >= 1) return "possible";
  return null;
}

const shortDay = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** Practical, rental-focused advice derived only from the forecast numbers. */
export function adviseForEvent(days: DailyWeather[], air?: AirQuality): WeatherAdvice[] {
  if (days.length === 0) return [];
  const advice: WeatherAdvice[] = [];
  const list = (ds: DailyWeather[]) => ds.map((d) => shortDay(d.date)).join(", ");

  const rainLikely = days.filter((d) => isRainy(d) === "likely");
  const rainPossible = days.filter((d) => isRainy(d) === "possible");
  const thunder = days.filter((d) => d.thunder);
  const hot = days.filter((d) => d.tempMaxC >= 35);
  const veryHot = days.filter((d) => d.tempMaxC >= 40);
  const cold = days.filter((d) => d.tempMinC <= 10);
  const windy = days.filter((d) => d.windMaxKmh >= 35);
  const highUv = days.filter((d) => (d.uvIndexMax ?? 0) >= 8);

  if (rainLikely.length > 0) {
    advice.push({ level: "warning", itemKey: "tent", date: rainLikely[0].date, text: `Rain is likely on ${list(rainLikely)} — book a covered option: tents/canopies over any open area, or an indoor banquet hall.` });
    advice.push({ level: "caution", itemKey: "generator", date: rainLikely[0].date, text: "Keep a generator as power backup and keep AV, lighting and cables covered and off the ground." });
  } else if (rainPossible.length > 0) {
    advice.push({ level: "caution", itemKey: "tent", date: rainPossible[0].date, text: `Showers are possible on ${list(rainPossible)} — keep a tent or canopy on standby for outdoor setups.` });
  }
  if (thunder.length > 0) {
    advice.push({ level: "warning", text: `Thunderstorms forecast on ${list(thunder)} — avoid open lawns and tall metal structures during the storm window.` });
  }
  if (veryHot.length > 0) {
    advice.push({ level: "warning", itemKey: "cold_storage", date: veryHot[0].date, text: `Extreme heat (40°C+) on ${list(veryHot)} — plan shade, coolers and cold storage for food and drinks; move outdoor segments to the evening.` });
  } else if (hot.length > 0) {
    advice.push({ level: "caution", itemKey: "cold_storage", date: hot[0].date, text: `Hot days (35°C+) on ${list(hot)} — arrange shade, fans or coolers and chilled storage for catering.` });
  }
  if (cold.length > 0) {
    advice.push({ level: "caution", text: `Cool nights (down to ${Math.min(...cold.map((d) => d.tempMinC))}°C) — an indoor venue or heaters will keep guests comfortable.` });
  }
  if (windy.length > 0) {
    advice.push({ level: "caution", text: `Strong winds (up to ${Math.max(...windy.map((d) => d.windMaxKmh))} km/h) on ${list(windy)} — anchor tents and avoid tall decor or loose signage.` });
  }
  if (highUv.length > 0 && rainLikely.length === 0) {
    advice.push({ level: "caution", text: `Very high UV on ${list(highUv)} — provide shade for daytime outdoor areas.` });
  }
  if (air && air.usAqi > 150) {
    advice.push({ level: "warning", itemKey: "banquet_hall", text: `Air quality is ${air.label.toLowerCase()} right now (AQI ${air.usAqi}) — an indoor venue is the safer choice.` });
  }
  if (advice.length === 0) {
    advice.push({ level: "good", itemKey: "lawn", text: "Dry, comfortable conditions — good for outdoor setups like lawns, terraces and open-air seating." });
  }
  return advice;
}
