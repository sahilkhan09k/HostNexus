"use client";

import { useState } from "react";
import Link from "next/link";
import { Clock, LayoutGrid, Users } from "lucide-react";
import { Button, Location, Rating, SectionHeader } from "@/components/ds";
import { Container } from "@/components/landing/motion";
import { CATEGORIES, LISTINGS, type CategoryId, type Listing } from "@/components/landing/content";
import { CATEGORY_ICONS, ResourceVisual } from "@/components/landing/resource-visual";
import { cn } from "@/lib/utils";

function ResourceCard({ card }: { card: Listing }) {
  return (
    <Link href="/marketplace" className="hn-resource-card">
      <div className="hn-resource-card__frame">
        <div className="hn-resource-card__zoom">
          <ResourceVisual category={card.category} image={card.image} alt={card.title} />
        </div>
        <span className="hn-chip hn-chip--glass hn-resource-card__tag">{card.tag}</span>
        <span className={cn("hn-chip hn-resource-card__status", card.available ? "hn-chip--available" : "hn-chip--glass")}>
          {card.available && <i />}
          {card.availableLabel}
        </span>
      </div>
      <div className="hn-resource-card__body">
        <span className="hn-resource-card__business">{card.business}</span>
        <span className="hn-resource-card__title">{card.title}</span>
        {card.description && <p className="hn-resource-card__desc">{card.description}</p>}
        <div className="hn-resource-card__meta">
          <Location>{card.location}</Location>
          <span className="hn-meta" style={{ gap: 4, fontSize: 12 }}><Users size={13} strokeWidth={1.5} />{card.capacity}</span>
          <span className="hn-meta" style={{ gap: 4, fontSize: 12 }}><Clock size={13} strokeWidth={1.5} />Instant book</span>
        </div>
        <div className="hn-resource-card__footer">
          <span className="hn-price">{card.price}<small>{card.unit}</small></span>
          <Rating value={card.rating} />
        </div>
      </div>
    </Link>
  );
}

export function ResourceCategories() {
  const [active, setActive] = useState<CategoryId | "all">("all");
  const cards = active === "all" ? LISTINGS : LISTINGS.filter((l) => l.category === active);

  return (
    <section id="marketplace" className="hn-section hn-section--muted">
      <Container className="hn-stack hn-stack--48">
        <SectionHeader
          eyebrow="Marketplace"
          title={<>Discover Available<br />Resources</>}
          description="Browse live inventory shared by hotels, caterers, and event venues across Pune and Mumbai."
          action={<Button variant="outline" arrow size="sm" href="/marketplace">View All Resources</Button>}
        />

        <div className="hn-pills" role="toolbar" aria-label="Filter by category">
          <button type="button" className={cn("hn-pill", active === "all" && "is-active")} aria-pressed={active === "all"} onClick={() => setActive("all")}>
            <LayoutGrid size={14} strokeWidth={1.5} />
            All
          </button>
          {CATEGORIES.map((cat) => {
            const Icon = CATEGORY_ICONS[cat.id];
            return (
              <button
                key={cat.id}
                type="button"
                className={cn("hn-pill", active === cat.id && "is-active")}
                aria-pressed={active === cat.id}
                onClick={() => setActive(cat.id)}
              >
                <Icon size={14} strokeWidth={1.5} />
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Keyed by filter so the cards replay their entry animation on each switch. */}
        <div key={active} className="hn-resource-grid">
          {cards.map((card) => <ResourceCard key={card.id} card={card} />)}
        </div>
      </Container>
    </section>
  );
}
