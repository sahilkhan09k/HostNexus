"use client";

import { useId, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "./icon";

export interface AccordionItem {
  q: ReactNode;
  a: ReactNode;
}

export interface AccordionProps {
  items: AccordionItem[];
  /** Index open initially; -1 for none */
  defaultOpen?: number;
  className?: string;
  style?: CSSProperties;
}

/** FAQ accordion: hairline dividers, chevron, one item open at a time. */
export function Accordion({ items, defaultOpen = 0, className, style }: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const baseId = useId();

  return (
    <div className={cn("hn-accordion", className)} style={style}>
      {items.map((item, i) => {
        const isOpen = open === i;
        const triggerId = `${baseId}-t${i}`;
        const panelId = `${baseId}-p${i}`;
        return (
          <div key={i} className="hn-accordion__item">
            <button
              id={triggerId}
              type="button"
              className="hn-accordion__trigger"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => setOpen(isOpen ? -1 : i)}
            >
              <span className="hn-accordion__q">{item.q}</span>
              <Icon name={isOpen ? "chevron-up" : "chevron-down"} size={16} />
            </button>
            <div
              id={panelId}
              role="region"
              aria-labelledby={triggerId}
              className={cn("hn-accordion__panel", isOpen && "hn-accordion__panel--open")}
              inert={!isOpen}
            >
              <div className="hn-accordion__clip">
                <p className="hn-accordion__a">{item.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
