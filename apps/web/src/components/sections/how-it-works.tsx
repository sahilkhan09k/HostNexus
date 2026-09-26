import { CalendarCheck, Search, ShieldCheck, Sparkles } from "lucide-react";
import { Button, Eyebrow, SectionHeader } from "@/components/ds";
import { Container } from "@/components/landing/motion";
import { GUARANTEES, STEPS } from "@/components/landing/content";

const STEP_ICONS = { search: Search, sparkles: Sparkles, calendar: CalendarCheck };

export function HowItWorks() {
  return (
    <section id="how-it-works" className="hn-section hn-section--page">
      <Container className="hn-stack hn-stack--56">
        <SectionHeader
          eyebrow="How It Works"
          title={<>Three Steps to<br />Share Smarter</>}
          description="From posting your resource to getting paid — the entire process takes under 5 minutes."
          action={<Button variant="outline" arrow size="sm" href="/register">List a Resource</Button>}
        />

        <ol className="hn-steps">
          {STEPS.map((step) => {
            const Icon = STEP_ICONS[step.icon];
            return (
              <li key={step.number} className="hn-step">
                <div className="hn-step__top">
                  <span className="hn-step__icon"><Icon size={20} strokeWidth={1.5} /></span>
                  <span className="hn-step__number" aria-hidden="true">{step.number}</span>
                </div>
                <h3 className="hn-step__title">{step.title}</h3>
                <p className="hn-step__desc">{step.description}</p>
              </li>
            );
          })}
        </ol>

        <div className="hn-guarantees">
          <Eyebrow tone="light">Platform Guarantees</Eyebrow>
          <ul className="hn-guarantees__list">
            {GUARANTEES.map((g) => (
              <li key={g}>
                <ShieldCheck size={18} strokeWidth={1.5} />
                <span>{g}</span>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}
