import { prisma } from "../../config/database.js";
import { getCommittedQuantities } from "../capacity.js";
import { inclusiveDays, toCalendarDay } from "../booking-rules.js";
import {
  ANY_CATALOG_ITEM,
  citiesIn,
  parseDateRange,
  parseRequest,
  parseRequirements,
  sameRegion,
  statedCapacity,
  titleCase,
  type Budget,
  type ParsedRequest,
  type ParsedRequirement,
} from "./request-parser.js";
import type { ResourceResultCard } from "./types.js";

/**
 * Inventory answers for the AI Concierge, from live listings only.
 *
 * Each requested item is answered in tiers:
 *   1. MATCH       — the right item, in the requested place, within budget, big enough, free on the dates
 *   2. ALTERNATIVE — the right item but somewhere else / over budget / capacity not stated (always labelled why)
 * and when tier 1 is empty the reply says so explicitly ("No banquet halls are listed in Pune") before
 * offering alternatives. Listings of other item types are never shown, and every number comes from the DB.
 */

type Live = Awaited<ReturnType<typeof loadLiveListings>>[number];

type LocationFit = "EXACT" | "NEARBY" | "ELSEWHERE" | "ANY";
type CapacityFit = "OK" | "TOO_SMALL" | "UNKNOWN" | "N/A";

interface Candidate {
  l: Live;
  free: number;
  city?: string;
  locationFit: LocationFit;
  estimatePaise: number; // rent for the requested quantity and days (deposit excluded)
  withinBudget: boolean | null;
  capacity?: number;
  capacityFit: CapacityFit;
}

export interface RequirementOutcome {
  requirement: ParsedRequirement;
  /** Judged on tier-1 matches: NONE nothing suitable · UNAVAILABLE suitable but booked · PARTIAL not enough · FULL covered */
  status: "NONE" | "UNAVAILABLE" | "PARTIAL" | "FULL";
  totalFree: number;
  cards: ResourceResultCard[];
  alternatives: ResourceResultCard[];
  /** Why tier 1 is empty or short, in order: e.g. ["No banquet halls are listed in Pune."] */
  gaps: string[];
  unavailableTitles: string[];
  tooSmall: Array<{ title: string; capacity: number }>;
}

export interface InventoryAnswer {
  reply: string;
  results: ResourceResultCard[];
  outcomes: RequirementOutcome[];
  request: ParsedRequest;
  /** Kept for callers that only need the start day */
  date?: string;
  location?: string;
}

async function loadLiveListings() {
  // Live, bookable listings only: active, not deleted, from a verified (not suspended) owner.
  return prisma.resource.findMany({
    where: { isActive: true, deletedAt: null, business: { owner: { verificationStatus: "VERIFIED" } } },
    include: {
      availabilityWindows: true,
      business: {
        select: {
          id: true, name: true, city: true, state: true,
          reviewsReceived: { select: { rating: true, reviewerRole: true } },
        },
      },
    },
  });
}

export class ListingRetriever {
  /** True if the message names a known rentable item (whole words only). */
  static mentionsCatalogItem(query: string): boolean {
    return ANY_CATALOG_ITEM.test(query);
  }

  static parseUserRequirements(query: string): ParsedRequirement[] {
    return parseRequirements(query.toLowerCase());
  }

  /** Start day of the requested dates ("YYYY-MM-DD"), if any. */
  static parseRequestedDate(query: string, now: Date = new Date()): string | undefined {
    return parseDateRange(query, now)?.start;
  }

  static parseLocation(query: string): string | undefined {
    return parseRequest(query).location?.label.toLowerCase();
  }

  /**
   * Answer an inventory request from live listings.
   * `dateOverride` (YYYY-MM-DD, from the UI) wins over dates written in the message.
   */
  static async answer(query: string, dateOverride?: string): Promise<InventoryAnswer> {
    return this.answerRequest(parseRequest(query), { dateOverride });
  }

  /**
   * Answer an already-parsed request (e.g. one rebuilt from conversation context).
   * `preface` is a short italic line explaining what was carried over or changed.
   */
  static async answerRequest(
    request: ParsedRequest,
    opts: { dateOverride?: string; preface?: string } = {}
  ): Promise<InventoryAnswer> {
    const dateOverride = opts.dateOverride;
    if (dateOverride) {
      const d = toCalendarDay(dateOverride).toISOString().slice(0, 10);
      request.startDate = d;
      if (!request.endDate || request.endDate < d) request.endDate = d;
    }
    const base = { request, date: request.startDate, location: request.location?.label };

    if (request.requirements.length === 0) {
      return {
        ...base,
        reply:
          `### What are you looking for?\n\n` +
          `Tell me the item and how many you need, for example *"30 chairs and 40 tables on 28th October in Pune"*, ` +
          `and I'll check what is actually listed and free on those dates.`,
        results: [],
        outcomes: [],
      };
    }

    const listings = await loadLiveListings();
    const start = request.startDate ? new Date(`${request.startDate}T00:00:00.000Z`) : null;
    const end = request.endDate ? new Date(`${request.endDate}T00:00:00.000Z`) : start;
    const days = start && end ? inclusiveDays(start, end) : 1;
    const committed = start && end
      ? await getCommittedQuantities(listings.map((l) => l.id), start, end)
      : new Map<string, number>();

    // A budget for several different items is a total for the whole order; judge it at the end.
    const perItemBudget = request.requirements.length === 1 ? request.budget : undefined;

    const outcomes = request.requirements.map((req) =>
      this.evaluate(req, listings, request, { start, end, days, committed, budget: perItemBudget })
    );

    const seen = new Set<string>();
    const results = outcomes
      .flatMap((o) => [...o.cards, ...o.alternatives])
      .filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));

    return { ...base, reply: this.composeReply(outcomes, request, days, opts.preface), results, outcomes };
  }

  /**
   * Answer a question about listings shown earlier in the conversation:
   * "is the first one free on 30th?", "how much is the deposit for it?",
   * "does the owner deliver?", "which is cheaper?".
   */
  static async answerAboutListings(
    ids: string[],
    question: string,
    search: ParsedRequest | undefined,
    opts: { assumed?: boolean } = {}
  ): Promise<InventoryAnswer> {
    const q = question.toLowerCase();
    const live = await loadLiveListings();
    const byId = new Map(live.map((l) => [l.id, l]));
    const targets = ids.map((id) => byId.get(id)).filter((l): l is Live => !!l);
    const gone = ids.length - targets.length;

    const asked = parseDateRange(question);
    const startIso = asked?.start ?? search?.startDate;
    const endIso = asked?.end ?? search?.endDate ?? startIso;
    const start = startIso ? new Date(`${startIso}T00:00:00.000Z`) : null;
    const end = endIso ? new Date(`${endIso}T00:00:00.000Z`) : start;
    const days = start && end ? inclusiveDays(start, end) : 1;
    const committed = start && end
      ? await getCommittedQuantities(targets.map((l) => l.id), start, end)
      : new Map<string, number>();
    const dateReq: ParsedRequest = { ...(search ?? { requirements: [] }), startDate: startIso, endDate: endIso };
    const when = dateText(dateReq);

    const topics = {
      availability: /\b(available|availability|free|booked|open)\b/.test(q) || !!asked,
      price: /\b(price|cost|rent|rate|charges?|how much|expensive|cheap)\b/.test(q),
      deposit: /\bdeposit\b/.test(q),
      location: /\b(where|location|address|located|city|area)\b/.test(q),
      delivery: /\b(deliver(?:y|s)?|transport|pick ?up|drop)\b/.test(q),
      capacity: /\b(capacity|how many (?:guests|people)|fit|big|size|seat|hold)\b/.test(q),
      owner: /\b(owner|who|rating|reviews?|trusted|reliable)\b/.test(q),
      condition: /\b(condition|damage|scratch|wear|quality)\b/.test(q),
      compare: /\b(cheaper|cheapest|better|compare|difference|which one)\b/.test(q),
    };
    const specific = Object.values(topics).some(Boolean);

    if (targets.length === 0) {
      return {
        request: dateReq, results: [], outcomes: [], date: startIso,
        reply: `### That listing is no longer available\n\nIt has been removed or paused by the owner since I showed it. Ask me to search again and I'll check what's live now.`,
      };
    }

    let text = targets.length === 1
      ? `### About ${targets[0].name}\n\n`
      : `### ${topics.compare ? "Comparing" : "About"} ${targets.length} listings\n\n`;
    if (opts.assumed) text += `_You didn't say which one, so this is about **${targets[0].name}**, the first result._\n\n`;

    if (topics.compare && targets.length > 1) {
      const cheapest = [...targets].sort((a, b) => a.rentAmountPaise - b.rentAmountPaise)[0];
      text += `💰 **Cheapest:** [${cheapest.name}](/marketplace/${cheapest.id}) at ${rupees(cheapest.rentAmountPaise)}/day.\n\n`;
    }

    const cards: ResourceResultCard[] = [];
    for (const l of targets) {
      const req = search?.requirements.find((r) => r.pattern.test(`${l.name} ${l.resourceType} ${l.description ?? ""}`)) ?? {
        key: "listing", singular: l.resourceType.toLowerCase(), plural: l.resourceType.toLowerCase(),
        venue: /hall|venue|lawn|banquet|terrace/i.test(l.resourceType), pattern: /./,
      } as ParsedRequirement;

      const free = freeUnits(l, start, end, committed);
      const capacity = statedCapacity(`${l.name} ${l.description ?? ""}`);
      const reviews = (l.business?.reviewsReceived ?? []).filter((r) => r.reviewerRole === "RENTER");
      const rating = reviews.length ? +(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : null;
      const units = req.venue ? 1 : req.quantity ?? 1;
      const lines: string[] = [];

      if (!specific || topics.availability) {
        if (!start) lines.push(`📅 ${l.quantity} in stock. Tell me a date and I'll check how many are free that day.`);
        else if (free > 0) lines.push(`✅ ${req.venue || l.quantity === 1 ? "Available" : `${free} of ${l.quantity} free`}${when}.`);
        else if (l.status !== "available") lines.push(`❌ Not available right now (the owner has marked it ${l.status}).`);
        else lines.push(`❌ Not available${when}: fully booked or outside the owner's availability dates.`);
      }
      if (!specific || topics.price || topics.compare) {
        const per = req.venue || l.quantity === 1 ? "per day" : `per ${l.unit || "unit"} per day`;
        let line = `💰 Rent: **${rupees(l.rentAmountPaise)}** ${per}`;
        if (units > 1 || days > 1) line += ` — ${units > 1 ? `${units} × ` : ""}${days} day${days === 1 ? "" : "s"} ≈ **${rupees(l.rentAmountPaise * units * days)}**`;
        lines.push(`${line}.`);
      }
      if (!specific || topics.deposit || topics.price) {
        lines.push(`🔒 Refundable security deposit: **${l.securityDepositPaise > 0 ? rupees(l.securityDepositPaise) : "none"}**, held in escrow and returned after the return inspection.`);
      }
      if (!specific || topics.location) lines.push(`📍 ${l.location || l.business.city || "Location not given"}.`);
      if (!specific || topics.delivery) {
        lines.push(l.transportAvailable
          ? `🚚 The owner can deliver at **${rupees(l.transportRatePerKmPaise)}/km** (choose owner transport when booking).`
          : `🚚 The owner doesn't offer delivery — you arrange transport.`);
      }
      if (!specific || topics.capacity) {
        if (req.venue) lines.push(capacity ? `👥 Holds up to **${capacity} guests**.` : `👥 Capacity isn't stated in the listing — confirm it with the owner before booking.`);
        else lines.push(`📦 ${l.quantity} ${l.unit || "unit"}${l.quantity === 1 ? "" : "s"} listed in total.`);
      }
      if (!specific || topics.owner) {
        lines.push(`🏢 Listed by **${l.business.name}** · ${rating !== null ? `${rating}★ from ${reviews.length} renter review${reviews.length === 1 ? "" : "s"}` : "no reviews yet"}.`);
      }
      if (!specific || topics.condition) {
        lines.push(l.hasPreExistingDamage
          ? `⚠️ Owner disclosed existing wear: ${l.damageDescription || "see the listing photos"}.`
          : `✨ No damage disclosed by the owner.`);
      }

      if (targets.length > 1) text += `#### [${l.name}](/marketplace/${l.id})\n`;
      text += lines.map((x) => `* ${x}`).join("\n") + "\n\n";

      cards.push(this.toCard(
        {
          l, free: start ? free : l.quantity, city: undefined, locationFit: "ANY",
          estimatePaise: l.rentAmountPaise * units * days, withinBudget: null,
          capacity, capacityFit: "N/A",
        },
        { ...req, quantity: undefined },
        dateReq,
        { days },
        "MATCH"
      ));
    }

    if (gone > 0) text += `_${gone} of the listings you asked about ${gone === 1 ? "is" : "are"} no longer available._\n\n`;
    text += `Open the listing to see photos and request a booking.`;

    return { request: dateReq, results: cards, outcomes: [], date: startIso, reply: text };
  }

  private static evaluate(
    req: ParsedRequirement,
    listings: Live[],
    request: ParsedRequest,
    ctx: { start: Date | null; end: Date | null; days: number; committed: Map<string, number>; budget?: Budget }
  ): RequirementOutcome {
    const loc = request.location;
    const itemText = (l: Live) => `${l.name} ${l.resourceType} ${l.description ?? ""}`;
    const ofType = listings.filter((l) => req.pattern.test(itemText(l)));

    const candidates: Candidate[] = ofType.map((l) => {
      // Free units over the whole requested range
      let free = l.status === "available" ? l.quantity : 0;
      if (ctx.start && ctx.end) {
        const windows = l.availabilityWindows ?? [];
        const covered = windows.length === 0 ||
          windows.some((w) => toCalendarDay(w.fromDate) <= ctx.start! && toCalendarDay(w.toDate) >= ctx.end!);
        free = covered ? Math.max(0, free - (ctx.committed.get(l.id) ?? 0)) : 0;
      }

      // The listing's own location wins; the owner's business city is only a fallback
      const placeText = `${l.location ?? ""} ${l.business.city ?? ""} ${l.business.state ?? ""}`;
      const ownCities = citiesIn(l.location ?? "");
      const cities = ownCities.length > 0 ? ownCities : citiesIn(`${l.business.city ?? ""} ${l.business.state ?? ""}`);
      const city = cities[0];
      let locationFit: LocationFit = "ANY";
      if (loc) {
        if (loc.city) {
          locationFit = cities.includes(loc.city) ? "EXACT"
            : cities.some((c) => sameRegion(c, loc.city!)) ? "NEARBY"
            : "ELSEWHERE";
        } else {
          locationFit = placeText.toLowerCase().includes(loc.label.toLowerCase()) ? "EXACT" : "ELSEWHERE";
        }
      }

      const units = req.venue ? 1 : Math.min(req.quantity ?? 1, Math.max(free, 1));
      const estimatePaise = ctx.budget?.basis === "per_day"
        ? l.rentAmountPaise * (ctx.budget.perUnit ? 1 : units)
        : l.rentAmountPaise * units * ctx.days;
      const withinBudget = ctx.budget ? estimatePaise <= ctx.budget.amountPaise : null;

      const capacity = req.venue ? statedCapacity(`${l.name} ${l.description ?? ""}`) : undefined;
      const capacityFit: CapacityFit = !req.venue || !request.guests ? "N/A"
        : capacity === undefined ? "UNKNOWN"
        : capacity >= request.guests ? "OK" : "TOO_SMALL";

      return { l, free, city, locationFit, estimatePaise, withinBudget, capacity, capacityFit };
    });

    const inPlace = (c: Candidate) => c.locationFit === "EXACT" || c.locationFit === "ANY";
    const fits = (c: Candidate) => c.withinBudget !== false && c.capacityFit !== "TOO_SMALL";

    // Tier 1: right place, fits budget and size, and something free
    const matchesAll = candidates.filter((c) => inPlace(c) && fits(c));
    const primary = matchesAll.filter((c) => c.free > 0).sort(byBest);
    const totalFree = primary.reduce((s, c) => s + c.free, 0);

    // Tier 2: close but not exact — nearby / other city / over budget / (unknown capacity stays in tier 1 with a caveat)
    const alternativesPool = candidates
      .filter((c) => c.free > 0 && c.capacityFit !== "TOO_SMALL" && !primary.includes(c))
      .sort((a, b) => altRank(a) - altRank(b) || byBest(a, b));

    const gaps: string[] = [];
    const where = loc ? ` in **${loc.label}**` : "";
    const budgetText = ctx.budget ? ` within **${rupees(ctx.budget.amountPaise)}**${budgetBasisText(ctx.budget)}` : "";
    const sizeText = request.guests && req.venue ? ` for **${request.guests} guests**` : "";

    if (ofType.length === 0) {
      gaps.push(`No ${req.plural} are listed on HostNexus right now.`);
    } else if (primary.length === 0) {
      const inPlaceAny = candidates.filter(inPlace);
      if (loc && inPlaceAny.length === 0) {
        gaps.push(`No ${req.plural} are listed${where}.`);
      } else if (ctx.budget && inPlaceAny.length > 0 && inPlaceAny.every((c) => c.withinBudget === false)) {
        const cheapest = [...inPlaceAny].sort((a, b) => a.estimatePaise - b.estimatePaise)[0];
        gaps.push(`No ${req.plural}${where}${budgetText}. The cheapest${where ? " there" : ""} is ${rupees(cheapest.estimatePaise)}${estimateBasisText(ctx.budget, ctx.days, req)}.`);
      } else if (request.guests && req.venue && inPlaceAny.length > 0 && inPlaceAny.every((c) => c.capacityFit === "TOO_SMALL")) {
        gaps.push(`No ${req.plural}${where} are big enough${sizeText}.`);
      } else if (matchesAll.length > 0) {
        gaps.push(`${matchesAll.length === 1 ? "The only" : `All ${matchesAll.length}`} matching ${matchesAll.length === 1 ? req.singular : req.plural}${where} ${matchesAll.length === 1 ? "is" : "are"} fully booked or unavailable on your dates.`);
      } else {
        gaps.push(`No ${req.plural}${where}${budgetText}${sizeText} are available.`);
      }
    }

    const toCard = (c: Candidate, tier: "MATCH" | "ALTERNATIVE") => this.toCard(c, req, request, ctx, tier);
    const status: RequirementOutcome["status"] =
      ofType.length === 0 || (primary.length === 0 && matchesAll.length === 0) ? "NONE"
        : primary.length === 0 ? "UNAVAILABLE"
        : req.quantity && !req.venue && totalFree < req.quantity ? "PARTIAL"
        : "FULL";
    return {
      requirement: req,
      status,
      totalFree,
      cards: primary.slice(0, 4).map((c) => toCard(c, "MATCH")),
      // Alternatives only when the direct answer is empty or not enough
      alternatives: status === "FULL" ? [] : alternativesPool.slice(0, 3).map((c) => toCard(c, "ALTERNATIVE")),
      gaps,
      unavailableTitles: matchesAll.filter((c) => c.free === 0).map((c) => c.l.name),
      tooSmall: candidates.filter((c) => c.capacityFit === "TOO_SMALL" && inPlace(c)).map((c) => ({ title: c.l.name, capacity: c.capacity! })),
    };
  }

  private static toCard(
    c: Candidate,
    req: ParsedRequirement,
    request: ParsedRequest,
    ctx: { days: number; budget?: Budget },
    tier: "MATCH" | "ALTERNATIVE"
  ): ResourceResultCard {
    const res = c.l;
    const rentPaise = res.rentAmountPaise || 0;
    const depositPaise = res.securityDepositPaise || 0;
    const countable = !req.venue && (res.quantity > 1 || !!res.unit);
    const unitWord = res.unit || (req.venue ? req.singular : "unit");
    const reviews = (res.business?.reviewsReceived ?? []).filter((r) => r.reviewerRole === "RENTER");
    const rating = reviews.length ? +(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : null;
    const { categoryColor, bg } = categoryVisuals(res.resourceType);
    const dates = dateText(request);

    const match = req.quantity && !req.venue ? Math.min(100, Math.round((c.free / req.quantity) * 100)) : 100;
    const fitLabel = req.quantity && !req.venue
      ? c.free >= req.quantity
        ? `Covers all ${req.quantity} ${req.plural} you need${dates}`
        : `Has ${c.free} of the ${req.quantity} ${req.plural} you need${dates}`
      : countable
        ? `${c.free} ${c.free === 1 ? req.singular : req.plural} free${dates}`
        : `Available${dates}`;

    // Every reason this isn't a perfect fit, stated plainly
    const caveats: string[] = [];
    const loc = request.location;
    if (loc && c.locationFit === "NEARBY") caveats.push(`Near ${loc.label}, not in it${c.city ? ` (${titleCase(c.city)})` : ""}`);
    if (loc && c.locationFit === "ELSEWHERE") caveats.push(`Not in ${loc.label}${c.city ? ` — in ${titleCase(c.city)}` : ""}`);
    if (c.withinBudget === false && ctx.budget) {
      caveats.push(`Over your ${rupees(ctx.budget.amountPaise)} budget by ${rupees(c.estimatePaise - ctx.budget.amountPaise)}`);
    }
    if (c.capacityFit === "UNKNOWN") caveats.push(`Capacity not stated — confirm it fits ${request.guests} guests`);

    const features: string[] = [];
    if (c.capacity) features.push(`Holds ${c.capacity} guests`);
    if (ctx.budget && c.withinBudget) features.push(`Within budget: ${rupees(c.estimatePaise)}${estimateBasisText(ctx.budget, ctx.days, req)}`);
    if (countable && res.quantity > 1) features.push(`${c.free} of ${res.quantity} free${dates}`);
    if (res.transportAvailable) features.push("Owner can deliver");
    features.push(res.hasPreExistingDamage ? "Owner disclosed existing wear" : "No damage disclosed");

    const shown = req.quantity && !req.venue ? Math.min(c.free, req.quantity) : c.free;
    return {
      id: res.id,
      title: res.name,
      business: res.business?.name ?? "",
      businessId: res.businessId,
      location: res.location ?? res.business?.city ?? "",
      price: rentPaise > 0 ? `${rupees(rentPaise)}${countable ? `/${unitWord}` : ""}/day` : "Price on request",
      rentAmountPaise: rentPaise,
      securityDepositPaise: depositPaise,
      securityDeposit: depositPaise > 0 ? rupees(depositPaise) : "None",
      capacity: c.capacity ? `${c.capacity} guests` : `${c.free} free`,
      quantityAvailable: c.free,
      unit: unitWord,
      rating,
      reviewCount: reviews.length,
      match,
      matchedFor: shown === 1 ? req.singular : req.plural,
      requestedQuantity: req.venue ? null : req.quantity ?? null,
      fitLabel,
      tier,
      caveats,
      available: c.free > 0,
      category: res.resourceType,
      categoryColor,
      bg,
      whyChoose: fitLabel,
      features,
      hasPreExistingDamage: res.hasPreExistingDamage,
      damageDescription: res.damageDescription,
      photos: res.photos || [],
    };
  }

  /**
   * One section per requested item: what we understood, the direct answer
   * (including an explicit "none in Pune"), then labelled alternatives.
   */
  private static composeReply(outcomes: RequirementOutcome[], request: ParsedRequest, days: number, preface?: string): string {
    const understood: string[] = [];
    if (request.guests) understood.push(`${request.guests} guests`);
    if (request.location) understood.push(`in ${request.location.label}`);
    if (request.budget) understood.push(`budget ${rupees(request.budget.amountPaise)}${budgetBasisText(request.budget)}`);
    if (request.startDate) understood.push(dateText(request).trim());

    let text = `### Availability${request.location ? ` in ${request.location.label}` : ""}${dateText(request)}\n\n`;
    if (preface) text += `_${preface}_\n\n`;
    if (understood.length > 0) text += `Searching for: ${understood.join(" · ")}\n\n`;

    for (const o of outcomes) {
      const r = o.requirement;
      const need = r.venue
        ? cap(r.singular)
        : r.quantity ? `${r.quantity} ${r.quantity === 1 ? r.singular : r.plural}${r.quantityInferred ? " (one per guest)" : ""}` : cap(r.plural);
      text += `#### ${need}\n`;

      if (o.cards.length > 0) {
        const lead = o.status === "PARTIAL"
          ? `⚠️ Only **${o.totalFree}** free — **${r.quantity! - o.totalFree} short**:`
          : `✅ ${o.cards.length === 1 ? "Found" : `Found ${o.cards.length}`}${request.location ? ` in ${request.location.label}` : ""}:`;
        text += `* ${lead}\n`;
        for (const c of o.cards) text += `* ${listingLine(c)}\n`;
      }
      for (const g of o.gaps) text += `* ❌ ${g}\n`;
      for (const s of o.tooSmall) text += `* ⚠️ ${s.title} holds only ${s.capacity} guests.\n`;

      if (o.alternatives.length > 0) {
        const allElsewhere = o.alternatives.every((a) => a.caveats.some((x) => x.startsWith("Not in") || x.startsWith("Near")));
        const allOver = o.alternatives.every((a) => a.caveats.some((x) => x.startsWith("Over your")));
        const heading = allElsewhere && request.location
          ? `📍 ${cap(r.plural)} available in other places:`
          : allOver ? `💰 Options above your budget:` : `Other options:`;
        text += `* ${heading}\n`;
        for (const a of o.alternatives) text += `* ${listingLine(a)} — ${a.caveats.join("; ")}\n`;
      }
      text += `\n`;
    }

    // A budget for a multi-item order is judged on the cheapest way to fill it
    if (request.budget && outcomes.length > 1) {
      const total = outcomes.reduce((sum, o) => {
        const need = o.requirement.quantity ?? 1;
        let left = need, cost = 0;
        for (const c of [...o.cards].sort((a, b) => a.rentAmountPaise - b.rentAmountPaise)) {
          const take = Math.min(left, c.quantityAvailable);
          cost += take * c.rentAmountPaise * (request.budget!.basis === "per_day" ? 1 : days);
          left -= take;
        }
        return sum + cost;
      }, 0);
      if (total > 0) {
        text += total <= request.budget.amountPaise
          ? `💰 The cheapest way to fill what's available comes to about **${rupees(total)}** — within your ${rupees(request.budget.amountPaise)} budget.\n\n`
          : `💰 The cheapest way to fill what's available comes to about **${rupees(total)}** — **${rupees(total - request.budget.amountPaise)} over** your ${rupees(request.budget.amountPaise)} budget.\n\n`;
      }
    }

    const anyMatch = outcomes.some((o) => o.cards.length > 0);
    const anyAlt = outcomes.some((o) => o.alternatives.length > 0);
    if (anyMatch || anyAlt) {
      text += `Open a listing to request your dates and quantity. You can negotiate the daily rate before the owner accepts; payment is held in escrow until you inspect the items at handover.`;
    } else {
      text += `${request.startDate ? "Try other dates, or c" : "C"}heck back later — new listings are added as businesses join.`;
    }
    if (!request.startDate && anyMatch) {
      text += `\n\n_Tip: tell me the date (e.g. "on 28th October") and I'll check how many are actually free that day._`;
    }
    return text;
  }
}

// ─── helpers ─────────────────────────────────────────────────────────────

/** Units of a listing free over [start, end] (inclusive), respecting status and availability windows. */
function freeUnits(l: Live, start: Date | null, end: Date | null, committed: Map<string, number>): number {
  if (l.status !== "available") return 0;
  if (!start || !end) return l.quantity;
  const windows = l.availabilityWindows ?? [];
  const covered = windows.length === 0 ||
    windows.some((w) => toCalendarDay(w.fromDate) <= start && toCalendarDay(w.toDate) >= end);
  return covered ? Math.max(0, l.quantity - (committed.get(l.id) ?? 0)) : 0;
}

function byBest(a: Candidate, b: Candidate) {
  const cap = (c: Candidate) => (c.capacityFit === "UNKNOWN" ? 1 : 0); // stated capacity first
  return cap(a) - cap(b) || b.free - a.free || a.estimatePaise - b.estimatePaise;
}

function altRank(c: Candidate) {
  // nearby before elsewhere; within budget before over budget
  const loc = c.locationFit === "NEARBY" ? 0 : c.locationFit === "ELSEWHERE" ? 2 : 1;
  return loc * 2 + (c.withinBudget === false ? 1 : 0);
}

function rupees(paise: number) {
  return `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;
}

function budgetBasisText(b: Budget) {
  return b.perUnit ? " per unit/day" : b.basis === "per_day" ? " per day" : "";
}

function estimateBasisText(b: Budget | undefined, days: number, req: ParsedRequirement) {
  if (b?.basis === "per_day") return b.perUnit ? " per unit/day" : " per day";
  const units = !req.venue && req.quantity ? ` for ${req.quantity}` : "";
  return `${units} for ${days} day${days === 1 ? "" : "s"}`;
}

function dateText(request: ParsedRequest) {
  if (!request.startDate) return "";
  if (!request.endDate || request.endDate === request.startDate) return ` on ${formatDate(request.startDate)}`;
  return ` from ${formatDate(request.startDate)} to ${formatDate(request.endDate)}`;
}

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function listingLine(c: ResourceResultCard) {
  const where = c.location ? ` · ${c.location}` : "";
  const size = c.features.find((f) => f.startsWith("Holds "));
  return `[${c.title}](/marketplace/${c.id})${where} · ${c.price}${c.requestedQuantity ? ` · ${c.quantityAvailable} free` : ""}${size ? ` · ${size.toLowerCase()}` : ""}`;
}

function categoryVisuals(category: string): { categoryColor: string; bg: string } {
  const cat = (category || "").toLowerCase();
  if (cat.includes("banquet") || cat.includes("ballroom")) {
    return { categoryColor: "bg-violet-100 text-violet-700", bg: "bg-gradient-to-br from-violet-50 to-indigo-50" };
  }
  if (cat.includes("furniture") || cat.includes("chair") || cat.includes("table")) {
    return { categoryColor: "bg-amber-100 text-amber-800", bg: "bg-gradient-to-br from-amber-50 to-orange-50" };
  }
  if (cat.includes("kitchen") || cat.includes("catering") || cat.includes("crockery")) {
    return { categoryColor: "bg-emerald-100 text-emerald-800", bg: "bg-gradient-to-br from-emerald-50 to-teal-50" };
  }
  if (cat.includes("av") || cat.includes("audio") || cat.includes("sound")) {
    return { categoryColor: "bg-blue-100 text-blue-700", bg: "bg-gradient-to-br from-blue-50 to-cyan-50" };
  }
  if (cat.includes("event space") || cat.includes("terrace") || cat.includes("lawn")) {
    return { categoryColor: "bg-rose-100 text-rose-700", bg: "bg-gradient-to-br from-rose-50 to-pink-50" };
  }
  return { categoryColor: "bg-stone-100 text-stone-700", bg: "bg-gradient-to-br from-stone-50 to-slate-50" };
}
