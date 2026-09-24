// ─────────────────────────────────────────────────────────────
// Admin auth helper — completely separate from regular AuthService
// Uses a distinct localStorage key so admin and user sessions
// never collide.
// ─────────────────────────────────────────────────────────────

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
  verificationStatus: "PENDING" | "VERIFIED" | "REJECTED";
  verificationNotes: string | null;
  gstCertificateUrl: string | null;
  aadhaarUrl: string | null;
  createdAt: string;
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
  totalResources: number;
  totalBookings: number;
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
    const body = await res.json();

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
}
