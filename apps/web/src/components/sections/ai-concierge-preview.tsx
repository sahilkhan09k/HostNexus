"use client";

import { motion, type Easing } from "framer-motion";
import { Sparkles, Zap, Clock, ShieldCheck, Bot } from "lucide-react";
import { cn } from "@/lib/utils";

const EASE: Easing = [0.22, 1, 0.36, 1];

const FEATURES = [
  {
    icon: Zap,
    title: "Instant Matching",
    desc: "AI surfaces the 3 best vendor matches in under 2 minutes.",
  },
  {
    icon: Clock,
    title: "24/7 Availability",
    desc: "Concierge works round-the-clock, even outside business hours.",
  },
  {
    icon: ShieldCheck,
    title: "Conflict-Free Booking",
    desc: "Real-time calendar sync eliminates double bookings completely.",
  },
];

/* Typing indicator */
function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-3 py-2">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-2 w-2 rounded-full bg-stone-400"
          style={{
            animation: `dots-pulse 1.4s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

/* Inline resource mini-card */
function InlineResourceCard({
  name,
  price,
  rating,
  available,
}: {
  name: string;
  price: string;
  rating: string;
  available: boolean;
}) {
  return (
    <div className={cn(
      "flex items-center justify-between rounded-xl px-3 py-2.5",
      "border border-white/10 bg-white/10"
    )}>
      <div>
        <p className="text-xs font-semibold text-white">{name}</p>
        <p className="text-[11px] text-stone-400">{price} · {rating}★</p>
      </div>
      <span className={cn(
        "rounded-full px-2.5 py-1 text-[10px] font-bold",
        available ? "bg-emerald-500/20 text-emerald-400" : "bg-stone-500/20 text-stone-400"
      )}>
        {available ? "Available" : "Waitlist"}
      </span>
    </div>
  );
}

export function AiConciergePreview() {
  return (
    <section id="ai-concierge" className="py-24 bg-[#FAFAF9]">
      <div className="mx-auto max-w-screen-xl px-5 md:px-10 lg:px-16">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[60fr_40fr] lg:gap-16 items-center">

          {/* LEFT: Chat mockup — dark card */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.42, ease: EASE }}
          >
            <div className="rounded-3xl bg-stone-900 p-6 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.25)]">
              {/* Chat header */}
              <div className="mb-5 flex items-center gap-3 border-b border-white/[0.08] pb-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600">
                  <Bot className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">HostNexus AI Concierge</p>
                  <p className="text-[11px] text-stone-400">Online · Typically responds instantly</p>
                </div>
                <span className="ml-auto flex h-2 w-2 rounded-full bg-emerald-500" />
              </div>

              {/* Messages */}
              <div className="space-y-4">
                {/* User message */}
                <div className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-emerald-600 px-4 py-3">
                    <p className="text-sm text-white">
                      I need 50 banquet chairs in Koregaon Park this Saturday under ₹8,000
                    </p>
                  </div>
                </div>

                {/* AI response */}
                <div className="flex gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-900 mt-1">
                    <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                  </div>
                  <div className="max-w-[90%] space-y-3">
                    <div className="rounded-2xl rounded-tl-sm bg-white/[0.07] px-4 py-3">
                      <p className="text-sm text-stone-200">
                        Found <strong className="text-emerald-400">3 matches</strong> within 2km of Koregaon Park. Here are the best options:
                      </p>
                    </div>
                    {/* Inline resource cards */}
                    <div className="space-y-2">
                      <InlineResourceCard
                        name="Sarovar Hotels — Banquet Chairs ×80"
                        price="₹6,500/day"
                        rating="4.8"
                        available={true}
                      />
                      <InlineResourceCard
                        name="ITC Maratha — Chair Set ×60"
                        price="₹7,200/day"
                        rating="4.9"
                        available={true}
                      />
                    </div>
                    <div className="rounded-2xl rounded-tl-sm bg-white/[0.07] px-4 py-3">
                      <p className="text-sm text-stone-200">
                        Want me to hold these for you? Both hosts have instant-confirm enabled.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Typing indicator */}
                <div className="flex gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-900">
                    <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                  </div>
                  <div className="rounded-2xl rounded-tl-sm bg-white/[0.07]">
                    <TypingDots />
                  </div>
                </div>
              </div>

              {/* Input bar */}
              <div className="mt-5 flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.05] px-4 py-3">
                <input
                  className="flex-1 bg-transparent text-sm text-stone-300 placeholder:text-stone-600 focus:outline-none"
                  placeholder="Ask anything about available resources..."
                  readOnly
                />
                <button
                  type="button"
                  className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors"
                >
                  Send
                </button>
              </div>
            </div>
          </motion.div>

          {/* RIGHT: Features */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.42, delay: 0.1, ease: EASE }}
            className="flex flex-col gap-6"
          >
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-600">
                AI Concierge
              </span>
              <h2 className="mt-2 font-display text-[clamp(1.8rem,4vw,2.6rem)] font-bold tracking-tight text-stone-900">
                Your 24/7 Resource Procurement Assistant
              </h2>
              <p className="mt-4 text-base leading-relaxed text-stone-500">
                Describe what you need in plain language. Our AI concierge understands hospitality
                industry context and finds verified, conflict-free resources instantly.
              </p>
            </div>

            <div className="flex flex-col gap-4">
              {FEATURES.map((feat, i) => {
                const Icon = feat.icon;
                return (
                  <motion.div
                    key={feat.title}
                    initial={{ opacity: 0, y: 8 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.28, delay: 0.2 + i * 0.08, ease: EASE }}
                    className="flex items-start gap-4"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100">
                      <Icon className="h-5 w-5 text-emerald-700" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-stone-900">{feat.title}</h3>
                      <p className="mt-1 text-sm text-stone-500">{feat.desc}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <a
              href="#ai-concierge"
              className={cn(
                "mt-2 self-start rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white",
                "shadow-[0_2px_8px_rgba(5,150,105,0.25)]",
                "hover:bg-emerald-700 hover:shadow-[0_4px_16px_rgba(5,150,105,0.35)]",
                "transition-all duration-200 active:scale-[0.97]"
              )}
            >
              Try AI Concierge
            </a>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
