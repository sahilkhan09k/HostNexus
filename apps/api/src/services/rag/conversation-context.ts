import type { ChatHistoryMessage } from "./types.js";

/**
 * Conversation memory helpers for the HostNexus RAG pipeline.
 *
 * The chat session lives on the client, which sends the recent turns as `history`
 * with every request. These helpers turn that history into what the pipeline needs
 * to answer follow-up questions: a standalone retrieval query, and the listings the
 * user may be pointing at ("the second one", "that hall").
 */

const MAX_HISTORY_MESSAGES = 10;
const MAX_MESSAGE_CHARS = 1500;
const MAX_PRIOR_USER_TURNS_IN_QUERY = 2;

// Words that only make sense with something said earlier in the conversation
const REFERENCE_PATTERN =
  /\b(it|its|they|them|their|those|these|that one|this one|that hall|that venue|the same|same one|above|previous|earlier|former|latter|another|other one|instead|also|too|else|cheaper|cheapest|costlier|bigger|smaller|more)\b/i;

// Openers that continue the previous question ("and for 50 guests?", "what about Mumbai?")
const CONTINUATION_OPENER = /^(and|but|so|also|then|ok|okay|what about|how about|what if|only|same)\b/i;

const SHORT_FOLLOW_UP_WORDS = 4;

const ORDINAL_REFERENCES: Array<{ pattern: RegExp; index: number | "last" }> = [
  { pattern: /\b(first|1st)\s+(one|option|listing|item|result)\b|\bthe\s+(first|1st)\b(?!\s+time)|#1\b|\b(option|listing|number|no\.?)\s*1\b/i, index: 0 },
  { pattern: /\b(second|2nd)\s+(one|option|listing|item|result)\b|\bthe\s+(second|2nd)\b|#2\b|\b(option|listing|number|no\.?)\s*2\b/i, index: 1 },
  { pattern: /\b(third|3rd)\s+(one|option|listing|item|result)\b|\bthe\s+(third|3rd)\b|#3\b|\b(option|listing|number|no\.?)\s*3\b/i, index: 2 },
  { pattern: /\b(fourth|4th)\s+(one|option|listing|item|result)\b|\bthe\s+(fourth|4th)\b|#4\b|\b(option|listing|number|no\.?)\s*4\b/i, index: 3 },
  { pattern: /\b(last)\s+(one|option|listing|item|result)\b/i, index: "last" },
];

const SINGLE_REFERENCE = /\b(it|its|that one|this one|that hall|that venue|the same|same one)\b/i;

const MARKDOWN_LISTING_LINK = /\[([^\]]+)\]\(\/marketplace\/([^)\s]+)\)/g;

export interface ShownListing {
  id: string;
  title?: string;
}

/**
 * Keep only real user/assistant turns, newest last, bounded in count and size.
 */
export function sanitizeHistory(history: ChatHistoryMessage[] | undefined): ChatHistoryMessage[] {
  if (!history || history.length === 0) return [];

  return history
    .filter(m => (m.role === "user" || m.role === "assistant") && m.content.trim().length > 0)
    .slice(-MAX_HISTORY_MESSAGES)
    .map(m => ({
      role: m.role,
      content: m.content.trim().slice(0, MAX_MESSAGE_CHARS),
      listingIds: m.listingIds?.slice(0, 10),
    }));
}

/**
 * Does this message depend on earlier turns to be understood?
 */
export function isFollowUpMessage(message: string, hasPriorTurns: boolean): boolean {
  if (!hasPriorTurns) return false;

  const trimmed = message.trim();
  if (CONTINUATION_OPENER.test(trimmed)) return true;
  if (REFERENCE_PATTERN.test(trimmed)) return true;
  if (ORDINAL_REFERENCES.some(o => o.pattern.test(trimmed))) return true;

  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  return wordCount <= SHORT_FOLLOW_UP_WORDS;
}

/**
 * Rewrite a follow-up into a query retrieval can use on its own.
 * The current message goes first so its details (e.g. a new quantity) win over
 * older ones when requirements are parsed left to right.
 */
export function buildStandaloneQuery(message: string, priorUserMessagesNewestFirst: string[]): string {
  const context = priorUserMessagesNewestFirst.slice(0, MAX_PRIOR_USER_TURNS_IN_QUERY);
  return [message.trim(), ...context].join(" ");
}

/**
 * Listings shown in the most recent assistant turn that showed any, in display order.
 */
export function getLastShownListings(history: ChatHistoryMessage[]): ShownListing[] {
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    if (msg.role !== "assistant") continue;

    const linked = extractListingLinks(msg.content);
    if (msg.listingIds && msg.listingIds.length > 0) {
      return msg.listingIds.map(id => ({ id, title: linked.find(l => l.id === id)?.title }));
    }
    if (linked.length > 0) return linked;
  }
  return [];
}

/**
 * Work out which previously shown listing the user is talking about, if any.
 */
export function resolveListingReference(message: string, shown: ShownListing[]): ShownListing | undefined {
  if (shown.length === 0) return undefined;

  const lower = message.toLowerCase();

  const byTitle = shown.find(l => l.title && lower.includes(l.title.toLowerCase()));
  if (byTitle) return byTitle;

  for (const { pattern, index } of ORDINAL_REFERENCES) {
    if (!pattern.test(message)) continue;
    const resolved = index === "last" ? shown.length - 1 : index;
    return shown[resolved];
  }

  if (shown.length === 1 && SINGLE_REFERENCE.test(message)) return shown[0];

  return undefined;
}

function extractListingLinks(content: string): ShownListing[] {
  const found: ShownListing[] = [];
  for (const match of content.matchAll(MARKDOWN_LISTING_LINK)) {
    const [, title, id] = match;
    if (!found.some(l => l.id === id)) found.push({ id, title });
  }
  return found;
}
