"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, ChevronRight, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import ResourceForm from "./_components/resource-form";

// ─── Page ─────────────────────────────────────────────────────────────────────

/**
 * NewResourcePage
 *
 * Server-rendered page at `/dashboard/inventory/new` that hosts the resource
 * listing creation flow. Handles:
 * - Authentication guard — redirects unauthenticated users to `/login`.
 * - `ResourceForm` integration — wires `onSuccess`, `onCancel`, and
 *   `onDirtyChange` callbacks.
 * - Success banner — displays a confirmation message for 1.5 s before
 *   navigating to the inventory page.
 * - Unsaved-changes guard — adds a `beforeunload` listener while the form is
 *   dirty (Requirement 14.1) and shows an in-page confirmation dialog when
 *   the user clicks Cancel with unsaved changes (Requirement 14.2).
 *
 * @returns The full page layout including breadcrumb, page header, optional
 *   success banner, the `ResourceForm` component, and the cancel-confirmation
 *   modal overlay.
 *
 * Tasks: 5.1 (auth guard + layout), 5.2 (ResourceForm integration),
 *        6.1 (beforeunload guard), 6.2 (cancel confirmation dialog)
 */
export default function NewResourcePage() {
  const router = useRouter();
  const { isLoading, isAuthenticated } = useAuth();

  // ── Task 5.2 — Success banner state ─────────────────────────────────────
  const [showSuccess, setShowSuccess] = useState(false);

  // ── Task 6.1 — Dirty tracking lifted from ResourceForm ──────────────────
  const [isDirty, setIsDirty] = useState(false);

  // ── Task 6.2 — Cancel confirmation dialog state ─────────────────────────
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // ── Task 5.1 — Auth guard ────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
      return;
    }
    // Fallback: check localStorage token directly
    if (!isLoading) {
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("hostnexus_token")
          : null;
      if (!token) {
        router.replace("/login");
      }
    }
  }, [isLoading, isAuthenticated, router]);

  // ── Task 6.1 — beforeunload guard ───────────────────────────────────────
  useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isDirty]);

  // ── Task 5.2 — Success callback ─────────────────────────────────────────
  const handleSuccess = useCallback(() => {
    setShowSuccess(true);
    setTimeout(() => {
      router.push("/dashboard/inventory");
    }, 1500);
  }, [router]);

  // ── Task 5.2 / 6.2 — Cancel callback ────────────────────────────────────
  const handleCancel = useCallback(() => {
    if (!isDirty) {
      router.push("/dashboard/inventory");
    } else {
      setShowCancelConfirm(true);
    }
  }, [isDirty, router]);

  // ── Task 6.1 — Receive dirty state from ResourceForm ────────────────────
  const handleDirtyChange = useCallback((dirty: boolean) => {
    setIsDirty(dirty);
  }, []);

  // ── Loading spinner (Task 5.1) ───────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="max-w-2xl mx-auto">

        {/* ── Task 5.1 — Breadcrumb ────────────────────────────────────────── */}
        <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-1.5">
          <Link
            href="/dashboard/inventory"
            className="text-sm text-stone-500 transition-colors hover:text-stone-700"
          >
            My Listings
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-stone-400" aria-hidden="true" />
          <span className="text-sm text-stone-800 font-medium">New Resource</span>
        </nav>

        {/* ── Task 5.1 — Page header ────────────────────────────────────────── */}
        <div className="mb-8">
          <h1 className="font-display text-2xl font-bold text-stone-900">
            List New Resource
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            Fill in the details below to list your resource on the marketplace
          </p>
        </div>

        {/* ── Task 5.2 — Success banner ─────────────────────────────────────── */}
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
                Resource created! Redirecting to inventory...
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Task 5.2 — ResourceForm ───────────────────────────────────────── */}
        <ResourceForm
          onSuccess={handleSuccess}
          onCancel={handleCancel}
          onDirtyChange={handleDirtyChange}
        />
      </div>

      {/* ── Task 6.2 — Cancel confirmation dialog ────────────────────────────── */}
      <AnimatePresence>
        {showCancelConfirm && (
          <motion.div
            key="cancel-dialog-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center"
            onClick={() => setShowCancelConfirm(false)}
          >
            <motion.div
              key="cancel-dialog"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="cancel-dialog-title"
              aria-describedby="cancel-dialog-body"
              className="bg-white border border-stone-200 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl"
            >
              {/* Icon + Title */}
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50">
                  <AlertTriangle
                    className="h-4 w-4 text-amber-500"
                    aria-hidden="true"
                  />
                </div>
                <h2
                  id="cancel-dialog-title"
                  className="text-stone-900 font-semibold text-base"
                >
                  Unsaved Changes
                </h2>
              </div>

              {/* Body */}
              <p
                id="cancel-dialog-body"
                className="text-stone-500 text-sm leading-relaxed mb-6"
              >
                You have unsaved changes. Are you sure you want to leave?
              </p>

              {/* Buttons */}
              <div className="flex gap-3 justify-end">
                {/* Stay */}
                <button
                  type="button"
                  onClick={() => setShowCancelConfirm(false)}
                  className="rounded-xl border border-stone-200 bg-white px-5 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-all disabled:opacity-50"
                >
                  Stay
                </button>

                {/* Leave Anyway */}
                <button
                  type="button"
                  onClick={() => router.push("/dashboard/inventory")}
                  className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 text-sm font-semibold transition-all"
                >
                  Leave Anyway
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
