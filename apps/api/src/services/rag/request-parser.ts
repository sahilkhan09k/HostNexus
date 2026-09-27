import { todayIst } from "../booking-rules.js";

/**
 * Turns a free-text rental request ("a banquet hall for 300 guests in Pune
 * under ₹50,000 from 28th to 30th October") into structured criteria. Every
 * criterion is shown back to the user, so a misunderstanding is visible
 * instead of silently producing wrong matches.
 */

export interface ItemSpec {
  key: string;
  singular: string;
  plural: string;
  /** Word alternatives (matched on word boundaries) */
  terms: string;
  /** A venue: judged by guest capacity rather than a unit count */
  venue?: boolean;
}

export const ITEM_CATALOG: ItemSpec[] = [
  { key: "chair", singular: "chair", plural: "chairs", terms: "chairs?|chiavari|armchairs?|stools?" },
  { key: "table", singular: "table", plural: "tables", terms: "tables?" },
  { key: "bench", singular: "bench", plural: "benches", terms: "bench(?:es)?" },
  { key: "sofa", singular: "sofa", plural: "sofas", terms: "sofas?|couch(?:es)?|lounge seating" },
  { key: "banquet_hall", singular: "banquet hall", plural: "banquet halls", terms: "banquet(?: halls?)?|ballrooms?|halls?|venues?|event spaces?|party halls?|marriage halls?|wedding halls?", venue: true },
  { key: "lawn", singular: "lawn", plural: "lawns", terms: "lawns?|gardens?|open grounds?|terraces?|rooftops?", venue: true },
  { key: "kitchen", singular: "kitchen", plural: "kitchens", terms: "kitchens?|cooking stations?" },
  { key: "av", singular: "AV / sound setup", plural: "AV / sound equipment", terms: "av|audio|sound systems?|speakers?|projectors?|microphones?|mics?|led walls?|dj setups?" },
  { key: "lighting", singular: "lighting setup", plural: "lighting", terms: "lights?|lighting" },
  { key: "tent", singular: "tent", plural: "tents", terms: "tents?|canopy|canopies|shamianas?|marquees?", venue: true },
  { key: "vehicle", singular: "vehicle", plural: "vehicles", terms: "vehicles?|vans?|bus|buses|coach(?:es)?|cars?|tempos?|trucks?" },
  { key: "cold_storage", singular: "cold storage unit", plural: "cold storage", terms: "cold storage|refrigerators?|fridges?|freezers?|chillers?" },
  { key: "crockery", singular: "crockery set", plural: "crockery", terms: "crockery|plates?|cutlery|glassware|dinner sets?" },
  { key: "linen", singular: "linen", plural: "linen", terms: "linens?|tablecloths?|napkins?|bedsheets?" },
  { key: "generator", singular: "generator", plural: "generators", terms: "generators?|gensets?|dg sets?" },
  { key: "decor", singular: "decor", plural: "decor", terms: "decor|decorations?|flowers?|floral|dance floors?|stages?" },
];

const GUEST_WORDS = "guests?|pax|people|persons?|attendees?|heads?|covers?|members?";

// ─── Cities ──────────────────────────────────────────────────────────────

/** Canonical city → spellings users and listings use */
const CITY_ALIASES: Record<string, string[]> = {
  "mumbai": ["mumbai", "bombay"],
  "navi mumbai": ["navi mumbai", "new bombay", "vashi", "nerul", "belapur", "kharghar", "airoli"],
  "thane": ["thane"], "panvel": ["panvel", "new panvel"], "kalyan": ["kalyan"], "dombivli": ["dombivli"],
  "bhiwandi": ["bhiwandi"], "vasai": ["vasai", "virar"],
  "pune": ["pune", "poona"], "pimpri chinchwad": ["pimpri chinchwad", "pimpri", "chinchwad", "pcmc"], "hinjewadi": ["hinjewadi"],
  "delhi": ["delhi", "new delhi"], "gurgaon": ["gurgaon", "gurugram"], "noida": ["noida", "greater noida"],
  "ghaziabad": ["ghaziabad"], "faridabad": ["faridabad"],
  "bangalore": ["bangalore", "bengaluru"], "hyderabad": ["hyderabad"], "secunderabad": ["secunderabad"],
  "chennai": ["chennai", "madras"], "kolkata": ["kolkata", "calcutta"], "ahmedabad": ["ahmedabad"],
  "gandhinagar": ["gandhinagar"], "surat": ["surat"], "vadodara": ["vadodara", "baroda"], "jaipur": ["jaipur"],
  "udaipur": ["udaipur"], "lucknow": ["lucknow"], "kanpur": ["kanpur"], "nagpur": ["nagpur"], "nashik": ["nashik", "nasik"],
  "aurangabad": ["aurangabad", "chhatrapati sambhajinagar"], "kolhapur": ["kolhapur"], "satara": ["satara"],
  "lonavala": ["lonavala", "lonavla"], "mahabaleshwar": ["mahabaleshwar"], "indore": ["indore"], "bhopal": ["bhopal"],
  "chandigarh": ["chandigarh"], "mohali": ["mohali"], "ludhiana": ["ludhiana"], "amritsar": ["amritsar"],
  "dehradun": ["dehradun"], "kochi": ["kochi", "cochin"], "thiruvananthapuram": ["thiruvananthapuram", "trivandrum"],
  "goa": ["goa", "panaji", "panjim"], "coimbatore": ["coimbatore"], "madurai": ["madurai"], "mysore": ["mysore", "mysuru"],
  "visakhapatnam": ["visakhapatnam", "vizag"], "patna": ["patna"], "bhubaneswar": ["bhubaneswar"], "raipur": ["raipur"],
  "ranchi": ["ranchi"], "guwahati": ["guwahati"], "agra": ["agra"], "varanasi": ["varanasi", "banaras"],
};

/** Cities close enough to offer as "nearby" */
const REGIONS: string[][] = [
  ["mumbai", "navi mumbai", "thane", "panvel", "kalyan", "dombivli", "bhiwandi", "vasai"],
  ["pune", "pimpri chinchwad", "hinjewadi", "lonavala"],
  ["delhi", "gurgaon", "noida", "ghaziabad", "faridabad"],
  ["hyderabad", "secunderabad"],
  ["chandigarh", "mohali"],
  ["ahmedabad", "gandhinagar"],
];

const ALIAS_LIST: Array<[string, string]> = Object.entries(CITY_ALIASES)
  .flatMap(([canon, names]) => names.map((n) => [n, canon] as [string, string]))
  .sort((a, b) => b[0].length - a[0].length); // longest first: "navi mumbai" before "mumbai"

/** Known cities named in a text, longest match first (so "Navi Mumbai" isn't also "Mumbai"). */
export function citiesIn(text: string): string[] {
  let rest = ` ${text.toLowerCase().replace(/[^a-z\s]/g, " ")} `;
  const found: string[] = [];
  for (const [alias, canon] of ALIAS_LIST) {
    const re = new RegExp(`\\s${alias.replace(/ /g, "\\s+")}\\s`);
    if (re.test(rest)) {
      if (!found.includes(canon)) found.push(canon);
      rest = rest.replace(new RegExp(`\\s${alias.replace(/ /g, "\\s+")}\\s`, "g"), "  ");
    }
  }
  return found;
}

export function sameRegion(a: string, b: string): boolean {
  return REGIONS.some((r) => r.includes(a) && r.includes(b));
}

// ─── Parsed request ──────────────────────────────────────────────────────

export interface ParsedRequirement {
  key: string;
  singular: string;
  plural: string;
  venue: boolean;
  quantity?: number;
  /** true when the quantity was inferred (e.g. one chair per guest) */
  quantityInferred?: boolean;
  pattern: RegExp;
}

export interface Budget {
  amountPaise: number;
  /** "total" = rent for the whole booking; "per_day" = rent per day */
  basis: "total" | "per_day";
  /** true when the budget is for each unit ("₹100 per chair") */
  perUnit: boolean;
}

export interface Location {
  /** What the user typed, for messages ("Pune") */
  label: string;
  /** Canonical known city, if recognised */
  city?: string;
}

export interface ParsedRequest {
  requirements: ParsedRequirement[];
  guests?: number;
  location?: Location;
  budget?: Budget;
  /** Inclusive IST calendar days, "YYYY-MM-DD" */
  startDate?: string;
  endDate?: string;
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MONTH_RE = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";

const STOPWORDS = new Set([
  "i", "we", "me", "my", "our", "us", "you", "want", "wants", "need", "needs", "needed", "would", "like", "to", "order",
  "rent", "renting", "hire", "book", "booking", "for", "on", "the", "a", "an", "some", "please", "pls", "in", "at", "of",
  "and", "with", "get", "find", "looking", "look", "show", "any", "is", "are", "there", "do", "have", "has", "can",
  "could", "will", "be", "event", "events", "date", "day", "days", "from", "till", "until", "by", "this", "next",
  "weekend", "week", "today", "tomorrow", "available", "availability", "units", "unit", "pieces", "piece", "pcs", "nos",
  "number", "hi", "hello", "hey", "also", "or", "about", "around", "near", "what", "which", "how", "much", "many",
  "price", "cost", "cheap", "cheapest", "best", "good", "urgent", "urgently", "asap", "st", "nd", "rd", "th", "it",
  "them", "that", "these", "those", "your", "list", "listing", "listings", "item", "items", "stuff", "things",
  "under", "below", "within", "less", "than", "max", "maximum", "upto", "up", "budget", "rs", "inr", "per", "each",
  "lakh", "lakhs", "lac", "k", "thousand", "crore", "wedding", "party", "function", "conference", "meeting",
  "anywhere", "city", "cities", "nearby", "near", "me",
  "cheaper", "cheapest", "bigger", "smaller", "larger", "instead", "same", "else", "other", "another", "options",
  "option", "alternatives", "alternative", "ones", "one", "more", "first", "second", "third", "last", "again",
  "only", "just", "then", "now", "plus", "too", "okay", "ok", "yes", "yeah", "thanks", "thank", "make", "change",
  "actually", "rather", "both", "all", "else", "limit", "tell", "details", "detail", "deposit", "rent", "rate",
  "free", "booked", "open", "does", "did", "was", "were", "they", "their", "its", "he", "she", "then", "sure",
  ...MONTHS, "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "sept", "oct", "nov", "dec",
  ...GUEST_WORDS.split("|").map((w) => w.replace(/\?$/, "").replace(/s\?$/, "")),
  "guests", "persons", "attendees", "heads", "covers", "members",
]);

/** Words that end a free-text place name: "in Pune under ₹50,000" → "Pune" */
const PLACE_STOP = /\b(on|for|by|from|this|next|tomorrow|today|with|and|under|below|within|less|max|maximum|up|upto|budget|between|during|around|near|at|to|till|until|of|per|each|that|which|who|asap|urgently|please)\b/;

const wordRe = (terms: string) => new RegExp(`\\b(?:${terms})\\b`, "i");
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const ANY_CATALOG_ITEM = wordRe(ITEM_CATALOG.map((s) => s.terms).join("|"));

export function parseRequest(query: string, now: Date = new Date()): ParsedRequest {
  const text = query.toLowerCase();
  const guests = parseGuests(text);
  const requirements = parseRequirements(text);

  // "chairs for 300 guests" → 300 chairs (one per guest) when no count was given
  if (guests) {
    for (const r of requirements) {
      if (r.key === "chair" && r.quantity === undefined) {
        r.quantity = guests;
        r.quantityInferred = true;
      }
    }
  }

  const range = parseDateRange(text, now);
  return {
    requirements,
    guests,
    location: parseLocation(text),
    budget: parseBudget(text),
    startDate: range?.start,
    endDate: range?.end,
  };
}

/** Rebuild a requirement from its key ("chair", "banquet_hall", "free:photographer"). */
export function requirementFromKey(key: string, quantity?: number, quantityInferred?: boolean): ParsedRequirement | undefined {
  const spec = ITEM_CATALOG.find((s) => s.key === key);
  if (spec) {
    return {
      key: spec.key, singular: spec.singular, plural: spec.plural, venue: !!spec.venue,
      quantity, quantityInferred, pattern: wordRe(spec.terms),
    };
  }
  const stem = key.startsWith("free:") ? key.slice(5) : "";
  if (!/^[a-z][a-z-]{1,40}$/.test(stem)) return undefined;
  return {
    key, singular: stem, plural: `${stem}s`, venue: false, quantity, quantityInferred,
    pattern: wordRe(`${escapeRe(stem)}(?:s|es)?`),
  };
}

export function isCatalogKey(key: string): boolean {
  return ITEM_CATALOG.some((s) => s.key === key);
}

export function parseGuests(text: string): number | undefined {
  const m = text.toLowerCase().match(new RegExp(`(\\d[\\d,]{0,6})\\s*\\+?\\s*(?:${GUEST_WORDS})\\b`));
  return m ? parseInt(m[1].replace(/,/g, ""), 10) : undefined;
}

export function parseRequirements(text: string): ParsedRequirement[] {
  const found: Array<ParsedRequirement & { at: number }> = [];

  for (const spec of ITEM_CATALOG) {
    const re = new RegExp(`\\b(?:${spec.terms})\\b`, "gi");
    let m: RegExpExecArray | null;
    let quantity: number | undefined;
    let at = -1;
    let lastEnd = -1;
    while ((m = re.exec(text))) {
      // "chiavari chairs" / "banquet hall" is one mention, not two
      const adjacent = lastEnd >= 0 && text.slice(lastEnd, m.index).trim() === "";
      lastEnd = m.index + m[0].length;
      if (adjacent) continue;
      if (at < 0) at = m.index;
      // A count up to two words before the item: "30 chairs", "1,000 plastic chairs", "40 round tables"
      const before = text.slice(Math.max(0, m.index - 40), m.index);
      const q = before.match(/(?<![₹\d,.])(\d[\d,]{0,6})\s*(?:x\s*)?((?:[a-z-]+\s+){0,2})$/);
      // …but not a guest count ("300 pax hall") or money ("₹5000 hall")
      if (q && !new RegExp(`\\b(?:${GUEST_WORDS})\\b`).test(q[2]) && !/(rs\.?|inr|₹)\s*$/.test(before.slice(0, before.length - q[0].length))) {
        quantity = (quantity ?? 0) + parseInt(q[1].replace(/,/g, ""), 10);
      }
    }
    if (at >= 0) {
      found.push({
        key: spec.key, singular: spec.singular, plural: spec.plural, venue: !!spec.venue,
        quantity, pattern: wordRe(spec.terms), at,
      });
    }
  }

  if (found.length === 0) {
    // Not in the catalog: each remaining content word is treated as the item ("a photographer", "5 mattresses").
    const words = text.replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter(Boolean);
    const cities = new Set(citiesIn(text).flatMap((c) => CITY_ALIASES[c] ?? [c]).flatMap((n) => n.split(" ")));
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if (STOPWORDS.has(w) || cities.has(w) || /^\d/.test(w) || w.length < 3) continue;
      const stem = w.replace(/(?:es|s)$/, "");
      const prev = words[i - 1];
      found.push({
        key: `free:${stem}`,
        singular: stem,
        plural: w.endsWith("s") ? w : `${w}s`,
        venue: false,
        quantity: prev && /^\d{1,6}$/.test(prev) ? parseInt(prev, 10) : undefined,
        pattern: wordRe(`${escapeRe(stem)}(?:s|es)?`),
        at: i,
      });
    }
  }

  return found.sort((a, b) => a.at - b.at).map(({ at: _at, ...r }) => r);
}

export function parseLocation(text: string): Location | undefined {
  const lower = text.toLowerCase();
  if (/\b(anywhere|any city|all cities|any location)\b/.test(lower)) return undefined;

  // 1. A known city anywhere in the message ("Pune banquet hall", "in Bombay")
  const known = citiesIn(lower);
  if (known.length > 0) {
    const canon = known[0];
    return { label: titleCase(canon), city: canon };
  }

  // 2. "in / at / near <place>" for places we don't know (localities, small towns)
  const m = lower.match(/\b(?:in|at|near|around)\s+([a-z][a-z .'-]{1,40})/);
  if (!m) return undefined;
  let place = m[1];
  const stop = place.match(PLACE_STOP);
  if (stop && stop.index !== undefined) place = place.slice(0, stop.index);
  place = place.replace(/[.\s'-]+$/, "").trim();
  const first = place.split(/\s+/)[0];
  if (!place || STOPWORDS.has(first) || MONTHS.some((mn) => mn.startsWith(first.slice(0, 3)) && first.length >= 3)) return undefined;
  if (["bulk", "total", "stock", "advance", "cash", "person"].includes(first)) return undefined;
  return { label: titleCase(place) };
}

export function parseBudget(text: string): Budget | undefined {
  const lower = text.toLowerCase();
  const amount = String.raw`(?:rs\.?|inr|₹)?\s*(\d[\d,]*(?:\.\d+)?)\s*(k|thousand|lakhs?|lacs?|l|cr|crores?)?\b`;
  const m =
    lower.match(new RegExp(`(?:under|below|within|less than|max(?:imum)?(?: of)?|up ?to|not more than|not exceeding|budget(?: of| is|:)?|<=?)\\s*${amount}`)) ??
    lower.match(new RegExp(`(?:rs\\.?|inr|₹)\\s*(\\d[\\d,]*(?:\\.\\d+)?)\\s*(k|thousand|lakhs?|lacs?|l|cr|crores?)?\\s*budget`));
  if (!m) return undefined;

  let rupees = parseFloat(m[1].replace(/,/g, ""));
  const unit = m[2] ?? "";
  if (unit === "k" || unit === "thousand") rupees *= 1_000;
  else if (/^(lakh|lac|l)/.test(unit)) rupees *= 100_000;
  else if (/^(cr|crore)/.test(unit)) rupees *= 10_000_000;
  if (!(rupees > 0)) return undefined;

  const after = lower.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 25);
  const perDay = /^\s*(?:\/|per|a)\s*(?:day|night)\b|^\s*daily\b/.test(after);
  const perUnit = /^\s*(?:\/|per|each|a)\s*(?:chair|table|unit|piece|pc|item|bench)\b|^\s*each\b/.test(after);
  return { amountPaise: Math.round(rupees * 100), basis: perDay || perUnit ? "per_day" : "total", perUnit };
}

/** Single day or range: "28th October", "28th to 30th Oct", "Oct 28 - Nov 2", "28/10 for 3 days", "tomorrow". */
export function parseDateRange(text: string, now: Date = new Date()): { start: string; end: string } | undefined {
  const lower = text.toLowerCase();
  const today = todayIst(now);
  const iso = (y: number, m: number, d: number) => {
    const dt = new Date(Date.UTC(y, m, d));
    if (dt.getUTCMonth() !== m || dt.getUTCDate() !== d) return undefined; // e.g. 31 Feb
    return dt.toISOString().slice(0, 10);
  };
  const withYear = (m: number, d: number, y?: number) => {
    if (y !== undefined) return iso(y < 100 ? 2000 + y : y, m, d);
    const thisYear = iso(today.getUTCFullYear(), m, d);
    if (thisYear && new Date(thisYear) < today) return iso(today.getUTCFullYear() + 1, m, d);
    return thisYear;
  };
  const monthIndex = (name: string) => MONTHS.findIndex((mn) => mn.startsWith(name.slice(0, 3)));
  const addDays = (isoDay: string, n: number) => new Date(new Date(`${isoDay}T00:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);
  const SEP = String.raw`\s*(?:-|–|—|to|till|until|through|thru)\s*`;
  const ORD = "(?:st|nd|rd|th)?";

  let start: string | undefined;
  let end: string | undefined;
  let m: RegExpMatchArray | null;

  // "28th to 30th October (2026)" / "28-30 oct"
  if ((m = lower.match(new RegExp(`\\b(\\d{1,2})${ORD}${SEP}(\\d{1,2})${ORD}\\s+(?:of\\s+)?${MONTH_RE}\\b(?:,?\\s+(\\d{4}))?`)))) {
    const mon = monthIndex(m[3]);
    start = withYear(mon, +m[1], m[4] ? +m[4] : undefined);
    if (start) end = iso(+start.slice(0, 4), mon, +m[2]);
  }
  // "Oct 28 to 30" / "october 28-30"
  else if ((m = lower.match(new RegExp(`\\b${MONTH_RE}\\s+(\\d{1,2})${ORD}${SEP}(\\d{1,2})${ORD}\\b(?:,?\\s+(\\d{4}))?`)))) {
    const mon = monthIndex(m[1]);
    start = withYear(mon, +m[2], m[4] ? +m[4] : undefined);
    if (start) end = iso(+start.slice(0, 4), mon, +m[3]);
  } else {
    // Collect every single date mentioned, in order
    const singles: Array<{ at: number; day: string }> = [];
    const push = (at: number, day: string | undefined) => day && singles.push({ at, day });
    for (const mm of lower.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) push(mm.index!, iso(+mm[1], +mm[2] - 1, +mm[3]));
    for (const mm of lower.matchAll(new RegExp(`\\b(\\d{1,2})${ORD}\\s+(?:of\\s+)?${MONTH_RE}\\b(?:,?\\s+(\\d{4}))?`, "g"))) {
      push(mm.index!, withYear(monthIndex(mm[2]), +mm[1], mm[3] ? +mm[3] : undefined));
    }
    for (const mm of lower.matchAll(new RegExp(`\\b${MONTH_RE}\\s+(\\d{1,2})${ORD}\\b(?:,?\\s+(\\d{4}))?`, "g"))) {
      push(mm.index!, withYear(monthIndex(mm[1]), +mm[2], mm[3] ? +mm[3] : undefined));
    }
    for (const mm of lower.matchAll(/\b(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?\b/g)) {
      if (+mm[2] >= 1 && +mm[2] <= 12) push(mm.index!, withYear(+mm[2] - 1, +mm[1], mm[3] ? +mm[3] : undefined));
    }
    if (/\btoday\b/.test(lower)) push(lower.search(/\btoday\b/), today.toISOString().slice(0, 10));
    if (/\btomorrow\b/.test(lower)) push(lower.search(/\btomorrow\b/), addDays(today.toISOString().slice(0, 10), 1));
    singles.sort((a, b) => a.at - b.at);

    if (singles.length > 0) {
      start = singles[0].day;
      if (singles.length > 1) {
        const between = lower.slice(singles[0].at, singles[1].at);
        if (new RegExp(SEP.trim()).test(between) || /\band\b/.test(between)) end = singles[1].day;
      }
    }
  }

  if (!start) return undefined;

  // "for 3 days" / "for a week" (only if no explicit end)
  if (!end) {
    const d = lower.match(/\bfor\s+(\d{1,3}|a|one|two|three|four|five|six|seven)\s+(days?|nights?|weeks?)\b/);
    if (d) {
      const words: Record<string, number> = { a: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7 };
      const n = /^\d+$/.test(d[1]) ? +d[1] : words[d[1]];
      const days = d[2].startsWith("week") ? n * 7 : n;
      if (days > 1) end = addDays(start, days - 1);
    }
  }
  end = end ?? start;
  if (end < start) {
    // "30 Dec to 2 Jan" → the end is next year
    end = `${+end.slice(0, 4) + 1}${end.slice(4)}`;
  }
  return { start, end };
}

/** Largest guest capacity stated in a listing's text ("seats 500", "capacity: 300 pax"), if any. */
export function statedCapacity(text: string): number | undefined {
  const lower = text.toLowerCase();
  const nums: number[] = [];
  for (const m of lower.matchAll(new RegExp(`(\\d[\\d,]{1,6})\\s*\\+?\\s*(?:${GUEST_WORDS}|seat(?:s|ing)?|capacity)\\b`, "g"))) {
    nums.push(parseInt(m[1].replace(/,/g, ""), 10));
  }
  for (const m of lower.matchAll(/\b(?:capacity|seats|seating|accommodates|holds|up to|upto)\s*(?:of|:|-)?\s*(\d[\d,]{1,6})/g)) {
    nums.push(parseInt(m[1].replace(/,/g, ""), 10));
  }
  const valid = nums.filter((n) => n >= 10);
  return valid.length ? Math.max(...valid) : undefined;
}

export function titleCase(s: string) {
  return s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}
