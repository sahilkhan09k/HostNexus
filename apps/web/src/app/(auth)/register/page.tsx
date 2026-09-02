"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, type Easing } from "framer-motion";
import {
  Eye, EyeOff, Mail, Lock, Building, User,
  Phone, ArrowRight, CheckCircle, AlertCircle,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

const EASE: Easing = [0.22, 1, 0.36, 1];

const BUSINESS_TYPES = [
  "Hotel / Resort",
  "Restaurant / Catering",
  "Banquet / Event Venue",
  "AV & Equipment Rental",
  "Furniture Supplier",
  "Transport / Logistics",
  "Event Organizer",
  "Other",
];

export default function RegisterPage() {
  const router = useRouter();
  const { register: registerUser } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    businessName: "",
    businessType: "",
    password: "",
  });

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await registerUser(form.email, form.password, form.businessName);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed. Please try again.");
      setStep(2);
    } finally {
      setLoading(false);
    }
  };

  const inputCls = cn(
    "w-full rounded-xl border border-stone-200 bg-stone-50 py-3 pl-10 pr-4 text-sm text-stone-800",
    "placeholder:text-stone-400",
    "focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20",
    "transition-all duration-200"
  );

  return (
    <div className="grid w-full max-w-5xl grid-cols-1 overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-[0_20px_60px_-10px_rgba(0,0,0,0.12)] lg:grid-cols-2">

      {/* Left branding panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-stone-900 p-10 lg:flex">
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-stone-900 via-stone-900 to-emerald-950 opacity-90" />

        <div className="relative z-10">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 border border-emerald-500/30">
            <span className="text-lg font-black text-emerald-400">H</span>
          </div>
          <h2 className="mt-8 font-display text-3xl font-extrabold leading-tight text-white">
            Join India&apos;s Hospitality Network
          </h2>
          <p className="mt-3 text-base leading-relaxed text-stone-400">
            Create a free account to list your resources, discover availability, and start earning from idle assets.
          </p>
        </div>

        <div className="relative z-10 space-y-3">
          {[
            "Free to join - no listing fees",
            "AI automatically finds buyers for your resources",
            "Get paid securely with escrow protection",
          ].map((point) => (
            <div key={point} className="flex items-center gap-2.5 text-sm text-stone-400">
              <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400" />
              {point}
            </div>
          ))}
        </div>

        {/* Step indicator */}
        <div className="relative z-10 flex items-center gap-2">
          <div className={cn("h-1.5 w-8 rounded-full transition-all", step === 1 ? "bg-emerald-400" : "bg-stone-600")} />
          <div className={cn("h-1.5 w-8 rounded-full transition-all", step === 2 ? "bg-emerald-400" : "bg-stone-600")} />
          <span className="ml-2 text-xs text-stone-500">Step {step} of 2</span>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex flex-col justify-center p-8 md:p-10">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold text-stone-900">
            {step === 1 ? "Create your account" : "Your business details"}
          </h1>
          <p className="mt-1.5 text-sm text-stone-500">
            {step === 1 ? (
              <>
                Already have an account?{" "}
                <Link href="/login" className="font-semibold text-emerald-600 hover:text-emerald-700 transition-colors">
                  Sign in
                </Link>
              </>
            ) : (
              <button type="button" onClick={() => setStep(1)} className="font-medium text-emerald-600 hover:text-emerald-700 transition-colors">
                ← Back to personal details
              </button>
            )}
          </p>
        </div>

        <motion.form
          key={step}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.28, ease: EASE }}
          onSubmit={step === 1 ? handleNext : handleSubmit}
          className="space-y-4"
        >
          {step === 1 ? (
            <>
              {/* Full name */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-stone-500">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                  <input type="text" required placeholder="Your full name" value={form.name} onChange={set("name")} className={inputCls} />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-stone-500">Business Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                  <input type="email" required placeholder="you@yourbusiness.com" value={form.email} onChange={set("email")} className={inputCls} />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-stone-500">Mobile Number</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                  <input type="tel" required placeholder="+91 98765 43210" value={form.phone} onChange={set("phone")} className={inputCls} />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-stone-500">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required minLength={8}
                    placeholder="Min. 8 characters"
                    value={form.password}
                    onChange={set("password")}
                    className={cn(inputCls, "pr-11")}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Business name */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-stone-500">Business Name</label>
                <div className="relative">
                  <Building className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                  <input type="text" required placeholder="Your business name" value={form.businessName} onChange={set("businessName")} className={inputCls} />
                </div>
              </div>

              {/* Business type */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-stone-500">Business Type</label>
                <select
                  required
                  value={form.businessType}
                  onChange={set("businessType")}
                  className={cn(
                    "w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-800",
                    "focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20",
                    "transition-all duration-200",
                    !form.businessType && "text-stone-400"
                  )}
                >
                  <option value="" disabled>Select your business type</option>
                  {BUSINESS_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {/* Terms */}
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input type="checkbox" required className="mt-0.5 h-4 w-4 accent-emerald-600 rounded" />
                <span className="text-xs text-stone-500">
                  I agree to the{" "}
                  <Link href="#" className="text-emerald-600 underline hover:text-emerald-700">Terms of Service</Link>
                  {" "}and{" "}
                  <Link href="#" className="text-emerald-600 underline hover:text-emerald-700">Privacy Policy</Link>
                </span>
              </label>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold text-white",
              "bg-emerald-600 shadow-[0_2px_8px_rgba(5,150,105,0.30)]",
              "hover:bg-emerald-700 hover:shadow-[0_4px_16px_rgba(5,150,105,0.40)]",
              "transition-all duration-200 active:scale-[0.98]",
              "disabled:opacity-60 disabled:cursor-not-allowed"
            )}
          >
            {loading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : step === 1 ? (
              <>Continue <ArrowRight className="h-4 w-4" /></>
            ) : (
              <>Create Account <ArrowRight className="h-4 w-4" /></>
            )}
          </button>
        </motion.form>
      </div>
    </div>
  );
}
