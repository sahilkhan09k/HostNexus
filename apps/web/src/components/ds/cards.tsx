import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Location, Rating } from "./content";
import { EmailField } from "./forms";
import { IconChip } from "./icon-button";
import { Media } from "./media";

/** Wraps card content in a Next link when an href is given. */
function CardShell({ href, className, style, children }: { href?: string; className: string; style?: CSSProperties; children: ReactNode }) {
  return href ? (
    <Link href={href} className={className} style={style}>{children}</Link>
  ) : (
    <div className={className} style={style}>{children}</div>
  );
}

export interface DestinationCardProps {
  title: ReactNode;
  location?: ReactNode;
  rating?: number;
  /** Image URL */
  image?: string;
  /** Alternative to image, rendered inside the frame */
  media?: ReactNode;
  height?: number | string;
  /** lg = feature tile (bigger title) */
  size?: "md" | "lg";
  href?: string;
  className?: string;
  style?: CSSProperties;
}

/** Full-bleed photo card with bottom scrim, title, location, rating and glass arrow. */
export function DestinationCard({ title, location, rating, image, media, height = 300, size = "md", href, className, style }: DestinationCardProps) {
  const lg = size === "lg";
  return (
    <CardShell
      href={href}
      className={cn("hn-dest-card", lg && "hn-dest-card--lg", href && "hn-dest-card--interactive", className)}
      style={{ height, ...style }}
    >
      <div className="hn-dest-card__media">
        <Media src={image} radius={0} label={typeof title === "string" ? title : undefined}>{media}</Media>
      </div>
      <div className="hn-dest-card__scrim" />
      <div className="hn-dest-card__body">
        <div className="hn-dest-card__text">
          <div className="hn-dest-card__title">{title}</div>
          <div className="hn-dest-card__meta">
            {location && <Location tone="light">{location}</Location>}
            {rating != null && <Rating value={rating} tone="light" />}
          </div>
        </div>
        <IconChip icon="arrow-up-right" variant="glass" size={lg ? 36 : 30} />
      </div>
    </CardShell>
  );
}

export interface ListingCardProps {
  title: ReactNode;
  /** Pre-formatted, e.g. "₹45,000/day" */
  price?: ReactNode;
  location?: ReactNode;
  image?: string;
  media?: ReactNode;
  imageHeight?: number;
  width?: number | string;
  href?: string;
  className?: string;
  style?: CSSProperties;
}

/** Image + title/price row + location. */
export function ListingCard({ title, price, location, image, media, imageHeight = 220, width, href, className, style }: ListingCardProps) {
  return (
    <CardShell
      href={href}
      className={cn("hn-listing-card", href && "hn-listing-card--interactive", className)}
      style={{ width, ...style }}
    >
      <div className="hn-listing-card__frame">
        <div className="hn-listing-card__zoom">
          <Media src={image} height={imageHeight} radius={0} label={typeof title === "string" ? title : undefined}>{media}</Media>
        </div>
      </div>
      <div className="hn-listing-card__info">
        <div className="hn-listing-card__row">
          <span className="hn-listing-card__title">{title}</span>
          {price && <span className="hn-listing-card__price">{price}</span>}
        </div>
        {location && <Location>{location}</Location>}
      </div>
    </CardShell>
  );
}

export interface NewsletterCardProps {
  message?: ReactNode;
  placeholder?: string;
  onSubmit?: (email: string) => void;
  width?: number | string;
  className?: string;
  style?: CSSProperties;
}

/** Solid ink card with a centered message and dark email field. */
export function NewsletterCard({
  message = "Join our community and hear about new resources first.",
  placeholder = "you@business.com", onSubmit, width = 300, className, style,
}: NewsletterCardProps) {
  return (
    <div className={cn("hn-newsletter", className)} style={{ width, ...style }}>
      <p className="hn-newsletter__message">{message}</p>
      <EmailField placeholder={placeholder} onSubmit={onSubmit} />
    </div>
  );
}
