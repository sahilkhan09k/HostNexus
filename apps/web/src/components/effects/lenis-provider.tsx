"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";

// Routes where Lenis smooth scroll should be DISABLED.
// These routes use their own inner scrollable containers (overflow-y-auto on <main>),
// so Lenis targeting <html> intercepts wheel events without anything to scroll.
const LENIS_DISABLED_PREFIXES = ["/dashboard", "/login", "/register", "/ai-concierge"];

/**
 * LenisProvider - initialises Lenis smooth scroll on marketing/landing pages only.
 * Skips initialisation on dashboard and auth routes where the layout uses an
 * inner scrollable <main> element instead of the document root.
 */
export function LenisProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isDisabled = LENIS_DISABLED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );

  useEffect(() => {
    if (isDisabled) return;

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 2,
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    const id = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(id);
      lenis.destroy();
    };
  }, [isDisabled]);

  return <>{children}</>;
}
