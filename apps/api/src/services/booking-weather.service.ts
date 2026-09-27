import { prisma } from "../config/database.js";
import { badRequest, notFound } from "../utils/http-error.js";
import { todayIst } from "./booking-rules.js";
import { parseLocation, titleCase, type Location } from "./rag/request-parser.js";
import { WeatherService, isRainy, OUTDOOR_WORDS, type DailyWeather } from "./rag/weather.service.js";

/**
 * Weather check for a booking: when a renter picks dates, forecast the
 * listing's city for those days and say what the weather means for this
 * particular resource (the rental itself) and for moving it (transport).
 *
 * Advisory only — it never blocks a booking, and there is no platform policy
 * for weather cancellations, so none is promised here. Every number shown
 * comes from the live forecast (see WeatherService); dates beyond the
 * forecast horizon get no impacts, only last year's observed weather as a hint.
 */

export type ImpactLevel = "none" | "low" | "moderate" | "high";

export interface WeatherImpact {
  area: "rental" | "transport";
  level: Exclude<ImpactLevel, "none">;
  title: string;
  detail: string;
  /** IST days it applies to, "YYYY-MM-DD" */
  dates: string[];
}

export type TransportMode = "SELF" | "PROVIDER";

export interface BookingWeatherCheck {
  resourceId: string;
  resourceType: string;
  /** Place the forecast is for ("Pune") */
  location: string;
  source: string;
  fetchedAt: string;
  startDate: string;
  endDate: string;
  /** Last day the provider forecasts */
  horizonEnd: string;
  /** How much of the booking the forecast covers */
  coverage: "full" | "partial" | "none";
  /** Forecast days inside the booking */
  days: DailyWeather[];
  /** Same dates last year, only when no booked day is forecast yet */
  lastYear?: DailyWeather[];
  /** Whether moving the resource is part of this booking */
  transport: { relevant: boolean; mode: TransportMode; ownerProvides: boolean; dates: string[] };
  overall: ImpactLevel;
  impacts: WeatherImpact[];
}

export type BookingWeatherResult =
  | { ok: true; check: BookingWeatherCheck }
  | { ok: false; reason: "NO_LOCATION" | "PLACE_NOT_FOUND" | "UNAVAILABLE" | "PAST_DATES"; location?: string };

// ─── Resource profiles ───────────────────────────────────────────────────

/** Fixed places — nothing is moved, so there is no transport leg */
const VENUES = new Set(["Banquet Hall", "Event Space", "Meeting Space", "Kitchen Facility", "Parking Space"]);
/** Used in the open by nature */
const ALWAYS_OUTDOOR = new Set(["Tent/Canopy", "Parking Space"]);
/** Needs mains or generator power, or is itself electrical */
const ELECTRICAL = new Set(["AV Equipment", "Generator/Power", "Cold Storage", "Kitchen Facility", "Catering Equipment"]);
/** Spoils or stains when wet */
const WATER_SENSITIVE = new Set(["AV Equipment", "Linen/Textile", "Decor Items", "Furniture"]);

const MAX_BOOKING_DAYS = 60;
const DAY_MS = 86_400_000;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

const addDays = (iso: string, n: number) => new Date(new Date(`${iso}T00:00:00Z`).getTime() + n * DAY_MS).toISOString().slice(0, 10);
const shortDay = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
/** Days in date order — impacts combine groups (heavy + moderate rain) that aren't */
const inOrder = (days: DailyWeather[]) => [...days].sort((a, b) => a.date.localeCompare(b.date));
const list = (days: DailyWeather[]) => inOrder(days).map((d) => shortDay(d.date)).join(", ");

const RANK: Record<ImpactLevel, number> = { none: 0, low: 1, moderate: 2, high: 3 };

/** Rain heavy enough to flood roads and soak anything uncovered */
const isHeavyRain = (d: DailyWeather) => d.precipMm >= 20 || (d.precipProbability !== null && d.precipProbability >= 80 && d.precipMm >= 10);

export interface ResourceWeatherProfile {
  resourceType: string;
  name: string;
  description?: string | null;
  transportAvailable: boolean;
}

// ─── Impact rules ────────────────────────────────────────────────────────

/** What the forecast means for using this resource on the booked days. */
export function rentalImpacts(resource: ResourceWeatherProfile, days: DailyWeather[]): WeatherImpact[] {
  const type = resource.resourceType;
  const text = `${resource.name} ${resource.description ?? ""}`.toLowerCase();
  const outdoor = ALWAYS_OUTDOOR.has(type) || OUTDOOR_WORDS.test(text) || /\b(lawn|garden|open ground)\b/.test(text);
  const venue = VENUES.has(type);
  const impacts: WeatherImpact[] = [];
  const add = (level: WeatherImpact["level"], title: string, detail: string, ds: DailyWeather[]) =>
    impacts.push({ area: "rental", level, title, detail, dates: inOrder(ds).map((d) => d.date) });

  const heavy = days.filter(isHeavyRain);
  const rainLikely = days.filter((d) => isRainy(d) === "likely" && !isHeavyRain(d));
  const rainPossible = days.filter((d) => isRainy(d) === "possible");
  const wet = [...heavy, ...rainLikely];
  const thunder = days.filter((d) => d.thunder);
  const veryHot = days.filter((d) => d.tempMaxC >= 40);
  const hot = days.filter((d) => d.tempMaxC >= 35 && d.tempMaxC < 40);
  const gale = days.filter((d) => d.windMaxKmh >= 50);
  const windy = days.filter((d) => d.windMaxKmh >= 35 && d.windMaxKmh < 50);
  const cold = days.filter((d) => d.tempMinC <= 10);

  // Rain
  if (wet.length > 0) {
    const level = heavy.length > 0 ? "high" : "moderate";
    if (type === "Tent/Canopy") {
      add(level, "Rain load on the tent", `Rain is forecast on ${list(wet)}. Ask for waterproof sheeting, side walls and drainage trenches; ${heavy.length > 0 ? "heavy rain can pool on the roof — plan for it to be checked during the event." : "keep guttering clear."}`, wet);
    } else if (outdoor) {
      add(level, "Open-air space will get wet", `Rain is forecast on ${list(wet)}. Book a tent or canopy over the area, or keep an indoor backup ready for those days.`, wet);
    } else if (venue) {
      add(heavy.length > 0 ? "moderate" : "low", "Guest arrival in the rain", `Rain on ${list(wet)} can slow guests and vendors reaching the venue${heavy.length > 0 ? " and cause waterlogging nearby" : ""}. Plan a covered drop-off and allow extra setup time.`, wet);
    } else if (type === "Vehicle") {
      add(level, "Wet roads for the vehicle", `Rain on ${list(wet)} means slower trips and possible waterlogged routes. Build extra travel time into the schedule.`, wet);
    } else if (type === "Staff/Manpower") {
      add(heavy.length > 0 ? "moderate" : "low", "Staff commute may be delayed", `Rain on ${list(wet)} can delay staff arriving. Confirm reporting times with the owner a day ahead.`, wet);
    } else if (WATER_SENSITIVE.has(type)) {
      add(level, "Keep it covered and dry", `Rain on ${list(wet)} can damage ${type === "AV Equipment" ? "electronics" : type.toLowerCase()} used in the open. Use it indoors or under cover — water damage can be raised as a damage claim at return.`, wet);
    } else if (ELECTRICAL.has(type)) {
      add(level, "Protect power and connections", `Rain on ${list(wet)} — keep it on raised ground, under cover, with connections sealed.`, wet);
    } else {
      add("low", "Rain during the rental", `Rain is forecast on ${list(wet)}. Keep the items under cover when not in use.`, wet);
    }
  } else if (rainPossible.length > 0 && (outdoor || WATER_SENSITIVE.has(type) || type === "Tent/Canopy")) {
    add("low", "Showers possible", `Light showers are possible on ${list(rainPossible)}. Keep a cover or canopy on standby.`, rainPossible);
  }

  // Thunderstorms
  if (thunder.length > 0) {
    if (outdoor || type === "Tent/Canopy") {
      add("high", "Thunderstorm risk outdoors", `Thunderstorms are forecast on ${list(thunder)}. Avoid open ground and tall metal frames during the storm, and have a place to move guests indoors.`, thunder);
    } else if (ELECTRICAL.has(type)) {
      add("moderate", "Power cuts and surges", `Thunderstorms on ${list(thunder)} can cause power cuts and surges. Use surge protection and keep generator backup ready.`, thunder);
    } else if (venue) {
      add("moderate", "Possible power cuts at the venue", `Thunderstorms on ${list(thunder)} can knock out power. Check that the venue has generator backup.`, thunder);
    }
  }

  // Wind
  if (gale.length > 0 || windy.length > 0) {
    const worst = Math.max(...[...gale, ...windy].map((d) => d.windMaxKmh));
    if (type === "Tent/Canopy") {
      add(gale.length > 0 ? "high" : "moderate", "Wind load on the tent", `Winds up to ${worst} km/h on ${list([...gale, ...windy])}. The tent must be anchored and guy-roped${gale.length > 0 ? "; at gale strength it may need to be taken down" : ""}.`, [...gale, ...windy]);
    } else if (outdoor || type === "Decor Items") {
      add(gale.length > 0 ? "high" : "moderate", "Strong winds", `Winds up to ${worst} km/h on ${list([...gale, ...windy])} — tie down decor, signage and lightweight furniture.`, [...gale, ...windy]);
    }
  }

  // Heat
  if (veryHot.length > 0 || hot.length > 0) {
    const hotDays = [...veryHot, ...hot];
    const peak = Math.max(...hotDays.map((d) => d.tempMaxC));
    const level = veryHot.length > 0 ? "high" : "moderate";
    if (type === "Cold Storage") {
      add(level, "Cooling works harder", `Up to ${peak}°C on ${list(hotDays)}. The unit will run at full load — keep doors shut, don't overfill, and keep power backup ready.`, hotDays);
    } else if (type === "Staff/Manpower") {
      add(level, "Heat for staff", `Up to ${peak}°C on ${list(hotDays)}. Plan shaded breaks and drinking water for staff working outdoors.`, hotDays);
    } else if (type === "Generator/Power" || type === "AV Equipment") {
      add(veryHot.length > 0 ? "moderate" : "low", "Overheating risk", `Up to ${peak}°C on ${list(hotDays)}. Keep equipment shaded and ventilated.`, hotDays);
    } else if (type === "Vehicle") {
      add("low", "Hot days on the road", `Up to ${peak}°C on ${list(hotDays)}. Confirm the vehicle's AC works before the trip.`, hotDays);
    } else if (outdoor) {
      add(level, "Heat in the open", `Up to ${peak}°C on ${list(hotDays)}. Add shade and fans or coolers, and move outdoor segments to the evening.`, hotDays);
    } else if (type === "Catering Equipment" || type === "Kitchen Facility") {
      add("low", "Keep food chilled", `Up to ${peak}°C on ${list(hotDays)}. Plan cold storage for perishables.`, hotDays);
    }
  }

  // Cold nights
  if (cold.length > 0 && outdoor) {
    add("low", "Cool nights", `Down to ${Math.min(...cold.map((d) => d.tempMinC))}°C on ${list(cold)} — heaters or an indoor option will keep guests comfortable.`, cold);
  }

  return impacts;
}

/** What the forecast means for moving the resource out (first day) and back (last day). */
export function transportImpacts(mode: TransportMode, legs: DailyWeather[], resourceType: string): WeatherImpact[] {
  const impacts: WeatherImpact[] = [];
  const who = mode === "PROVIDER" ? "The owner's delivery" : "Your pickup";
  const whose = mode === "PROVIDER" ? "the owner's driver" : "you";
  const fragile = WATER_SENSITIVE.has(resourceType) || ELECTRICAL.has(resourceType);
  const add = (level: WeatherImpact["level"], title: string, detail: string, ds: DailyWeather[]) =>
    impacts.push({ area: "transport", level, title, detail, dates: inOrder(ds).map((d) => d.date) });

  const heavy = legs.filter(isHeavyRain);
  const rain = legs.filter((d) => isRainy(d) === "likely" && !isHeavyRain(d));
  const thunder = legs.filter((d) => d.thunder);
  const gale = legs.filter((d) => d.windMaxKmh >= 50);
  const veryHot = legs.filter((d) => d.tempMaxC >= 40);

  if (heavy.length > 0) {
    add("high", "Heavy rain on a transport day", `${who} or return on ${list(heavy)} may be delayed by waterlogged roads. Agree a time window with ${mode === "PROVIDER" ? "the owner" : "your driver"}, and ${fragile ? "make sure the goods travel in a closed vehicle or under tarpaulin" : "keep the load covered"}.`, heavy);
  } else if (rain.length > 0) {
    add("moderate", "Rain on a transport day", `Rain is likely on ${list(rain)}. Expect slower traffic; ${fragile ? "the goods must travel covered — water damage in transit is hard to dispute later" : "keep the load covered"}.`, rain);
  }
  if (thunder.length > 0) {
    add("moderate", "Thunderstorm on a transport day", `Storms on ${list(thunder)} — ${whose} should avoid loading or unloading in the open while it passes.`, thunder);
  }
  if (gale.length > 0) {
    add("moderate", "Strong winds on the road", `Winds up to ${Math.max(...gale.map((d) => d.windMaxKmh))} km/h on ${list(gale)} — tall or open loads must be strapped down.`, gale);
  }
  if (veryHot.length > 0 && (resourceType === "Cold Storage" || resourceType === "Catering Equipment")) {
    add("low", "Heat during transit", `Up to ${Math.max(...veryHot.map((d) => d.tempMaxC))}°C on ${list(veryHot)} — move it in the cooler morning or evening.`, veryHot);
  }
  return impacts;
}

// ─── Service ─────────────────────────────────────────────────────────────

export class BookingWeatherService {
  /**
   * Weather check for renting `resourceId` from `startDate` to `endDate`
   * (inclusive IST days). Never throws for weather problems — those come back
   * as a reason. Throws NotFound / Validation for bad input.
   */
  static async check(
    resourceId: string,
    startDate: string,
    endDate: string,
    mode: TransportMode = "SELF",
    now: Date = new Date(),
  ): Promise<BookingWeatherResult> {
    if (!ISO_DAY.test(startDate) || !ISO_DAY.test(endDate)) throw badRequest("Dates must be YYYY-MM-DD");
    if (endDate < startDate) throw badRequest("endDate must not be before startDate");
    if (addDays(startDate, MAX_BOOKING_DAYS - 1) < endDate) throw badRequest(`A weather check covers at most ${MAX_BOOKING_DAYS} days`);

    const resource = await prisma.resource.findFirst({
      where: { id: resourceId, deletedAt: null },
      include: { business: { select: { city: true } } },
    });
    if (!resource) throw notFound("Resource not found");

    const today = todayIst(now).toISOString().slice(0, 10);
    if (endDate < today) return { ok: false, reason: "PAST_DATES" };

    const location = listingLocation(resource.location, resource.business?.city);
    if (!location) return { ok: false, reason: "NO_LOCATION" };

    const place = await WeatherService.geocode(location);
    if (!place) return { ok: false, reason: "PLACE_NOT_FOUND", location: location.label };

    let forecast: Awaited<ReturnType<typeof WeatherService.forecast>>;
    try {
      forecast = await WeatherService.forecast(place);
    } catch (err) {
      console.warn("Booking weather check unavailable:", err instanceof Error ? err.message : err);
      return { ok: false, reason: "UNAVAILABLE", location: place.name };
    }

    const from = startDate < today ? today : startDate;
    const days = forecast.days.filter((d) => d.date >= from && d.date <= endDate);
    const horizonEnd = forecast.days.length > 0 ? forecast.days[forecast.days.length - 1].date : today;
    const coverage = days.length === 0 ? "none" : endDate <= horizonEnd ? "full" : "partial";
    const lastYear = coverage === "none" ? await WeatherService.lastYear(place, from, endDate) : undefined;

    // A venue stays put; anything else is moved out on the first day and back on the last
    const transportRelevant = !VENUES.has(resource.resourceType) || resource.transportAvailable;
    const ownerProvides = resource.transportAvailable;
    const effectiveMode: TransportMode = ownerProvides && mode === "PROVIDER" ? "PROVIDER" : "SELF";
    const legDates = [...new Set([startDate, endDate])];
    const legs = days.filter((d) => legDates.includes(d.date));

    const impacts = [
      ...rentalImpacts(resource, days),
      ...(transportRelevant ? transportImpacts(effectiveMode, legs, resource.resourceType) : []),
    ].sort((a, b) => RANK[b.level] - RANK[a.level]);

    const overall = impacts.reduce<ImpactLevel>((worst, i) => (RANK[i.level] > RANK[worst] ? i.level : worst), "none");

    return {
      ok: true,
      check: {
        resourceId: resource.id,
        resourceType: resource.resourceType,
        location: place.name,
        source: forecast.source,
        fetchedAt: forecast.fetchedAt,
        startDate,
        endDate,
        horizonEnd,
        coverage,
        days,
        lastYear,
        transport: { relevant: transportRelevant, mode: effectiveMode, ownerProvides, dates: legDates },
        overall,
        impacts,
      },
    };
  }
}

/**
 * The place to forecast: the owner's business city when set, else a known
 * city in the listing's free-text location ("Koregaon Park, Pune"), else its
 * last comma-separated part.
 */
export function listingLocation(location: string | null | undefined, businessCity: string | null | undefined): Location | undefined {
  if (businessCity?.trim()) {
    const parsed = parseLocation(businessCity);
    return parsed?.city ? parsed : { label: titleCase(businessCity.trim().toLowerCase()) };
  }
  if (!location?.trim()) return undefined;
  const parsed = parseLocation(location);
  if (parsed?.city) return parsed;
  const last = location.split(",").map((s) => s.trim()).filter(Boolean).pop();
  return last ? { label: titleCase(last.toLowerCase()) } : undefined;
}
