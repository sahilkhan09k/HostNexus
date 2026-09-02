"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Loader2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RESOURCE_TYPES } from "@/schemas/resource.schema";

// ─── Constants ────────────────────────────────────────────────────────────────

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

const INPUT_BASE =
  "w-full rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-sm text-stone-800 placeholder:text-stone-400 focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed";

const INPUT_ERROR =
  "border-rose-300 focus:border-rose-400 focus:ring-rose-500/20";

const LABEL_BASE =
  "block text-xs font-semibold uppercase tracking-wider text-stone-500 mb-1.5";

const ERROR_BASE = "text-rose-600 text-xs mt-1";

const STATUS_OPTIONS = [
  { value: "available", label: "Available" },
  { value: "unavailable", label: "Unavailable" },
  { value: "maintenance", label: "Under Maintenance" },
  { value: "reserved", label: "Reserved" },
] as const;

type ResourceStatus = (typeof STATUS_OPTIONS)[number]["value"];

// ─── Types ────────────────────────────────────────────────────────────────────

interface ResourceData {
  id: string;
  name: string;
  resourceType: string;
  description: string | null;
  quantity: number;
  unit: string | null;
  location: string | null;
  status: string;
  isActive: boolean;
}

interface FormValues {
  name: string;
  resourceType: string;
  description: string;
  quantity: string; // string for controlled input
  unit: string;
  location: string;
  status: ResourceStatus;
  isActive: boolean;
}

interface FormErrors {
  name?: string;
  resourceType?: string;
  description?: string;
  quantity?: string;
  unit?: string;
  location?: string;
}

type TouchedFields = Partial<Record<keyof FormValues, boolean>>;

// ─── Validation ───────────────────────────────────────────────────────────────

function validate(values: FormValues): FormErrors {
  const errors: FormErrors = {};

  if (!values.name.trim()) {
    errors.name = "Resource name is required";
  } else if (values.name.trim().length < 3) {
    errors.name = "Name must be at least 3 characters";
  } else if (values.name.trim().length > 100) {
    errors.name = "Name cannot exceed 100 characters";
  }

  if (!values.resourceType) {
    errors.resourceType = "Please select a resource category";
  } else if (!(RESOURCE_TYPES as readonly string[]).includes(values.resourceType)) {
    errors.resourceType = "Please select a valid resource category";
  }

  if (values.description.length > 1000) {
    errors.description = "Description must be 1000 characters or less";
  }

  const qty = parseInt(values.quantity, 10);
  if (!values.quantity || isNaN(qty)) {
    errors.quantity = "Quantity is required";
  } else if (!Number.isInteger(qty)) {
    errors.quantity = "Quantity must be a whole number";
  } else if (qty < 1) {
    errors.quantity = "Quantity must be at least 1";
  } else if (qty > 10000) {
    errors.quantity = "Quantity cannot exceed 10,000";
  }

  if (values.unit.length > 50) {
    errors.unit = "Unit must be 50 characters or less";
  }

  if (values.location.length > 200) {
    errors.location = "Location must be 200 characters or less";
  }

  return errors;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EditResourcePage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  // ── Fetch state ─────────────────────────────────────────────────────────────
  const [fetchLoading, setFetchLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [values, setValues] = useState<FormValues>({
    name: "",
    resourceType: "",
    description: "",
    quantity: "1",
    unit: "",
    location: "",
    status: "available",
    isActive: true,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<TouchedFields>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [errorDismissed, setErrorDismissed] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // ── Fetch the resource on mount ─────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;

    const fetchResource = async () => {
      setFetchLoading(true);
      setFetchError(null);
      try {
        const token = localStorage.getItem("hostnexus_token");
        if (!token) {
          router.replace("/login");
          return;
        }

        // Fetch all user's resources and find the matching one.
        // The /api/resources endpoint returns resources owned by the
        // authenticated user, so this naturally enforces ownership.
        const res = await fetch(`${API_URL}/api/resources`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          throw new Error("Failed to load resources");
        }

        const data = await res.json();
        const list: ResourceData[] = data?.data?.resources ?? [];
        const found = list.find((r) => r.id === id) ?? null;

        if (!found) {
          setFetchError("not_found");
          return;
        }

        // Pre-fill form
        setValues({
          name: found.name ?? "",
          resourceType: found.resourceType ?? "",
          description: found.description ?? "",
          quantity: String(found.quantity ?? 1),
          unit: found.unit ?? "",
          location: found.location ?? "",
          status: (found.status as ResourceStatus) ?? "available",
          isActive: found.isActive ?? true,
        });
      } catch (err) {
        setFetchError(
          err instanceof Error ? err.message : "Failed to load resource"
        );
      } finally {
        setFetchLoading(false);
      }
    };

    fetchResource();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ── Reset error-dismissed state when a new submitError arrives ──────────────
  useEffect(() => {
    if (submitError) setErrorDismissed(false);
  }, [submitError]);

  // ── Field handlers ──────────────────────────────────────────────────────────
  const handleChange = useCallback(
    <K extends keyof FormValues>(field: K, value: FormValues[K]) => {
      setValues((prev) => ({ ...prev, [field]: value }));
      // Clear the error for this field as the user types
      setErrors((prev) => {
        if (!prev[field as keyof FormErrors]) return prev;
        const next = { ...prev };
        delete next[field as keyof FormErrors];
        return next;
      });
    },
    []
  );

  const handleBlur = useCallback((field: keyof FormValues) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    setErrors((prev) => {
      // Re-validate the entire form on blur so cross-field deps stay correct
      const currentValues = { ...values };
      const allErrors = validate(currentValues);
      return { ...prev, [field]: allErrors[field as keyof FormErrors] };
    });
  }, [values]);

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      // Touch all fields to surface errors
      const allTouched: TouchedFields = Object.fromEntries(
        (Object.keys(values) as Array<keyof FormValues>).map((k) => [k, true])
      );
      setTouched(allTouched);

      const validationErrors = validate(values);
      setErrors(validationErrors);

      if (Object.keys(validationErrors).length > 0) return;

      setIsSubmitting(true);
      setSubmitError(null);

      try {
        const token = localStorage.getItem("hostnexus_token");
        if (!token) {
          router.replace("/login");
          return;
        }

        const body = {
          name: values.name.trim(),
          resourceType: values.resourceType,
          description: values.description.trim() || undefined,
          quantity: parseInt(values.quantity, 10),
          unit: values.unit.trim() || undefined,
          location: values.location.trim() || undefined,
          status: values.status,
          isActive: values.isActive,
        };

        const res = await fetch(`${API_URL}/api/resources/${id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(
            errData?.message ?? `Update failed (${res.status})`
          );
        }

        setShowSuccess(true);
        setTimeout(() => {
          router.push("/dashboard/inventory");
        }, 1500);
      } catch (err) {
        setSubmitError(
          err instanceof Error ? err.message : "Something went wrong"
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [id, router, values]
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // Render: loading
  // ─────────────────────────────────────────────────────────────────────────────

  if (fetchLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Render: not found / fetch error
  // ─────────────────────────────────────────────────────────────────────────────

  if (fetchError) {
    return (
      <div className="space-y-6">
        <div className="max-w-2xl mx-auto">
          <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-1.5">
            <Link
              href="/dashboard/inventory"
              className="text-sm text-stone-500 hover:text-stone-700 transition-colors"
            >
              My Listings
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-stone-400" aria-hidden="true" />
            <span className="text-sm text-stone-800 font-medium">Edit Resource</span>
          </nav>

          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center">
            <AlertCircle className="mx-auto h-10 w-10 text-rose-500 mb-4" aria-hidden="true" />
            <p className="text-base font-semibold text-rose-800 mb-1">
              {fetchError === "not_found" ? "Resource not found" : "Failed to load resource"}
            </p>
            <p className="text-sm text-rose-600 mb-6">
              {fetchError === "not_found"
                ? "This resource doesn't exist or you don't have permission to edit it."
                : fetchError}
            </p>
            <Link
              href="/dashboard/inventory"
              className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-5 py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-all"
            >
              Back to Inventory
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Render: form
  // ─────────────────────────────────────────────────────────────────────────────

  const showErrorBanner = !!submitError && !errorDismissed;

  return (
    <div className="space-y-6">
      <div className="max-w-2xl mx-auto">

        {/* ── Breadcrumb ─────────────────────────────────────────────────────── */}
        <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-1.5">
          <Link
            href="/dashboard/inventory"
            className="text-sm text-stone-500 hover:text-stone-700 transition-colors"
          >
            My Listings
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-stone-400" aria-hidden="true" />
          <span className="text-sm text-stone-800 font-medium">Edit Resource</span>
        </nav>

        {/* ── Page header ────────────────────────────────────────────────────── */}
        <div className="mb-8">
          <h1 className="font-display text-2xl font-bold text-stone-900">
            Edit Resource
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            Update the details for your listing
          </p>
        </div>

        {/* ── Success banner ─────────────────────────────────────────────────── */}
        <AnimatePresence>
          {showSuccess && (
            <motion.div
              key="success-banner"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              role="status"
              aria-live="polite"
              className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex items-center gap-3 mb-6"
            >
              <CheckCircle2
                className="h-4 w-4 text-emerald-600 shrink-0"
                aria-hidden="true"
              />
              <p className="text-sm font-medium text-emerald-800">
                Resource updated! Redirecting to inventory...
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Form card ──────────────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.06)]">
          <h2 className="text-base font-semibold text-stone-900 mb-6">
            Resource Details
          </h2>

          {/* Error banner */}
          {showErrorBanner && (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 p-4 flex items-start gap-3 mb-6"
            >
              <AlertCircle className="h-4 w-4 text-rose-600 mt-0.5 shrink-0" aria-hidden="true" />
              <p className="text-sm text-rose-700 flex-1">{submitError}</p>
              <button
                type="button"
                aria-label="Dismiss error"
                onClick={() => setErrorDismissed(true)}
                className="shrink-0 rounded focus:outline-none focus:ring-1 focus:ring-rose-400/50"
              >
                <X className="h-4 w-4 text-rose-400 hover:text-rose-600 transition-colors duration-150" />
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="space-y-5">

              {/* Resource Category */}
              <div>
                <label htmlFor="resourceType" className={LABEL_BASE}>
                  Resource Category <span className="text-rose-500">*</span>
                </label>
                <select
                  id="resourceType"
                  name="resourceType"
                  value={values.resourceType}
                  onChange={(e) => handleChange("resourceType", e.target.value)}
                  onBlur={() => handleBlur("resourceType")}
                  disabled={isSubmitting}
                  aria-invalid={touched.resourceType && !!errors.resourceType}
                  aria-describedby={
                    touched.resourceType && errors.resourceType
                      ? "resourceType-error"
                      : undefined
                  }
                  className={cn(
                    INPUT_BASE,
                    "appearance-none cursor-pointer",
                    touched.resourceType && errors.resourceType && INPUT_ERROR
                  )}
                >
                  <option value="" disabled>
                    Select a category
                  </option>
                  {RESOURCE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                {touched.resourceType && errors.resourceType && (
                  <p id="resourceType-error" className={ERROR_BASE} role="alert">
                    {errors.resourceType}
                  </p>
                )}
              </div>

              {/* Resource Name */}
              <div>
                <label htmlFor="name" className={LABEL_BASE}>
                  Resource Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={values.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  onBlur={() => handleBlur("name")}
                  disabled={isSubmitting}
                  placeholder="e.g., Grand Banquet Hall"
                  autoComplete="off"
                  aria-invalid={touched.name && !!errors.name}
                  aria-describedby={
                    touched.name && errors.name ? "name-error" : undefined
                  }
                  className={cn(
                    INPUT_BASE,
                    touched.name && errors.name && INPUT_ERROR
                  )}
                />
                {touched.name && errors.name && (
                  <p id="name-error" className={ERROR_BASE} role="alert">
                    {errors.name}
                  </p>
                )}
              </div>

              {/* Description */}
              <div>
                <label htmlFor="description" className={LABEL_BASE}>
                  Description{" "}
                  <span className="text-stone-400 font-normal normal-case tracking-normal">(optional)</span>
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={4}
                  value={values.description}
                  onChange={(e) => handleChange("description", e.target.value)}
                  onBlur={() => handleBlur("description")}
                  disabled={isSubmitting}
                  placeholder="Describe your resource in detail..."
                  maxLength={1000}
                  aria-invalid={touched.description && !!errors.description}
                  aria-describedby={
                    touched.description && errors.description
                      ? "description-error description-counter"
                      : "description-counter"
                  }
                  className={cn(
                    INPUT_BASE,
                    "resize-none",
                    touched.description && errors.description && INPUT_ERROR
                  )}
                />
                <div className="flex items-center justify-between mt-1">
                  {touched.description && errors.description ? (
                    <p id="description-error" className={ERROR_BASE} role="alert">
                      {errors.description}
                    </p>
                  ) : (
                    <span />
                  )}
                  <p
                    id="description-counter"
                    aria-live="polite"
                    className={cn(
                      "text-xs tabular-nums text-stone-400",
                      values.description.length > 950 && "text-amber-500",
                      values.description.length >= 1000 && "text-rose-500"
                    )}
                  >
                    {values.description.length}/1000
                  </p>
                </div>
              </div>

              {/* Quantity + Unit */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="quantity" className={LABEL_BASE}>
                    Available Quantity <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    id="quantity"
                    name="quantity"
                    min={1}
                    max={10000}
                    step={1}
                    value={values.quantity}
                    onChange={(e) => handleChange("quantity", e.target.value)}
                    onBlur={() => handleBlur("quantity")}
                    disabled={isSubmitting}
                    aria-invalid={touched.quantity && !!errors.quantity}
                    aria-describedby={
                      touched.quantity && errors.quantity
                        ? "quantity-error"
                        : undefined
                    }
                    className={cn(
                      INPUT_BASE,
                      touched.quantity && errors.quantity && INPUT_ERROR
                    )}
                  />
                  {touched.quantity && errors.quantity && (
                    <p id="quantity-error" className={ERROR_BASE} role="alert">
                      {errors.quantity}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="unit" className={LABEL_BASE}>
                    Unit{" "}
                    <span className="text-stone-400 font-normal normal-case tracking-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    id="unit"
                    name="unit"
                    value={values.unit}
                    onChange={(e) => handleChange("unit", e.target.value)}
                    onBlur={() => handleBlur("unit")}
                    disabled={isSubmitting}
                    placeholder="e.g., seats, hours, pieces"
                    aria-invalid={touched.unit && !!errors.unit}
                    aria-describedby={
                      touched.unit && errors.unit ? "unit-error" : undefined
                    }
                    className={cn(
                      INPUT_BASE,
                      touched.unit && errors.unit && INPUT_ERROR
                    )}
                  />
                  {touched.unit && errors.unit && (
                    <p id="unit-error" className={ERROR_BASE} role="alert">
                      {errors.unit}
                    </p>
                  )}
                </div>
              </div>

              {/* Location */}
              <div>
                <label htmlFor="location" className={LABEL_BASE}>
                  Location{" "}
                  <span className="text-stone-400 font-normal normal-case tracking-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  id="location"
                  name="location"
                  value={values.location}
                  onChange={(e) => handleChange("location", e.target.value)}
                  onBlur={() => handleBlur("location")}
                  disabled={isSubmitting}
                  placeholder="e.g., Mumbai, Maharashtra"
                  aria-invalid={touched.location && !!errors.location}
                  aria-describedby={
                    touched.location && errors.location
                      ? "location-error"
                      : undefined
                  }
                  className={cn(
                    INPUT_BASE,
                    touched.location && errors.location && INPUT_ERROR
                  )}
                />
                {touched.location && errors.location && (
                  <p id="location-error" className={ERROR_BASE} role="alert">
                    {errors.location}
                  </p>
                )}
              </div>

              {/* Status */}
              <div>
                <label htmlFor="status" className={LABEL_BASE}>
                  Availability Status
                </label>
                <select
                  id="status"
                  name="status"
                  value={values.status}
                  onChange={(e) =>
                    handleChange("status", e.target.value as ResourceStatus)
                  }
                  onBlur={() => handleBlur("status")}
                  disabled={isSubmitting}
                  className={cn(INPUT_BASE, "appearance-none cursor-pointer")}
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* List on Marketplace toggle */}
              <div className="flex items-start gap-4">
                <button
                  type="button"
                  role="switch"
                  aria-checked={values.isActive}
                  aria-label="List on Marketplace"
                  onClick={() => handleChange("isActive", !values.isActive)}
                  disabled={isSubmitting}
                  className={cn(
                    "relative inline-flex w-11 h-6 shrink-0 rounded-full transition-colors duration-200",
                    "focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-white",
                    "disabled:opacity-50",
                    values.isActive ? "bg-emerald-600" : "bg-stone-200"
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "inline-block w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 mt-0.5",
                      values.isActive ? "translate-x-5" : "translate-x-0.5"
                    )}
                  />
                </button>
                <div>
                  <p className="text-sm font-medium text-stone-700 leading-none mb-1">
                    List on Marketplace
                  </p>
                  <p className="text-xs text-stone-500 leading-relaxed">
                    When enabled, your resource will be visible to all businesses
                  </p>
                </div>
              </div>

            </div>{/* /space-y-5 */}

            {/* Action buttons */}
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-6 mt-6 border-t border-stone-100">
              <button
                type="button"
                onClick={() => router.push("/dashboard/inventory")}
                disabled={isSubmitting}
                className="rounded-xl border border-stone-200 bg-white px-5 py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-all disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-[0_2px_8px_rgba(5,150,105,0.25)] hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {isSubmitting && (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                )}
                {isSubmitting ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
}
