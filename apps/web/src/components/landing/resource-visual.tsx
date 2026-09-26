import Image from "next/image";
import { Building2, Car, ChefHat, Sofa, Tent, Tv2, type LucideIcon } from "lucide-react";
import type { CategoryId } from "./content";

export const CATEGORY_ICONS: Record<CategoryId, LucideIcon> = {
  banquet: Building2,
  kitchen: ChefHat,
  av: Tv2,
  furniture: Sofa,
  vehicles: Car,
  event: Tent,
};

/**
 * Listing photo, or — when none is supplied — a dusk-toned panel in the design
 * system's night/ink palette with a warm ember glow and the category's line icon.
 */
export function ResourceVisual({
  category,
  image,
  alt = "",
  iconSize = 56,
  sizes = "(max-width: 768px) 100vw, 33vw",
}: {
  category: CategoryId;
  image?: string;
  alt?: string;
  iconSize?: number;
  sizes?: string;
}) {
  if (image) {
    return (
      <div className="hn-visual hn-visual--photo">
        <Image src={image} alt={alt} fill sizes={sizes} className="hn-visual__img" />
      </div>
    );
  }
  const Icon = CATEGORY_ICONS[category];
  return (
    <div className="hn-visual" aria-hidden="true">
      <Icon className="hn-visual__icon" size={iconSize} strokeWidth={1} />
    </div>
  );
}
