"use client";

import { motion, type Easing } from "framer-motion";
import { NumberTicker } from "@/components/ui/number-ticker";
import { cn } from "@/lib/utils";

const EASE: Easing = [0.22, 1, 0.36, 1];

const STATS = [
  { value: 35, suffix: "+", label: "Resources Listed", prefix: "" },
  { value: 200, suffix: "+", label: "Businesses Onboard", prefix: "" },
  { value: 48, suffix: "L+", label: "Saved Monthly", prefix: "₹" },
  { value: 0, suffix: "", label: "Double Bookings", prefix: "" },
];

export function StatsBar() {
  return (
    <section className="border-t border-b border-stone-100 bg-white">
      <div className="mx-auto max-w-screen-xl px-5 md:px-10 lg:px-16">
        <div className="grid grid-cols-2 divide-x divide-stone-100 sm:grid-cols-4">
          {STATS.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.32, delay: i * 0.06, ease: EASE }}
              className="flex flex-col items-center gap-1 py-8 px-4 text-center"
            >
              <p className={cn(
                "font-display text-3xl font-extrabold tracking-tight text-stone-900",
                stat.value === 0 && "text-emerald-600"
              )}>
                <NumberTicker
                  value={stat.value}
                  prefix={stat.prefix}
                  suffix={stat.suffix}
                  duration={1200}
                />
              </p>
              <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">
                {stat.label}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
