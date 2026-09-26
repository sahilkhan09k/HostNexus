"use client";

import { motion, type Easing } from "framer-motion";
import {
  Star, Users, MapPin, ShieldCheck, AlertTriangle, ArrowUpRight, ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const EASE: Easing = [0.22, 1, 0.36, 1];

export interface ResourceCardData {
  id: string;
  category: string;
  categoryColor: string;
  accentColor: string;
  title: string;
  business: string;
  businessId: string;          // needed for profile link
  location: string;
  price: string;
  unit: string;
  capacity: string;
  rating: number | null;       // owner rating from real reviews (null = no reviews yet)
  reviews: number;             // review count
  available: boolean;
  availableText: string;
  tags: string[];
  imageBg: string;
  // Commercial & Chain of custody fields
  rentAmountPaise?: number;
  securityDepositPaise?: number;
  photos?: string[];
  hasPreExistingDamage?: boolean;
  damageDescription?: string | null;
  damagePhotos?: string[];
  transportAvailable?: boolean;
  transportRatePerKmPaise?: number;
}

interface ResourceCardProps {
  data: ResourceCardData;
  index?: number;
  onBook?: (id: string) => void;
  onViewDetails?: (id: string) => void;
}

export function ResourceCard({ data, index = 0, onBook, onViewDetails }: ResourceCardProps) {
  const primaryPhoto = data.photos && data.photos.length > 0 ? data.photos[0] : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-30px" }}
      transition={{ duration: 0.3, delay: index * 0.06, ease: EASE }}
      className="group flex flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-[0_2px_12px_-2px_rgba(0,0,0,0.08)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_8px_28px_-4px_rgba(0,0,0,0.13)] cursor-pointer"
      onClick={() => onViewDetails ? onViewDetails(data.id) : onBook?.(data.id)}
    >
      {/* Image / accent area */}
      <div className={cn("relative h-48 flex-shrink-0 overflow-hidden", data.imageBg)}>
        {primaryPhoto ? (
          <img
            src={primaryPhoto}
            alt={data.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.6) 0%, transparent 50%)",
            }}
          />
        )}

        {/* Category badge */}
        <span className={cn(
          "absolute left-3 top-3 rounded-full px-3 py-1 text-[11px] font-semibold backdrop-blur-xs",
          data.categoryColor
        )}>
          {data.category}
        </span>

        {/* Pre-existing wear disclosure badge */}
        {data.hasPreExistingDamage ? (
          <span className="absolute left-3 bottom-3 inline-flex items-center gap-1 rounded-full bg-amber-500/90 text-white px-2.5 py-0.5 text-[10px] font-medium backdrop-blur-xs shadow-xs">
            <AlertTriangle className="w-3 h-3" />
            <span>Disclosed Wear</span>
          </span>
        ) : (
          <span className="absolute left-3 bottom-3 inline-flex items-center gap-1 rounded-full bg-emerald-600/90 text-white px-2.5 py-0.5 text-[10px] font-medium backdrop-blur-xs shadow-xs">
            <ShieldCheck className="w-3 h-3" />
            <span>Pristine Condition</span>
          </span>
        )}

        {/* Availability */}
        <span className={cn(
          "absolute right-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-semibold backdrop-blur-xs shadow-xs",
          data.available
            ? "bg-green-100/90 text-green-800"
            : "bg-stone-100/90 text-stone-600"
        )}>
          {data.availableText}
        </span>
      </div>

      {/* Card body */}
      <div className="flex flex-1 flex-col p-4">
        {/* Business name → links to business profile */}
        <div className="flex items-center justify-between gap-2">
          <Link
            href={`/business/${data.businessId}`}
            onClick={(e) => e.stopPropagation()}
            className="group/biz flex items-center gap-1 min-w-0"
          >
            <p className="truncate text-[11px] font-semibold text-emerald-700 group-hover/biz:underline underline-offset-2 transition-colors">
              {data.business}
            </p>
            <ExternalLink className="h-2.5 w-2.5 shrink-0 text-emerald-500 opacity-0 group-hover/biz:opacity-100 transition-opacity" />
          </Link>

          {/* Owner rating badge */}
          {data.rating !== null ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5">
              <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
              <span className="text-[10px] font-bold text-amber-700 tabular-nums">
                {data.rating.toFixed(1)}
              </span>
              {data.reviews > 0 && (
                <span className="text-[9px] text-stone-400">({data.reviews})</span>
              )}
            </span>
          ) : (
            <span className="inline-flex shrink-0 items-center rounded-full bg-stone-50 border border-stone-200 px-2 py-0.5 text-[9px] font-medium text-stone-400">
              New listing
            </span>
          )}
        </div>

        <h3 className="mt-1 text-[15px] font-bold leading-snug text-stone-900 line-clamp-1">
          {data.title}
        </h3>

        <div className="mt-1.5 flex items-center gap-1 text-xs text-stone-400">
          <MapPin className="h-3 w-3 shrink-0 text-emerald-500" />
          {data.location}
        </div>

        {/* Tags */}
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {data.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="rounded-md bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-500">
              {tag}
            </span>
          ))}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Pricing row */}
        <div className="mt-4 flex items-end justify-between border-t border-stone-100 pt-3">
          <div className="flex items-center gap-2 text-xs text-stone-400">
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {data.capacity}
            </span>
          </div>

          <div className="text-right">
            <div className="text-base font-bold text-stone-900 leading-tight">
              {data.rentAmountPaise !== undefined
                ? `₹${(data.rentAmountPaise / 100).toLocaleString()}`
                : data.price}
              <span className="text-[11px] font-normal text-stone-500"> / day</span>
            </div>
            {data.securityDepositPaise !== undefined && data.securityDepositPaise > 0 && (
              <div className="text-[10px] font-medium text-emerald-700">
                + ₹{(data.securityDepositPaise / 100).toLocaleString()} deposit
              </div>
            )}
            {data.transportAvailable && (
              <div className="text-[10px] font-medium text-stone-500">
                Transport ₹{((data.transportRatePerKmPaise ?? 0) / 100).toLocaleString()}/km
              </div>
            )}
          </div>
        </div>

        {/* CTA */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onBook?.(data.id); }}
          className={cn(
            "mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold",
            "border border-emerald-200 bg-emerald-50 text-emerald-700",
            "hover:bg-emerald-600 hover:text-white hover:border-emerald-600",
            "transition-all duration-200 active:scale-[0.98]"
          )}
        >
          Book Resource <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.div>
  );
}
