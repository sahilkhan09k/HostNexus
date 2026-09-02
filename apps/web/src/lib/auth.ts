interface User {
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

interface AuthResponse {
  success: boolean;
  data: {
    user: User;
    token: string;
  };
}

interface LoginCredentials {
  email: string;
  password: string;
}

interface RegisterCredentials {
  email: string;
  password: string;
  businessName: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export class AuthService {
  private static TOKEN_KEY = "hostnexus_token";
  private static USER_KEY = "hostnexus_user";
  static BUSINESS_KEY = "hostnexus_business";

  static getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(this.TOKEN_KEY);
  }

  static getUser(): User | null {
    if (typeof window === "undefined") return null;
    const userJson = localStorage.getItem(this.USER_KEY);
    return userJson ? JSON.parse(userJson) : null;
  }

  static getBusiness(): Business | null {
    if (typeof window === "undefined") return null;
    const json = localStorage.getItem(this.BUSINESS_KEY);
    return json ? JSON.parse(json) : null;
  }

  static setBusiness(business: Business): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(this.BUSINESS_KEY, JSON.stringify(business));
  }

  static async fetchAndStoreBusiness(token: string): Promise<Business | null> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/business/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      const data = await res.json();
      const business = data.data.business as Business;
      this.setBusiness(business);
      return business;
    } catch {
      return null;
    }
  }

  static setAuth(token: string, user: User): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  }

  static clearAuth(): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    localStorage.removeItem(this.BUSINESS_KEY);
  }

  static async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Login failed" }));
      throw new Error(error.message || "Invalid email or password");
    }

    const data: AuthResponse = await response.json();
    this.setAuth(data.data.token, data.data.user);
    await this.fetchAndStoreBusiness(data.data.token);
    return data;
  }

  static async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Registration failed" }));
      throw new Error(error.message || "Registration failed");
    }

    const data: AuthResponse = await response.json();
    this.setAuth(data.data.token, data.data.user);
    await this.fetchAndStoreBusiness(data.data.token);
    return data;
  }

  static logout(): void {
    this.clearAuth();
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  }
}
