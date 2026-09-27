// ─────────────────────────────────────────────────────────────
// Admin auth helper — completely separate from regular AuthService
// Uses a distinct localStorage key so admin and user sessions
// never collide.
// ─────────────────────────────────────────────────────────────

import type { AdminDecision, BookingRequestWithDetails, DamageClaim, Dispute, PaymentTransaction } from "@hostnexus/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const ADMIN_TOKEN_KEY = "hostnexus_admin_token";
const ADMIN_KEY = "hostnexus_admin";

function isBrowser() {
  return typeof window !== "undefined";
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
}

export interface PendingUser {
  id: string;
  email: string;
  ownerName: string | null;
  phone: string | null;
  verificationStatus: "PENDING" | "VERIFIED" | "REJECTED" | "SUSPENDED";
  verificationNotes: string | null;
  gstCertificateUrl: string | null;
  aadhaarUrl: string | null;
  gstin: string | null;
  /** Names the GST registry returned for this GSTIN — compare with the business name */
  gstLegalName?: string | null;
  gstTradeName?: string | null;
  createdAt: string;
  /** Bookings not yet completed or cancelled, on either side */
  openBookings: number;
  businesses: {
    id: string;
    name: string;
    businessType: string | null;
    addressLine: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
  }[];
}

export interface AdminSummary {
  pending: number;
  verified: number;
  rejected: number;
  suspended: number;
  totalResources: number;
  totalBookings: number;
  openDisputes: number;
  pendingPayouts: number;
  failedRefunds: number;
}

/** A dispute with the full booking it belongs to (evidence, inspections, ledger, timeline). */
export interface AdminDispute extends Dispute {
  damageClaim: DamageClaim | null;
  booking: BookingRequestWithDetails;
}

export interface AdminTransaction extends PaymentTransaction {
  booking: {
    id: string;
    startDate: string;
    endDate: string;
    resource: { name: string };
    seeker: { id: string; name: string };
    provider: { id: string; name: string };
  };
}



export class AdminAuthService {
  static getToken(): string | null {
    if (!isBrowser()) return null;
    return localStorage.getItem(ADMIN_TOKEN_KEY);
  }

  static setToken(token: string): void {
    if (!isBrowser()) return;
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
  }

  static setAdmin(admin: AdminUser): void {
    if (!isBrowser()) return;
    localStorage.setItem(ADMIN_KEY, JSON.stringify(admin));
  }

  static getAdmin(): AdminUser | null {
    if (!isBrowser()) return null;
    const json = localStorage.getItem(ADMIN_KEY);
    return json ? JSON.parse(json) : null;
  }

  /** Raw stored profile JSON — a stable string snapshot for useSyncExternalStore */
  static getAdminJson(): string | null {
    if (!isBrowser()) return null;
    return localStorage.getItem(ADMIN_KEY);
  }

  static clearAdmin(): void {
    if (!isBrowser()) return;
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(ADMIN_KEY);
  }

  static isLoggedIn(): boolean {
    return !!this.getToken();
  }

  private static async fetch<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getToken();
    const headers = new Headers(options.headers);
    headers.set("Content-Type", "application/json");
    if (token) headers.set("Authorization", `Bearer ${token}`);

    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    const body = await res.json().catch(() => ({}));

    if (res.status === 401) this.clearAdmin(); // expired or revoked — force a fresh login
    if (!res.ok) {
      throw new Error(body?.error?.message ?? body?.message ?? "Request failed");
    }
    return body;
  }

  static async login(email: string, password: string): Promise<AdminUser> {
    const body = await this.fetch<{ success: boolean; data: { token: string; admin: AdminUser } }>(
      "/api/admin/login",
      { method: "POST", body: JSON.stringify({ email, password }) }
    );
    this.setToken(body.data.token);
    this.setAdmin(body.data.admin);
    return body.data.admin;
  }

  static async getSummary(): Promise<AdminSummary> {
    const body = await this.fetch<{ success: boolean; data: AdminSummary }>("/api/admin/summary");
    return body.data;
  }

  static async getUsers(status?: string): Promise<PendingUser[]> {
    const qs = status ? `?status=${status}` : "";
    const body = await this.fetch<{ success: boolean; data: { users: PendingUser[] } }>(
      `/api/admin/users${qs}`
    );
    return body.data.users;
  }

  static async approveUser(id: string): Promise<void> {
    await this.fetch(`/api/admin/users/${id}/approve`, { method: "PATCH" });
  }

  static async rejectUser(id: string, notes?: string): Promise<void> {
    await this.fetch(`/api/admin/users/${id}/reject`, {
      method: "PATCH",
      body: JSON.stringify({ notes }),
    });
  }

  /** Ends every admin session server-side (tokens are revoked, not just forgotten). */
  static async logout(): Promise<void> {
    try {
      if (this.getToken()) await this.fetch("/api/admin/logout", { method: "POST" });
    } catch {
      /* already invalid */
    } finally {
      this.clearAdmin();
    }
  }

  /**
   * KYC documents are private: fetch with the admin token and open the PDF from
   * a blob URL (a plain link can't carry the Authorization header).
   */
  static async openKycDocument(ref: string): Promise<void> {
    const win = window.open("", "_blank", "noopener");
    const file = ref.replace(/^\/kyc\//, "");
    const res = await fetch(`${API_BASE}/api/admin/kyc/${encodeURIComponent(file)}`, {
      headers: { Authorization: `Bearer ${this.getToken() ?? ""}` },
    });
    if (!res.ok) {
      win?.close();
      if (res.status === 401) this.clearAdmin();
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error?.message ?? "Could not open document");
    }
    const url = URL.createObjectURL(await res.blob());
    if (win) win.location.href = url;
    else window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  static async suspendUser(id: string, reason: string): Promise<void> {
    await this.fetch(`/api/admin/users/${id}/suspend`, {
      method: "PATCH",
      body: JSON.stringify({ reason }),
    });
  }

  static async reinstateUser(id: string): Promise<void> {
    await this.fetch(`/api/admin/users/${id}/reinstate`, { method: "PATCH" });
  }

  // ── Dispute console ──

  static async getDisputes(status: "OPEN" | "ESCALATED" | "RESOLVED" | "ALL" = "ALL"): Promise<AdminDispute[]> {
    const body = await this.fetch<{ success: boolean; data: { disputes: AdminDispute[] } }>(
      `/api/admin/disputes?status=${status}`
    );
    return body.data.disputes;
  }

  static async resolveDispute(
    bookingId: string,
    input: { decision: AdminDecision; resolutionAmountPaise?: number; resolutionNotes: string }
  ): Promise<void> {
    await this.fetch(`/api/admin/disputes/${bookingId}/resolve`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  // ── Escrow ledger: owner payouts & renter refunds ──

  static async getTransactions(filter: { direction?: "TO_OWNER" | "TO_RENTER"; status?: string } = {}): Promise<AdminTransaction[]> {
    const qs = new URLSearchParams(
      Object.entries(filter).filter(([, v]) => v) as [string, string][]
    ).toString();
    const body = await this.fetch<{ success: boolean; data: { transactions: AdminTransaction[] } }>(
      `/api/admin/transactions${qs ? `?${qs}` : ""}`
    );
    return body.data.transactions;
  }

  static async markPayoutPaid(id: string, utrReference: string): Promise<void> {
    await this.fetch(`/api/admin/transactions/${id}/mark-paid`, {
      method: "POST",
      body: JSON.stringify({ utrReference }),
    });
  }

  static async retryRefund(id: string): Promise<void> {
    await this.fetch(`/api/admin/transactions/${id}/retry`, { method: "POST" });
  }
}
