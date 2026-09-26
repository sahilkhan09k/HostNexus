/**
 * Cross-checks the details a registrant typed against what the GST registry
 * says about the GSTIN they uploaded. A GSTIN is public information (printed
 * on every invoice), so "exists and is Active" alone does not prove the
 * registrant owns it. Anything that does not match goes to manual review.
 */

/** GST state codes = first two digits of a GSTIN */
const STATE_CODES: Record<string, string[]> = {
  "01": ["jammu and kashmir", "jammu kashmir"],
  "02": ["himachal pradesh"],
  "03": ["punjab"],
  "04": ["chandigarh"],
  "05": ["uttarakhand", "uttaranchal"],
  "06": ["haryana"],
  "07": ["delhi", "new delhi", "nct of delhi"],
  "08": ["rajasthan"],
  "09": ["uttar pradesh"],
  "10": ["bihar"],
  "11": ["sikkim"],
  "12": ["arunachal pradesh"],
  "13": ["nagaland"],
  "14": ["manipur"],
  "15": ["mizoram"],
  "16": ["tripura"],
  "17": ["meghalaya"],
  "18": ["assam"],
  "19": ["west bengal"],
  "20": ["jharkhand"],
  "21": ["odisha", "orissa"],
  "22": ["chhattisgarh", "chattisgarh"],
  "23": ["madhya pradesh"],
  "24": ["gujarat"],
  "26": ["dadra and nagar haveli and daman and diu", "dadra and nagar haveli", "daman and diu"],
  "25": ["daman and diu"],
  "27": ["maharashtra"],
  "28": ["andhra pradesh"],
  "29": ["karnataka"],
  "30": ["goa"],
  "31": ["lakshadweep"],
  "32": ["kerala"],
  "33": ["tamil nadu"],
  "34": ["puducherry", "pondicherry"],
  "35": ["andaman and nicobar islands", "andaman and nicobar"],
  "36": ["telangana"],
  "37": ["andhra pradesh"],
  "38": ["ladakh"],
};

const normState = (s: string) => s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();

export function stateMatchesGstin(gstin: string, state: string): boolean {
  const names = STATE_CODES[gstin.slice(0, 2)];
  return !!names && names.includes(normState(state));
}

// Generic corporate words that carry no identifying information
const STOPWORDS = new Set([
  "m", "s", "ms", "the", "and", "of", "co", "company", "pvt", "private", "ltd", "limited",
  "llp", "opc", "inc", "corp", "corporation", "firm", "india", "proprietor", "prop",
]);

export function nameTokens(name: string | null | undefined): string[] {
  if (!name) return [];
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/** True when two names clearly refer to the same entity. */
export function namesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  if (ta.length === 0 || tb.length === 0) return false;
  const ja = ta.join(" ");
  const jb = tb.join(" ");
  if (ja === jb) return true;
  if (ja.length >= 4 && jb.length >= 4 && (ja.includes(jb) || jb.includes(ja))) return true;
  const sa = new Set(ta);
  const sb = new Set(tb);
  const shared = [...sa].filter((t) => sb.has(t)).length;
  return shared / new Set([...sa, ...sb]).size >= 0.6;
}

export interface KycMatchInput {
  gstin: string;
  legalName: string | null;
  tradeName: string | null;
  businessName: string;
  ownerName: string;
  state: string;
}

export interface KycMatchResult {
  autoVerified: boolean;
  nameMatches: boolean;
  stateMatches: boolean;
}

/**
 * Business name must match the registered trade or legal name, or (for sole
 * proprietorships, where the legal name is the proprietor) the owner's name
 * must match the legal name. The state must match the GSTIN state code.
 */
export function evaluateKycMatch(input: KycMatchInput): KycMatchResult {
  const nameMatches =
    namesMatch(input.businessName, input.tradeName) ||
    namesMatch(input.businessName, input.legalName) ||
    namesMatch(input.ownerName, input.legalName);
  const stateMatches = stateMatchesGstin(input.gstin, input.state);
  return { autoVerified: nameMatches && stateMatches, nameMatches, stateMatches };
}
