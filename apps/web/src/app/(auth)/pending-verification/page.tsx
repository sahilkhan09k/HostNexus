"use client";

import { motion, type Easing } from "framer-motion";
import Link from "next/link";
import {
  Clock, CheckCircle, Mail, ShieldCheck,
  FileText, ArrowRight, Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const EASE: Easing = [0.22, 1, 0.36, 1];

const STEPS = [
  {
    icon: CheckCircle,
    color: "text-emerald-600",
    bg: "bg-emerald-100",
    title: "Documents Submitted",
    desc: "Your GST certificate and Aadhaar have been received.",
    done: true,
  },
  {
    icon: ShieldCheck,
    color: "text-amber-600",
    bg: "bg-amber-100",
    title: "Admin Review",
    desc: "Our team verifies your business identity — typically within 24–48 hours.",
    done: false,
  },
  {
    icon: Building2,
    color: "text-stone-400",
    bg: "bg-stone-100",
    title: "Account Activated",
    desc: "Once verified, you can log in and start listing resources.",
    done: false,
  },
];

export default function PendingVerificationPage() {
  return (
    <div className="w-full max-w-lg">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: EASE }}
        className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-[0_20px_60px_-10px_rgba(0,0,0,0.10)]"
      >
        {/* Top accent bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-600" />

        <div className="p-8 md:p-10">
          {/* Icon + heading */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.1, ease: EASE }}
            className="mb-6 flex justify-center"
          >
            <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-amber-50 border border-amber-200">
              <Clock className="h-9 w-9 text-amber-500" />
              {/* Pulse ring */}
              <span className="absolute inset-0 animate-ping rounded-2xl bg-amber-100 opacity-40" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.2, ease: EASE }}
            className="text-center"
          >
            <h1 className="font-display text-2xl font-bold text-stone-900">
              Application Under Review
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-stone-500">
              We&apos;ve received your registration. Our team will review your documents and activate your account within <strong className="text-stone-700">24–48 hours</strong>.
            </p>
          </motion.div>

          {/* Timeline */}
          <div className="mt-8 space-y-0">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              const isLast = i === STEPS.length - 1;
              return (
                <motion.div
                  key={step.title}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.25 + i * 0.1, ease: EASE }}
                  className="flex gap-4"
                >
                  {/* Icon + connector */}
                  <div className="flex flex-col items-center">
                    <div className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                      step.bg
                    )}>
                      <Icon className={cn("h-4 w-4", step.color)} />
                    </div>
                    {!isLast && (
                      <div className={cn(
                        "mt-1 w-px flex-1",
                        step.done ? "bg-emerald-300" : "bg-stone-200"
                      )} style={{ minHeight: "28px" }} />
                    )}
                  </div>

                  {/* Text */}
                  <div className={cn("pb-6", isLast && "pb-0")}>
                    <p className={cn(
                      "text-sm font-semibold",
                      step.done ? "text-stone-800" : i === 1 ? "text-amber-700" : "text-stone-400"
                    )}>
                      {step.title}
                      {i === 1 && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                          In progress
                        </span>
                      )}
                    </p>
                    <p className={cn(
                      "mt-0.5 text-xs leading-relaxed",
                      step.done ? "text-stone-500" : i === 1 ? "text-amber-600/80" : "text-stone-400"
                    )}>
                      {step.desc}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Email notice */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35, delay: 0.55, ease: EASE }}
            className="mt-6 flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 p-4"
          >
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
            <div>
              <p className="text-xs font-semibold text-sky-800">We&apos;ll email you when verified</p>
              <p className="mt-0.5 text-xs text-sky-700">
                Check your inbox (and spam folder) for a confirmation from{" "}
                <span className="font-medium">verify@hostnexus.in</span>.
              </p>
            </div>
          </motion.div>

          {/* What to expect next */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35, delay: 0.65, ease: EASE }}
            className="mt-4 rounded-xl border border-stone-100 bg-stone-50 p-4"
          >
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-stone-500">
              What happens next
            </p>
            <ul className="space-y-1.5">
              {[
                "Admin reviews your GST & Aadhaar",
                "Account activated — you receive a confirmation email",
                "Log in and start listing your resources",
              ].map((item, i) => (
                <li key={item} className="flex items-center gap-2 text-xs text-stone-600">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-stone-200 text-[9px] font-bold text-stone-600">
                    {i + 1}
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.75, ease: EASE }}
            className="mt-6 flex flex-col gap-2"
          >
            <Link
              href="/login"
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold",
                "bg-emerald-600 text-white shadow-[0_2px_8px_rgba(5,150,105,0.25)]",
                "hover:bg-emerald-700 transition-all"
              )}
            >
              Go to Sign In <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-stone-200 py-3 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors"
            >
              <FileText className="h-4 w-4" />
              Back to Home
            </Link>
          </motion.div>
        </div>
      </motion.div>

      <p className="mt-4 text-center text-xs text-stone-400">
        Questions? Contact{" "}
        <a href="mailto:support@hostnexus.in" className="text-emerald-600 hover:underline">
          support@hostnexus.in
        </a>
      </p>
    </div>
  );
}
