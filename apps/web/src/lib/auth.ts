// ─────────────────────────────────────────────────────────────
// HostNexus AuthService
// Handles access token (15m) + refresh token (7d) lifecycle
// Registration is now a 3-step KYC flow — no tokens on register,
// account must be VERIFIED by admin before login is allowed.
// ─────────────────────────────────────────────────────────────

export interface SafeUser {
  id: string;
  email: string;
  ownerName: string | null;
  phone: string | null;
  verificationStatus: string;
  createdAt: string;
  updatedAt: string;
}

export interface Business {
  id: string;
  name: string;
  ownerId: string;
  businessType: string | null;
  addressLine: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  success: boolean;
  data: {
    user: SafeUser;
    accessToken: string;
    refreshToken: string;
  };
}

/** What the register endpoint returns — 202, no tokens */
export interface RegisterResponse {
  success: boolean;
  data: { user: SafeUser };
  message: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  ownerName: string;
  phone: string;
  businessName: string;
  businessType: string;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  gstCertificateUrl: string;
  aadhaarUrl: string;
}

interface LoginCredentials {
  email: string;
  password: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

const KEYS = {
  ACCESS_TOKEN: "hostnexus_access_token",
  REFRESH_TOKEN: "hostnexus_refresh_token",
  USER: "hostnexus_user",
  BUSINESS: "hostnexus_business",
} as const;

// ─── Token helpers ────────────────────────────────────────────

function decodeTokenPayload(token: string): { exp?: number; sub?: string } | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

function isTokenExpired(token: string): boolean {
  const payload = decodeTokenPayload(token);
  if (!payload?.exp) return true;
  return Date.now() / 1000 >= payload.exp - 60;
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

// ─── AuthService ──────────────────────────────────────────────

export class AuthService {
  // ── Getters ──────────────────────────────────────────────

  static getAccessToken(): string | null {
    if (!isBrowser()) return null;
    return localStorage.getItem(KEYS.ACCESS_TOKEN) || localStorage.getItem("hostnexus_token");
  }

  static getToken(): string | null {
    return this.getAccessToken();
  }

  static getRefreshToken(): string | null {
    if (!isBrowser()) return null;
    return localStorage.getItem(KEYS.REFRESH_TOKEN);
  }

  static getUser(): SafeUser | null {
    if (!isBrowser()) return null;
    const json = localStorage.getItem(KEYS.USER);
    return json ? (JSON.parse(json) as SafeUser) : null;
  }

  static getBusiness(): Business | null {
    if (!isBrowser()) return null;
    const json = localStorage.getItem(KEYS.BUSINESS);
    return json ? (JSON.parse(json) as Business) : null;
  }

  // ── Setters ──────────────────────────────────────────────

  static setTokens(accessToken: string, refreshToken: string): void {
    if (!isBrowser()) return;
    localStorage.setItem(KEYS.ACCESS_TOKEN, accessToken);
    localStorage.setItem(KEYS.REFRESH_TOKEN, refreshToken);
    localStorage.setItem("hostnexus_token", accessToken); // legacy compat
  }

  static setUser(user: SafeUser): void {
    if (!isBrowser()) return;
    localStorage.setItem(KEYS.USER, JSON.stringify(user));
  }

  static setBusiness(business: Business): void {
    if (!isBrowser()) return;
    localStorage.setItem(KEYS.BUSINESS, JSON.stringify(business));
  }

  static clearAuth(): void {
    if (!isBrowser()) return;
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
    localStorage.removeItem("hostnexus_token");
  }

  // ── Token refresh ─────────────────────────────────────────

  static async refreshTokens(): Promise<string | null> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return null;
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const { accessToken, refreshToken: newRefreshToken } = data.data;
      this.setTokens(accessToken, newRefreshToken);
      return accessToken;
    } catch {
      return null;
    }
  }

  // ── Authenticated fetch wrapper ───────────────────────────

  static async fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
    let accessToken = this.getAccessToken();

    if (!accessToken || isTokenExpired(accessToken)) {
      const newToken = await this.refreshTokens();
      if (!newToken) {
        this.clearAuth();
        if (isBrowser()) window.location.href = "/login";
        throw new Error("Session expired. Please log in again.");
      }
      accessToken = newToken;
    }

    const headers = new Headers(options.headers);
    headers.set("Authorization", `Bearer ${accessToken}`);
    headers.set("Content-Type", headers.get("Content-Type") || "application/json");

    const response = await fetch(url, { ...options, headers });

    if (response.status === 401) {
      const newToken = await this.refreshTokens();
      if (!newToken) {
        this.clearAuth();
        if (isBrowser()) window.location.href = "/login";
        throw new Error("Session expired. Please log in again.");
      }
      headers.set("Authorization", `Bearer ${newToken}`);
      return fetch(url, { ...options, headers });
    }

    return response;
  }

  // ── Business fetch ────────────────────────────────────────

  static async fetchAndStoreBusiness(): Promise<Business | null> {
    try {
      const res = await this.fetchWithAuth(`${API_BASE_URL}/api/business/me`);
      if (!res.ok) return null;
      const data = await res.json();
      const business = data.data.business as Business;
      this.setBusiness(business);
      return business;
    } catch {
      return null;
    }
  }

  // ── Auth actions ──────────────────────────────────────────

  /**
   * Login — throws with structured messages for PENDING / REJECTED accounts.
   */
  static async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const code: string = body?.error?.code ?? "";
      const message: string = body?.error?.message ?? body?.message ?? "Login failed";

      // Surface verification-specific codes so the UI can react
      if (code === "ACCOUNT_PENDING") {
        const err = new Error(message);
        (err as any).code = "ACCOUNT_PENDING";
        throw err;
      }
      if (code === "ACCOUNT_REJECTED") {
        const err = new Error(message);
        (err as any).code = "ACCOUNT_REJECTED";
        throw err;
      }

      throw new Error(message);
    }

    const data: AuthResponse = await response.json();
    this.setTokens(data.data.accessToken, data.data.refreshToken);
    this.setUser(data.data.user);
    await this.fetchAndStoreBusiness();
    return data;
  }

  /**
   * Register — sends the full KYC payload, returns 202 (no tokens).
   * Caller is responsible for redirecting to /pending-verification.
   */
  static async register(credentials: RegisterCredentials): Promise<RegisterResponse> {
    const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(
        body?.error?.message ||
        body?.error?.details?.[0]?.message ||
        "Registration failed"
      );
    }

    // 202 — pending verification, no tokens issued
    return response.json() as Promise<RegisterResponse>;
  }

  static logout(): void {
    this.clearAuth();
    if (isBrowser()) window.location.href = "/login";
  }

  /**
   * Session validation on app boot.
   * Calls /api/auth/validate which enforces verificationStatus === VERIFIED.
   * Returns null for PENDING / REJECTED / expired tokens.
   */
  static async validateSession(): Promise<SafeUser | null> {
    const accessToken = this.getAccessToken();
    const refreshToken = this.getRefreshToken();
    if (!accessToken && !refreshToken) return null;

    try {
      const res = await this.fetchWithAuth(`${API_BASE_URL}/api/auth/validate`);
      if (!res.ok) return null;
      const data = await res.json();
      const user = data.data.user as SafeUser;
      this.setUser(user);
      return user;
    } catch {
      return null;
    }
  }
}
