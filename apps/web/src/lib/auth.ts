interface User {
  id: string;
  email: string;
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
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export class AuthService {
  private static TOKEN_KEY = "hostnexus_token";
  private static USER_KEY = "hostnexus_user";

  static getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(this.TOKEN_KEY);
  }

  static getUser(): User | null {
    if (typeof window === "undefined") return null;
    const userJson = localStorage.getItem(this.USER_KEY);
    return userJson ? JSON.parse(userJson) : null;
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
    return data;
  }

  static logout(): void {
    this.clearAuth();
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  }
}
