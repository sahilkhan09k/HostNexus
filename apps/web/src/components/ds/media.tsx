import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface MediaProps {
  /** Image URL. When absent, children render, else a neutral labelled placeholder. */
  src?: string;
  alt?: string;
  children?: ReactNode;
  radius?: string | number;
  height?: string | number;
  /** Placeholder text shown while no image has been supplied. */
  label?: string;
  className?: string;
  style?: CSSProperties;
}

/** Image frame with a placeholder: HostNexus photography is supplied separately. */
export function Media({ src, alt = "", children, radius = "var(--hn-radius-lg)", height = "100%", label, className, style }: MediaProps) {
  return (
    <div className={cn("hn-media", className)} style={{ borderRadius: radius, height, ...style }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary URLs; next/image would need remotePatterns per host
        <img className="hn-media__img" src={src} alt={alt} />
      ) : (
        children ?? <div className="hn-media__placeholder">{label || "Image"}</div>
      )}
    </div>
  );
}
