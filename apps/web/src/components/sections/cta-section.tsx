import { ShieldCheck } from "lucide-react";
import { Button, Eyebrow } from "@/components/ds";
import { Container } from "@/components/landing/motion";
import { HERO_IMAGE } from "@/components/landing/content";

export function CtaSection() {
  return (
    <section className="hn-section hn-section--page hn-cta-section">
      <Container>
        <div className="hn-cta">
          {/* eslint-disable-next-line @next/next/no-img-element -- same remote hero photo */}
          <img className="hn-cta__img" src={HERO_IMAGE} alt="" loading="lazy" />
          <div className="hn-cta__scrim" />
          <div className="hn-cta__content">
            <span className="hn-hero__badge">
              <span className="hn-hero__badge-dot" />
              <Eyebrow tone="light" style={{ color: "inherit" }}>Join 200+ Businesses</Eyebrow>
            </span>
            <h2 className="hn-cta__title">Start Connecting Your<br />Resources Today</h2>
            <p className="hn-cta__lead">
              Whether you have idle banquet space, spare kitchens, or AV equipment — or need them for your next event —
              HostNexus gets you connected in minutes.
            </p>
            <div className="hn-cta__actions">
              <Button size="lg" arrow href="/dashboard">List a Resource</Button>
              <Button size="lg" variant="light" href="/marketplace">Browse Marketplace</Button>
            </div>
            <p className="hn-cta__note">
              <ShieldCheck size={14} strokeWidth={1.5} />
              Free to join · No listing fees · Escrow-protected payments
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}
