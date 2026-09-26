import type { CSSProperties } from "react";

export type IconName =
  | "arrow-up-right" | "arrow-right"
  | "chevron-left" | "chevron-right" | "chevron-down" | "chevron-up"
  | "map-pin" | "star" | "search" | "shield-check" | "menu" | "x" | "mail";

type Shape = string | { circle: [number, number, number] } | { rect: [number, number, number, number, number] };

// Path data copied from Lucide (ISC). Stroke 1.5 matches the source.
const PATHS: Record<IconName, Shape[]> = {
  "arrow-up-right": ["M7 7h10v10", "M7 17 17 7"],
  "arrow-right": ["M5 12h14", "m12 5 7 7-7 7"],
  "chevron-left": ["m15 18-6-6 6-6"],
  "chevron-right": ["m9 18 6-6-6-6"],
  "chevron-down": ["m6 9 6 6 6-6"],
  "chevron-up": ["m18 15-6-6-6 6"],
  "map-pin": [
    "M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0",
    { circle: [12, 10, 3] },
  ],
  star: [
    "M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z",
  ],
  search: [{ circle: [11, 11, 8] }, "m21 21-4.3-4.3"],
  "shield-check": [
    "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",
    "m9 12 2 2 4-4",
  ],
  menu: ["M4 12h16", "M4 6h16", "M4 18h16"],
  x: ["M18 6 6 18", "m6 6 12 12"],
  mail: [{ rect: [2, 4, 20, 16, 2] }, "m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"],
};

export interface IconProps {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  color?: string;
  fill?: string;
  className?: string;
  style?: CSSProperties;
}

/** Thin rounded line icon (Lucide paths, 1.5 stroke). Decorative: aria-hidden. */
export function Icon({ name, size = 18, strokeWidth = 1.5, color = "currentColor", fill = "none", className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ flexShrink: 0, display: "block", ...style }}
      aria-hidden="true"
    >
      {PATHS[name].map((shape, i) => {
        if (typeof shape === "string") return <path key={i} d={shape} />;
        if ("circle" in shape) {
          const [cx, cy, r] = shape.circle;
          return <circle key={i} cx={cx} cy={cy} r={r} />;
        }
        const [x, y, width, height, rx] = shape.rect;
        return <rect key={i} x={x} y={y} width={width} height={height} rx={rx} />;
      })}
    </svg>
  );
}
