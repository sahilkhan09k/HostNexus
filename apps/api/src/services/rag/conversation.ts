import {
  isCatalogKey,
  parseRequest,
  requirementFromKey,
  titleCase,
  type Budget,
  type ParsedRequest,
} from "./request-parser.js";
import type { QueryIntent } from "./types.js";

/**
 * Conversation memory for the concierge.
 *
 * The server stays stateless: every reply returns a small `ConciergeContext`
 * (the last search's criteria and the listings shown), the chat sends it back
 * with the next message, and "Start New Conversation" simply drops it. That is
 * enough to resolve follow-ups like "what about Mumbai?", "make it 50",
 * "and 40 tables?" or "is the first one free on the 30th?".
 */

export interface SearchContext {
  items: Array<{ key: string; quantity?: number; inferred?: boolean }>;
  guests?: number;
  location?: { label: string; city?: string };
  budget?: Budget;
  startDate?: string;
  endDate?: string;
}

export interface ConciergeContext {
  v: 1;
  lastIntent?: QueryIntent;
  /** The last user message, for policy follow-ups ("and who decides?") */
  lastUserMessage?: string;
  search?: SearchContext;
  /** Listing ids shown in the last inventory answer, in display order */
  resultIds?: string[];
  /** The last weather lookup, so "and tomorrow?" / "what about Mumbai?" can follow it */
  weather?: { location: { label: string; city?: string }; startDate?: string; endDate?: string };
}

export type FollowUp =
  | { kind: "SEARCH"; request: ParsedRequest; carried: string[]; changed: string[] }
  | { kind: "ABOUT_RESULTS"; targetIds: string[]; assumed: boolean; question: string }
  | { kind: "NONE" };

export function toSearchContext(req: ParsedRequest): SearchContext {
  return {
    items: req.requirements.map((r) => ({
      key: r.key,
      ...(r.quantity !== undefined ? { quantity: r.quantity } : {}),
      ...(r.quantityInferred ? { inferred: true } : {}),
    })),
    guests: req.guests,
    location: req.location,
    budget: req.budget,
    startDate: req.startDate,
    endDate: req.endDate,
  };
}

export function fromSearchContext(ctx: SearchContext): ParsedRequest {
  return {
    requirements: ctx.items
      .map((i) => requirementFromKey(i.key, i.quantity, i.inferred))
      .filter((r): r is NonNullable<typeof r> => !!r),
    guests: ctx.guests,
    location: ctx.location,
    budget: ctx.budget,
    startDate: ctx.startDate,
    endDate: ctx.endDate,
  };
}

// ─── Cues ───────────────────────────────────────────────────────────────

const CLEAR_LOCATION = /\b(anywhere|any (?:city|location|place)|all cities|other cities|every city)\b/;
const CLEAR_BUDGET = /\b(?:no|any|without(?: a| any)?)\s+(?:budget|price)(?:\s+limit)?\b|\bno (?:price )?limit\b|\bbudget doesn'?t matter\b/;
const CLEAR_DATES = /\b(any (?:date|day)|no (?:fixed )?date|whenever|flexible dates?)\b/;
const REFINE_CUE = /^\s*(what|how)\s+about\b|\binstead\b|^\s*(and|also|plus|but)\b|\bsame\b|\bmake it\b|\bchange (?:it|that|the)\b|\b(?:only|just) need\b|^\s*(?:in|at|on|for|under|below|within|near)\b/;
/** Words that point back at listings already shown */
const REFERENCE = /\b(it|its|that|this|these|those|them|they|one|ones|first|second|third|fourth|last|1st|2nd|3rd|4th|both|either|the (?:hall|listing|venue|place|option|chairs?|tables?|item|owner|seller|provider)s?)\b/;
/** What people ask about a listing they've seen */
const ATTRIBUTE_Q = /\b(available|availability|free|booked|open|price|cost|rent|rate|charges?|how much|deposit|where|location|address|located|deliver(?:y|s)?|transport|pick ?up|capacity|how many (?:guests|people)|fit|big|size|owner|who|rating|reviews?|condition|details?|more about|tell me|cheaper|cheapest|better|compare|difference)\b/;

const ORDINALS: Array<[RegExp, (n: number) => number]> = [
  [/\b(first|1st)\b/, () => 0],
  [/\b(second|2nd)\b/, () => 1],
  [/\b(third|3rd)\b/, () => 2],
  [/\b(fourth|4th)\b/, () => 3],
  [/\blast\b/, (n) => n - 1],
];

/**
 * Decide how a message relates to the conversation so far.
 * `intent` is the message's stand-alone intent; policy intents (damage,
 * escrow, negotiation) are left to the policy engine unless the message is
 * clearly asking about a listing already shown.
 */
export function resolveFollowUp(
  message: string,
  ctx: ConciergeContext | undefined,
  intent: QueryIntent,
  listingTitles: Map<string, string>,
  now: Date = new Date()
): FollowUp {
  const text = message.toLowerCase().trim();
  const cur = parseRequest(message, now);
  const catalogItems = cur.requirements.filter((r) => isCatalogKey(r.key));
  const prev = ctx?.search ? fromSearchContext(ctx.search) : undefined;
  const resultIds = ctx?.resultIds ?? [];

  // 1. A question about listings already shown ("is the first one free on 30th?", "deposit for it?").
  //    Naming a shown listing wins even if its name contains an item word ("Chiavari Chairs").
  const byName = resultIds.filter((id) => {
    const title = listingTitles.get(id)?.toLowerCase();
    return title && title.length >= 3 && text.includes(title);
  });
  if (resultIds.length > 0 && (catalogItems.length === 0 || byName.length > 0)) {
    const mentionsRef = byName.length > 0 || REFERENCE.test(text);
    const pointsAtOne = byName.length > 0 || ORDINALS.some(([re]) => re.test(text));
    // "and the second one?" repeats the previous question for another listing
    const repeatsLast =
      pointsAtOne && !ATTRIBUTE_Q.test(text) && !cur.startDate &&
      ctx?.lastIntent === "listing_inquiry" && !!ctx.lastUserMessage && ATTRIBUTE_Q.test(ctx.lastUserMessage.toLowerCase());
    if (repeatsLast) message = `${ctx!.lastUserMessage} — ${message}`;
    if (mentionsRef && (ATTRIBUTE_Q.test(text) || cur.startDate || repeatsLast)) {
      let targets = byName;
      let assumed = false;
      if (targets.length === 0) {
        const ord = ORDINALS.find(([re]) => re.test(text));
        if (ord) {
          const i = ord[1](resultIds.length);
          targets = resultIds[i] ? [resultIds[i]] : [];
        } else if (/\b(both|these|those|them|they|all|either|ones|compare|cheaper|cheapest|better|difference)\b/.test(text)) {
          targets = resultIds.slice(0, 4);
        } else {
          targets = [resultIds[0]];
          assumed = resultIds.length > 1;
        }
      }
      if (targets.length > 0) return { kind: "ABOUT_RESULTS", targetIds: targets, assumed, question: message };
    }
  }

  // Policy questions stand on their own ("what if it gets damaged?", "how does escrow work?")
  if (intent === "damage_inquiry" || intent === "negotiation_inquiry" || intent === "payment_escrow_inquiry") {
    return { kind: "NONE" };
  }

  // 2. A new item in the same conversation ("and 40 tables?", "I also need a kitchen")
  if (catalogItems.length > 0 || (intent === "listing_inquiry" && cur.requirements.length > 0)) {
    const request: ParsedRequest = { ...cur };
    const carried: string[] = [];
    if (prev) {
      if (!cur.location && !CLEAR_LOCATION.test(text) && prev.location) {
        request.location = prev.location;
        carried.push(`in ${prev.location.label}`);
      }
      if (!cur.startDate && !CLEAR_DATES.test(text) && prev.startDate) {
        request.startDate = prev.startDate;
        request.endDate = prev.endDate;
        carried.push(dateLabel(prev.startDate, prev.endDate));
      }
      if (!cur.guests && prev.guests) {
        request.guests = prev.guests;
        carried.push(`${prev.guests} guests`);
        for (const r of request.requirements) {
          if (r.key === "chair" && r.quantity === undefined) { r.quantity = prev.guests; r.quantityInferred = true; }
        }
      }
      // A budget belongs to the item it was set for
      const sameItems = sameKeys(prev.requirements.map((r) => r.key), request.requirements.map((r) => r.key));
      if (!cur.budget && !CLEAR_BUDGET.test(text) && prev.budget && sameItems) {
        request.budget = prev.budget;
        carried.push(`budget ${rupees(prev.budget.amountPaise)}`);
      }
    }
    return { kind: "SEARCH", request, carried, changed: [] };
  }

  // 3. A refinement of the last search ("what about Mumbai?", "make it 50", "under 30k", "on 5th Nov instead")
  if (prev && prev.requirements.length > 0) {
    const quantity = bareQuantity(text);
    const clearsSomething = CLEAR_LOCATION.test(text) || CLEAR_BUDGET.test(text) || CLEAR_DATES.test(text);
    const hasCriteria = !!(cur.location || cur.budget || cur.startDate || cur.guests || quantity !== undefined || clearsSomething);
    const looksLikeFollowUp = hasCriteria && (REFINE_CUE.test(text) || text.split(/\s+/).length <= 8);

    if (looksLikeFollowUp) {
      const request: ParsedRequest = {
        ...prev,
        requirements: prev.requirements.map((r) => ({ ...r })),
      };
      const changed: string[] = [];

      if (cur.location) { request.location = cur.location; changed.push(`now in **${cur.location.label}**`); }
      else if (CLEAR_LOCATION.test(text)) { request.location = undefined; changed.push("in **any city**"); }

      if (cur.budget) { request.budget = cur.budget; changed.push(`budget **${rupees(cur.budget.amountPaise)}**`); }
      else if (CLEAR_BUDGET.test(text)) { request.budget = undefined; changed.push("**no budget limit**"); }

      if (cur.startDate) {
        request.startDate = cur.startDate;
        request.endDate = cur.endDate;
        changed.push(`**${dateLabel(cur.startDate, cur.endDate)}**`);
      } else if (CLEAR_DATES.test(text)) {
        request.startDate = undefined;
        request.endDate = undefined;
        changed.push("**any date**");
      }

      if (cur.guests) {
        request.guests = cur.guests;
        changed.push(`**${cur.guests} guests**`);
        for (const r of request.requirements) if (r.key === "chair" && r.quantityInferred) r.quantity = cur.guests;
      }

      if (quantity !== undefined) {
        // "make it 50" applies to the one countable item being searched
        const countable = request.requirements.filter((r) => !r.venue);
        if (countable.length === 1) {
          countable[0].quantity = quantity;
          countable[0].quantityInferred = false;
          changed.push(`**${quantity} ${quantity === 1 ? countable[0].singular : countable[0].plural}**`);
        }
      }

      if (changed.length > 0) return { kind: "SEARCH", request, carried: [], changed };
    }
  }

  return { kind: "NONE" };
}

/** "make it 50", "50 instead", "only 20", "actually 45" → the number; ignores dates, money and guests. */
function bareQuantity(text: string): number | undefined {
  const m =
    text.match(/\bmake (?:it|that) (\d[\d,]{0,6})\b(?!\s*(?:guests?|pax|people|k\b|lakh|%))/) ??
    text.match(/\b(?:change (?:it|that|the quantity) to|only need|just need|need only|actually)\s+(\d[\d,]{0,6})\b(?!\s*(?:guests?|pax|people|k\b|lakh|%|st|nd|rd|th))/) ??
    text.match(/^\s*(?:only |just )?(\d[\d,]{0,6})\s*(?:units?|pieces?|pcs|nos)?\s*(?:instead|please|then)?\s*[?.!]*\s*$/) ??
    text.match(/\b(\d[\d,]{0,6})\s+instead\b/);
  if (!m) return undefined;
  const n = parseInt(m[1].replace(/,/g, ""), 10);
  return n > 0 ? n : undefined;
}

function sameKeys(a: string[], b: string[]) {
  return a.length === b.length && a.every((k) => b.includes(k));
}

function rupees(paise: number) {
  return `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;
}

function dateLabel(start?: string, end?: string) {
  const f = (iso: string) =>
    new Date(`${iso}T00:00:00.000Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
  if (!start) return "";
  return !end || end === start ? `on ${f(start)}` : `${f(start)} – ${f(end)}`;
}

export { titleCase };
