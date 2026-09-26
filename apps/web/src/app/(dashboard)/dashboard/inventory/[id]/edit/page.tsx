"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  DollarSign,
  Info,
  Loader2,
  ShieldCheck,
  X,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RESOURCE_TYPES } from "@/schemas/resource.schema";
import { AuthService } from "@/lib/auth";
import { ImageUploader } from "@/components/ui/image-uploader";
import AvailabilityManager from "@/components/ui/availability-manager";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const INPUT_BASE =
  "w-full rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-sm text-stone-800 placeholder:text-stone-400 focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed";
const LABEL_BASE = "block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5";

const STATUS_OPTIONS = [
  { value: "available", label: "Available" },
  { value: "unavailable", label: "Unavailable" },
  { value: "maintenance", label: "Under Maintenance" },
  { value: "reserved", label: "Reserved" },
] as const;

export default function EditResourcePage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [fetchLoading, setFetchLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState("");
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState("available");
  const [isActive, setIsActive] = useState(true);

  // Commercial & Chain of custody fields
  const [rentAmount, setRentAmount] = useState(0);
  const [securityDeposit, setSecurityDeposit] = useState(0);
  const [photos, setPhotos] = useState<string[]>([]);
  const [hasPreExistingDamage, setHasPreExistingDamage] = useState(false);
  const [damageDescription, setDamageDescription] = useState("");
  const [damagePhotos, setDamagePhotos] = useState<string[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (!id) return;

    const fetchResource = async () => {
      setFetchLoading(true);
      setFetchError(null);
      try {
        const res = await AuthService.fetchWithAuth(`${API_URL}/api/resources/${id}`);
        if (!res.ok) throw new Error("Failed to load resource");

        const data = await res.json();
        const found = data?.data?.resource;
        if (!found) {
          setFetchError("Resource not found");
          return;
        }

        setName(found.name || "");
        setResourceType(found.resourceType || "");
        setDescription(found.description || "");
        setQuantity(found.quantity || 1);
        setUnit(found.unit || "");
        setLocation(found.location || "");
        setStatus(found.status || "available");
        setIsActive(found.isActive !== undefined ? found.isActive : true);

        setRentAmount((found.rentAmountPaise || 0) / 100);
        setSecurityDeposit((found.securityDepositPaise || 0) / 100);
        setPhotos(found.photos || []);
        setHasPreExistingDamage(Boolean(found.hasPreExistingDamage));
        setDamageDescription(found.damageDescription || "");
        setDamagePhotos(found.damagePhotos || []);
      } catch (err: any) {
        setFetchError(err.message || "Failed to load resource");
      } finally {
        setFetchLoading(false);
      }
    };

    fetchResource();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setSubmitError("Resource name is required");
      return;
    }
    if (hasPreExistingDamage && (!damageDescription.trim() || damagePhotos.length === 0)) {
      setSubmitError("Please provide a description and at least one photo for pre-existing damage.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const payload = {
        name: name.trim(),
        resourceType,
        description: description.trim() || undefined,
        quantity: Number(quantity),
        unit: unit.trim() || undefined,
        location: location.trim() || undefined,
        status,
        isActive,
        rentAmountPaise: Math.round(Number(rentAmount) * 100),
        securityDepositPaise: Math.round(Number(securityDeposit) * 100),
        photos,
        hasPreExistingDamage,
        damageDescription: hasPreExistingDamage ? damageDescription : undefined,
        damagePhotos: hasPreExistingDamage ? damagePhotos : [],
      };

      const res = await AuthService.fetchWithAuth(`${API_URL}/api/resources/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error?.message || errData?.message || "Update failed");
      }

      setShowSuccess(true);
      setTimeout(() => {
        router.push("/dashboard/inventory");
      }, 1200);
    } catch (err: any) {
      setSubmitError(err.message || "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (fetchLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
        <h2 className="text-lg font-bold text-stone-900">{fetchError}</h2>
        <Link href="/dashboard/inventory" className="text-emerald-600 font-semibold hover:underline">
          Return to Inventory
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-stone-500">
        <Link href="/dashboard/inventory" className="hover:text-stone-800 transition-colors">
          My Listings
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-stone-400" />
        <span className="text-stone-800 font-medium">Edit Resource</span>
      </nav>

      <div>
        <h1 className="font-display text-3xl font-semibold text-stone-900">Edit Resource Listing</h1>
        <p className="text-xs text-stone-500 mt-1">Update commercial pricing, condition disclosures, and specifications.</p>
      </div>

      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-xl border border-green-200 bg-green-50 p-4 flex items-center gap-3 text-sm text-green-800 font-medium"
          >
            <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
            Resource successfully updated! Redirecting to inventory...
          </motion.div>
        )}
      </AnimatePresence>

      {submitError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 flex items-center gap-3 text-sm text-rose-800">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span className="flex-1">{submitError}</span>
          <button type="button" onClick={() => setSubmitError(null)}>
            <X className="w-4 h-4 text-rose-500" />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Details */}
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-stone-900 border-b border-stone-100 pb-3">
            Resource Information
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={LABEL_BASE}>Resource Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={INPUT_BASE}
                required
              />
            </div>

            <div>
              <label className={LABEL_BASE}>Category *</label>
              <select
                value={resourceType}
                onChange={(e) => setResourceType(e.target.value)}
                className={INPUT_BASE}
                required
              >
                {RESOURCE_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={LABEL_BASE}>Storage Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className={INPUT_BASE}
              />
            </div>

            <div>
              <label className={LABEL_BASE}>Available Quantity</label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)}
                className={INPUT_BASE}
              />
            </div>

            <div>
              <label className={LABEL_BASE}>Unit</label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className={INPUT_BASE}
              />
            </div>

            <div>
              <label className={LABEL_BASE}>Listing Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className={INPUT_BASE}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3 pt-6">
              <input
                type="checkbox"
                id="isActive"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded border-stone-300"
              />
              <label htmlFor="isActive" className="text-sm font-medium text-stone-700">
                Visible on Public Marketplace
              </label>
            </div>

            <div className="sm:col-span-2">
              <label className={LABEL_BASE}>Description</label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={INPUT_BASE}
              />
            </div>
          </div>
        </div>

        {/* Pricing & Escrow */}
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
            <DollarSign className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-semibold text-stone-900">Commercial Pricing & Escrow Terms</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={LABEL_BASE}>Daily Rental Price (₹ INR) *</label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-stone-400 font-medium">₹</span>
                <input
                  type="number"
                  min="0"
                  value={rentAmount || ""}
                  onChange={(e) => setRentAmount(parseFloat(e.target.value) || 0)}
                  className={cn(INPUT_BASE, "pl-8")}
                />
              </div>
            </div>

            <div>
              <label className={LABEL_BASE}>Refundable Security Deposit (₹ INR) *</label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-stone-400 font-medium">₹</span>
                <input
                  type="number"
                  min="0"
                  value={securityDeposit || ""}
                  onChange={(e) => setSecurityDeposit(parseFloat(e.target.value) || 0)}
                  className={cn(INPUT_BASE, "pl-8")}
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 flex items-start gap-3 text-xs text-amber-900">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p>
              Note: Updating pricing applies only to future booking requests. Existing active bookings preserve their original snapshot.
            </p>
          </div>
        </div>

        {/* Photos */}
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-stone-900 border-b border-stone-100 pb-3">Showcase Photos</h2>
          <ImageUploader
            value={photos}
            onChange={setPhotos}
            maxFiles={8}
            label="Resource Gallery Images"
            description="Manage uploaded photos"
          />
        </div>

        {/* Pre-Existing Condition */}
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
          <div className="border-b border-stone-100 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <h2 className="text-base font-semibold text-stone-900">Pre-Existing Wear & Damage Disclosure</h2>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={hasPreExistingDamage}
                onChange={(e) => setHasPreExistingDamage(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
              <span className="ml-3 text-xs font-semibold text-stone-700">
                {hasPreExistingDamage ? "Has Wear Disclosed" : "Pristine"}
              </span>
            </label>
          </div>

          {hasPreExistingDamage && (
            <div className="space-y-4 rounded-xl border border-amber-200 bg-amber-50/40 p-4">
              <div>
                <label className={LABEL_BASE}>Description of Existing Wear *</label>
                <textarea
                  rows={3}
                  value={damageDescription}
                  onChange={(e) => setDamageDescription(e.target.value)}
                  className={cn(INPUT_BASE, "bg-white")}
                  placeholder="Detail any scratches, stains, or operational wear..."
                />
              </div>

              <ImageUploader
                value={damagePhotos}
                onChange={setDamagePhotos}
                maxFiles={6}
                label="Wear & Damage Evidence Photos *"
                description="Upload close-up photos of pre-existing condition"
              />
            </div>
          )}
        </div>

        {/* Availability Windows */}
        <AvailabilityManager resourceId={id} />

        <div className="flex items-center justify-end gap-3 pt-4">
          <Link
            href="/dashboard/inventory"
            className="rounded-xl border border-stone-200 px-5 py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-colors disabled:opacity-50"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}
