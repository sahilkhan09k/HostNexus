"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** window.scrollY, rAF-throttled. Stays 0 when the user prefers reduced motion. */
export function useScrollY() {
  const [y, setY] = useState(0);
  useEffect(() => {
    if (prefersReducedMotion()) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setY(window.scrollY));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);
  return y;
}

/** True once the element is 15% visible; never reverses. */
function useReveal<T extends Element>(threshold = 0.15) {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        io.disconnect();
      }
    }, { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, visible] as const;
}

/**
 * Two-tone statement: words fill grey → ink as the element scrolls from
 * 90% to 30% of the viewport height.
 */
export function InkFillText({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [progress, setProgress] = useState(0);
  const words = text.split(" ");

  useEffect(() => {
    const update = () => {
      if (!ref.current) return;
      if (prefersReducedMotion()) return setProgress(1);
      const top = ref.current.getBoundingClientRect().top;
      const vh = window.innerHeight;
      setProgress(Math.max(0, Math.min(1, (vh * 0.9 - top) / (vh * 0.6))));
    };
    const frame = requestAnimationFrame(update);
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const lit = Math.round(progress * words.length);
  return (
    <p ref={ref} className={cn("hn-ink-fill", className)}>
      {words.map((word, i) => (
        <span key={i} className={i < lit ? "is-lit" : undefined}>{word} </span>
      ))}
    </p>
  );
}

/**
 * Centered 1280px container with the section blur-in reveal
 * (blur 12px → 0, fade, translateY 24px → 0 over 900ms).
 */
export function Container({ children, className, style, reveal = true }: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  reveal?: boolean;
}) {
  const [ref, visible] = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className={cn("hn-container", reveal && "hn-reveal", reveal && visible && "is-visible", className)} style={style}>
      {children}
    </div>
  );
}
