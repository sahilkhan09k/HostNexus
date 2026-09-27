import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from "vitest";
import { RagService } from "../services/rag/rag.service.js";
import { WeatherService, parseWeatherDates, adviseForEvent, isWeatherQuery } from "../services/rag/weather.service.js";
import type { RagResponse } from "../services/rag/types.js";
import { prisma } from "../config/database.js";

vi.mock("../config/database.js", async () => {
  const { createFakePrisma } = await import("./helpers/fake-prisma.js");
  return { prisma: createFakePrisma() };
});

beforeAll(() => {
  for (const k of ["GROQ_API_KEY", "GEMINI_API_KEY", "OPENAI_API_KEY", "OPEN_METEO_API_KEY"]) delete process.env[k];
});

const db = prisma as any;
const T0 = new Date("2026-10-01T04:30:00.000Z"); // 10:00 IST, Thu 1 Oct 2026

const DAYS = Array.from({ length: 16 }, (_, i) => new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10));

/** Open-Meteo daily forecast: dry and 31°C everywhere except heavy rain on Sat 3 Oct */
function openMeteoForecast() {
  const rainy = (i: number) => DAYS[i] === "2026-10-03";
  return {
    current: { temperature_2m: 29.4, apparent_temperature: 32.1, relative_humidity_2m: 70, weather_code: 2, wind_speed_10m: 11 },
    daily: {
      time: DAYS,
      weather_code: DAYS.map((_, i) => (rainy(i) ? 65 : 1)),
      temperature_2m_max: DAYS.map(() => 31.2),
      temperature_2m_min: DAYS.map(() => 22.6),
      precipitation_sum: DAYS.map((_, i) => (rainy(i) ? 18.4 : 0)),
      precipitation_probability_max: DAYS.map((_, i) => (rainy(i) ? 85 : 5)),
      wind_speed_10m_max: DAYS.map(() => 14),
      uv_index_max: DAYS.map(() => 6),
    },
  };
}

/** MET Norway hourly series for 3 days from now */
function metForecast() {
  const series = Array.from({ length: 72 }, (_, h) => {
    const t = new Date(Date.UTC(2026, 9, 1, 0) + h * 3_600_000);
    return {
      time: t.toISOString(),
      data: {
        instant: { details: { air_temperature: 20 + (h % 24) / 2, wind_speed: 3, relative_humidity: 60 } },
        next_1_hours: { summary: { symbol_code: h === 30 ? "heavyrain" : "clearsky_day" }, details: { precipitation_amount: h === 30 ? 9 : 0 } },
      },
    };
  });
  return { properties: { meta: { updated_at: T0.toISOString() }, timeseries: series } };
}

type Route = (url: URL) => { status?: number; body: unknown } | undefined;

function fakeFetch(overrides: Route = () => undefined) {
  const calls: string[] = [];
  const fn = vi.fn(async (input: string) => {
    const url = new URL(input);
    calls.push(url.host + url.pathname);
    const hit = overrides(url) ?? defaultRoute(url);
    return new Response(JSON.stringify(hit.body), { status: hit.status ?? 200, headers: { "Content-Type": "application/json" } });
  });
  WeatherService.setFetcher(fn as any);
  return { fn, calls };
}

function defaultRoute(url: URL): { status?: number; body: unknown } {
  const name = url.searchParams.get("name") ?? url.searchParams.get("q") ?? "";
  const cities: Record<string, [number, number, string]> = {
    Pune: [18.52, 73.86, "Maharashtra"],
    Mumbai: [19.07, 72.88, "Maharashtra"],
  };
  switch (url.host) {
    case "geocoding-api.open-meteo.com": {
      const c = cities[name];
      return { body: c ? { results: [{ name, latitude: c[0], longitude: c[1], admin1: c[2], country_code: "IN", population: 3_000_000, feature_code: "PPLA2" }] } : {} };
    }
    case "nominatim.openstreetmap.org":
      return { body: [] };
    case "api.open-meteo.com":
      return { body: openMeteoForecast() };
    case "air-quality-api.open-meteo.com":
      return { body: { current: { us_aqi: 64, pm2_5: 18.2 } } };
    case "archive-api.open-meteo.com":
      return { body: { daily: { time: ["2025-12-25"], weather_code: [0], temperature_2m_max: [30], temperature_2m_min: [19], precipitation_sum: [0], wind_speed_10m_max: [9] } } };
    case "api.met.no":
      return { body: metForecast() };
    default:
      return { status: 404, body: {} };
  }
}

function session() {
  let context: RagResponse["context"];
  return {
    async say(message: string) {
      const res = await RagService.processQuery({ message, context });
      context = res.context;
      return res;
    },
  };
}

function listing(id: string, fields: Record<string, unknown>) {
  return db.__seed("resource", {
    id, businessId: "biz-1", resourceType: "Furniture", description: null, quantity: 1, unit: null,
    status: "available", location: "Pune", rentAmountPaise: 10_000, securityDepositPaise: 10_000,
    photos: [], hasPreExistingDamage: false, damageDescription: null, damagePhotos: [],
    transportAvailable: false, transportRatePerKmPaise: 0, ...fields,
  });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
  db.__reset();
  db.__seed("user", { id: "u-1", verificationStatus: "VERIFIED" });
  db.__seed("business", { id: "biz-1", name: "SK caterers", ownerId: "u-1", city: null });
});

afterEach(() => {
  vi.useRealTimers();
  WeatherService.setFetcher(undefined);
});

describe("recognising weather questions", () => {
  it.each([
    "What's the weather in Pune tomorrow?",
    "Will it rain in Mumbai on 3rd October?",
    "How hot will it be in Delhi this weekend",
    "AQI in Delhi today",
    "forecast for Goa next week",
  ])("%s → weather_inquiry", (q) => {
    expect(RagService.classifyIntent(q)).toBe("weather_inquiry");
  });

  it("leaves rentals and policy questions alone", () => {
    expect(RagService.classifyIntent("I need cold storage in Pune")).toBe("listing_inquiry");
    expect(RagService.classifyIntent("50 chairs in Pune on 3rd Oct, will it rain?")).toBe("listing_inquiry");
    expect(RagService.classifyIntent("What happens if it rains, do I get a refund?")).not.toBe("weather_inquiry");
    expect(isWeatherQuery("I need a tempo for transport")).toBe(false);
  });

  it("understands weather-style dates", () => {
    expect(parseWeatherDates("weather this weekend", T0)).toEqual({ start: "2026-10-03", end: "2026-10-04" });
    expect(parseWeatherDates("rain next week?", T0)).toEqual({ start: "2026-10-05", end: "2026-10-11" });
    expect(parseWeatherDates("next 3 days", T0)).toEqual({ start: "2026-10-01", end: "2026-10-03" });
    expect(parseWeatherDates("day after tomorrow", T0)).toEqual({ start: "2026-10-03", end: "2026-10-03" });
    expect(parseWeatherDates("on 28th October", T0)).toEqual({ start: "2026-10-28", end: "2026-10-28" });
  });
});

describe("answering from the live forecast", () => {
  it("reports the provider's numbers for the asked day and advises a covered setup when rain is likely", async () => {
    const { calls } = fakeFetch();
    const res = await RagService.processQuery({ message: "Will it rain in Pune on 3rd October?" });

    expect(res.intent).toBe("weather_inquiry");
    expect(res.reply).toContain("Weather in **Pune**, Maharashtra");
    expect(res.reply).toContain("85% chance of rain, 18.4 mm");
    expect(res.reply).toContain("23–31°C");
    expect(res.reply).toMatch(/Rain is likely on Sat, 3 Oct.*tents/);
    expect(res.reply).not.toContain("Right now"); // not today
    expect(res.weather?.days.map((d) => d.date)).toEqual(["2026-10-03"]);
    expect(res.suggestedFollowUps).toContain("Find tents in Pune on Sat, 3 Oct");
    expect(res.sources).toEqual(["Open-Meteo forecast · Pune"]);
    expect(calls).not.toContain("air-quality-api.open-meteo.com/v1/air-quality");
  });

  it("includes current conditions and air quality when today is asked", async () => {
    fakeFetch();
    const res = await RagService.processQuery({ message: "weather in Pune today" });
    expect(res.reply).toContain("**Right now:** ⛅ Partly cloudy, **29°C** (feels like 32°C) · humidity 70%");
    expect(res.reply).toContain("air quality **Moderate** (AQI 64)");
    expect(res.reply).toContain("Dry, comfortable conditions");
  });

  it("defaults to the next 7 days", async () => {
    fakeFetch();
    const res = await RagService.processQuery({ message: "What's the weather like in Mumbai?" });
    expect(res.weather?.days).toHaveLength(7);
    expect(res.reply).toContain("7-day forecast");
  });

  it("follows up on the place and the dates", async () => {
    fakeFetch();
    const chat = session();
    await chat.say("Will it rain in Pune on 3rd October?");

    const mumbai = await chat.say("and Mumbai?");
    expect(mumbai.intent).toBe("weather_inquiry");
    expect(mumbai.reply).toContain("Weather in **Mumbai**");
    expect(mumbai.weather?.days.map((d) => d.date)).toEqual(["2026-10-03"]);

    const tomorrow = await chat.say("what about tomorrow?");
    expect(tomorrow.reply).toContain("Weather in **Mumbai**");
    expect(tomorrow.weather?.days.map((d) => d.date)).toEqual(["2026-10-02"]);
  });

  it("checks the weather for the event being planned", async () => {
    fakeFetch();
    listing("chairs", { name: "White chairs", resourceType: "Chairs", quantity: 100 });
    const chat = session();
    await chat.say("I need 50 chairs in Pune on 3rd October");
    const res = await chat.say("will it rain that day?");
    expect(res.intent).toBe("weather_inquiry");
    expect(res.reply).toContain("Weather in **Pune**");
    expect(res.weather?.days.map((d) => d.date)).toEqual(["2026-10-03"]);
  });

  it("asks for a city instead of guessing", async () => {
    const { fn } = fakeFetch();
    const res = await RagService.processQuery({ message: "will it rain tomorrow?" });
    expect(res.reply).toContain("Which city?");
    expect(fn).not.toHaveBeenCalled();
  });

  it("says when the dates are beyond the forecast, and shows last year's observations as such", async () => {
    fakeFetch();
    const res = await RagService.processQuery({ message: "Weather in Pune on 25th December" });
    expect(res.reply).toContain("isn't available yet");
    expect(res.reply).toContain("Same dates last year (observed, not a forecast)");
    expect(res.reply).toContain("Open-Meteo historical archive");
    expect(res.weather?.days).toEqual([]);
  });

  it("falls back to MET Norway when Open-Meteo is rate-limited", async () => {
    fakeFetch((url) =>
      url.host === "api.open-meteo.com" ? { status: 429, body: { error: true, reason: "Daily API request limit exceeded." } } : undefined
    );
    const res = await RagService.processQuery({ message: "weather in Pune tomorrow" });
    expect(res.sources).toEqual(["MET Norway forecast · Pune"]);
    expect(res.weather?.days[0]).toMatchObject({ date: "2026-10-02", summary: "Heavy rain", precipMm: 9, precipProbability: null });
    expect(res.reply).toContain("9 mm");
  });

  it("admits when no provider answers — no invented numbers", async () => {
    fakeFetch((url) => (url.host.includes("open-meteo") && !url.host.startsWith("geocoding") || url.host === "api.met.no" ? { status: 503, body: {} } : undefined));
    const res = await RagService.processQuery({ message: "weather in Pune tomorrow" });
    expect(res.reply).toContain("Weather service unavailable");
    expect(res.reply).not.toMatch(/°C/);
    expect(res.weather).toBeUndefined();
  });
});

describe("weather on rental searches", () => {
  beforeEach(() => {
    listing("lawn", { name: "Green Lawns", resourceType: "Lawn", description: "Open lawn for 400 guests" });
    listing("chairs", { name: "White chairs", resourceType: "Chairs", quantity: 100 });
  });

  it("adds the forecast to an outdoor search", async () => {
    fakeFetch();
    const res = await RagService.processQuery({ message: "Find a lawn in Pune on 3rd October" });
    expect(res.intent).toBe("listing_inquiry");
    expect(res.results.map((r) => r.id)).toContain("lawn");
    expect(res.reply).toContain("Weather in **Pune**, Maharashtra for your dates");
    expect(res.reply).toContain("Rain is likely");
    expect(res.weather?.days).toHaveLength(1);
  });

  it("adds it when the search also asks about the weather", async () => {
    fakeFetch();
    const res = await RagService.processQuery({ message: "50 chairs in Pune on 3rd October, will it rain?" });
    expect(res.results.map((r) => r.id)).toContain("chairs");
    expect(res.reply).toContain("for your dates");
  });

  it("doesn't look up the weather for an indoor search", async () => {
    const { fn } = fakeFetch();
    const res = await RagService.processQuery({ message: "50 chairs in Pune on 3rd October" });
    expect(res.weather).toBeUndefined();
    expect(fn).not.toHaveBeenCalled();
  });

  it("still returns the listings when the weather lookup fails", async () => {
    fakeFetch(() => ({ status: 503, body: {} }));
    const res = await RagService.processQuery({ message: "Find a lawn in Pune on 3rd October" });
    expect(res.results.map((r) => r.id)).toContain("lawn");
    expect(res.reply).not.toContain("for your dates");
  });
});

describe("advice", () => {
  const day = (over: Partial<Parameters<typeof adviseForEvent>[0][number]>) => ({
    date: "2026-10-03", summary: "Clear", emoji: "☀️", tempMaxC: 30, tempMinC: 20, precipMm: 0,
    precipProbability: 0, windMaxKmh: 10, uvIndexMax: 5, thunder: false, ...over,
  });

  it("is derived only from the forecast numbers", () => {
    expect(adviseForEvent([day({})])[0]).toMatchObject({ level: "good", itemKey: "lawn" });
    expect(adviseForEvent([day({ tempMaxC: 41 })])[0]).toMatchObject({ level: "warning", itemKey: "cold_storage" });
    expect(adviseForEvent([day({ precipProbability: 40 })])[0]).toMatchObject({ level: "caution", itemKey: "tent" });
    expect(adviseForEvent([day({ windMaxKmh: 45 })])[0].text).toContain("45 km/h");
    expect(adviseForEvent([day({})], { usAqi: 220, pm25: 150, label: "Very unhealthy" }).some((a) => a.itemKey === "banquet_hall")).toBe(true);
  });
});
