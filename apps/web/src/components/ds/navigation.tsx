import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { IconButton } from "./icon-button";

export interface NavLink {
  label: string;
  href: string;
}

export interface NavBarProps {
  links?: NavLink[];
  /** Label of the current link */
  active?: string;
  ctaLabel?: string;
  ctaHref?: string;
  /** Replaces the default CTA, e.g. a sign-in + get-started pair */
  actions?: ReactNode;
  /** light = white text over photography; dark = ink text on page */
  tone?: "light" | "dark";
  /** Optional wordmark; the source nav omits it (brand lives in the giant hero wordmark) */
  brand?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/** Minimal top nav: text links left, ember pill right, hairline underneath. */
export function NavBar({ links = [], active, ctaLabel = "Sign In", ctaHref = "/login", actions, tone = "light", brand, className, style }: NavBarProps) {
  return (
    <nav aria-label="Main" className={cn("hn-nav", tone === "light" && "hn-nav--light", className)} style={style}>
      <div className="hn-nav__left">
        {brand && <Link href="/" className="hn-nav__brand">{brand}</Link>}
        <div className={cn("hn-nav__links", active && "hn-nav__links--has-active")}>
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="hn-nav__link" aria-current={active === link.label ? "page" : undefined}>
              {link.label}
            </Link>
          ))}
        </div>
      </div>
      {actions ?? <Button size="sm" href={ctaHref}>{ctaLabel}</Button>}
    </nav>
  );
}

export interface CarouselControlsProps {
  onPrev?: () => void;
  onNext?: () => void;
  canPrev?: boolean;
  canNext?: boolean;
  size?: number;
  className?: string;
  style?: CSSProperties;
}

/** Outline "previous" + accent "next" circles. */
export function CarouselControls({ onPrev, onNext, canPrev = true, canNext = true, size = 36, className, style }: CarouselControlsProps) {
  return (
    <div className={cn("hn-carousel-controls", className)} style={style}>
      <IconButton icon="chevron-left" variant="outline" size={size} label="Previous" onClick={onPrev} disabled={!canPrev} />
      <IconButton icon="chevron-right" variant="accent" size={size} label="Next" onClick={onNext} disabled={!canNext} />
    </div>
  );
}
