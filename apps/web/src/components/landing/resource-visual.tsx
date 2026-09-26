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
 * Stand-in for resource photography (none supplied yet): a dusk-toned panel in the
 * design system's night/ink palette with a warm ember glow and the category's line icon.
 */
export function ResourceVisual({ category, iconSize = 56 }: { category: CategoryId; iconSize?: number }) {
  const Icon = CATEGORY_ICONS[category];
  return (
    <div className="hn-visual" aria-hidden="true">
      <Icon className="hn-visual__icon" size={iconSize} strokeWidth={1} />
    </div>
  );
}
