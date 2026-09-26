import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "./icon";

type Tone = "dark" | "light";

export interface EyebrowProps {
  children?: ReactNode;
  tone?: Tone;
  className?: string;
  style?: CSSProperties;
}

/** Small label above a heading. Sentence case, never all caps. */
export function Eyebrow({ children, tone = "dark", className, style }: EyebrowProps) {
  return <div className={cn("hn-eyebrow", tone === "light" && "hn-eyebrow--light", className)} style={style}>{children}</div>;
}

export interface LocationProps {
  children?: ReactNode;
  /** light = on photos or dark surfaces */
  tone?: Tone;
  size?: number;
}

/** Map-pin + place name. */
export function Location({ children, tone = "dark", size = 12 }: LocationProps) {
  return (
    <span className={cn("hn-meta", tone === "light" && "hn-meta--light")} style={{ gap: 4, fontSize: size }}>
      <Icon name="map-pin" size={size + 1} />
      {children}
    </span>
  );
}

export interface RatingProps {
  value?: number;
  max?: number;
  /** light = on photos or dark surfaces */
  tone?: Tone;
  size?: number;
}

/** Amber star + "(4.9 out of 5)". */
export function Rating({ value = 4.9, max = 5, tone = "dark", size = 12 }: RatingProps) {
  return (
    <span className={cn("hn-meta", tone === "light" && "hn-meta--light")} style={{ gap: 5, fontSize: size }}>
      <Icon name="star" size={size + 1} fill="var(--hn-star)" color="var(--hn-star)" strokeWidth={1} />
      ({value} out of {max})
    </span>
  );
}

export interface SectionHeaderProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Right-aligned (or centered) action, e.g. <Button variant="outline" arrow> */
  action?: ReactNode;
  align?: "left" | "center";
  tone?: Tone;
  className?: string;
  style?: CSSProperties;
}

/** Eyebrow + h2 with the action bottom-right (or stacked when centered). */
export function SectionHeader({ eyebrow, title, description, action, align = "left", tone = "dark", className, style }: SectionHeaderProps) {
  const center = align === "center";
  return (
    <div
      className={cn("hn-section-header", center && "hn-section-header--center", tone === "light" && "hn-section-header--light", className)}
      style={style}
    >
      <div className="hn-section-header__main">
        {eyebrow && <Eyebrow tone={tone}>{eyebrow}</Eyebrow>}
        <h2 className="hn-section-header__title">{title}</h2>
        {description && center && <p className="hn-section-header__desc">{description}</p>}
      </div>
      {description && !center && <p className="hn-section-header__desc hn-section-header__aside">{description}</p>}
      {action && <div className="hn-section-header__action">{action}</div>}
    </div>
  );
}

export interface TestimonialProps {
  headline: ReactNode;
  body?: ReactNode;
  author?: ReactNode;
  /** Image URL or node (e.g. initials). Grey circle when omitted. */
  avatar?: string | ReactNode;
  rating?: number;
  className?: string;
  style?: CSSProperties;
}

/** Large quote glyph, headline, body and author with rating. */
export function Testimonial({ headline, body, author, avatar, rating = 5, className, style }: TestimonialProps) {
  return (
    <figure className={cn("hn-testimonial", className)} style={{ margin: 0, ...style }}>
      <div aria-hidden="true" className="hn-testimonial__mark">“</div>
      <div className="hn-testimonial__content">
        <h3 className="hn-testimonial__headline">{headline}</h3>
        {body && <blockquote style={{ margin: 0 }}><p className="hn-testimonial__body">{body}</p></blockquote>}
        <figcaption className="hn-testimonial__author">
          <div className="hn-testimonial__avatar">
            {typeof avatar === "string" ? (
              // eslint-disable-next-line @next/next/no-img-element -- arbitrary avatar URLs
              <img src={avatar} alt="" />
            ) : avatar}
          </div>
          <div className="hn-testimonial__who">
            <span className="hn-testimonial__name">{author}</span>
            <Rating value={rating} size={11} />
          </div>
        </figcaption>
      </div>
    </figure>
  );
}

export interface LogoItem {
  name: string;
  /** Partner logo image; falls back to the name set in type */
  src?: string;
}

export interface LogoStripProps {
  logos: LogoItem[];
  marquee?: boolean;
  height?: number;
  className?: string;
  style?: CSSProperties;
}

/** Greyscale partner logos; drifts left as a 40s marquee (pauses on hover). */
export function LogoStrip({ logos, marquee = true, height = 36, className, style }: LogoStripProps) {
  const row = (hidden: boolean) => (
    <div className="hn-logo-strip__row" aria-hidden={hidden || undefined}>
      {logos.map((logo) => (
        <div key={logo.name} className="hn-logo-strip__item" style={{ height }}>
          {logo.src ? (
            // eslint-disable-next-line @next/next/no-img-element -- partner logos are arbitrary URLs
            <img src={logo.src} alt={hidden ? "" : logo.name} />
          ) : (
            <span className="hn-logo-strip__name">{logo.name}</span>
          )}
        </div>
      ))}
    </div>
  );
  return (
    <div className={cn("hn-logo-strip", className)} style={style}>
      <div className={cn("hn-logo-strip__track", marquee && "hn-logo-strip__track--marquee")}>
        {row(false)}
        {marquee && row(true)}
      </div>
    </div>
  );
}
