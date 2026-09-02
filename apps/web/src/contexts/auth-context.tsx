"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { AuthService, type Business } from "@/lib/auth";

interface User {
  id: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

interface AuthContextType {
  user: User | null;
  business: Business | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, businessName: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedUser = AuthService.getUser();
    const storedBusiness = AuthService.getBusiness();
    setUser(storedUser);
    setBusiness(storedBusiness);
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const response = await AuthService.login({ email, password });
    setUser(response.data.user);
    setBusiness(AuthService.getBusiness());
  };

  const register = async (email: string, password: string, businessName: string) => {
    const response = await AuthService.register({ email, password, businessName });
    setUser(response.data.user);
    setBusiness(AuthService.getBusiness());
  };

  const logout = () => {
    AuthService.logout();
    setUser(null);
    setBusiness(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, business, isLoading, isAuthenticated: !!user, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
