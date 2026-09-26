"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users } from "lucide-react";
import { CarouselControls, Location, Rating } from "@/components/ds";
import { LISTINGS } from "@/components/landing/content";
import { ResourceVisual } from "@/components/landing/resource-visual";
import { cn } from "@/lib/utils";

const AUTO_MS = 5000;

/** Auto-advancing preview of live marketplace listings (pauses on hover). */
export function HeroPreviewCards() {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const total = LISTINGS.length;
  const card = LISTINGS[current];

  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(() => setCurrent((c) => (c + 1) % total), AUTO_MS);
    return () => clearTimeout(timer);
  }, [paused, current, total]);

  return (
    <div className="hn-preview" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <Link key={card.id} href="/marketplace" className="hn-preview__card">
        <div className="hn-preview__media">
          <ResourceVisual category={card.category} image={card.image} alt={card.title} iconSize={64} sizes="420px" />
          <span className="hn-chip hn-chip--glass hn-preview__tag">{card.tag}</span>
          <span className={cn("hn-chip hn-preview__status", card.available ? "hn-chip--available" : "hn-chip--glass")}>
            {card.available && <i />}
            {card.availableLabel}
          </span>
        </div>
        <div className="hn-preview__body">
          <span className="hn-preview__business">{card.business}</span>
          <span className="hn-preview__title">{card.title}</span>
          <div className="hn-preview__meta">
            <Location>{card.location}</Location>
            <span className="hn-meta" style={{ gap: 4, fontSize: 12 }}>
              <Users size={13} strokeWidth={1.5} />
              {card.capacity}
            </span>
          </div>
          <div className="hn-preview__footer">
            <span className="hn-price">{card.price}<small>{card.unit}</small></span>
            <Rating value={card.rating} />
          </div>
        </div>
      </Link>

      <div className="hn-preview__controls">
        <div className="hn-preview__dots" role="tablist" aria-label="Listings">
          {LISTINGS.map((l, i) => (
            <button
              key={l.id}
              type="button"
              role="tab"
              aria-selected={i === current}
              aria-label={l.title}
              className={cn("hn-dot", i === current && "is-active")}
              onClick={() => setCurrent(i)}
            />
          ))}
        </div>
        <CarouselControls
          onPrev={() => setCurrent((current - 1 + total) % total)}
          onNext={() => setCurrent((current + 1) % total)}
          size={34}
        />
      </div>
    </div>
  );
}
