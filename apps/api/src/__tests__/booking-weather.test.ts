import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { prisma } from "../config/database.js";
import { WeatherService, type DailyWeather } from "../services/rag/weather.service.js";
import {
  BookingWeatherService, listingLocation, rentalImpacts, transportImpacts,
} from "../services/booking-weather.service.js";

vi.mock("../config/database.js", async () => {
  const { createFakePrisma } = await import("./helpers/fake-prisma.js");
  return { prisma: createFakePrisma() };
});

const db = prisma as any;
const T0 = new Date("2026-10-01T04:30:00.000Z"); // 10:00 IST, Thu 1 Oct 2026
const DAYS = Array.from({ length: 16 }, (_, i) => new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10));

/** Dry 31°C everywhere, except 40 mm of rain with thunder on Sat 3 Oct */
function forecastBody() {
  const storm = (d: string) => d === "2026-10-03";
  return {
    daily: {
      time: DAYS,
      weather_code: DAYS.map((d) => (storm(d) ? 95 : 1)),
      temperature_2m_max: DAYS.map(() => 31),
      temperature_2m_min: DAYS.map(() => 22),
      precipitation_sum: DAYS.map((d) => (storm(d) ? 40 : 0)),
      precipitation_probability_max: DAYS.map((d) => (storm(d) ? 90 : 5)),
      wind_speed_10m_max: DAYS.map(() => 12),
      uv_index_max: DAYS.map(() => 6),
    },
  };
}

function fakeFetch() {
  const fn = vi.fn(async (input: string) => {
    const url = new URL(input);
    let body: unknown = {};
    if (url.host === "geocoding-api.open-meteo.com") {
      body = url.searchParams.get("name") === "Pune"
        ? { results: [{ name: "Pune", latitude: 18.52, longitude: 73.86, admin1: "Maharashtra", country_code: "IN", population: 3_000_000 }] }
        : {};
    } else if (url.host === "api.open-meteo.com") body = forecastBody();
    else if (url.host === "archive-api.open-meteo.com") {
      body = { daily: { time: ["2025-12-20"], weather_code: [0], temperature_2m_max: [29], temperature_2m_min: [14], precipitation_sum: [0], wind_speed_10m_max: [8] } };
    } else if (url.host === "nominatim.openstreetmap.org") body = [];
    return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
  });
  WeatherService.setFetcher(fn as any);
  return fn;
}

function day(date: string, over: Partial<DailyWeather> = {}): DailyWeather {
  return { date, summary: "Clear", emoji: "☀️", tempMaxC: 30, tempMinC: 20, precipMm: 0, precipProbability: 0, windMaxKmh: 10, uvIndexMax: 5, thunder: false, ...over };
}

function seedResource(over: Record<string, unknown> = {}) {
  db.__seed("business", { id: "biz-1", name: "Koregaon Grand", ownerId: "u-1", city: "Pune" });
  return db.__seed("resource", {
    id: "res-1", businessId: "biz-1", name: "Wedding tent 40x60", description: null,
    resourceType: "Tent/Canopy", location: "Koregaon Park, Pune", quantity: 2, ...over,
  });
}

beforeEach(() => {
  db.__reset();
  fakeFetch();
});
afterEach(() => WeatherService.setFetcher(undefined));

describe("listingLocation", () => {
  it("prefers the owner's business city", () => {
    expect(listingLocation("Somewhere odd", "Pune")).toEqual({ label: "Pune", city: "pune" });
  });
  it("finds a known city inside the listing location", () => {
    expect(listingLocation("Andheri East, Mumbai", null)?.city).toBe("mumbai");
  });
  it("falls back to the last part of the location", () => {
    expect(listingLocation("MG Road, Chakan", null)).toEqual({ label: "Chakan" });
  });
  it("has nothing to go on without either", () => {
    expect(listingLocation(null, null)).toBeUndefined();
  });
});

describe("rentalImpacts", () => {
  it("flags heavy rain and thunder as high risk for a tent", () => {
    const impacts = rentalImpacts(
      { resourceType: "Tent/Canopy", name: "Tent", transportAvailable: false },
      [day("2026-10-03", { precipMm: 40, precipProbability: 90, thunder: true })],
    );
    expect(impacts.map((i) => i.title)).toEqual(["Rain load on the tent", "Thunderstorm risk outdoors"]);
    expect(impacts.every((i) => i.level === "high")).toBe(true);
  });

  it("treats an indoor banquet hall as a guest-access concern only", () => {
    const [impact] = rentalImpacts(
      { resourceType: "Banquet Hall", name: "Grand Ballroom", transportAvailable: false },
      [day("2026-10-03", { precipMm: 8, precipProbability: 70 })],
    );
    expect(impact).toMatchObject({ area: "rental", level: "low", title: "Guest arrival in the rain" });
  });

  it("recognises an open-air event space from its description", () => {
    const [impact] = rentalImpacts(
      { resourceType: "Event Space", name: "Skyline Rooftop Terrace", description: "Open-air rooftop", transportAvailable: false },
      [day("2026-10-03", { precipMm: 8, precipProbability: 70 })],
    );
    expect(impact.title).toBe("Open-air space will get wet");
  });

  it("lists mixed heavy and moderate rain days in date order", () => {
    const [impact] = rentalImpacts(
      { resourceType: "Tent/Canopy", name: "Tent", transportAvailable: false },
      [day("2026-09-28", { precipMm: 6, precipProbability: 100 }), day("2026-09-30", { precipMm: 25 })],
    );
    expect(impact.dates).toEqual(["2026-09-28", "2026-09-30"]);
    expect(impact.detail).toMatch(/Mon, 28 Sept?, Wed, 30 Sept?/);
  });

  it("warns cold storage about extreme heat", () => {
    const [impact] = rentalImpacts(
      { resourceType: "Cold Storage", name: "Walk-in chiller", transportAvailable: false },
      [day("2026-05-10", { tempMaxC: 42 })],
    );
    expect(impact).toMatchObject({ level: "high", title: "Cooling works harder" });
    expect(impact.detail).toContain("42°C");
  });

  it("says nothing when the weather is fine", () => {
    expect(rentalImpacts({ resourceType: "AV Equipment", name: "PA system", transportAvailable: false }, [day("2026-10-02")])).toEqual([]);
  });
});

describe("transportImpacts", () => {
  it("names the owner's delivery when the owner transports it", () => {
    const [impact] = transportImpacts("PROVIDER", [day("2026-10-03", { precipMm: 30, precipProbability: 90 })], "AV Equipment");
    expect(impact).toMatchObject({ area: "transport", level: "high", dates: ["2026-10-03"] });
    expect(impact.detail).toMatch(/^The owner's delivery/);
    expect(impact.detail).toContain("closed vehicle");
  });
  it("names the renter's pickup otherwise", () => {
    const [impact] = transportImpacts("SELF", [day("2026-10-03", { precipMm: 30 })], "Furniture");
    expect(impact.detail).toMatch(/^Your pickup/);
  });
});

describe("BookingWeatherService.check", () => {
  it("forecasts the booking and rates a stormy delivery day", async () => {
    seedResource({ transportAvailable: true, transportRatePerKmPaise: 2500 });
    const r = await BookingWeatherService.check("res-1", "2026-10-02", "2026-10-03", "PROVIDER", T0);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const c = r.check;
    expect(c.location).toBe("Pune");
    expect(c.coverage).toBe("full");
    expect(c.days.map((d) => d.date)).toEqual(["2026-10-02", "2026-10-03"]);
    expect(c.overall).toBe("high");
    expect(c.transport).toEqual({ relevant: true, mode: "PROVIDER", ownerProvides: true, dates: ["2026-10-02", "2026-10-03"] });
    // The storm falls on the return day, so transport is hit as well as the rental
    expect(c.impacts.some((i) => i.area === "transport" && i.dates.includes("2026-10-03"))).toBe(true);
    expect(c.impacts.some((i) => i.area === "rental")).toBe(true);
  });

  it("ignores PROVIDER when the owner offers no transport", async () => {
    seedResource();
    const r = await BookingWeatherService.check("res-1", "2026-10-03", "2026-10-03", "PROVIDER", T0);
    expect(r.ok && r.check.transport.mode).toBe("SELF");
  });

  it("does not add transport impacts for a venue", async () => {
    seedResource({ resourceType: "Banquet Hall", name: "Ballroom" });
    const r = await BookingWeatherService.check("res-1", "2026-10-03", "2026-10-03", "SELF", T0);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.check.transport.relevant).toBe(false);
    expect(r.check.impacts.every((i) => i.area === "rental")).toBe(true);
  });

  it("reports calm dates as no impact", async () => {
    seedResource();
    const r = await BookingWeatherService.check("res-1", "2026-10-05", "2026-10-06", "SELF", T0);
    expect(r.ok && r.check.overall).toBe("none");
    expect(r.ok && r.check.impacts).toEqual([]);
  });

  it("gives last year's weather, not impacts, beyond the forecast", async () => {
    seedResource();
    const r = await BookingWeatherService.check("res-1", "2026-12-20", "2026-12-21", "SELF", T0);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.check.coverage).toBe("none");
    expect(r.check.impacts).toEqual([]);
    expect(r.check.lastYear?.[0].date).toBe("2025-12-20");
  });

  it("marks a booking that runs past the horizon as partial", async () => {
    seedResource();
    const r = await BookingWeatherService.check("res-1", "2026-10-15", "2026-10-20", "SELF", T0);
    expect(r.ok && r.check.coverage).toBe("partial");
  });

  it("returns a reason instead of throwing when the place is unknown", async () => {
    db.__seed("business", { id: "biz-1", name: "X", ownerId: "u-1", city: null });
    db.__seed("resource", { id: "res-1", businessId: "biz-1", name: "Chair", resourceType: "Furniture", location: "Nowhere Land" });
    const r = await BookingWeatherService.check("res-1", "2026-10-02", "2026-10-02", "SELF", T0);
    expect(r).toEqual({ ok: false, reason: "PLACE_NOT_FOUND", location: "Nowhere Land" });
  });

  it("rejects past dates, bad dates and missing listings", async () => {
    seedResource();
    expect(await BookingWeatherService.check("res-1", "2026-09-01", "2026-09-02", "SELF", T0)).toEqual({ ok: false, reason: "PAST_DATES" });
    await expect(BookingWeatherService.check("res-1", "2026-10-05", "2026-10-02", "SELF", T0)).rejects.toMatchObject({ statusCode: 400 });
    await expect(BookingWeatherService.check("res-1", "02/10/2026", "2026-10-02", "SELF", T0)).rejects.toMatchObject({ statusCode: 400 });
    await expect(BookingWeatherService.check("nope", "2026-10-02", "2026-10-02", "SELF", T0)).rejects.toMatchObject({ statusCode: 404 });
  });
});
