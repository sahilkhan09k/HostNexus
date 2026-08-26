"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence, type Easing } from "framer-motion";
import {
  Star, Users, MapPin, Zap, CheckCircle2,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const EASE: Easing = [0.22, 1, 0.36, 1];

const ALL_CARDS = [
  {
    id: 1,
    tag: "Banquet Hall",
    tagColor: "bg-violet-100 text-violet-700",
    accentBar: "bg-gradient-to-r from-violet-400 to-indigo-400",
    title: "Grand Ballroom",
    business: "JW Marriott Pune",
    location: "Koregaon Park",
    price: "₹45,000",
    unit: "/day",
    capacity: "500 pax",
    rating: 4.9,
    reviews: 38,
    available: true,
    availableLabel: "Available",
  },
  {
    id: 2,
    tag: "Commercial Kitchen",
    tagColor: "bg-amber-100 text-amber-700",
    accentBar: "bg-gradient-to-r from-amber-400 to-orange-400",
    title: "Industrial Production Kitchen",
    business: "Radisson Blu Pune",
    location: "Bund Garden Road",
    price: "₹8,500",
    unit: "/half-day",
    capacity: "12 staff",
    rating: 4.7,
    reviews: 24,
    available: true,
    availableLabel: "Available",
  },
  {
    id: 3,
    tag: "AV Equipment",
    tagColor: "bg-sky-100 text-sky-700",
    accentBar: "bg-gradient-to-r from-sky-400 to-cyan-400",
    title: "Full AV Conference Bundle",
    business: "Fortune Hotels India",
    location: "Viman Nagar, Pune",
    price: "₹12,000",
    unit: "/day",
    capacity: "200 pax",
    rating: 4.8,
    reviews: 17,
    available: false,
    availableLabel: "Next Mon",
  },
  {
    id: 4,
    tag: "Event Space",
    tagColor: "bg-rose-100 text-rose-700",
    accentBar: "bg-gradient-to-r from-rose-400 to-pink-400",
    title: "Rooftop Terrace — 5,000 sq.ft",
    business: "Hyatt Regency Pune",
    location: "Nagar Road, Pune",
    price: "₹28,000",
    unit: "/day",
    capacity: "350 pax",
    rating: 4.9,
    reviews: 29,
    available: true,
    availableLabel: "Available",
  },
  {
    id: 5,
    tag: "Furniture & Fixtures",
    tagColor: "bg-lime-100 text-lime-700",
    accentBar: "bg-gradient-to-r from-lime-400 to-green-400",
    title: "Premium Chair & Table Set ×200",
    business: "ITC Maratha Mumbai",
    location: "Andheri East, Mumbai",
    price: "₹6,000",
    unit: "/day",
    capacity: "200 pax",
    rating: 4.6,
    reviews: 41,
    available: true,
    availableLabel: "Available",
  },
  {
    id: 6,
    tag: "Vehicle Fleet",
    tagColor: "bg-teal-100 text-teal-700",
    accentBar: "bg-gradient-to-r from-teal-400 to-emerald-400",
    title: "Luxury Coach Fleet ×4 Buses",
    business: "Sahara Star Mumbai",
    location: "Santacruz, Mumbai",
    price: "₹22,000",
    unit: "/day",
    capacity: "160 seats",
    rating: 4.5,
    reviews: 12,
    available: false,
    availableLabel: "Fri onwards",
  },
];

const VISIBLE = 1; // cards shown at once

export function HeroPreviewCards() {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);

  const total = ALL_CARDS.length;

  const goTo = useCallback(
    (next: number, dir: 1 | -1) => {
      setDirection(dir);
      setCurrent((next + total) % total);
    },
    [total]
  );

  const prev = () => goTo(current - 1, -1);
  const next = () => goTo(current + 1, 1);

  /* Framer Motion drag-to-swipe */
  const handleDragEnd = (_: unknown, info: { offset: { x: number } }) => {
    if (info.offset.x < -40) next();
    else if (info.offset.x > 40) prev();
  };

  const card = ALL_CARDS[current];

  const variants = {
    enter: (d: number) => ({ opacity: 0, x: d * 48, scale: 0.97 }),
    center: { opacity: 1, x: 0, scale: 1 },
    exit: (d: number) => ({ opacity: 0, x: -d * 48, scale: 0.97 }),
  };

  return (
    <div className="relative w-full select-none">

      {/* ── Card carousel ── */}
      <div className="relative overflow-hidden rounded-2xl">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={card.id}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: EASE }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.15}
            onDragEnd={handleDragEnd}
            className={cn(
              "w-full cursor-grab active:cursor-grabbing",
              "rounded-2xl border border-stone-200 bg-white overflow-hidden",
              "shadow-[0_8px_32px_-4px_rgba(0,0,0,0.12)]"
            )}
          >
            {/* Colour accent top bar */}
            <div className={cn("h-1.5 w-full", card.accentBar)} />

            <div className="p-5">
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <span className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                    card.tagColor
                  )}>
                    {card.tag}
                  </span>
                  <h3 className="mt-2.5 text-[15px] font-bold leading-snug text-stone-900">
                    {card.title}
                  </h3>
                  <div className="mt-1.5 flex items-center gap-1 text-xs text-stone-400">
                    <MapPin className="h-3 w-3 shrink-0 text-emerald-500" />
                    <span className="truncate">{card.business} · {card.location}</span>
                  </div>
                </div>
                <span className={cn(
                  "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                  card.available
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-stone-100 text-stone-400 border border-stone-200"
                )}>
                  {card.availableLabel}
                </span>
              </div>

              {/* Stats */}
              <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-4">
                <div className="flex items-center gap-4 text-xs text-stone-400">
                  <span className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    {card.capacity}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    <span className="font-semibold text-stone-700">{card.rating}</span>
                    <span>({card.reviews})</span>
                  </span>
                </div>
                <div>
                  <span className="text-lg font-bold text-stone-900">{card.price}</span>
                  <span className="text-xs text-stone-400">{card.unit}</span>
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Navigation controls ── */}
      <div className="mt-4 flex items-center justify-between">
        {/* Dot indicators */}
        <div className="flex items-center gap-1.5">
          {ALL_CARDS.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i, i > current ? 1 : -1)}
              className={cn(
                "rounded-full transition-all duration-200",
                i === current
                  ? "h-2 w-6 bg-emerald-500"
                  : "h-2 w-2 bg-stone-300 hover:bg-stone-400"
              )}
              aria-label={`Go to listing ${i + 1}`}
            />
          ))}
        </div>

        {/* Arrow buttons */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={prev}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-500",
              "hover:border-emerald-300 hover:text-emerald-600 hover:shadow-sm",
              "transition-all duration-150 active:scale-95"
            )}
            aria-label="Previous listing"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={next}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-500",
              "hover:border-emerald-300 hover:text-emerald-600 hover:shadow-sm",
              "transition-all duration-150 active:scale-95"
            )}
            aria-label="Next listing"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Counter ── */}
      <p className="mt-2 text-[11px] text-stone-400">
        {current + 1} of {total} listings
      </p>

      {/* ── Live indicator ── */}
      <div className="mt-5 flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        <span className="text-xs font-medium text-stone-400">
          35+ resources live · updated in real-time
        </span>
      </div>

      {/* ── Trust micro-row ── */}
      <div className="mt-3 flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-xs text-stone-400">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          Instant confirmation
        </div>
        <div className="flex items-center gap-1.5 text-xs text-stone-400">
          <Zap className="h-3.5 w-3.5 text-amber-500" />
          AI-matched in &lt;2s
        </div>
      </div>
    </div>
  );
}
