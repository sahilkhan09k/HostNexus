"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, type Easing } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, ShieldCheck, AlertCircle, Loader2 } from "lucide-react";
import { AdminAuthService } from "@/lib/admin-auth";
import { cn } from "@/lib/utils";

const EASE: Easing = [0.22, 1, 0.36, 1];

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Already logged in → go to dashboard
  useEffect(() => {
    if (AdminAuthService.isLoggedIn()) router.replace("/admin/dashboard");
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await AdminAuthService.login(email, password);
      router.push("/admin/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const inputCls = cn(
    "w-full rounded-xl border border-stone-200 bg-stone-50 py-3 pl-10 pr-4 text-sm text-stone-800",
    "placeholder:text-stone-400",
    "focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0D1117] px-4">
      {/* Background grid */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.04]"
        style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "32px 32px" }}
      />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: EASE }}
        className="w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-white shadow-[0_32px_80px_-12px_rgba(0,0,0,0.5)]"
      >
        {/* Top emerald bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-emerald-400 to-emerald-600" />

        <div className="p-8">
          {/* Logo / heading */}
          <div className="mb-8 text-center">
            <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 shadow-[0_8px_24px_rgba(5,150,105,0.40)]">
              <ShieldCheck className="h-7 w-7 text-white" />
            </div>
            <h1 className="font-display text-2xl font-bold text-stone-900">Admin Portal</h1>
            <p className="mt-1 text-sm text-stone-500">HostNexus · Internal Access Only</p>
          </div>

          {error && (
            <div className="mb-5 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-stone-500">
                Admin Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <input
                  type="email" required autoComplete="username"
                  placeholder="admin@hostnexus.in"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-stone-500">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <input
                  type={showPassword ? "text" : "password"} required autoComplete="current-password"
                  placeholder="••••••••"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  className={cn(inputCls, "pr-11")}
                />
                <button type="button" onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit" disabled={loading}
              className={cn(
                "mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold text-white",
                "bg-emerald-600 shadow-[0_2px_8px_rgba(5,150,105,0.30)]",
                "hover:bg-emerald-700 transition-all active:scale-[0.98]",
                "disabled:opacity-60 disabled:cursor-not-allowed"
              )}
            >
              {loading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <><ShieldCheck className="h-4 w-4" /> Sign In to Admin</>
              }
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
