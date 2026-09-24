import { AuthService } from "./auth";
import type {
  Resource,
  ResourceWithBusiness,
  CreateResourceInput,
  UpdateResourceInput,
  BookingRequest,
  BookingRequestWithDetails,
  CreateBookingRequestInput,
  RenterReceivingInspectionInput,
  ReturnInitiationInput,
  OwnerReceiptInput,
  OwnerDamageClaimInput,
  RenterClaimResponseInput,
  AdminResolveDisputeInput,
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

export async function payEscrow(bookingId: string): Promise<BookingRequest> {
  const res = await AuthService.fetchWithAuth(`${API_BASE_URL}/api/bookings/${bookingId}/pay`, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || "Failed to fund escrow");
  }
  const data = await res.json();
  return data.data.booking;
}

export async function markHandover(bookingId: string): Promise<BookingRequest> {
  const res = await AuthService.fetchWithAuth(`${API_BASE_URL}/api/bookings/${bookingId}/handover`, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || "Failed to mark handover");
  }
  const data = await res.json();
  return data.data.booking;
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

export async function adminResolveDispute(bookingId: string, input: AdminResolveDisputeInput): Promise<BookingRequest> {
  const res = await AuthService.fetchWithAuth(`${API_BASE_URL}/api/bookings/${bookingId}/resolve-dispute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || "Failed to resolve dispute");
  }
  const data = await res.json();
  return data.data.booking;
}

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
