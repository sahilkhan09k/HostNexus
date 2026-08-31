"use client";

import { motion, type Easing } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const EASE: Easing = [0.22, 1, 0.36, 1];

export function CtaSection() {
  return (
    <section className="py-24 bg-[#FAFAF9]">
      <div className="mx-auto max-w-screen-xl px-5 md:px-10 lg:px-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.4, ease: EASE }}
          className="overflow-hidden rounded-3xl bg-emerald-600"
        >
          <div className="flex flex-col items-center gap-6 px-8 py-16 text-center md:px-16 md:py-20">
            {/* Badge */}
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-100">
              <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
              Join 200+ Businesses
            </span>

            {/* Heading */}
            <h2 className="font-display text-[clamp(2rem,5vw,3.2rem)] font-extrabold leading-tight tracking-tight text-white">
              Start Connecting Your Resources Today
            </h2>

            {/* Subtext */}
            <p className="max-w-lg text-base leading-relaxed text-emerald-100">
              Whether you have idle banquet space, spare kitchens, or AV equipment â€” or need
              them for your next event â€” HostNexus gets you connected in minutes.
            </p>

            {/* CTA buttons */}
            <div className="flex flex-col items-center gap-3 sm:flex-row">
              <a
                href="/dashboard"
                className={cn(
                  "flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-sm font-semibold text-emerald-700",
                  "shadow-[0_4px_16px_rgba(0,0,0,0.12)]",
                  "hover:bg-emerald-50 hover:shadow-[0_6px_20px_rgba(0,0,0,0.15)]",
                  "transition-all duration-200 active:scale-[0.97]"
                )}
              >
                List a Resource
                <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="/marketplace"
                className={cn(
                  "flex items-center gap-2 rounded-xl border-2 border-white/40 px-7 py-3.5 text-sm font-semibold text-white",
                  "hover:border-white/70 hover:bg-white/10",
                  "transition-all duration-200 active:scale-[0.97]"
                )}
              >
                Browse Marketplace
              </a>
            </div>

            {/* Trust line */}
            <p className="text-xs text-emerald-200">
              Free to join Â· No listing fees Â· Escrow-protected payments
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

