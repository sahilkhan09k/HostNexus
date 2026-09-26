import Link from "next/link";
import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "./icon";

export type ButtonVariant = "primary" | "outline" | "dark" | "light" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

const CHIP_ICON: Record<ButtonSize, number> = { sm: 13, md: 16, lg: 19 };

export interface ButtonProps {
  children?: ReactNode;
  /** primary = ember fill; outline = grey border; dark/light for photo or dark sections */
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Adds the circular arrow chip on the right; rotates 45° on hover */
  arrow?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  /** Renders a Next.js link styled as the button */
  href?: string;
  type?: "button" | "submit";
  onClick?: (e: MouseEvent<HTMLElement>) => void;
  className?: string;
  style?: CSSProperties;
}

/** Pill button with optional arrow chip: the signature HostNexus CTA. */
export function Button({
  children, variant = "primary", size = "md", arrow = false, disabled = false, fullWidth = false,
  href, type = "button", onClick, className, style,
}: ButtonProps) {
  const classes = cn(
    "hn-btn", `hn-btn--${variant}`, `hn-btn--${size}`,
    arrow && "hn-btn--arrow", fullWidth && "hn-btn--full", className,
  );
  const content = (
    <>
      <span>{children}</span>
      {arrow && (
        <span className="hn-btn__chip">
          <Icon name="arrow-up-right" size={CHIP_ICON[size]} />
        </span>
      )}
    </>
  );

  if (href && !disabled) {
    return <Link href={href} className={classes} style={style} onClick={onClick}>{content}</Link>;
  }
  return (
    <button type={type} disabled={disabled} onClick={onClick} className={classes} style={style}>
      {content}
    </button>
  );
}
