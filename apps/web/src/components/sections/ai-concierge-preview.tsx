import { Bot, Clock, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { Button, Eyebrow } from "@/components/ds";
import { Container } from "@/components/landing/motion";
import { CONCIERGE_FEATURES } from "@/components/landing/content";

const FEATURE_ICONS = { zap: Zap, clock: Clock, shield: ShieldCheck };

function InlineResourceCard({ name, price, rating, available }: { name: string; price: string; rating: string; available: boolean }) {
  return (
    <div className="hn-chat__resource">
      <div>
        <p className="hn-chat__resource-name">{name}</p>
        <p className="hn-chat__resource-meta">{price} · {rating}★</p>
      </div>
      <span className={available ? "hn-chip hn-chip--available" : "hn-chip hn-chip--glass"}>
        {available && <i />}
        {available ? "Available" : "Waitlist"}
      </span>
    </div>
  );
}

export function AiConciergePreview() {
  return (
    <section id="ai-concierge" className="hn-section hn-section--subtle">
      <Container className="hn-concierge">
        {/* Chat mockup */}
        <div className="hn-chat" aria-label="Example AI concierge conversation">
          <div className="hn-chat__header">
            <span className="hn-chat__avatar"><Bot size={18} strokeWidth={1.5} /></span>
            <div>
              <p className="hn-chat__name">HostNexus AI Concierge</p>
              <p className="hn-chat__status">Online · Typically responds instantly</p>
            </div>
            <span className="hn-chat__online" />
          </div>

          <div className="hn-chat__messages">
            <div className="hn-chat__bubble hn-chat__bubble--user">
              I need 50 banquet chairs in Koregaon Park this Saturday under ₹8,000
            </div>

            <div className="hn-chat__ai">
              <span className="hn-chat__ai-avatar"><Sparkles size={14} strokeWidth={1.5} /></span>
              <div className="hn-chat__ai-body">
                <div className="hn-chat__bubble">
                  Found <strong>3 matches</strong> within 2km of Koregaon Park. Here are the best options:
                </div>
                <InlineResourceCard name="Sarovar Hotels — Banquet Chairs ×80" price="₹6,500/day" rating="4.8" available />
                <InlineResourceCard name="ITC Maratha — Chair Set ×60" price="₹7,200/day" rating="4.9" available />
                <div className="hn-chat__bubble">
                  Want me to hold these for you? Both hosts have instant-confirm enabled.
                </div>
              </div>
            </div>

            <div className="hn-chat__ai">
              <span className="hn-chat__ai-avatar"><Sparkles size={14} strokeWidth={1.5} /></span>
              <div className="hn-chat__bubble hn-chat__typing" aria-label="Concierge is typing">
                <span /><span /><span />
              </div>
            </div>
          </div>

          <div className="hn-chat__input">
            <span>Ask anything about available resources…</span>
            <span className="hn-chat__send">Send</span>
          </div>
        </div>

        {/* Copy + features */}
        <div className="hn-concierge__copy">
          <div className="hn-stack hn-stack--16">
            <Eyebrow>AI Concierge</Eyebrow>
            <h2 className="hn-h2">Your 24/7 Resource<br />Procurement Assistant</h2>
            <p className="hn-body">
              Describe what you need in plain language. Our AI concierge understands hospitality industry context and
              finds verified, conflict-free resources instantly.
            </p>
          </div>
          <ul className="hn-feature-list">
            {CONCIERGE_FEATURES.map((feat) => {
              const Icon = FEATURE_ICONS[feat.icon];
              return (
                <li key={feat.title}>
                  <span className="hn-feature-list__icon"><Icon size={18} strokeWidth={1.5} /></span>
                  <div>
                    <h3>{feat.title}</h3>
                    <p>{feat.desc}</p>
                  </div>
                </li>
              );
            })}
          </ul>
          <Button arrow href="/ai-concierge">Try AI Concierge</Button>
        </div>
      </Container>
    </section>
  );
}
