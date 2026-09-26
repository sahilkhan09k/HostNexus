"use client";

import { useEffect, useState, useRef } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, DollarSign, Info, Loader2, ShieldCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { RESOURCE_TYPES } from "@/schemas/resource.schema";
import { useResourceForm, type FormValues } from "../_hooks/use-resource-form";
import { ImageUploader } from "@/components/ui/image-uploader";
import AvailabilityManager, { type AvailabilityManagerHandle } from "@/components/ui/availability-manager";

export interface ResourceFormProps {
  onSuccess?: (resourceId?: string) => void;
  onCancel?: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
  initialValues?: Partial<FormValues>;
  resourceId?: string;
  submitButtonText?: string;
}

const INPUT_BASE =
  "w-full rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-sm text-stone-800 placeholder:text-stone-400 focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed";

const INPUT_ERROR = "border-rose-300 focus:border-rose-400 focus:ring-rose-500/20";
const LABEL_BASE = "block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5";
const ERROR_BASE = "text-rose-600 text-xs mt-1";

export default function ResourceForm({
  onSuccess,
  onCancel,
  onDirtyChange,
  initialValues,
  resourceId,
  submitButtonText = "Create Resource",
}: ResourceFormProps) {
  const availabilityRef = useRef<AvailabilityManagerHandle>(null);

  const {
    values,
    errors,
    touched,
    isSubmitting,
    submitError,
    isDirty,
    handleChange,
    handleBlur,
    handleSubmit: _handleSubmit,
  } = useResourceForm({
    onSuccess: async (newId) => {
      // After resource is saved, persist availability windows
      const rid = newId ?? resourceId;
      if (rid && availabilityRef.current) {
        try { await availabilityRef.current.saveToApi(rid); } catch { /* non-fatal */ }
      }
      onSuccess?.(newId);
    },
    initialValues,
    resourceId,
  });

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const [errorDismissed, setErrorDismissed] = useState(false);
  useEffect(() => {
    if (submitError) setErrorDismissed(false);
  }, [submitError]);

  return (
    <form onSubmit={_handleSubmit} className="space-y-8 w-full max-w-4xl mx-auto">
      {submitError && !errorDismissed && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm text-rose-800">{submitError}</div>
          <button
            type="button"
            aria-label="Dismiss error"
            onClick={() => setErrorDismissed(true)}
            className="text-rose-500 hover:text-rose-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── 1. Basic Details Card ────────────────────────────────────── */}
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-5">
        <div className="border-b border-stone-100 pb-4">
          <h2 className="text-base font-semibold text-stone-900">Resource Details</h2>
          <p className="text-xs text-stone-500 mt-0.5">Describe your physical resource and its category.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label htmlFor="name" className={LABEL_BASE}>Resource Name *</label>
            <input
              id="name"
              name="name"
              type="text"
              placeholder="e.g. 50-KVA Silent Diesel Generator, 100 Banquet Chairs"
              value={values.name}
              disabled={isSubmitting}
              onChange={(e) => handleChange("name", e.target.value)}
              onBlur={() => handleBlur("name")}
              className={cn(INPUT_BASE, touched.name && errors.name && INPUT_ERROR)}
            />
            {touched.name && errors.name && <p className={ERROR_BASE}>{errors.name}</p>}
          </div>

          <div>
            <label htmlFor="resourceType" className={LABEL_BASE}>Resource Category *</label>
            <select
              id="resourceType"
              name="resourceType"
              value={values.resourceType}
              disabled={isSubmitting}
              onChange={(e) => handleChange("resourceType", e.target.value)}
              onBlur={() => handleBlur("resourceType")}
              className={cn(INPUT_BASE, touched.resourceType && errors.resourceType && INPUT_ERROR)}
            >
              <option value="">Select Category</option>
              {RESOURCE_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            {touched.resourceType && errors.resourceType && <p className={ERROR_BASE}>{errors.resourceType}</p>}
          </div>

          <div>
            <label htmlFor="location" className={LABEL_BASE}>Storage / Pickup Location</label>
            <input
              id="location"
              name="location"
              type="text"
              placeholder="e.g. Mumbai, Andheri East Warehouse"
              value={values.location}
              disabled={isSubmitting}
              onChange={(e) => handleChange("location", e.target.value)}
              onBlur={() => handleBlur("location")}
              className={INPUT_BASE}
            />
          </div>

          <div>
            <label htmlFor="quantity" className={LABEL_BASE}>Available Quantity *</label>
            <input
              id="quantity"
              name="quantity"
              type="number"
              min="1"
              max="10000"
              value={values.quantity}
              disabled={isSubmitting}
              onChange={(e) => handleChange("quantity", parseInt(e.target.value, 10) || 1)}
              onBlur={() => handleBlur("quantity")}
              className={cn(INPUT_BASE, touched.quantity && errors.quantity && INPUT_ERROR)}
            />
            {touched.quantity && errors.quantity && <p className={ERROR_BASE}>{errors.quantity}</p>}
          </div>

          <div>
            <label htmlFor="unit" className={LABEL_BASE}>Unit of Measure</label>
            <input
              id="unit"
              name="unit"
              type="text"
              placeholder="e.g. units, pieces, sets, hours"
              value={values.unit}
              disabled={isSubmitting}
              onChange={(e) => handleChange("unit", e.target.value)}
              onBlur={() => handleBlur("unit")}
              className={INPUT_BASE}
            />
          </div>

          <div className="sm:col-span-2">
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="description" className="text-xs font-semibold uppercase tracking-wider text-stone-600">
                Description & Technical Specifications
              </label>
              <span className="text-xs text-stone-400">
                {values.description?.length || 0}/1000
              </span>
            </div>
            <textarea
              id="description"
              name="description"
              rows={3}
              maxLength={1000}
              placeholder="Provide specifications, dimensions, power requirements, or handling instructions..."
              value={values.description}
              disabled={isSubmitting}
              onChange={(e) => handleChange("description", e.target.value)}
              onBlur={() => handleBlur("description")}
              className={INPUT_BASE}
            />
          </div>

          {/* Active Listing Toggle */}
          <div className="sm:col-span-2 flex items-center justify-between p-4 rounded-xl border border-stone-200 bg-stone-50">
            <div>
              <label htmlFor="isActive" className="text-sm font-semibold text-stone-900 block">
                List on Marketplace
              </label>
              <p className="text-xs text-stone-500 mt-0.5">
                Make this resource immediately discoverable and bookable.
              </p>
            </div>
            <button
              type="button"
              id="isActive"
              role="switch"
              aria-checked={values.isActive}
              aria-label="List on Marketplace"
              onClick={() => handleChange("isActive", !values.isActive)}
              disabled={isSubmitting}
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2",
                values.isActive ? "bg-emerald-600" : "bg-stone-300"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                  values.isActive ? "translate-x-5" : "translate-x-0"
                )}
              />
            </button>
          </div>
        </div>
      </div>

      {/* ── 2. Commercial Pricing & Security Deposit (MVP v2) ────────── */}
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-5">
        <div className="border-b border-stone-100 pb-4">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-semibold text-stone-900">Commercial Pricing & Escrow Terms</h2>
          </div>
          <p className="text-xs text-stone-500 mt-0.5">
            Rent and refundable security deposits are held in platform escrow until inspection confirmation.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="rentAmount" className={LABEL_BASE}>Daily Rental Price (₹ INR) *</label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-stone-400 font-medium">₹</span>
              <input
                id="rentAmount"
                name="rentAmount"
                type="number"
                min="0"
                step="1"
                placeholder="0"
                value={values.rentAmount || ""}
                disabled={isSubmitting}
                onChange={(e) => handleChange("rentAmount", parseFloat(e.target.value) || 0)}
                onBlur={() => handleBlur("rentAmount")}
                className={cn(INPUT_BASE, "pl-8", touched.rentAmount && errors.rentAmount && INPUT_ERROR)}
              />
            </div>
            {touched.rentAmount && errors.rentAmount && <p className={ERROR_BASE}>{errors.rentAmount}</p>}
            <p className="text-[11px] text-stone-400 mt-1">Per day or billing cycle per unit.</p>
          </div>

          <div>
            <label htmlFor="securityDeposit" className={LABEL_BASE}>Refundable Security Deposit (₹ INR) *</label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-stone-400 font-medium">₹</span>
              <input
                id="securityDeposit"
                name="securityDeposit"
                type="number"
                min="0"
                step="1"
                placeholder="0"
                value={values.securityDeposit || ""}
                disabled={isSubmitting}
                onChange={(e) => handleChange("securityDeposit", parseFloat(e.target.value) || 0)}
                onBlur={() => handleBlur("securityDeposit")}
                className={cn(INPUT_BASE, "pl-8", touched.securityDeposit && errors.securityDeposit && INPUT_ERROR)}
              />
            </div>
            {touched.securityDeposit && errors.securityDeposit && <p className={ERROR_BASE}>{errors.securityDeposit}</p>}
            <p className="text-[11px] text-stone-400 mt-1">Held in escrow; auto-released 2h after return if no damage reported.</p>
          </div>
        </div>

        {/* Guideline recommendation note */}
        <div className="rounded-xl border border-amber-200/80 bg-amber-50/70 p-3.5 flex items-start gap-3 text-xs text-amber-900">
          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Platform Recommendation:</span> Keep the security deposit reasonable and proportionate to the resource's replacement value. High deposits can reduce renter booking conversions.
          </div>
        </div>
      </div>

      {/* ── 3. Resource Showcase Gallery ──────────────────────────────── */}
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
        <div className="border-b border-stone-100 pb-4">
          <h2 className="text-base font-semibold text-stone-900">Showcase Photos</h2>
          <p className="text-xs text-stone-500 mt-0.5">High-resolution photos showcasing the general appearance and condition.</p>
        </div>

        <ImageUploader
          value={values.photos}
          onChange={(urls) => handleChange("photos", urls)}
          maxFiles={8}
          label="Resource Gallery Images"
          description="Upload front, side, and operational views"
        />
      </div>

      {/* ── 4. Digital Chain of Custody: Pre-Existing Damage Disclosure ── */}
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-5">
        <div className="border-b border-stone-100 pb-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <h2 className="text-base font-semibold text-stone-900">Pre-Existing Wear & Damage Disclosure</h2>
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              Digital Chain of Custody: Disclosing pre-existing condition prevents disputes upon return.
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={values.hasPreExistingDamage}
              onChange={(e) => handleChange("hasPreExistingDamage", e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
            <span className="ml-3 text-xs font-semibold text-stone-700">
              {values.hasPreExistingDamage ? "Has Pre-Existing Wear" : "Pristine / No Damage"}
            </span>
          </label>
        </div>

        {values.hasPreExistingDamage ? (
          <div className="space-y-4 rounded-xl border border-amber-200 bg-amber-50/40 p-4">
            <div className="flex items-start gap-2.5 text-xs text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p>
                Declare any pre-existing scratches, stains, dents, or operational quirks. This disclosure becomes part of the immutable booking snapshot and protects both parties.
              </p>
            </div>

            <div>
              <label htmlFor="damageDescription" className={LABEL_BASE}>
                Detailed Description of Existing Wear *
              </label>
              <textarea
                id="damageDescription"
                name="damageDescription"
                rows={3}
                placeholder="e.g. Scratch on left aluminum casing; small stain on seat fabric #12; minor dent on bottom rim."
                value={values.damageDescription}
                onChange={(e) => handleChange("damageDescription", e.target.value)}
                onBlur={() => handleBlur("damageDescription")}
                className={cn(INPUT_BASE, "bg-white", touched.damageDescription && errors.damageDescription && INPUT_ERROR)}
              />
              {touched.damageDescription && errors.damageDescription && (
                <p className={ERROR_BASE}>{errors.damageDescription}</p>
              )}
            </div>

            <ImageUploader
              value={values.damagePhotos}
              onChange={(urls) => handleChange("damagePhotos", urls)}
              maxFiles={6}
              label="Damage & Wear Photos (Required) *"
              description="Capture close-up photos highlighting the pre-existing wear or blemishes"
            />
            {touched.damagePhotos && errors.damagePhotos && (
              <p className={ERROR_BASE}>{errors.damagePhotos}</p>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-green-100 bg-green-50/60 p-4 flex items-center gap-3 text-xs text-green-900">
            <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
            <div>
              <span className="font-semibold">Declared Pristine Condition:</span> You declare this resource is in good operating condition with no notable defects. Renters will verify this condition upon handover.
            </div>
          </div>
        )}
      </div>

      {/* ── 5. Availability Windows ──────────────────────────────── */}
      <AvailabilityManager
        ref={availabilityRef}
        resourceId={resourceId}
      />

      {/* ── 6. Action Buttons ────────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="rounded-xl border border-stone-200 px-5 py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-colors disabled:opacity-50"
        >
          {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
          <span>{isSubmitting ? (resourceId ? "Saving..." : "Creating...") : submitButtonText}</span>
        </button>
      </div>
    </form>
  );
}
