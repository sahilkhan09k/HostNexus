// ============================================================
// HostNexus — Shared TypeScript Contracts (MVP v2)
// Used by both apps/web and apps/api
// Digital Chain of Custody & Dispute Resolution System
// ============================================================

// ─────────────────────────────────────────
// Generic API Response Wrapper
// ─────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

// ─────────────────────────────────────────
// Auth
// ─────────────────────────────────────────

export interface AuthTokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: SafeUser;
  accessToken: string;
  refreshToken: string;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

// ─────────────────────────────────────────
// User & Business
// ─────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
}

export interface SafeUser {
  id: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface Business {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBusinessInput {
  name: string;
}

export interface UpdateBusinessInput {
  name: string;
}

// ─────────────────────────────────────────
// Resource & Commercial Listing
// ─────────────────────────────────────────

export type ResourceStatus = "available" | "unavailable" | "maintenance" | "reserved";

export interface Resource {
  id: string;
  businessId: string;
  name: string;
  description: string | null;
  resourceType: string;
  quantity: number;
  unit: string | null;
  status: ResourceStatus;
  location: string | null;
  isActive: boolean;
  
  // Commercial terms & Pre-existing wear disclosure (paise integer: 1 INR = 100 paise)
  rentAmountPaise: number;
  securityDepositPaise: number;
  photos: string[];
  hasPreExistingDamage: boolean;
  damageDescription: string | null;
  damagePhotos: string[];

  createdAt: string;
  updatedAt: string;
}

export interface ResourceWithBusiness extends Resource {
  business: {
    id: string;
    name: string;
  };
}

export interface CreateResourceInput {
  name: string;
  description?: string;
  resourceType: string;
  quantity?: number;
  unit?: string;
  status?: ResourceStatus;
  location?: string;
  isActive?: boolean;
  rentAmountPaise: number;
  securityDepositPaise: number;
  photos?: string[];
  hasPreExistingDamage?: boolean;
  damageDescription?: string;
  damagePhotos?: string[];
}

export interface UpdateResourceInput {
  name?: string;
  description?: string;
  resourceType?: string;
  quantity?: number;
  unit?: string;
  status?: ResourceStatus;
  location?: string;
  isActive?: boolean;
  rentAmountPaise?: number;
  securityDepositPaise?: number;
  photos?: string[];
  hasPreExistingDamage?: boolean;
  damageDescription?: string;
  damagePhotos?: string[];
}

export interface ResourceQuery {
  resourceType?: string;
  status?: ResourceStatus;
  isActive?: string;
}

// ─────────────────────────────────────────
// Dual State Machine (MVP v2)
// ─────────────────────────────────────────

export type BookingStatus =
  | "BOOKING_REQUESTED"
  | "BOOKING_ACCEPTED"
  | "HANDOVER_INSPECTION"
  | "ACTIVE"
  | "RETURN_INITIATED"
  | "RETURN_NOT_RECEIVED"
  | "OWNER_INSPECTION"
  | "DISPUTED"
  | "NON_RETURNED"
  | "COMPLETED"
  | "CANCELLED";

export type FinancialStatus =
  | "PENDING_PAYMENT"
  | "FUNDS_HELD"
  | "RENT_RELEASED"
  | "DEPOSIT_HELD"
  | "DEPOSIT_REFUNDED"
  | "DEPOSIT_TO_OWNER"
  | "PARTIAL_SETTLEMENT";

export type InspectionType = "RECEIVING" | "RETURN";
export type InspectionStatus = "ACCEPTED" | "REPORTED_ISSUE";

export type EvidenceStage =
  | "PRE_EXISTING"
  | "RECEIVING"
  | "RETURN"
  | "DAMAGE_CLAIM"
  | "RENTER_REBUTTAL";

export type EvidenceFileType = "IMAGE" | "VIDEO";

export type ClaimType =
  | "DAMAGE"
  | "MISSING_ITEM"
  | "MISSING_QUANTITY"
  | "WRONG_ITEM_RETURNED"
  | "SEVERE_STAIN"
  | "RETURN_NOT_RECEIVED"
  | "OTHER";

export type ClaimStatus = "PENDING" | "DISPUTED" | "RESOLVED" | "REJECTED";

export type DisputeReason =
  | "PRE_EXISTING_DAMAGE"
  | "NOT_CAUSED_BY_RENTER"
  | "AFTER_RETURN"
  | "NORMAL_WEAR_TEAR"
  | "INCORRECT_AMOUNT"
  | "OTHER";

export type AdminDecision =
  | "REFUND_RENTER"
  | "PAY_OWNER"
  | "PARTIAL_SETTLEMENT"
  | "REJECT_CLAIM";

export type PaymentTxType =
  | "ESCROW_DEPOSIT"
  | "RENT_PAYOUT"
  | "DEPOSIT_REFUND"
  | "DAMAGE_PAYOUT"
  | "PARTIAL_SETTLEMENT";

export type ActorRole = "OWNER" | "RENTER" | "ADMIN" | "SYSTEM";

// ─────────────────────────────────────────
// Evidence, Inspection & Dispute Models
// ─────────────────────────────────────────

export interface Evidence {
  id: string;
  bookingId: string;
  inspectionId: string | null;
  uploadedById: string;
  stage: EvidenceStage;
  type: EvidenceFileType;
  fileUrl: string;
  fileHash: string | null;
  notes: string | null;
  createdAt: string;
}

export interface Inspection {
  id: string;
  bookingId: string;
  type: InspectionType;
  performedById: string;
  status: InspectionStatus;
  quantity: number;
  condition: string | null;
  notes: string | null;
  evidence?: Evidence[];
  createdAt: string;
}

export interface DamageClaim {
  id: string;
  bookingId: string;
  claimantId: string;
  claimType: ClaimType;
  description: string;
  claimedAmountPaise: number;
  status: ClaimStatus;
  createdAt: string;
  resolvedAt: string | null;
  disputes?: Dispute[];
}

export interface Dispute {
  id: string;
  bookingId: string;
  damageClaimId: string | null;
  status: "OPEN" | "RESOLVED";
  renterResponse: string | null;
  renterReason: DisputeReason | null;
  adminDecision: AdminDecision | null;
  resolutionAmountPaise: number | null;
  resolutionNotes: string | null;
  resolvedById: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export interface PaymentTransaction {
  id: string;
  bookingId: string;
  type: PaymentTxType;
  amountPaise: number;
  status: "PENDING" | "COMPLETED" | "FAILED";
  providerReference: string | null;
  createdAt: string;
}

export interface BookingTimelineEvent {
  id: string;
  bookingId: string;
  eventType: string;
  actorId: string | null;
  actorRole: ActorRole;
  title: string;
  description: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

// ─────────────────────────────────────────
// Booking Request (Contract with Chain of Custody)
// ─────────────────────────────────────────

export interface BookingRequest {
  id: string;
  seekerId: string;
  providerId: string;
  resourceId: string;
  quantity: number;
  startDate: string;
  endDate: string;
  totalDays: number | null;
  specialRequests: string | null;
  
  // Dual states
  bookingStatus: BookingStatus;
  financialStatus: FinancialStatus;
  status: string; // Legacy bridge

  // Money in integer paise
  rentAmountPaise: number;
  securityDepositPaise: number;
  totalAmountPaise: number;

  // Snapshots at booking creation
  conditionSnapshot: Record<string, unknown> | null;
  listingPhotosSnapshot: string[];
  damageDisclosureSnapshot: Record<string, unknown> | null;
  termsVersion: string;

  // Timestamps & Server-Enforced Deadlines
  handoverInitiatedAt: string | null;
  renterInspectionDeadline: string | null;
  returnInitiatedAt: string | null;
  ownerReceivedAt: string | null;
  ownerInspectionDeadline: string | null;
  completedAt: string | null;
  nonReturnReportedAt: string | null;

  createdAt: string;
  updatedAt: string;
}

export interface BookingRequestWithDetails extends BookingRequest {
  resource: {
    id: string;
    name: string;
    resourceType: string;
    location: string | null;
    photos?: string[];
  };
  seeker: {
    id: string;
    name: string;
  };
  provider: {
    id: string;
    name: string;
  };
  inspections?: Inspection[];
  evidence?: Evidence[];
  damageClaims?: DamageClaim[];
  disputes?: Dispute[];
  paymentTransactions?: PaymentTransaction[];
  timelineEvents?: BookingTimelineEvent[];
  negotiation?: {
    id: string;
    bookingId: string;
    status: "OPEN" | "ACCEPTED" | "REJECTED" | "CANCELLED";
    offers: Array<{
      id: string;
      negotiationId: string;
      proposerId: string;
      proposer: { id: string; name: string };
      proposerRole: "SEEKER" | "PROVIDER";
      offeredAmountPaise: number;
      message: string | null;
      status: "PENDING" | "COUNTERED" | "ACCEPTED" | "REJECTED";
      createdAt: string;
    }>;
    createdAt: string;
    updatedAt: string;
  };
}

// ─────────────────────────────────────────
// Action DTOs
// ─────────────────────────────────────────

export interface CreateBookingRequestInput {
  resourceId: string;
  quantity: number;
  startDate: string;
  endDate: string;
  specialRequests?: string;
}

export interface RenterReceivingInspectionInput {
  status: "ACCEPTED" | "REPORTED_ISSUE";
  notes?: string;
  evidenceUrls?: string[];
  issueDescription?: string;
}

export interface ReturnInitiationInput {
  notes?: string;
  returnEvidenceUrls: string[];
}

export interface OwnerReceiptInput {
  received: boolean;
  notes?: string;
}

export interface OwnerDamageClaimInput {
  claimType: ClaimType;
  description: string;
  claimedAmountPaise: number;
  evidenceUrls: string[];
}

export interface RenterClaimResponseInput {
  action: "ACCEPT" | "DISPUTE";
  reason?: DisputeReason;
  rebuttalNotes?: string;
  rebuttalEvidenceUrls?: string[];
}

export interface AdminResolveDisputeInput {
  decision: AdminDecision;
  resolutionAmountPaise?: number;
  resolutionNotes: string;
}

export interface BookingQuery {
  type?: "incoming" | "outgoing";
  status?: string;
  bookingStatus?: BookingStatus;
  financialStatus?: FinancialStatus;
}

// ─────────────────────────────────────────
// Messaging
// ─────────────────────────────────────────

export interface Conversation {
  id: string;
  businessAId: string;
  businessBId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  readAt: string | null;
  createdAt: string;
}

export interface MessageWithSender extends Message {
  sender: {
    id: string;
    name: string;
  };
}

export interface ConversationWithMessages extends Conversation {
  messages: MessageWithSender[];
  businessA: { id: string; name: string };
  businessB: { id: string; name: string };
}
