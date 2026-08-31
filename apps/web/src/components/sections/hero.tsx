"use client";

import { useRef } from "react";
import { motion, type Easing } from "framer-motion";
import {
  Search,
  MapPin,
  CalendarDays,
  TrendingDown,
  ShieldCheck,
  ChevronDown,
} from "lucide-react";
import { HeroBackground3D } from "@/components/three/hero-background";
import { HeroPreviewCards } from "@/components/sections/hero-preview-cards";
import { cn } from "@/lib/utils";

const EASE: Easing = [0.22, 1, 0.36, 1];

const AVATARS = [
  { initials: "JM", bg: "bg-emerald-100 text-emerald-700" },
  { initials: "RB", bg: "bg-sky-100 text-sky-700" },
  { initials: "IH", bg: "bg-amber-100 text-amber-700" },
  { initials: "FH", bg: "bg-purple-100 text-purple-700" },
];

export function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);

  const fadeUp = (delay: number) => ({
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.38, delay, ease: EASE },
  });

  return (
    <section
      ref={sectionRef}
      className="relative min-h-screen overflow-hidden bg-[#FAFAF9] pt-[68px]"
    >
      {/* â”€â”€â”€ Full-screen photo background â”€â”€â”€ */}
      <HeroBackground3D />

      {/* â”€â”€â”€ Hero content grid â”€â”€â”€ */}
      <div className="relative z-[2] mx-auto grid min-h-[calc(100vh-68px)] max-w-screen-xl grid-cols-1 items-center gap-10 px-5 py-16 md:px-10 lg:grid-cols-[54fr_46fr] lg:gap-16 lg:px-16 lg:py-20">

        {/* â”€â”€ LEFT: Text + Search â”€â”€ */}
        <div className="flex flex-col justify-center">

          {/* Badge */}
          <motion.div {...fadeUp(0.1)}>
            <span className={cn(
              "inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wider",
              "border border-emerald-200 bg-emerald-50/80 text-emerald-700 backdrop-blur-sm"
            )}>
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              AI-Powered B2B Platform
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            {...fadeUp(0.18)}
            className="mt-5 font-display text-[clamp(2.2rem,5vw,3.6rem)] font-extrabold leading-[1.08] tracking-tight text-stone-900"
          >
            The Smart Way to{" "}
            <br className="hidden sm:block" />
            Share{" "}
            <span className="gradient-text">Hospitality</span>
            <br className="hidden sm:block" />
            {" "}Resources
          </motion.h1>

          {/* Subtext */}
          <motion.p
            {...fadeUp(0.26)}
            className="mt-5 max-w-[420px] text-base leading-relaxed text-stone-500"
          >
            Hotels, caterers, banquet halls and event organizers connect to
            share idle resources â€” all powered by an AI concierge that
            searches, compares, and books in seconds.
          </motion.p>

          {/* â”€â”€â”€ Airbnb-style search bar â”€â”€â”€ */}
          <motion.div {...fadeUp(0.34)} className="mt-8">
            <div className={cn(
              "flex flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white/90 backdrop-blur-md sm:flex-row",
              "shadow-[0_8px_32px_-4px_rgba(0,0,0,0.12)]",
            )}>
              {/* Resource Type */}
              <button
                type="button"
                className="group flex flex-1 flex-col gap-0.5 px-5 py-3.5 text-left transition-colors hover:bg-stone-50 sm:border-r sm:border-stone-100"
              >
                <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 transition-colors group-hover:text-stone-500">
                  Resource Type
                </span>
                <span className="flex items-center gap-1.5 text-sm font-medium text-stone-600">
                  Banquet Hall
                  <ChevronDown className="h-3.5 w-3.5 opacity-40" />
                </span>
              </button>

              {/* Location */}
              <button
                type="button"
                className="group flex flex-1 flex-col gap-0.5 px-5 py-3.5 text-left transition-colors hover:bg-stone-50 sm:border-r sm:border-stone-100"
              >
                <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 transition-colors group-hover:text-stone-500">
                  Location
                </span>
                <span className="flex items-center gap-1.5 text-sm font-medium text-stone-600">
                  <MapPin className="h-3.5 w-3.5 text-emerald-500" />
                  Koregaon Park, Pune
                </span>
              </button>

              {/* Date */}
              <button
                type="button"
                className="group flex flex-1 flex-col gap-0.5 px-5 py-3.5 text-left transition-colors hover:bg-stone-50 sm:border-r sm:border-stone-100"
              >
                <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 transition-colors group-hover:text-stone-500">
                  Date
                </span>
                <span className="flex items-center gap-1.5 text-sm font-medium text-stone-600">
                  <CalendarDays className="h-3.5 w-3.5 text-emerald-500" />
                  This Saturday
                </span>
              </button>

              {/* Search CTA */}
              <div className="flex items-center p-2">
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white",
                    "shadow-[0_2px_8px_rgba(5,150,105,0.30)]",
                    "hover:bg-emerald-700 hover:shadow-[0_4px_16px_rgba(5,150,105,0.42)]",
                    "transition-all duration-200 active:scale-[0.97] sm:w-auto"
                  )}
                >
                  <Search className="h-4 w-4" />
                  Search
                </button>
              </div>
            </div>
          </motion.div>

          {/* Trust line */}
          <motion.div
            {...fadeUp(0.42)}
            className="mt-5 flex flex-wrap items-center gap-3"
          >
            <div className="flex -space-x-2">
              {AVATARS.map((av) => (
                <div
                  key={av.initials}
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold ring-2 ring-white",
                    av.bg
                  )}
                >
                  {av.initials}
                </div>
              ))}
            </div>
            <p className="text-sm text-stone-500">
              Trusted by{" "}
              <span className="font-semibold text-stone-800">200+ businesses</span>
              {" "}Â· Pune &amp; Mumbai
            </p>
          </motion.div>

          {/* Floating stat chips */}
          <motion.div
            {...fadeUp(0.50)}
            className="mt-8 flex flex-wrap gap-3"
          >
            <div className={cn(
              "flex items-center gap-2.5 rounded-xl border border-stone-200 bg-white/80 px-4 py-2.5 backdrop-blur-sm",
              "shadow-[0_4px_16px_-2px_rgba(0,0,0,0.08)]"
            )}>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100">
                <TrendingDown className="h-3.5 w-3.5 text-emerald-700" />
              </div>
              <div>
                <p className="text-xs font-bold text-stone-900">â‚¹4.8L Avg. Savings</p>
                <p className="text-[10px] text-stone-400">per month</p>
              </div>
            </div>

            <div className={cn(
              "flex items-center gap-2.5 rounded-xl border border-stone-200 bg-white/80 px-4 py-2.5 backdrop-blur-sm",
              "shadow-[0_4px_16px_-2px_rgba(0,0,0,0.08)]"
            )}>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-100">
                <ShieldCheck className="h-3.5 w-3.5 text-sky-700" />
              </div>
              <div>
                <p className="text-xs font-bold text-stone-900">100% Conflict-Free</p>
                <p className="text-[10px] text-stone-400">zero double bookings</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* â”€â”€ RIGHT: Live marketplace preview card stack â”€â”€ */}
        <motion.div
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.52, delay: 0.28, ease: EASE }}
          className="relative flex items-start justify-center lg:justify-end"
        >
          {/* Frosted backdrop behind cards */}
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-6 rounded-3xl"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(250,250,249,0.7) 0%, transparent 70%)",
            }}
          />

          <div className="relative w-full max-w-[400px]">
            {/* Section label */}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.32, ease: EASE }}
              className="mb-4 flex items-center gap-2"
            >
              <span className="text-xs font-bold uppercase tracking-widest text-stone-400">
                Live Listings
              </span>
              <span className="h-px flex-1 bg-stone-200" />
            </motion.div>

            <HeroPreviewCards />
          </div>
        </motion.div>
      </div>

      {/* â”€â”€â”€ Bottom fade to next section â”€â”€â”€ */}
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-0 right-0 z-[2] h-24"
        style={{
          background: "linear-gradient(to bottom, transparent, #FAFAF9)",
        }}
      />
    </section>
  );
}

