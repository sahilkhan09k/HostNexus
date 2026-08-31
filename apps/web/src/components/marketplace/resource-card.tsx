"use client";

import { motion, type Easing } from "framer-motion";
import {
  Star, Users, MapPin, Clock, Heart, ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const EASE: Easing = [0.22, 1, 0.36, 1];

export interface ResourceCardData {
  id: string;
  category: string;
  categoryColor: string;
  accentColor: string;
  title: string;
  business: string;
  location: string;
  price: string;
  unit: string;
  capacity: string;
  rating: number;
  reviews: number;
  available: boolean;
  availableText: string;
  tags: string[];
  imageBg: string;
}

interface ResourceCardProps {
  data: ResourceCardData;
  index?: number;
  onBook?: (id: string) => void;
}

export function ResourceCard({ data, index = 0, onBook }: ResourceCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-30px" }}
      transition={{ duration: 0.3, delay: index * 0.06, ease: EASE }}
      className="group flex flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-[0_2px_12px_-2px_rgba(0,0,0,0.08)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_8px_28px_-4px_rgba(0,0,0,0.13)]"
    >
      {/* Image / accent area */}
      <div className={cn("relative h-44 flex-shrink-0 overflow-hidden", data.imageBg)}>
        {/* Category badge */}
        <span className={cn(
          "absolute left-3 top-3 rounded-full px-3 py-1 text-[11px] font-semibold",
          data.categoryColor
        )}>
          {data.category}
        </span>

        {/* Availability */}
        <span className={cn(
          "absolute right-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-semibold",
          data.available
            ? "bg-emerald-100 text-emerald-700"
            : "bg-stone-100 text-stone-500"
        )}>
          {data.availableText}
        </span>

        {/* Wishlist */}
        <button
          type="button"
          aria-label="Save to wishlist"
          className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-stone-400 shadow-sm backdrop-blur-sm transition-all hover:bg-white hover:text-rose-500"
        >
          <Heart className="h-3.5 w-3.5" />
        </button>

        {/* Decorative pattern */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.6) 0%, transparent 50%)",
          }}
        />
      </div>

      {/* Card body */}
      <div className="flex flex-1 flex-col p-4">
        <p className="text-[11px] font-medium text-stone-400">{data.business}</p>
        <h3 className="mt-0.5 text-[15px] font-bold leading-snug text-stone-900 line-clamp-1">
          {data.title}
        </h3>

        <div className="mt-1.5 flex items-center gap-1 text-xs text-stone-400">
          <MapPin className="h-3 w-3 shrink-0 text-emerald-500" />
          {data.location}
        </div>

        {/* Tags */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {data.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="rounded-md bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-500">
              {tag}
            </span>
          ))}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Footer row */}
        <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-3">
          <div className="flex items-center gap-3 text-xs text-stone-400">
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {data.capacity}
            </span>
            <span className="flex items-center gap-1">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              <span className="font-semibold text-stone-600">{data.rating}</span>
              <span>({data.reviews})</span>
            </span>
          </div>
          <div>
            <span className="text-base font-bold text-stone-900">{data.price}</span>
            <span className="text-[11px] text-stone-400">{data.unit}</span>
          </div>
        </div>

        {/* CTA */}
        <button
          type="button"
          onClick={() => onBook?.(data.id)}
          className={cn(
            "mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold",
            "border border-emerald-200 bg-emerald-50 text-emerald-700",
            "hover:bg-emerald-600 hover:text-white hover:border-emerald-600",
            "transition-all duration-200 active:scale-[0.98]"
          )}
        >
          Request Booking <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.div>
  );
}
