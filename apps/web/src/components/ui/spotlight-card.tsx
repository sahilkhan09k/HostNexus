"use client";

import React, { useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface SpotlightCardProps {
  children: React.ReactNode;
  className?: string;
  spotlightColor?: string;
}

/**
 * SpotlightCard — light-theme cursor-tracked glow on white cards.
 * Spotlight colour uses a soft emerald tint: rgba(5,150,105,0.06)
 */
export function SpotlightCard({
  children,
  className,
  spotlightColor = "rgba(5, 150, 105, 0.06)",
}: SpotlightCardProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!divRef.current) return;
    const rect = divRef.current.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setOpacity(1)}
      onMouseLeave={() => setOpacity(0)}
      className={cn(
        "relative overflow-hidden rounded-2xl bg-white border border-stone-200",
        "transition-all duration-300",
        "hover:-translate-y-0.5",
        "shadow-[0_4px_6px_-1px_rgba(0,0,0,0.07),0_2px_4px_-1px_rgba(0,0,0,0.06)]",
        "hover:shadow-[0_10px_25px_-5px_rgba(0,0,0,0.12),0_4px_10px_-3px_rgba(0,0,0,0.08)]",
        className
      )}
    >
      {/* Spotlight radial gradient */}
      <div
        className="pointer-events-none absolute -inset-px transition-opacity duration-300"
        style={{
          opacity,
          background: `radial-gradient(500px circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 40%)`,
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
