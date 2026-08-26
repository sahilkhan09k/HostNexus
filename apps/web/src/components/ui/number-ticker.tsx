"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";
import { cn } from "@/lib/utils";

interface NumberTickerProps {
  value: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
}

/**
 * NumberTicker — count-up animation that triggers once on viewport entry.
 */
export function NumberTicker({
  value,
  prefix = "",
  suffix = "",
  duration = 1400,
  className,
}: NumberTickerProps) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });

  useEffect(() => {
    if (!isInView) return;
    let start = 0;
    const stepTime = 16;
    const steps = duration / stepTime;
    const increment = value / steps;

    const timer = setInterval(() => {
      start += increment;
      if (start >= value) {
        setDisplay(value);
        clearInterval(timer);
      } else {
        setDisplay(Math.floor(start));
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [isInView, value, duration]);

  return (
    <span ref={ref} className={cn("font-mono tabular-nums", className)}>
      {prefix}
      {display.toLocaleString("en-IN")}
      {suffix}
    </span>
  );
}
