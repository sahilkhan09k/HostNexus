"use client";

import { useState } from "react";
import { motion, type Easing } from "framer-motion";
import {
  Building2,
  ChefHat,
  Tv2,
  Sofa,
  Car,
  Tent,
  Star,
  Users,
  Clock,
} from "lucide-react";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { cn } from "@/lib/utils";

const EASE: Easing = [0.22, 1, 0.36, 1];

const CATEGORIES = [
  { id: "banquet", label: "Banquet Halls", icon: Building2 },
  { id: "kitchen", label: "Commercial Kitchens", icon: ChefHat },
  { id: "av", label: "AV Equipment", icon: Tv2 },
  { id: "furniture", label: "Furniture & Fixtures", icon: Sofa },
  { id: "vehicles", label: "Vehicles & Transport", icon: Car },
  { id: "event", label: "Event Spaces", icon: Tent },
];

const RESOURCE_CARDS = [
  {
    id: 1,
    category: "Banquet Hall",
    categoryColor: "bg-purple-100 text-purple-700",
    gradientFrom: "from-purple-100",
    gradientTo: "to-indigo-100",
    business: "JW Marriott Pune",
    title: "Grand Ballroom",
    description: "Opulent 10,000 sq.ft space with crystal chandeliers and AV setup included.",
    price: "₹45,000",
    priceUnit: "/day",
    capacity: 500,
    rating: 4.9,
    reviews: 38,
    available: true,
    availableText: "Available Sat–Sun",
  },
  {
    id: 2,
    category: "Commercial Kitchen",
    categoryColor: "bg-orange-100 text-orange-700",
    gradientFrom: "from-orange-100",
    gradientTo: "to-amber-50",
    business: "Radisson Blu Pune",
    title: "Industrial Production Kitchen",
    description: "Rational iCombi Pro 20-Grid Oven, prep stations, walk-in cold storage.",
    price: "₹8,500",
    priceUnit: "/half-day",
    capacity: 12,
    rating: 4.7,
    reviews: 24,
    available: true,
    availableText: "Available weekdays",
  },
  {
    id: 3,
    category: "AV Equipment",
    categoryColor: "bg-sky-100 text-sky-700",
    gradientFrom: "from-sky-100",
    gradientTo: "to-blue-50",
    business: "Fortune Hotels India",
    title: "Full AV Conference Bundle",
    description: "4K projector, 75\" smart displays ×4, wireless mics, Dolby sound system.",
    price: "₹12,000",
    priceUnit: "/day",
    capacity: 200,
    rating: 4.8,
    reviews: 17,
    available: false,
    availableText: "Next available Mon",
  },
];

export function ResourceCategories() {
  const [activeCategory, setActiveCategory] = useState("banquet");

  return (
    <section id="marketplace" className="py-24 bg-[#FAFAF9]">
      <div className="mx-auto max-w-screen-xl px-5 md:px-10 lg:px-16">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.36, ease: EASE }}
          className="mb-10"
        >
          <span className="text-xs font-bold uppercase tracking-widest text-emerald-600">
            Marketplace
          </span>
          <h2 className="mt-2 font-display text-[clamp(1.8rem,4vw,2.6rem)] font-bold tracking-tight text-stone-900">
            Discover Available Resources
          </h2>
          <p className="mt-3 max-w-lg text-base leading-relaxed text-stone-500">
            Browse live inventory shared by hotels, caterers, and event venues across Pune and Mumbai.
          </p>
        </motion.div>

        {/* Category pills */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.32, delay: 0.08, ease: EASE }}
          className="mb-10 flex gap-2.5 overflow-x-auto pb-2 scrollbar-hide"
        >
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-emerald-600 text-white shadow-[0_2px_8px_rgba(5,150,105,0.30)]"
                    : "border border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:bg-stone-50 hover:text-stone-800"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {cat.label}
              </button>
            );
          })}
        </motion.div>

        {/* Resource cards */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {RESOURCE_CARDS.map((card, i) => (
            <motion.div
              key={card.id}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.32, delay: i * 0.08, ease: EASE }}
            >
              <SpotlightCard className="flex flex-col">
                {/* Image placeholder */}
                <div
                  className={cn(
                    "relative h-44 bg-gradient-to-br overflow-hidden",
                    card.gradientFrom,
                    card.gradientTo
                  )}
                >
                  {/* Category badge */}
                  <span
                    className={cn(
                      "absolute top-3 left-3 rounded-full px-3 py-1 text-xs font-semibold",
                      card.categoryColor
                    )}
                  >
                    {card.category}
                  </span>

                  {/* Availability badge */}
                  <span
                    className={cn(
                      "absolute top-3 right-3 rounded-full px-3 py-1 text-xs font-semibold",
                      card.available
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-stone-100 text-stone-500"
                    )}
                  >
                    {card.availableText}
                  </span>

                  {/* Decorative pattern */}
                  <div className="absolute inset-0 opacity-10">
                    <div className="h-full w-full" style={{
                      backgroundImage: "radial-gradient(circle at 25% 25%, rgba(0,0,0,0.15) 0%, transparent 50%)"
                    }} />
                  </div>
                </div>

                {/* Card body */}
                <div className="flex flex-1 flex-col gap-3 p-5">
                  <div>
                    <p className="text-xs font-medium text-stone-400">{card.business}</p>
                    <h3 className="mt-0.5 text-base font-semibold text-stone-900">{card.title}</h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-stone-500 line-clamp-2">{card.description}</p>
                  </div>

                  {/* Metadata row */}
                  <div className="flex items-center gap-3 text-xs text-stone-400">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {card.capacity} pax
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Instant book
                    </span>
                  </div>

                  {/* Price + Rating row */}
                  <div className="mt-auto flex items-center justify-between border-t border-stone-100 pt-3">
                    <div>
                      <span className="text-lg font-bold text-stone-900">{card.price}</span>
                      <span className="text-xs text-stone-400">{card.priceUnit}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      <span className="text-sm font-semibold text-stone-700">{card.rating}</span>
                      <span className="text-xs text-stone-400">({card.reviews})</span>
                    </div>
                  </div>
                </div>
              </SpotlightCard>
            </motion.div>
          ))}
        </div>

        {/* View all link */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.32, delay: 0.3, ease: EASE }}
          className="mt-10 text-center"
        >
          <a
            href="#marketplace"
            className={cn(
              "inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-6 py-3 text-sm font-semibold text-stone-700",
              "shadow-[0_2px_6px_rgba(0,0,0,0.06)]",
              "hover:border-emerald-300 hover:text-emerald-700 hover:shadow-[0_4px_12px_rgba(5,150,105,0.12)]",
              "transition-all duration-200"
            )}
          >
            View All 35+ Resources
          </a>
        </motion.div>
      </div>
    </section>
  );
}
