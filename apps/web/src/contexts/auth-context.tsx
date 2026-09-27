"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { AuthService, type SafeUser, type Business, type RegisterCredentials } from "@/lib/auth";

interface AuthContextType {
  user: SafeUser | null;
  business: Business | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  /** Register with automated GSTIN KYC — does NOT log the user in; caller signs in next */
  register: (credentials: RegisterCredentials) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  fetchWithAuth: typeof AuthService.fetchWithAuth;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Pages that should NOT redirect to /dashboard even when logged in */
const PUBLIC_ONLY_PATHS = ["/login", "/register", "/pending-verification"];

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<SafeUser | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ── Boot-time session check ───────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function initSession() {
      try {
        // 1. Restore from localStorage immediately for instant UI
        const storedUser = AuthService.getUser();
        const storedBusiness = AuthService.getBusiness();

        // Only restore if the stored user is verified — avoids showing
        // a partial UI state for pending accounts that somehow have stale storage
        if (storedUser?.verificationStatus === "VERIFIED" && !cancelled) {
          setUser(storedUser);
          setBusiness(storedBusiness);
        }

        // 2. Validate against server — /api/auth/validate enforces VERIFIED status
        const validUser = await AuthService.validateSession();

        if (cancelled) return;

        if (validUser) {
          setUser(validUser);
          const biz =
            AuthService.getBusiness() ?? (await AuthService.fetchAndStoreBusiness());
          setBusiness(biz);

          // 3. Redirect verified users away from public-only pages
          if (pathname === "/" || PUBLIC_ONLY_PATHS.includes(pathname ?? "")) {
            router.replace("/dashboard");
          }
        } else {
          // Session invalid, expired, or not verified — clear stale data
          AuthService.clearAuth();
          setUser(null);
          setBusiness(null);
        }
      } catch {
        AuthService.clearAuth();
        setUser(null);
        setBusiness(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    initSession();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auth actions ──────────────────────────────────────────────

  const login = useCallback(async (email: string, password: string) => {
    const response = await AuthService.login({ email, password });
    setUser(response.data.user);
    setBusiness(AuthService.getBusiness());
  }, []);

  /**
   * KYC registration — submits full credentials, does NOT issue tokens.
   * Returns normally on 201; throws on validation / GSTIN / server error.
   * Caller (register page) signs in afterwards.
   */
  const register = useCallback(async (credentials: RegisterCredentials) => {
    await AuthService.register(credentials);
    // No tokens — do not set user/business state
  }, []);

  const logout = useCallback(() => {
    AuthService.logout();
    setUser(null);
    setBusiness(null);
  }, []);

  const fetchWithAuth = useCallback(
    (url: string, options?: RequestInit) => AuthService.fetchWithAuth(url, options),
    []
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        business,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        fetchWithAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
