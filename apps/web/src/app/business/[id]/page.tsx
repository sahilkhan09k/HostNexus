"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence, type Easing } from "framer-motion";
import {
  ArrowLeft, Star, Building2, MapPin, Package, TrendingUp,
  TrendingDown, Award, ShieldCheck, Clock, AlertTriangle,
  ChevronLeft, ChevronRight, Loader2, Users,
} from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { cn } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const EASE: Easing = [0.22, 1, 0.36, 1];

// ─── API types ────────────────────────────────────────────────

interface BusinessProfile {
  business: {
    id: string;
    name: string;
    businessType: string | null;
    addressLine: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    createdAt: string;
    owner: { id: string; ownerName: string | null; verificationStatus: string };
    resources: {
      id: string; name: string; resourceType: string;
      rentAmountPaise: number; location: string | null; photos: string[];
    }[];
  };
  reputation: {
    asOwnerRating: number | null;
    asOwnerReviewCount: number;
    asRenterRating: number | null;
    asRenterReviewCount: number;
    overallRating: number | null;
    resourcesGiven: number;
    resourcesTaken: number;
    completedBookings: number;
    totalReviews: number;
    recentReviews: {
      rating: number;
      reviewerRole: string;
      comment: string | null;
      createdAt: string;
      reviewer: { id: string; name: string; businessType: string | null; city: string | null };
    }[];
  };
}

// ─── Helpers ──────────────────────────────────────────────────

function StarRow({ rating, size = "sm" }: { rating: number | null; size?: "sm" | "lg" }) {
  const filled = Math.round(rating ?? 0);
  const cls = size === "lg" ? "h-5 w-5" : "h-3.5 w-3.5";
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(cls, i < filled ? "fill-amber-400 text-amber-400" : "fill-stone-200 text-stone-200")}
        />
      ))}
    </div>
  );
}

function RatingCard({ label, rating, count, accent, index }: {
  label: string; rating: number | null; count: number;
  accent: string; index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: 0.1 + index * 0.08, ease: EASE }}
      className="flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">{label}</p>
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-full", accent)}>
          <Award className="h-4 w-4 text-white" />
        </div>
      </div>
      {rating !== null ? (
        <>
          <div className="flex items-end gap-2">
            <span className="font-display text-4xl font-semibold tracking-tight tabular-nums text-stone-900">{rating.toFixed(1)}</span>
            <span className="mb-1 text-xs text-stone-400">/ 5</span>
          </div>
          <StarRow rating={rating} />
          <p className="text-xs text-stone-400">{count} {count === 1 ? "review" : "reviews"}</p>
        </>
      ) : (
        <div className="flex flex-col gap-1 pt-2">
          <span className="font-display text-3xl font-semibold tabular-nums text-stone-300">—</span>
          <span className="text-xs text-stone-400">No reviews yet</span>
        </div>
      )}
    </motion.div>
  );
}

function ReviewCard({ review, index }: {
  review: BusinessProfile["reputation"]["recentReviews"][0];
  index: number;
}) {
  const isOwnerReview = review.reviewerRole === "RENTER"; // renter reviewed the owner
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.06, ease: EASE }}
      className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        {/* Reviewer info */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-sm font-bold text-stone-600">
            {review.reviewer.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-stone-900">{review.reviewer.name}</p>
            <div className="flex items-center gap-1.5 text-xs text-stone-400">
              {review.reviewer.businessType && <span>{review.reviewer.businessType}</span>}
              {review.reviewer.city && (
                <>
                  <span>·</span>
                  <span className="flex items-center gap-0.5">
                    <MapPin className="h-2.5 w-2.5" />{review.reviewer.city}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: role badge + date */}
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className={cn(
            "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
            isOwnerReview
              ? "bg-emerald-100 text-emerald-700"
              : "bg-sky-100 text-sky-700"
          )}>
            {isOwnerReview ? "As Owner" : "As Renter"}
          </span>
          <span className="text-[10px] text-stone-400">
            {new Date(review.createdAt).toLocaleDateString("en-IN", {
              day: "2-digit", month: "short", year: "numeric",
            })}
          </span>
        </div>
      </div>

      {/* Stars + comment */}
      <div className="mt-3">
        <StarRow rating={review.rating} />
        {review.comment && (
          <p className="mt-2 text-sm leading-relaxed text-stone-600">{review.comment}</p>
        )}
      </div>
    </motion.div>
  );
}

const TYPE_BG: Record<string, string> = {
  "Banquet Hall":     "bg-gradient-to-br from-violet-100 to-indigo-100",
  "Event Space":      "bg-gradient-to-br from-rose-100 to-pink-100",
  "Kitchen Facility": "bg-gradient-to-br from-amber-100 to-orange-100",
  "AV Equipment":     "bg-gradient-to-br from-sky-100 to-blue-100",
  "Furniture":        "bg-gradient-to-br from-lime-100 to-green-100",
  "Vehicle":          "bg-gradient-to-br from-teal-100 to-emerald-100",
};

// ─── Page ─────────────────────────────────────────────────────

export default function BusinessProfilePage() {
  const params = useParams();
  const businessId = params?.id as string;

  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewPage, setReviewPage] = useState(0);
  const REVIEWS_PER_PAGE = 5;

  useEffect(() => {
    if (!businessId) return;
    setLoading(true);
    fetch(`${API_BASE}/api/reviews/business/${businessId}`)
      .then(r => r.json())
      .then(body => {
        if (!body.success) throw new Error(body.error?.message ?? "Failed to load");
        setProfile(body.data as BusinessProfile);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [businessId]);

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col">
        <Navbar />
        <div className="flex flex-1 items-center justify-center pt-24">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
        <Footer />
      </div>
    );
  }

  // ── Error ──
  if (error || !profile) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col">
        <Navbar />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 pt-24 text-center">
          <div className="rounded-full bg-rose-50 p-4 text-rose-500">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <p className="text-base font-semibold text-stone-800">Business not found</p>
          <Link href="/marketplace"
            className="flex items-center gap-2 rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to Marketplace
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const { business, reputation } = profile;
  const reviews = reputation.recentReviews;
  const totalPages = Math.ceil(reviews.length / REVIEWS_PER_PAGE);
  const visibleReviews = reviews.slice(reviewPage * REVIEWS_PER_PAGE, (reviewPage + 1) * REVIEWS_PER_PAGE);

  const memberSince = new Date(business.createdAt).toLocaleDateString("en-IN", {
    month: "long", year: "numeric",
  });

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <Navbar />

      <main className="mx-auto max-w-screen-xl px-5 pt-24 pb-20 md:px-10 lg:px-16">

        {/* ── Breadcrumb ── */}
        <div className="mb-6 flex items-center gap-2 text-xs text-stone-400">
          <Link href="/marketplace" className="hover:text-stone-700 transition-colors">Marketplace</Link>
          <span>/</span>
          <span className="text-stone-700 font-medium">{business.name}</span>
        </div>

        {/* ── Hero card ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: EASE }}
          className="mb-8 overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm"
        >
          {/* Accent bar */}
          <div className="h-1.5 bg-gradient-to-r from-emerald-400 to-emerald-600" />

          <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-start sm:gap-8 md:p-8">
            {/* Avatar */}
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 border border-emerald-200 text-2xl font-black text-emerald-700 shadow-sm">
              {business.name.charAt(0).toUpperCase()}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-3xl font-semibold text-stone-900">
                  {business.name}
                </h1>
                {business.owner.verificationStatus === "VERIFIED" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-[11px] font-bold text-green-700">
                    <ShieldCheck className="h-3 w-3" /> Verified
                  </span>
                )}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-stone-500">
                {business.businessType && (
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5 text-stone-400" />
                    {business.businessType}
                  </span>
                )}
                {(business.city || business.state) && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-emerald-500" />
                    {[business.city, business.state].filter(Boolean).join(", ")}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-stone-400" />
                  Member since {memberSince}
                </span>
              </div>

              {/* Overall rating pill */}
              {reputation.overallRating !== null && (
                <div className="mt-3 flex items-center gap-2">
                  <StarRow rating={reputation.overallRating} size="lg" />
                  <span className="font-display text-xl font-medium text-stone-900">
                    {reputation.overallRating.toFixed(1)}
                  </span>
                  <span className="text-sm text-stone-400">
                    ({reputation.totalReviews} {reputation.totalReviews === 1 ? "review" : "reviews"})
                  </span>
                </div>
              )}
            </div>

            {/* Quick stats */}
            <div className="flex shrink-0 gap-4 sm:flex-col sm:items-end">
              <div className="text-center sm:text-right">
                <p className="font-display text-3xl font-semibold tabular-nums text-stone-900 tabular-nums">
                  {reputation.resourcesGiven}
                </p>
                <p className="text-xs text-stone-400">Resources rented out</p>
              </div>
              <div className="text-center sm:text-right">
                <p className="font-display text-3xl font-semibold tabular-nums text-stone-900 tabular-nums">
                  {reputation.resourcesTaken}
                </p>
                <p className="text-xs text-stone-400">Resources taken on rent</p>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">

          {/* ── Left: Ratings + Reviews ── */}
          <div className="lg:col-span-2 space-y-8">

            {/* Rating cards */}
            <section>
              <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-stone-900">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" /> Ratings
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <RatingCard
                  label="Rating as Owner"
                  rating={reputation.asOwnerRating}
                  count={reputation.asOwnerReviewCount}
                  accent="bg-emerald-600"
                  index={0}
                />
                <RatingCard
                  label="Rating as Renter"
                  rating={reputation.asRenterRating}
                  count={reputation.asRenterReviewCount}
                  accent="bg-stone-900"
                  index={1}
                />
              </div>
            </section>

            {/* Reviews */}
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-base font-bold text-stone-900">
                  <Users className="h-4 w-4 text-stone-400" />
                  Reviews
                  <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500">
                    {reviews.length}
                  </span>
                </h2>

                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setReviewPage(p => Math.max(0, p - 1))}
                      disabled={reviewPage === 0}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 text-stone-500 hover:bg-stone-50 disabled:opacity-40 transition-colors"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="px-2 text-xs text-stone-400">
                      {reviewPage + 1} / {totalPages}
                    </span>
                    <button
                      onClick={() => setReviewPage(p => Math.min(totalPages - 1, p + 1))}
                      disabled={reviewPage === totalPages - 1}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 text-stone-500 hover:bg-stone-50 disabled:opacity-40 transition-colors"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              {reviews.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-white py-14 text-center">
                  <Star className="h-10 w-10 text-stone-200" />
                  <p className="mt-4 text-sm font-semibold text-stone-500">No reviews yet</p>
                  <p className="mt-1 text-xs text-stone-400">Reviews appear after completed bookings</p>
                </div>
              ) : (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={reviewPage}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.2, ease: EASE }}
                    className="space-y-4"
                  >
                    {visibleReviews.map((review, i) => (
                      <ReviewCard key={`${review.reviewer.id}-${review.createdAt}`} review={review} index={i} />
                    ))}
                  </motion.div>
                </AnimatePresence>
              )}
            </section>
          </div>

          {/* ── Right: Stats + Active Listings ── */}
          <div className="space-y-6">

            {/* Transaction summary */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2, ease: EASE }}
              className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
            >
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-stone-400">
                Transaction History
              </p>
              <div className="divide-y divide-stone-100">
                {[
                  { label: "Resources rented out", value: reputation.resourcesGiven,   icon: TrendingUp,   color: "bg-emerald-600" },
                  { label: "Resources taken on rent", value: reputation.resourcesTaken, icon: TrendingDown, color: "bg-stone-900"     },
                  { label: "Completed bookings",     value: reputation.completedBookings, icon: Award,     color: "bg-stone-900"  },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div key={label} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-2.5">
                      <div className={cn("flex h-7 w-7 items-center justify-center rounded-full", color)}>
                        <Icon className="h-3.5 w-3.5 text-white" />
                      </div>
                      <span className="text-sm text-stone-600">{label}</span>
                    </div>
                    <span className="text-base font-semibold tabular-nums text-stone-900">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Active listings */}
            {business.resources.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.3, ease: EASE }}
                className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
              >
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-widest text-stone-400">
                    Active Listings
                  </p>
                  <Link
                    href="/marketplace"
                    className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
                  >
                    Browse all →
                  </Link>
                </div>
                <div className="space-y-3">
                  {business.resources.map((resource) => {
                    const bg = TYPE_BG[resource.resourceType] ?? "bg-gradient-to-br from-stone-100 to-slate-100";
                    const photo = resource.photos?.[0];
                    return (
                      <Link
                        key={resource.id}
                        href={`/marketplace/${resource.id}`}
                        className="flex items-center gap-3 rounded-xl border border-stone-100 p-2.5 hover:border-emerald-200 hover:bg-emerald-50/40 transition-all group"
                      >
                        {/* Thumbnail */}
                        <div className={cn("h-12 w-12 shrink-0 overflow-hidden rounded-lg", bg)}>
                          {photo ? (
                            <img src={photo} alt={resource.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <Package className="h-5 w-5 text-stone-400" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-stone-800 group-hover:text-emerald-700 transition-colors">
                            {resource.name}
                          </p>
                          <p className="text-xs text-stone-400">
                            ₹{(resource.rentAmountPaise / 100).toLocaleString()}/day
                            {resource.location && ` · ${resource.location}`}
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* Back CTA */}
            <Link
              href="/marketplace"
              className="flex items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-stone-600 shadow-sm hover:bg-stone-50 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Marketplace
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
