import type { CSSProperties, MouseEvent } from "react";
import { cn } from "@/lib/utils";
import { Icon, type IconName } from "./icon";

export type IconButtonVariant = "accent" | "outline" | "light" | "dark" | "glass";

export interface IconButtonProps {
  icon?: IconName;
  variant?: IconButtonVariant;
  /** Diameter in px (default 40) */
  size?: number;
  /** Accessible name; defaults to the icon name */
  label?: string;
  disabled?: boolean;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  style?: CSSProperties;
}

/** Circular icon button. */
export function IconButton({ icon = "arrow-up-right", variant = "accent", size = 40, label, disabled = false, onClick, className, style }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label || icon}
      disabled={disabled}
      onClick={onClick}
      className={cn("hn-icon-btn", `hn-icon-btn--${variant}`, className)}
      style={{ width: size, height: size, ...style }}
    >
      <Icon name={icon} size={Math.round(size * 0.42)} />
    </button>
  );
}

/** Non-interactive visual of an IconButton, for use inside a link or clickable card. */
export function IconChip({ icon = "arrow-up-right", variant = "glass", size = 40 }: Pick<IconButtonProps, "icon" | "variant" | "size">) {
  return (
    <span aria-hidden="true" className={cn("hn-icon-btn", `hn-icon-btn--${variant}`)} style={{ width: size, height: size, flexShrink: 0 }}>
      <Icon name={icon} size={Math.round(size * 0.42)} />
    </span>
  );
}
