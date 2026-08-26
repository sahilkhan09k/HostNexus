"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, type Easing } from "framer-motion";
import { Search, Sparkles, CalendarCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const EASE: Easing = [0.22, 1, 0.36, 1];

const STEPS = [
  {
    number: "01",
    icon: Search,
    title: "Post or Browse",
    description:
      "List your idle banquet hall, kitchen, equipment, or vehicles — or search what you need from verified hospitality businesses nearby.",
    panel: "browse",
  },
  {
    number: "02",
    icon: Sparkles,
    title: "Get AI Matched",
    description:
      "Our AI concierge analyses availability, location, capacity and budget to surface the best matches in seconds. No back-and-forth emails.",
    panel: "match",
  },
  {
    number: "03",
    icon: CalendarCheck,
    title: "Book & Coordinate",
    description:
      "Instant booking with conflict-free calendar sync, escrow payment protection, and real-time coordination tools.",
    panel: "book",
  },
];

/* Mock UI panels */
function BrowsePanel() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-sm">
        <Search className="h-4 w-4 text-stone-400" />
        <span className="text-sm text-stone-400">Banquet hall · Koregaon Park · Saturday</span>
      </div>
      {["Grand Ballroom — JW Marriott", "Crystal Hall — Radisson Blu", "Orchid Suite — The Westin"].map((item, i) => (
        <div key={item} className={cn(
          "flex items-center justify-between rounded-xl border px-4 py-3 bg-white shadow-sm",
          i === 0 ? "border-emerald-200 ring-1 ring-emerald-100" : "border-stone-200"
        )}>
          <div>
            <p className="text-sm font-semibold text-stone-800">{item}</p>
            <p className="text-xs text-stone-400">₹{[45000, 38000, 52000][i].toLocaleString()}/day · {[500, 350, 600][i]} pax</p>
          </div>
          {i === 0 && (
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-700">Best Match</span>
          )}
        </div>
      ))}
    </div>
  );
}

function MatchPanel() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">AI Concierge</p>
            <p className="mt-1 text-sm text-stone-700">
              Found <strong>3 matches</strong> for your requirements — Grand Ballroom has 94% compatibility with your event profile.
            </p>
          </div>
        </div>
      </div>
      {[
        { label: "Capacity match", value: "98%" },
        { label: "Budget fit", value: "100%" },
        { label: "Location score", value: "92%" },
        { label: "Host reliability", value: "4.9★" },
      ].map((item) => (
        <div key={item.label} className="flex items-center justify-between">
          <span className="text-sm text-stone-500">{item.label}</span>
          <span className="text-sm font-bold text-emerald-700">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

function BookPanel() {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Booking Confirmation</p>
        <p className="mt-2 text-lg font-bold text-stone-900">Grand Ballroom · JW Marriott Pune</p>
        <p className="text-sm text-stone-500">Saturday, 14 Dec 2024 · 10:00 AM – 10:00 PM</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-stone-200 bg-white p-3 text-center shadow-sm">
          <p className="text-xl font-extrabold text-stone-900">₹45,000</p>
          <p className="text-xs text-stone-400">Total · incl. taxes</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center">
          <p className="text-xl font-extrabold text-emerald-700">0</p>
          <p className="text-xs text-emerald-600">Conflicts detected</p>
        </div>
      </div>
      <button
        type="button"
        className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white shadow-[0_2px_8px_rgba(5,150,105,0.25)] hover:bg-emerald-700 transition-colors"
      >
        Confirm Booking — Escrow Protected
      </button>
    </div>
  );
}

const PANELS = { browse: BrowsePanel, match: MatchPanel, book: BookPanel };

export function HowItWorks() {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start center", "end center"],
  });

  const step0 = useTransform(scrollYProgress, [0, 0.4], [1, 0.4]);
  const step1 = useTransform(scrollYProgress, [0.25, 0.5, 0.75], [0.4, 1, 0.4]);
  const step2 = useTransform(scrollYProgress, [0.6, 1], [0.4, 1]);
  const opacities = [step0, step1, step2];

  const activeIndex = useTransform(scrollYProgress, [0, 0.4, 0.7, 1], [0, 0, 1, 2]);

  return (
    <section
      ref={sectionRef}
      id="how-it-works"
      className="py-24 bg-white"
    >
      <div className="mx-auto max-w-screen-xl px-5 md:px-10 lg:px-16">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.36, ease: EASE }}
          className="mb-14 text-center"
        >
          <span className="text-xs font-bold uppercase tracking-widest text-emerald-600">
            How It Works
          </span>
          <h2 className="mt-2 font-display text-[clamp(1.8rem,4vw,2.6rem)] font-bold tracking-tight text-stone-900">
            Three Steps to Share Smarter
          </h2>
        </motion.div>

        {/* 2-col layout */}
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-20">
          {/* Left — step list */}
          <div className="flex flex-col gap-8">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={step.number}
                  style={{ opacity: opacities[i] }}
                  className="flex gap-5"
                >
                  {/* Step indicator */}
                  <div className="flex flex-col items-center gap-2">
                    <div className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold",
                      "transition-all duration-300",
                      "bg-emerald-600 text-white shadow-[0_2px_8px_rgba(5,150,105,0.25)]"
                    )}>
                      <Icon className="h-5 w-5" />
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className="flex-1 w-px bg-stone-200 min-h-[40px]" />
                    )}
                  </div>
                  {/* Step text */}
                  <div className="pb-4">
                    <p className="text-xs font-bold uppercase tracking-widest text-stone-400">{step.number}</p>
                    <h3 className="mt-1 text-lg font-semibold text-stone-900">{step.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-stone-500">{step.description}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Right — mock UI panels */}
          <div className="relative">
            <div className="sticky top-24 space-y-0">
              {STEPS.map((step, i) => {
                const Panel = PANELS[step.panel as keyof typeof PANELS];
                return (
                  <motion.div
                    key={step.number}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-80px" }}
                    transition={{ duration: 0.36, delay: i * 0.1, ease: EASE }}
                    className={cn(
                      "rounded-2xl border border-stone-200 bg-white p-6",
                      "shadow-[0_4px_20px_-2px_rgba(0,0,0,0.08)]",
                      i > 0 && "mt-6"
                    )}
                  >
                    <div className="mb-4 flex items-center gap-2">
                      <span className="rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">
                        Step {step.number}
                      </span>
                      <span className="text-sm font-semibold text-stone-700">{step.title}</span>
                    </div>
                    <Panel />
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
