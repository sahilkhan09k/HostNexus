"use client";

import { Button, Eyebrow } from "@/components/ds";
import { NumberTicker } from "@/components/ui/number-ticker";
import { Container, InkFillText } from "@/components/landing/motion";
import { STATS } from "@/components/landing/content";
import { cn } from "@/lib/utils";

/** Stats beside a two-tone statement that fills with ink on scroll. */
export function StatsBar() {
  return (
    <section className="hn-section hn-section--page">
      <Container className="hn-split hn-split--story">
        <div className="hn-split__aside">
          <Eyebrow>By the Numbers</Eyebrow>
          <dl className="hn-stats">
            {STATS.map((stat) => (
              <div key={stat.label} className="hn-stats__item">
                <dt>{stat.label}</dt>
                <dd className={cn(stat.value === 0 && "is-accent")}>
                  <NumberTicker className="hn-ticker" value={stat.value} prefix={stat.prefix} suffix={stat.suffix} duration={1200} />
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="hn-story__main">
          <InkFillText
            className="hn-story__statement"
            text="Hotels, caterers, banquet halls and event organizers share idle resources on one platform — from posting to getting paid in under 5 minutes."
          />
          <Button variant="outline" arrow href="#how-it-works">See How It Works</Button>
        </div>
      </Container>
    </section>
  );
}
