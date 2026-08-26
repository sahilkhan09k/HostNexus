"use client";

import { motion, type Easing } from "framer-motion";
import { Star, Quote } from "lucide-react";
import { cn } from "@/lib/utils";

const EASE: Easing = [0.22, 1, 0.36, 1];

const LOGOS = [
  "ITC Hotels",
  "Radisson Blu",
  "Sarovar Hotels",
  "Fortune Hotels",
  "The Westin",
  "Hyatt Pune",
];

const TESTIMONIALS = [
  {
    quote:
      "The HostNexus AI found us 3 matching vendors in under 2 minutes. We booked a 500-pax banquet setup from Sarovar Hotels, and the whole process — from search to confirmation — took less than 10 minutes.",
    name: "Rajesh Kumar",
    title: "Operations Manager",
    company: "Radisson Blu Pune",
    rating: 5,
    initial: "RK",
    bg: "bg-sky-100 text-sky-700",
  },
  {
    quote:
      "We used to have our industrial kitchen idle for 3 days a week. Since listing on HostNexus, it's booked 80% of the time. The platform paid for itself within the first week.",
    name: "Priya Nair",
    title: "F&B Director",
    company: "ITC Maratha Mumbai",
    rating: 5,
    initial: "PN",
    bg: "bg-purple-100 text-purple-700",
  },
];

export function TrustSection() {
  return (
    <section className="py-24 bg-white">
      <div className="mx-auto max-w-screen-xl px-5 md:px-10 lg:px-16">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.36, ease: EASE }}
          className="mb-10 text-center"
        >
          <span className="text-xs font-bold uppercase tracking-widest text-emerald-600">
            Social Proof
          </span>
          <h2 className="mt-2 font-display text-[clamp(1.6rem,3.5vw,2.4rem)] font-bold tracking-tight text-stone-900">
            Trusted by India&apos;s Leading Hospitality Groups
          </h2>
        </motion.div>

        {/* Logo marquee */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, ease: EASE }}
          className="mb-14 overflow-hidden"
        >
          <div className="flex animate-marquee gap-0" style={{ width: "max-content" }}>
            {[...LOGOS, ...LOGOS].map((logo, i) => (
              <div
                key={`${logo}-${i}`}
                className="flex items-center px-10 py-2"
              >
                <span className="whitespace-nowrap text-base font-bold text-stone-300 hover:text-stone-500 transition-colors cursor-default">
                  {logo}
                </span>
                <span className="ml-10 h-1 w-1 rounded-full bg-stone-200" />
              </div>
            ))}
          </div>
        </motion.div>

        {/* Testimonial cards */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {TESTIMONIALS.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.32, delay: i * 0.1, ease: EASE }}
              className={cn(
                "flex flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-7",
                "shadow-[0_4px_20px_-2px_rgba(0,0,0,0.07)]",
                "hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.10)] transition-shadow duration-300"
              )}
            >
              {/* Stars */}
              <div className="flex gap-0.5">
                {Array.from({ length: t.rating }).map((_, s) => (
                  <Star key={s} className="h-4 w-4 fill-amber-400 text-amber-400" />
                ))}
              </div>

              {/* Quote icon + text */}
              <div className="relative">
                <Quote className="absolute -top-1 -left-1 h-5 w-5 text-emerald-200" />
                <p className="pl-5 text-sm leading-relaxed text-stone-600 italic">
                  &ldquo;{t.quote}&rdquo;
                </p>
              </div>

              {/* Reviewer */}
              <div className="mt-auto flex items-center gap-3 border-t border-stone-100 pt-4">
                <div className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold",
                  t.bg
                )}>
                  {t.initial}
                </div>
                <div>
                  <p className="text-sm font-semibold text-stone-800">{t.name}</p>
                  <p className="text-xs text-stone-400">{t.title} · {t.company}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
