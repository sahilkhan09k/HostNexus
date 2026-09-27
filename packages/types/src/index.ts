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
  transportAvailable: boolean;
  transportRatePerKmPaise: number;

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
  transportAvailable?: boolean;
  transportRatePerKmPaise?: number;
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
  transportAvailable?: boolean;
  transportRatePerKmPaise?: number;
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
  | "OWNER_INSPECTION"
  | "DISPUTED"
  | "COMPLETED"
  | "CANCELLED";

export type FinancialStatus =
  | "PENDING_PAYMENT"
  | "NO_PAYMENT"        // cancelled before any payment
  | "FUNDS_HELD"
  | "RENT_RELEASED"
  | "DEPOSIT_REFUNDED"
  | "DEPOSIT_TO_OWNER"
  | "PARTIAL_SETTLEMENT"
  | "FULLY_REFUNDED";   // everything paid went back to the renter

export type InspectionType = "HANDOVER" | "RECEIVING" | "RETURN" | "OWNER_RECEIPT";
export type InspectionStatus = "ACCEPTED" | "REPORTED_ISSUE";

export type EvidenceStage =
  | "PRE_EXISTING"
  | "HANDOVER"
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

/** RETURN_CLAIM decisions split the deposit; HANDOVER_ISSUE decisions settle rent + transport too. */
export type AdminDecision =
  | "REFUND_RENTER"
  | "PAY_OWNER"
  | "PARTIAL_SETTLEMENT"
  | "REJECT_CLAIM"
  | "FULL_REFUND"
  | "REJECT_ISSUE"
  | "PARTIAL_REFUND";

export type DisputeKind = "HANDOVER_ISSUE" | "RETURN_CLAIM";
export type DisputeStatus = "OPEN" | "ESCALATED" | "RESOLVED";

export type PaymentTxType =
  | "ESCROW_DEPOSIT"
  | "FULL_REFUND"
  | "RENT_REFUND"
  | "DEPOSIT_REFUND"
  | "RENT_PAYOUT"
  | "DAMAGE_PAYOUT";

export type PaymentDirection = "IN" | "TO_RENTER" | "TO_OWNER";

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
  kind: DisputeKind;
  raisedByRole: "OWNER" | "RENTER" | "SYSTEM";
  status: DisputeStatus;
  responseDeadline: string | null;
  escalatedAt: string | null;
  renterResponse: string | null;
  renterReason: DisputeReason | "MISSING_QUANTITY" | "CONDITION_MISMATCH" | null;
  ownerResponse: string | null;
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
  direction: PaymentDirection;
  amountPaise: number;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  providerReference: string | null;
  razorpayRefundId: string | null;
  utrReference: string | null;
  failureReason: string | null;
  processedAt: string | null;
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
  transportMode: "SELF" | "PROVIDER";
  transportDistanceKm: number | null;
  transportRatePerKmPaise: number;
  transportFeePaise: number;

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
  acceptedAt: string | null;
  paymentDeadline: string | null;
  fundedAt: string | null;
  handoverDeadline: string | null;
  ownerReceiptDeadline: string | null;
  cancelledAt: string | null;
  cancelledBy: "RENTER" | "OWNER" | "SYSTEM" | null;
  rejectionReason?: string | null;

  /** Only present for the renter, while escrow is funded and handover is pending. */
  handoverCode?: string | null;
  handoverCodeAttempts: number;

  receivedQuantity: number | null;
  returnedQuantity: number | null;
  ownerReceivedQuantity: number | null;

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
  transportMode?: "SELF" | "PROVIDER";
  transportDistanceKm?: number;
}

export interface HandoverInput {
  handoverCode: string;
  evidenceUrls: string[];
  notes?: string;
}

export interface OwnerHandoverResponseInput {
  action: "ACCEPT" | "CONTEST";
  notes?: string;
}

export interface RenterReceivingInspectionInput {
  status: "ACCEPTED" | "REPORTED_ISSUE";
  receivedQuantity?: number;
  notes?: string;
  evidenceUrls?: string[];
  issueDescription?: string;
}

export interface ReturnInitiationInput {
  returnedQuantity?: number;
  notes?: string;
  returnEvidenceUrls: string[];
}

export interface OwnerReceiptInput {
  received: boolean;
  receivedQuantity?: number;
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
// Notifications (REST /api/notifications + Socket.IO)
// ─────────────────────────────────────────

/** Ids the client needs to open the related object. `link` is an app-relative path. */
export interface NotificationData {
  link?: string;
  bookingId?: string;
  resourceId?: string;
  businessId?: string;
  reviewId?: string;
  negotiationId?: string;
}

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  data: NotificationData | null;
  read: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationListResponse {
  notifications: AppNotification[];
  count: number;
  nextCursor: string | null;
  unreadCount: number;
}

/** Server → client socket events */
export interface RealtimeEvents {
  "notification:new": { notification: AppNotification; toast: boolean };
  "notification:read": { ids: string[]; all: boolean };
  "booking:updated": { bookingId: string; event: string };
  "negotiation:updated": { bookingId: string; event: string };
}
