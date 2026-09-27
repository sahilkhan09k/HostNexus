import { AuthService } from "./auth";
import { openRazorpayCheckout } from "./razorpay";
import type {
  Resource,
  ResourceWithBusiness,
  CreateResourceInput,
  UpdateResourceInput,
  BookingRequest,
  BookingRequestWithDetails,
  CreateBookingRequestInput,
  RenterReceivingInspectionInput,
  HandoverInput,
  OwnerHandoverResponseInput,
  ReturnInitiationInput,
  OwnerReceiptInput,
  OwnerDamageClaimInput,
  RenterClaimResponseInput,
} from "@hostnexus/types";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

/**
 * Upload single media file (image/video) as base64 payload to backend
 */
export async function uploadMediaFile(file: File): Promise<{
  fileUrl: string;
  fileHash: string;
  filename: string;
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = reader.result as string;
        const res = await AuthService.fetchWithAuth(`${API_BASE_URL}/api/upload`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type,
            base64Data,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error?.message || "Upload failed");
        }

        const data = await res.json();
        // Construct full URL if relative
        const fullUrl = data.data.fileUrl.startsWith("http")
          ? data.data.fileUrl
          : `${API_BASE_URL}${data.data.fileUrl}`;

        resolve({
          fileUrl: fullUrl,
          fileHash: data.data.fileHash,
          filename: data.data.filename,
        });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

// ─────────────────────────────────────────
// Resource APIs
// ─────────────────────────────────────────

export async function createResource(input: CreateResourceInput): Promise<Resource> {
  const res = await AuthService.fetchWithAuth(`${API_BASE_URL}/api/resources`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || "Failed to create resource");
  }
  const data = await res.json();
  return data.data.resource;
}

export async function getResources(query?: Record<string, string>): Promise<Resource[]> {
  const params = query ? `?${new URLSearchParams(query).toString()}` : "";
  const res = await AuthService.fetchWithAuth(`${API_BASE_URL}/api/resources${params}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || "Failed to fetch resources");
  }
  const data = await res.json();
  return data.data.resources;
}

export async function getMarketplaceResources(query?: Record<string, string>): Promise<ResourceWithBusiness[]> {
  const params = query ? `?${new URLSearchParams(query).toString()}` : "";
  const res = await AuthService.fetchWithAuth(`${API_BASE_URL}/api/resources/all${params}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || "Failed to fetch marketplace resources");
  }
  const data = await res.json();
  return data.data.resources;
}

export async function getResourceById(id: string): Promise<ResourceWithBusiness> {
  // Uses fetchWithAuth so authenticated users get full access including their own resources
  const res = await AuthService.fetchWithAuth(`${API_BASE_URL}/api/resources/${id}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || "Resource not found");
  }
  const data = await res.json();
  return data.data.resource;
}

export async function updateResource(id: string, input: UpdateResourceInput): Promise<Resource> {
  const res = await AuthService.fetchWithAuth(`${API_BASE_URL}/api/resources/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || "Failed to update resource");
  }
  const data = await res.json();
  return data.data.resource;
}

// ─────────────────────────────────────────
// Booking & Chain of Custody APIs
// ─────────────────────────────────────────

export async function createBookingRequest(input: CreateBookingRequestInput): Promise<BookingRequest> {
  const res = await AuthService.fetchWithAuth(`${API_BASE_URL}/api/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || "Failed to create booking");
  }
  const data = await res.json();
  return data.data.bookingRequest;
}

export async function getBookingRequests(query?: Record<string, string>): Promise<BookingRequestWithDetails[]> {
  const params = query ? `?${new URLSearchParams(query).toString()}` : "";
  const res = await AuthService.fetchWithAuth(`${API_BASE_URL}/api/bookings${params}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || "Failed to fetch bookings");
  }
  const data = await res.json();
  return data.data.bookingRequests;
}

export async function getBookingRequestById(id: string): Promise<BookingRequestWithDetails> {
  const res = await AuthService.fetchWithAuth(`${API_BASE_URL}/api/bookings/${id}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || "Failed to fetch booking details");
  }
  const data = await res.json();
  return data.data.bookingRequest;
}

export async function updateBookingStatus(id: string, status: "accepted" | "rejected" | "cancelled", reason?: string): Promise<BookingRequest> {
  const res = await AuthService.fetchWithAuth(`${API_BASE_URL}/api/bookings/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, rejectionReason: reason }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || "Failed to update booking status");
  }
  const data = await res.json();
  return data.data.bookingRequest;
}

interface PaymentOrder {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  totalAmountPaise: number;
  paymentDeadline: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- each caller picks its own field from the response
async function postJson<T>(path: string, body: unknown, fallback: string, pick: (data: any) => T): Promise<T> {
  const res = await AuthService.fetchWithAuth(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.error?.message || json.error?.details?.[0]?.message || fallback);
    (err as Error & { code?: string }).code = json.error?.code;
    throw err;
  }
  return pick(json.data);
}

/**
 * Pay a booking into escrow: create (or reuse) its Razorpay order, open
 * Checkout, then have the API verify the payment with Razorpay and fund escrow.
 */
export async function payForBooking(
  bookingId: string,
  opts: { description: string; prefill?: { name?: string; email?: string; contact?: string } }
): Promise<BookingRequest | null> {
  let order: PaymentOrder;
  try {
    order = await postJson<PaymentOrder>(`/api/bookings/${bookingId}/pay`, {}, "Failed to start payment", (d) => d);
  } catch (err) {
    // An earlier checkout already went through; escrow is funded
    if ((err as Error & { code?: string }).code === "ALREADY_PAID") return null;
    throw err;
  }

  const result = await openRazorpayCheckout({
    keyId: order.keyId,
    orderId: order.orderId,
    amountPaise: order.amount,
    description: opts.description,
    prefill: opts.prefill,
  });

  return postJson<BookingRequest>(
    `/api/bookings/${bookingId}/pay/verify`,
    {
      razorpayOrderId: result.razorpay_order_id,
      razorpayPaymentId: result.razorpay_payment_id,
      razorpaySignature: result.razorpay_signature,
    },
    "Payment could not be verified",
    (d) => d.booking
  );
}

/** Owner: enter the renter's handover code and upload condition photos. */
export async function markHandover(bookingId: string, input: HandoverInput): Promise<BookingRequest> {
  return postJson(`/api/bookings/${bookingId}/handover`, input, "Failed to verify handover", (d) => d.booking);
}

/** Owner: accept (renter refunded in full) or contest (goes to admin) a handover issue. */
export async function respondToHandoverIssue(bookingId: string, input: OwnerHandoverResponseInput): Promise<BookingRequest> {
  return postJson(`/api/bookings/${bookingId}/handover-response`, input, "Failed to respond to the issue", (d) => d.booking);
}

export async function submitRenterInspection(bookingId: string, input: RenterReceivingInspectionInput): Promise<BookingRequest> {
  const res = await AuthService.fetchWithAuth(`${API_BASE_URL}/api/bookings/${bookingId}/renter-inspection`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || "Failed to submit receiving inspection");
  }
  const data = await res.json();
  return data.data.booking;
}

export async function initiateReturn(bookingId: string, input: ReturnInitiationInput): Promise<BookingRequest> {
  const res = await AuthService.fetchWithAuth(`${API_BASE_URL}/api/bookings/${bookingId}/return`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || "Failed to initiate return");
  }
  const data = await res.json();
  return data.data.booking;
}

export async function submitOwnerReceipt(bookingId: string, input: OwnerReceiptInput): Promise<BookingRequest> {
  const res = await AuthService.fetchWithAuth(`${API_BASE_URL}/api/bookings/${bookingId}/owner-receipt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || "Failed to submit receipt confirmation");
  }
  const data = await res.json();
  return data.data.booking;
}

export async function submitOwnerAcceptReturn(bookingId: string, notes?: string): Promise<BookingRequest> {
  const res = await AuthService.fetchWithAuth(`${API_BASE_URL}/api/bookings/${bookingId}/owner-accept-return`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notes }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || "Failed to accept return condition");
  }
  const data = await res.json();
  return data.data.booking;
}

export async function submitOwnerDamageClaim(bookingId: string, input: OwnerDamageClaimInput): Promise<BookingRequest> {
  const res = await AuthService.fetchWithAuth(`${API_BASE_URL}/api/bookings/${bookingId}/damage-claim`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || "Failed to submit damage claim");
  }
  const data = await res.json();
  return data.data.booking;
}

export async function submitRenterClaimResponse(bookingId: string, input: RenterClaimResponseInput): Promise<BookingRequest> {
  const res = await AuthService.fetchWithAuth(`${API_BASE_URL}/api/bookings/${bookingId}/claim-response`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || "Failed to submit claim response");
  }
  const data = await res.json();
  return data.data.booking;
}

// Dispute resolution is admin-only: see AdminAuthService.resolveDispute (lib/admin-auth.ts)

// ─────────────────────────────────────────
// Negotiation APIs
// ─────────────────────────────────────────

export interface NegotiationOffer {
  id: string;
  negotiationId: string;
  proposerId: string;
  proposer: { id: string; name: string };
  proposerRole: "SEEKER" | "PROVIDER";
  offeredAmountPaise: number;
  message: string | null;
  status: "PENDING" | "COUNTERED" | "ACCEPTED" | "REJECTED";
  createdAt: string;
}

export interface Negotiation {
  id: string;
  bookingId: string;
  status: "OPEN" | "ACCEPTED" | "REJECTED" | "CANCELLED";
  offers: NegotiationOffer[];
  createdAt: string;
  updatedAt: string;
}

export async function getNegotiation(bookingId: string): Promise<Negotiation | null> {
  const res = await AuthService.fetchWithAuth(`${API_BASE_URL}/api/negotiations/${bookingId}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.data.negotiation;
}

export async function makeNegotiationOffer(
  bookingId: string,
  offeredAmountPaise: number,
  message?: string
): Promise<NegotiationOffer> {
  const res = await AuthService.fetchWithAuth(`${API_BASE_URL}/api/negotiations/${bookingId}/offer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ offeredAmountPaise, message }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || "Failed to submit offer");
  }
  const data = await res.json();
  return data.data.offer;
}

export async function acceptNegotiationOffer(bookingId: string): Promise<void> {
  const res = await AuthService.fetchWithAuth(`${API_BASE_URL}/api/negotiations/${bookingId}/accept`, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || "Failed to accept offer");
  }
}

export async function rejectNegotiation(bookingId: string, reason?: string): Promise<void> {
  const res = await AuthService.fetchWithAuth(`${API_BASE_URL}/api/negotiations/${bookingId}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || "Failed to reject negotiation");
  }
}

// ─── AI Concierge RAG Pipeline ─────────────────────────────────

/**
 * Conversation memory the concierge returns with each reply. The chat sends it
 * back unchanged with the next message so follow-ups ("what about Mumbai?",
 * "is the first one free on 30th?") are understood. Treat it as opaque.
 */
export type AiConciergeContext = Record<string, unknown> & { v: 1 };

export interface AiConciergeQueryInput {
  message: string;
  /** Assistant turns must carry the signature the API returned with them, or they are ignored */
  history?: Array<{ role: "user" | "assistant"; content: string; listingIds?: string[]; signature?: string }>;
  context?: AiConciergeContext;
  date?: string;
  location?: string;
  quantity?: number;
}

export interface AiListingResult {
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
  /** Average renter rating; null when the owner has no reviews yet */
  rating: number | null;
  reviewCount: number;
  /** % of the requested quantity this listing can supply by itself */
  match: number;
  /** Which requested item this card answers, e.g. "chairs" */
  matchedFor: string;
  requestedQuantity: number | null;
  /** e.g. "Has 20 of the 30 chairs you need on 28 Oct 2026" */
  fitLabel: string;
  /** MATCH meets everything asked; ALTERNATIVE is the right item but misses something (see caveats) */
  tier: "MATCH" | "ALTERNATIVE";
  /** e.g. "Not in Pune — in Mumbai", "Over your ₹50,000 budget by ₹5,000" */
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

export interface AiConciergeResponse {
  reply: string;
  /** Server signature of this reply — send it back with the turn in `history` */
  replySignature?: string;
  context?: AiConciergeContext;
  results: AiListingResult[];
  intent: string;
  sources: string[];
  suggestedFollowUps: string[];
  referencedPolicies?: string[];
}

export async function queryAiConcierge(input: AiConciergeQueryInput): Promise<AiConciergeResponse> {
  const res = await fetch(`${API_BASE_URL}/api/ai/concierge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || "Failed to reach AI Concierge");
  }

  const data = await res.json();
  return data.data;
}

