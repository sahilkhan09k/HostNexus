export interface ChatHistoryMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface RagQueryInput {
  message: string;
  history?: ChatHistoryMessage[];
  date?: string;
  location?: string;
  quantity?: number;
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
  rating: number;
  reviewCount: number;
  match: number;
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
}
