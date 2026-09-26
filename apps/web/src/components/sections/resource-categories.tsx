"use client";

import { useState } from "react";
import Link from "next/link";
import { LayoutGrid, Users } from "lucide-react";
import { Button, IconChip, Location, Rating, SectionHeader } from "@/components/ds";
import { Container } from "@/components/landing/motion";
import { CATEGORIES, LISTINGS, type CategoryId, type Listing } from "@/components/landing/content";
import { CATEGORY_ICONS, ResourceVisual } from "@/components/landing/resource-visual";
import { cn } from "@/lib/utils";

/**
 * Photo tile from the design system's destination card: full-bleed image,
 * bottom scrim, white type and a glass arrow. The feature tile adds the
 * description and a larger title.
 */
function BentoCard({ card, feature = false }: { card: Listing; feature?: boolean }) {
  return (
    <Link href="/marketplace" className={cn("hn-dest-card hn-dest-card--interactive hn-bento__card", feature && "hn-dest-card--lg is-feature")}>
      <div className="hn-dest-card__media">
        <ResourceVisual
          category={card.category}
          image={card.image}
          alt={card.title}
          sizes={feature ? "(max-width: 768px) 100vw, 60vw" : "(max-width: 768px) 100vw, 35vw"}
        />
      </div>
      <div className="hn-dest-card__scrim hn-bento__scrim" />

      <div className="hn-bento__chips">
        <span className="hn-chip hn-chip--glass">{card.tag}</span>
        <span className={cn("hn-chip", card.available ? "hn-chip--available" : "hn-chip--glass")}>
          {card.available && <i />}
          {card.availableLabel}
        </span>
      </div>

      <div className="hn-dest-card__body">
        <div className="hn-dest-card__text">
          <span className="hn-bento__business">{card.business}</span>
          <span className="hn-dest-card__title">{card.title}</span>
          {feature && card.description && <p className="hn-bento__desc">{card.description}</p>}
          <div className="hn-dest-card__meta">
            <Location tone="light">{card.location}</Location>
            <span className="hn-meta hn-meta--light" style={{ gap: 4, fontSize: 12 }}>
              <Users size={13} strokeWidth={1.5} />{card.capacity}
            </span>
            <Rating value={card.rating} tone="light" />
          </div>
        </div>
        <div className="hn-bento__action">
          <span className="hn-bento__price">{card.price}<small>{card.unit}</small></span>
          <IconChip icon="arrow-up-right" variant="glass" size={feature ? 40 : 32} />
        </div>
      </div>
    </Link>
  );
}

/** Split into groups of three: one feature tile beside two stacked tiles. */
function chunk(cards: Listing[]) {
  const groups: Listing[][] = [];
  for (let i = 0; i < cards.length; i += 3) groups.push(cards.slice(i, i + 3));
  return groups;
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

        {/* Bento grid (reveals as one block). Keyed by filter so it fades in again on each switch. */}
        <div key={active} className="hn-bento">
          {chunk(cards).map((group, g) => (
            <div
              key={group[0].id}
              className={cn("hn-bento__group", `hn-bento__group--${group.length}`, g % 2 === 1 && "is-flipped")}
            >
              {group.map((card, i) => <BentoCard key={card.id} card={card} feature={i === 0 && group.length !== 2} />)}
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
