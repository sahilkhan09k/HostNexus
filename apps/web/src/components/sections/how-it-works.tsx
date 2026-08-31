"use client";

import { motion, type Easing } from "framer-motion";
import { Search, Sparkles, CalendarCheck, ArrowRight, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const EASE: Easing = [0.22, 1, 0.36, 1];

const STEPS = [
  {
    number: "01",
    icon: Search,
    title: "Post or Browse",
    description: "List idle resources or search what you need from verified hospitality businesses across Pune & Mumbai.",
    color: "bg-violet-100 text-violet-700",
    iconBg: "bg-violet-600",
  },
  {
    number: "02",
    icon: Sparkles,
    title: "Get AI Matched",
    description: "Our concierge analyses availability, capacity, and budget to surface the best matches in seconds.",
    color: "bg-emerald-100 text-emerald-700",
    iconBg: "bg-emerald-600",
  },
  {
    number: "03",
    icon: CalendarCheck,
    title: "Book & Coordinate",
    description: "Instant booking with conflict-free calendar sync, escrow payment protection, and real-time tools.",
    color: "bg-sky-100 text-sky-700",
    iconBg: "bg-sky-600",
  },
];

const FEATURES = [
  "Zero double-booking with atomic calendar locks",
  "AI concierge finds best matches in under 2 seconds",
  "Escrow-protected payments — funds released on completion",
  "Real-time notifications for every booking event",
  "GST-compliant invoicing generated automatically",
  "Verified business profiles with trust scores",
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 bg-[#FAFAF9]">
      <div className="mx-auto max-w-screen-xl px-5 md:px-10 lg:px-16">

        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.36, ease: EASE }}
          className="mb-16 text-center"
        >
          <span className="text-xs font-bold uppercase tracking-widest text-emerald-600">
            How It Works
          </span>
          <h2 className="mt-2 font-display text-[clamp(1.8rem,4vw,2.6rem)] font-bold tracking-tight text-stone-900">
            Three Steps to Share Smarter
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-base text-stone-500">
            From posting your resource to getting paid — the entire process takes under 5 minutes.
          </p>
        </motion.div>

        {/* ── Step cards row ── */}
        <div className="relative grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Connecting line (desktop) */}
          <div className="pointer-events-none absolute left-0 right-0 top-10 hidden h-px bg-stone-200 md:block mx-[calc(16.67%+22px)]" />

          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.36, delay: i * 0.1, ease: EASE }}
                className="relative flex flex-col rounded-2xl border border-stone-200 bg-white p-6 shadow-[0_4px_16px_-2px_rgba(0,0,0,0.07)]"
              >
                {/* Step number bubble */}
                <div className={cn(
                  "relative z-10 mb-5 flex h-12 w-12 items-center justify-center rounded-xl text-white shadow-md",
                  step.iconBg
                )}>
                  <Icon className="h-5 w-5" />
                </div>

                {/* Step number label */}
                <span className="mb-2 text-xs font-bold uppercase tracking-widest text-stone-400">
                  Step {step.number}
                </span>

                <h3 className="text-lg font-bold text-stone-900">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-stone-500 flex-1">{step.description}</p>

                {/* Arrow (not on last) */}
                {i < STEPS.length - 1 && (
                  <div className="absolute -right-3 top-10 z-20 hidden h-6 w-6 items-center justify-center rounded-full border border-stone-200 bg-white shadow-sm md:flex">
                    <ArrowRight className="h-3.5 w-3.5 text-stone-400" />
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* ── Feature strip ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.4, delay: 0.2, ease: EASE }}
          className="mt-12 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-8"
        >
          <p className="mb-6 text-center text-sm font-bold uppercase tracking-widest text-emerald-700">
            Platform Guarantees
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div key={feature} className="flex items-start gap-2.5">
                <CheckCircle className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
                <span className="text-sm text-stone-600">{feature}</span>
              </div>
            ))}
          </div>
        </motion.div>

      </div>
    </section>
  );
}
