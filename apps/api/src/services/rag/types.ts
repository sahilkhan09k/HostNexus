import type { ConciergeContext } from "./conversation.js";

export interface ChatHistoryMessage {
  role: "user" | "assistant" | "system";
  content: string;
  /** IDs of the listing cards shown with an assistant turn, in display order */
  listingIds?: string[];
}

export interface RagQueryInput {
  message: string;
  history?: ChatHistoryMessage[];
  date?: string;
  location?: string;
  quantity?: number;
  /** Conversation memory returned by the previous reply (search criteria + listings shown) */
  context?: ConciergeContext;
}

export type KnowledgeCategory = 
  | "policy" 
  | "damage_and_disputes" 
  | "chain_of_custody" 
  | "financial_escrow" 
  | "rules" 
  | "negotiation" 
  | "kyc_verification" 
  | "how_to_use" 
  | "general_faq";

export interface KnowledgeDocument {
  id: string;
  title: string;
  category: KnowledgeCategory;
  section: string;
  content: string;
  keywords: string[];
  rulesSummary: string[];
}

export interface RetrievedChunk {
  document: KnowledgeDocument;
  score: number;
  matchSnippet: string;
}

export interface ResourceResultCard {
  id: string;
  title: string;
  business: string;
  businessId: string;
  location: string;
  price: string;
  rentAmountPaise: number;
  securityDepositPaise: number;
  securityDeposit: string;
  capacity: string;
  quantityAvailable: number;
  unit: string;
  /** Average renter rating of the owner; null when there are no reviews yet (never invented). */
  rating: number | null;
  reviewCount: number;
  /** % of the requested quantity this listing can supply by itself (100 when no quantity was asked). */
  match: number;
  /** Which requested item this card answers, e.g. "chairs" */
  matchedFor: string;
  requestedQuantity: number | null;
  /** Human-readable fit, e.g. "Has 20 of the 30 chairs you need on 28 Oct 2026" */
  fitLabel: string;
  /** MATCH = meets every criterion asked; ALTERNATIVE = right item but e.g. another city or over budget */
  tier: "MATCH" | "ALTERNATIVE";
  /** Every way this listing misses the request, e.g. "Not in Pune — in Mumbai", "Over your ₹50,000 budget by ₹5,000" */
  caveats: string[];
  available: boolean;
  category: string;
  categoryColor: string;
  bg: string;
  whyChoose: string;
  features: string[];
  hasPreExistingDamage: boolean;
  damageDescription?: string | null;
  photos: string[];
}

export type QueryIntent = 
  | "listing_inquiry" 
  | "damage_inquiry" 
  | "policy_question" 
  | "negotiation_inquiry" 
  | "payment_escrow_inquiry" 
  | "general_faq";

export interface RagResponse {
  reply: string;
  results: ResourceResultCard[];
  intent: QueryIntent;
  sources: string[];
  suggestedFollowUps: string[];
  referencedPolicies?: string[];
  /** Send this back with the next message so follow-ups are understood */
  context?: ConciergeContext;
}
