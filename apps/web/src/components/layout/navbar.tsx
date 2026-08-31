"use client";

import { useState } from "react";
import { motion, useMotionValueEvent, useScroll, type Easing } from "framer-motion";
import { Building2, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const EASE: Easing = [0.22, 1, 0.36, 1];

const NAV_LINKS = [
  { label: "Marketplace", href: "#marketplace" },
  { label: "AI Concierge", href: "#ai-concierge" },
  { label: "Dashboard", href: "#dashboard" },
  { label: "How it Works", href: "#how-it-works" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 32));

  return (
    <>
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.05, ease: EASE }}
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-all duration-300",
          scrolled
            ? "bg-white/95 backdrop-blur-xl border-b border-stone-200 shadow-[0_1px_12px_rgba(0,0,0,0.06)]"
            : "bg-transparent"
        )}
      >
        <nav className="mx-auto flex h-[68px] max-w-screen-xl items-center justify-between px-5 md:px-10 lg:px-16">
          {/* Logo */}
          <a href="/" className="group flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 shadow-sm transition-all duration-200 group-hover:bg-emerald-700">
              <Building2 className="h-4.5 w-4.5 text-white" strokeWidth={2.2} />
            </div>
            <span className="font-display text-[17px] font-bold tracking-[-0.02em] text-stone-900">
              Host<span className="text-emerald-600">Nexus</span>
            </span>
          </a>

          {/* Center links */}
          <ul className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map((link) => (
              <li key={link.label}>
                <a
                  href={link.href}
                  className="rounded-lg px-3.5 py-2 text-sm font-medium text-stone-500 transition-all duration-150 hover:bg-stone-100 hover:text-stone-900"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>

          {/* Right CTAs */}
          <div className="flex items-center gap-3">
            <a
              href="/dashboard"
              className="hidden text-sm font-medium text-stone-500 transition-colors duration-150 hover:text-stone-900 md:block"
            >
              List a Resource
            </a>
            <a
              href="/login"
              className="hidden text-sm font-medium text-stone-500 transition-colors duration-150 hover:text-stone-900 md:block"
            >
              Sign In
            </a>
            <a
              href="/register"
              className={cn(
                "rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white",
                "shadow-[0_2px_8px_rgba(5,150,105,0.25)]",
                "hover:bg-emerald-700 hover:shadow-[0_4px_16px_rgba(5,150,105,0.35)]",
                "transition-all duration-200 active:scale-[0.97]"
              )}
            >
              Get Started
            </a>

            {/* Mobile menu toggle */}
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-stone-600 transition-colors hover:bg-stone-100 md:hidden"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </nav>
      </motion.header>

      {/* Mobile drawer */}
      <motion.div
        initial={false}
        animate={{ height: mobileOpen ? "auto" : 0, opacity: mobileOpen ? 1 : 0 }}
        transition={{ duration: 0.28, ease: EASE }}
        className="fixed inset-x-0 top-[68px] z-40 overflow-hidden bg-white border-b border-stone-200 shadow-lg md:hidden"
      >
        <div className="flex flex-col gap-1 px-4 py-3">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50 hover:text-stone-900"
            >
              {link.label}
            </a>
          ))}
          <div className="mt-2 flex gap-2 border-t border-stone-100 pt-3">
            <a
              href="/login"
              className="flex-1 rounded-xl border border-stone-200 px-4 py-2.5 text-center text-sm font-semibold text-stone-700 transition-colors hover:border-stone-300 hover:bg-stone-50"
            >
              Sign In
            </a>
            <a
              href="/register"
              className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
            >
              Get Started
            </a>
          </div>
        </div>
      </motion.div>
    </>
  );
}

