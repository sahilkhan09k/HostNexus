"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, type Easing } from "framer-motion";
import {
  Eye, EyeOff, Mail, Lock, Building, User, Phone,
  ArrowRight, CheckCircle, AlertCircle, MapPin,
  FileText, Upload, X, Loader2, ShieldCheck,
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

const INDIAN_STATES = [
  "Andhra Pradesh", "Assam", "Bihar", "Chhattisgarh", "Delhi", "Goa", "Gujarat",
  "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
  "Maharashtra", "Manipur", "Meghalaya", "Odisha", "Punjab", "Rajasthan", "Sikkim",
  "Tamil Nadu", "Telangana", "Uttar Pradesh", "Uttarakhand", "West Bengal",
];

type Step = 1 | 2 | 3;

const FIELD_LABELS: Record<string, string> = {
  email: "Email", password: "Password", ownerName: "Full name", phone: "Phone",
  businessName: "Business name", businessType: "Business type", addressLine: "Address",
  city: "City", state: "State", pincode: "Pincode",
  gstCertificateUrl: "GST Certificate",
};

interface DocUploadState {
  file: File | null;
  url: string | null;
  uploading: boolean;
  error: string | null;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

async function uploadDocToServer(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const base64Data = e.target?.result as string; // includes data:...;base64, prefix
        const res = await fetch(`${API_BASE}/api/upload`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            base64Data,
            filename: file.name,
            contentType: file.type,
          }),
        });
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody?.error?.message ?? "Upload failed");
        }
        const data = await res.json();
        // Single-file response returns data.data.fileUrl
        resolve(data.data.fileUrl as string);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("File read failed"));
    reader.readAsDataURL(file);
  });
}

function DocUploader({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: DocUploadState;
  onChange: (s: DocUploadState) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      onChange({ ...value, error: "Please upload a PDF file" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      onChange({ ...value, error: "File must be under 5 MB" });
      return;
    }
    onChange({ file, url: null, uploading: true, error: null });
    try {
      const url = await uploadDocToServer(file);
      onChange({ file, url, uploading: false, error: null });
    } catch {
      onChange({ file, url: null, uploading: false, error: "Upload failed — please retry" });
    }
  };

  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-stone-500">
        {label}
      </label>
      <p className="mb-2 text-xs text-stone-400">{hint}</p>

      {value.url ? (
        /* Uploaded state */
        <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-3">
          <CheckCircle className="h-4 w-4 shrink-0 text-green-600" />
          <span className="flex-1 truncate text-xs font-medium text-green-700">
            {value.file?.name ?? "Document uploaded"}
          </span>
          <button
            type="button"
            onClick={() => onChange({ file: null, url: null, uploading: false, error: null })}
            className="text-stone-400 hover:text-stone-600"
            aria-label="Remove file"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : value.uploading ? (
        /* Uploading state */
        <div className="flex items-center gap-3 rounded-xl border border-stone-200 bg-stone-50 p-3">
          <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
          <span className="text-xs text-stone-500">Uploading {value.file?.name}…</span>
        </div>
      ) : (
        /* Idle / error state */
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed py-4 text-sm font-medium transition-all",
            value.error
              ? "border-rose-300 bg-rose-50 text-rose-600 hover:bg-rose-50"
              : "border-stone-200 bg-stone-50 text-stone-500 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-600"
          )}
        >
          {value.error ? (
            <><AlertCircle className="h-4 w-4" /> {value.error}</>
          ) : (
            <><Upload className="h-4 w-4" /> Click to upload (PDF, max 5 MB)</>
          )}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<Step>(1);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    // Step 1 — personal
    ownerName: "",
    email: "",
    phone: "",
    password: "",
    // Step 2 — business + address
    businessName: "",
    businessType: "",
    addressLine: "",
    city: "",
    state: "",
    pincode: "",
    // Step 3 — KYC (url stored after upload)
    gstCertificateUrl: "",
  });

  const [gstDoc, setGstDoc] = useState<DocUploadState>({
    file: null, url: null, uploading: false, error: null,
  });

  // Redirect already-authenticated users
  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace("/dashboard");
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) return null;

  const set = (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setStep((s) => (s + 1) as Step);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!gstDoc.url) { setError("Please upload your GST Certificate."); return; }
    if (gstDoc.uploading) { setError("Please wait for uploads to finish."); return; }

    setSubmitting(true);
    try {
      const trimmed = Object.fromEntries(
        Object.entries(form).map(([k, v]) => [k, k === "password" ? v : v.trim()])
      );
      const payload = {
        ...trimmed,
        gstCertificateUrl: gstDoc.url,
      };

      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        // Validation errors carry the useful per-field message in details
        const detail = data?.error?.details?.[0];
        throw new Error(
          (detail && `${FIELD_LABELS[detail.path?.[0]] ?? detail.path?.[0]}: ${detail.message}`) ||
          data?.error?.message ||
          "Registration failed"
        );
      }

      // 201 — GSTIN verified automatically, so sign straight in
      await login(form.email.trim(), form.password);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = cn(
    "w-full rounded-xl border border-stone-200 bg-stone-50 py-3 pl-10 pr-4 text-sm text-stone-800",
    "placeholder:text-stone-400",
    "focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20",
    "transition-all duration-200"
  );

  const STEP_LABELS = ["Personal", "Business", "Documents"];

  return (
    <div className="flex w-full max-w-6xl overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-[0_20px_60px_-10px_rgba(0,0,0,0.12)]">

      {/* ── Left branding panel ── */}
      <div className="relative hidden w-[46%] shrink-0 flex-col justify-between overflow-hidden bg-stone-900 p-10 lg:flex xl:p-12">
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)", backgroundSize: "20px 20px" }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#16334A] via-[#0C1A26] to-[#0B0D11] opacity-95" />

        <div className="relative z-10">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600">
            <span className="text-lg font-medium text-white">H</span>
          </div>
          <h2 className="mt-8 font-display text-4xl font-semibold leading-[1.1] text-white">
            Join India&apos;s Hospitality Network
          </h2>
          <p className="mt-3 text-base leading-relaxed text-stone-400">
            Create a verified account to list resources, discover availability, and earn from idle assets.
          </p>
        </div>

        <div className="relative z-10 space-y-3">
          {[
            "Free to join — no listing fees",
            "Verified B2B businesses only",
            "Escrow-protected transactions",
            "AI-powered resource matching",
          ].map((point) => (
            <div key={point} className="flex items-center gap-2.5 text-sm text-stone-400">
              <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400" />
              {point}
            </div>
          ))}
        </div>

        {/* Step progress */}
        <div className="relative z-10">
          <p className="mb-2 text-xs text-stone-500 uppercase tracking-widest">Step {step} of 3</p>
          <div className="flex gap-2">
            {([1, 2, 3] as Step[]).map((s) => (
              <div key={s} className="flex flex-col gap-1">
                <div className={cn(
                  "h-1.5 w-16 rounded-full transition-all duration-300",
                  step >= s ? "bg-emerald-400" : "bg-stone-700"
                )} />
                <span className={cn(
                  "text-[10px] transition-colors",
                  step >= s ? "text-emerald-400" : "text-stone-600"
                )}>{STEP_LABELS[s - 1]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex min-w-0 flex-1 flex-col justify-center overflow-y-auto p-8 md:p-12">
        {/* Mobile step indicator */}
        <div className="mb-5 flex items-center gap-2 lg:hidden">
          {([1, 2, 3] as Step[]).map((s) => (
            <div key={s} className={cn("h-1.5 flex-1 rounded-full transition-all", step >= s ? "bg-emerald-500" : "bg-stone-200")} />
          ))}
        </div>

        <div className="mb-5">
          <h1 className="font-display text-3xl font-semibold text-stone-900">
            {step === 1 && "Create your account"}
            {step === 2 && "Business details"}
            {step === 3 && "Document verification"}
          </h1>
          <p className="mt-1.5 text-sm text-stone-500">
            {step === 1 ? (
              <>Already have an account?{" "}
                <Link href="/login" className="font-semibold text-emerald-600 hover:text-emerald-700 transition-colors">Sign in</Link>
              </>
            ) : (
              <button type="button" onClick={() => { setStep((s) => (s - 1) as Step); setError(""); }}
                className="font-medium text-emerald-600 hover:text-emerald-700 transition-colors">
                ← Back
              </button>
            )}
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <motion.form
          key={step}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25, ease: EASE }}
          onSubmit={step < 3 ? handleNextStep : handleSubmit}
          className="space-y-4"
        >
          {/* ──────── STEP 1: Personal info ──────── */}
          {step === 1 && (
            <>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-stone-500">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                  <input type="text" required minLength={2} placeholder="Your full name" value={form.ownerName} onChange={set("ownerName")} className={inputCls} />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-stone-500">Business Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                  <input type="email" required pattern="[^@\s]+@[^@\s]+\.[^@\s]{2,}" title="Enter a valid email like you@business.com" placeholder="you@yourbusiness.com" value={form.email} onChange={set("email")} className={inputCls} />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-stone-500">Mobile Number</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                  <input type="tel" required placeholder="9876543210" value={form.phone} onChange={set("phone")}
                    pattern="[0-9]{10,13}" title="Enter a valid 10-digit mobile number" className={inputCls} />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-stone-500">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                  <input type={showPassword ? "text" : "password"} required minLength={8}
                    placeholder="Min. 8 characters" value={form.password} onChange={set("password")}
                    className={cn(inputCls, "pr-11")} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ──────── STEP 2: Business + Address ──────── */}
          {step === 2 && (
            <>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-stone-500">Business Name</label>
                <div className="relative">
                  <Building className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                  <input type="text" required minLength={2} placeholder="Your registered business name" value={form.businessName} onChange={set("businessName")} className={inputCls} />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-stone-500">Business Type</label>
                <select required value={form.businessType} onChange={set("businessType")}
                  className={cn("w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-800 focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all", !form.businessType && "text-stone-400")}>
                  <option value="" disabled>Select business type</option>
                  {BUSINESS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-stone-500">Business Address</label>
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                  <input type="text" required minLength={5} title="Enter at least 5 characters" placeholder="Street / Area / Locality" value={form.addressLine} onChange={set("addressLine")} className={inputCls} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-stone-500">City</label>
                  <input type="text" required minLength={2} placeholder="Pune" value={form.city} onChange={set("city")}
                    className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-800 placeholder:text-stone-400 focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-stone-500">Pincode</label>
                  <input type="text" required placeholder="411001" value={form.pincode} onChange={set("pincode")}
                    pattern="\d{6}" title="Enter 6-digit pincode"
                    className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-800 placeholder:text-stone-400 focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all" />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-stone-500">State</label>
                <select required value={form.state} onChange={set("state")}
                  className={cn("w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-800 focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all", !form.state && "text-stone-400")}>
                  <option value="" disabled>Select state</option>
                  {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </>
          )}

          {/* ──────── STEP 3: KYC documents ──────── */}
          {step === 3 && (
            <>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <div className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <div>
                    <p className="text-xs font-semibold text-amber-800">Instant GST verification</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-amber-700">
                      HostNexus is a verified B2B marketplace. We read the GSTIN from your certificate and check it with the GST registry, so an active registration gets you in right away.
                    </p>
                  </div>
                </div>
              </div>

              <DocUploader
                label="GST Registration Certificate"
                hint="Form GST REG-06 PDF downloaded from the GST portal. Scanned copies and photos can't be read."
                value={gstDoc}
                onChange={(s) => { setGstDoc(s); if (s.url) setForm((f) => ({ ...f, gstCertificateUrl: s.url! })); }}
              />

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input type="checkbox" required className="mt-0.5 h-4 w-4 accent-emerald-600" />
                <span className="text-xs text-stone-500">
                  I confirm the document is genuine and I agree to the{" "}
                  <Link href="#" className="text-emerald-600 underline hover:text-emerald-700">Terms of Service</Link>
                  {" "}and{" "}
                  <Link href="#" className="text-emerald-600 underline hover:text-emerald-700">Privacy Policy</Link>.
                </span>
              </label>
            </>
          )}

          <button
            type="submit"
            disabled={submitting || gstDoc.uploading}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold text-white",
              "bg-emerald-600 shadow-[0_2px_8px_rgba(235,131,34,0.30)]",
              "hover:bg-emerald-700 hover:shadow-[0_4px_16px_rgba(235,131,34,0.40)]",
              "transition-all duration-200 active:scale-[0.98]",
              "disabled:opacity-60 disabled:cursor-not-allowed"
            )}
          >
            {submitting ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Verifying GSTIN…</>
            ) : step < 3 ? (
              <>Continue <ArrowRight className="h-4 w-4" /></>
            ) : (
              <>Verify GSTIN &amp; Create Account <FileText className="h-4 w-4" /></>
            )}
          </button>
        </motion.form>
      </div>
    </div>
  );
}
