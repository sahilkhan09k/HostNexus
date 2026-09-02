"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { RESOURCE_TYPES } from "@/schemas/resource.schema";
import { useResourceForm } from "../_hooks/use-resource-form";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ResourceFormProps {
  /** Called after a resource is successfully created. */
  onSuccess?: () => void;
  /** Called when the user wants to discard the form. */
  onCancel?: () => void;
  /**
   * Called whenever the form's dirty state changes.
   * Allows parent pages to react to unsaved-changes state (Task 6.1).
   */
  onDirtyChange?: (isDirty: boolean) => void;
}

// ─── Shared input class ───────────────────────────────────────────────────────

const INPUT_BASE =
  "w-full rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-sm text-stone-800 placeholder:text-stone-400 focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed";

const INPUT_ERROR =
  "border-rose-300 focus:border-rose-400 focus:ring-rose-500/20";

const LABEL_BASE =
  "block text-xs font-semibold uppercase tracking-wider text-stone-500 mb-1.5";

const ERROR_BASE = "text-rose-600 text-xs mt-1";

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * ResourceForm
 *
 * Controlled form for creating a new resource listing.
 * All form state management is delegated to the `useResourceForm` hook.
 *
 * @param props - Component props.
 * @param props.onSuccess - Called after a resource is successfully created.
 *   Typically triggers a success banner and redirect in the parent page.
 * @param props.onCancel - Called when the user clicks the Cancel button.
 *   The parent page decides whether to navigate immediately or show a
 *   confirmation dialog based on dirty state.
 * @param props.onDirtyChange - Called whenever the form's dirty state changes.
 *   Passes `true` when any field differs from its default; `false` after a
 *   reset or successful submission. Allows the parent to mount a
 *   `beforeunload` guard (Requirement 14.1).
 * @returns The rendered form card with all resource fields, inline validation
 *   feedback, a dismissible error banner, and action buttons.
 *
 * Requirements: 11.1, 11.2, 11.4
 */
export default function ResourceForm({ onSuccess, onCancel, onDirtyChange }: ResourceFormProps) {
  const {
    values,
    errors,
    touched,
    isSubmitting,
    submitError,
    isDirty,
    handleChange,
    handleBlur,
    handleSubmit,
  } = useResourceForm({ onSuccess });

  // ── Notify parent when dirty state changes (Task 6.1) ─────────────────────
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  // ── Local dismissal state for the submit error banner ──────────────────────
  // Resets to false whenever a new submitError arrives so the banner re-appears.
  const [errorDismissed, setErrorDismissed] = useState(false);

  useEffect(() => {
    if (submitError) {
      setErrorDismissed(false);
    }
  }, [submitError]);

  const showErrorBanner = !!submitError && !errorDismissed;

  return (
    // ── Outer card (Requirement 11.4) ──────────────────────────────────────
    <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.06)] w-full">

      {/* ── Section heading ─────────────────────────────────────────────── */}
      <h2 className="text-base font-semibold text-stone-900 mb-6">
        Resource Details
      </h2>

      {/* ── Task 4.9 — Error notification (above fields) ─────────────────── */}
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
            className="shrink-0 rounded text-rose-400 hover:text-rose-600 focus:outline-none focus:ring-1 focus:ring-rose-400/50 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        {/* ── Task 4.10 — All fields wrapped in space-y-5 ─────────────────── */}
        <div className="space-y-5">

          {/* ── Task 4.2 — Resource Type selector ──────────────────────────── */}
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

          {/* ── Task 4.3 — Resource Name input ──────────────────────────────── */}
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

          {/* ── Task 4.4 — Description textarea ─────────────────────────────── */}
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

          {/* ── Task 4.5 — Quantity + Unit (2-col grid) ──────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Quantity */}
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
                onChange={(e) =>
                  handleChange("quantity", parseInt(e.target.value, 10) || 1)
                }
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

            {/* Unit */}
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

          {/* ── Task 4.6 — Location input ────────────────────────────────────── */}
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
                touched.location && errors.location ? "location-error" : undefined
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

          {/* ── Task 4.7 — Active Status toggle ──────────────────────────────── */}
          <div className="flex items-start gap-4">
            <button
              type="button"
              role="switch"
              aria-checked={values.isActive}
              aria-label="List on Marketplace"
              onClick={() => handleChange("isActive", !values.isActive)}
              disabled={isSubmitting}
              className={cn(
                "relative inline-flex w-11 h-6 shrink-0 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-white disabled:opacity-50",
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

        {/* ── Task 4.8 — Cancel + Submit buttons ──────────────────────────── */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-6 mt-6 border-t border-stone-100">
          {/* Cancel */}
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded-xl border border-stone-200 bg-white px-5 py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-all disabled:opacity-50"
          >
            Cancel
          </button>

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-[0_2px_8px_rgba(5,150,105,0.25)] hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isSubmitting && (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            {isSubmitting ? "Creating..." : "Create Resource"}
          </button>
        </div>
      </form>
    </div>
  );
}
