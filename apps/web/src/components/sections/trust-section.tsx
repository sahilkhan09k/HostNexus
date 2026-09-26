"use client";

import { useState } from "react";
import { CarouselControls, Eyebrow, LogoStrip, SectionHeader, Testimonial } from "@/components/ds";
import { Container } from "@/components/landing/motion";
import { PARTNERS, TESTIMONIALS } from "@/components/landing/content";

export function TrustSection() {
  const [index, setIndex] = useState(0);
  const t = TESTIMONIALS[index];

  return (
    <section className="hn-section hn-section--page hn-trust">
      <Container>
        <SectionHeader
          align="center"
          eyebrow="Social Proof"
          title={<>Trusted by India&apos;s Leading<br />Hospitality Groups</>}
        />
      </Container>

      <LogoStrip logos={PARTNERS} className="hn-trust__logos" />

      <Container className="hn-split hn-split--testimonials">
        <div className="hn-split__aside">
          <div className="hn-stack hn-stack--16">
            <Eyebrow>Testimonials</Eyebrow>
            <p className="hn-lead-large">
              Operations teams across Pune &amp; Mumbai are turning idle capacity into revenue — and sourcing what they
              need in minutes.
            </p>
          </div>
          <CarouselControls
            onPrev={() => setIndex(index - 1)}
            onNext={() => setIndex(index + 1)}
            canPrev={index > 0}
            canNext={index < TESTIMONIALS.length - 1}
          />
        </div>
        <div aria-live="polite">
          <Testimonial
            key={index}
            headline={t.headline}
            body={t.quote}
            author={<>{t.name}<span className="hn-testimonial__role"> · {t.title}, {t.company}</span></>}
            avatar={<span>{t.initial}</span>}
            rating={t.rating}
          />
        </div>
      </Container>
    </section>
  );
}
