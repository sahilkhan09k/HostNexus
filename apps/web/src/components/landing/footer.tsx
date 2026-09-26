"use client";

import { useState } from "react";
import { Globe, Mail, MapPin, MessageCircle, Phone, Rss, Send } from "lucide-react";
import { Button, EmailField } from "@/components/ds";
import { Container } from "./motion";
import { FOOTER_LINKS, TRUST_BADGES } from "./content";

const SOCIAL = [
  { Icon: Globe, label: "Website" },
  { Icon: MessageCircle, label: "LinkedIn" },
  { Icon: Send, label: "Instagram" },
  { Icon: Rss, label: "YouTube" },
];

export function LandingFooter() {
  const [subscribed, setSubscribed] = useState(false);

  return (
    <footer className="hn-footer">
      <Container className="hn-footer__inner">
        {/* Newsletter */}
        <div className="hn-footer__newsletter">
          <div>
            <h2 className="hn-footer__heading">Get notified when new<br />resources go live</h2>
            <p className="hn-footer__muted">New banquet halls, kitchens, and AV packages added daily across Pune &amp; Mumbai.</p>
          </div>
          {subscribed ? (
            <p className="hn-footer__subscribed" role="status">You&apos;re subscribed. We&apos;ll be in touch.</p>
          ) : (
            <EmailField placeholder="your@business.com" onSubmit={() => setSubscribed(true)} className="hn-footer__email" />
          )}
        </div>

        {/* Brand + link columns */}
        <div className="hn-footer__grid">
          <div className="hn-footer__brand">
            <span className="hn-footer__logo">HostNexus</span>
            <p className="hn-footer__muted">
              India&apos;s AI-powered B2B marketplace for hospitality resource sharing — connecting hotels, caterers,
              banquet halls, and event organizers across Pune and Mumbai.
            </p>
            <ul className="hn-footer__contact">
              <li><a href="tel:+912012345678"><Phone size={14} strokeWidth={1.5} />+91 20 1234 5678</a></li>
              <li><a href="mailto:hello@hostnexus.in"><Mail size={14} strokeWidth={1.5} />hello@hostnexus.in</a></li>
              <li><MapPin size={14} strokeWidth={1.5} />Koregaon Park, Pune — 411001, Maharashtra, India</li>
            </ul>
            <div className="hn-footer__social">
              {SOCIAL.map(({ Icon, label }) => (
                <a key={label} href="#" aria-label={label} className="hn-footer__social-link">
                  <Icon size={16} strokeWidth={1.5} />
                </a>
              ))}
            </div>
            <div className="hn-footer__badges">
              {TRUST_BADGES.map((b) => <span key={b} className="hn-chip hn-chip--glass">{b}</span>)}
            </div>
          </div>

          {Object.entries(FOOTER_LINKS).map(([title, items]) => (
            <nav key={title} aria-label={title} className="hn-footer__col">
              <p className="hn-footer__col-title">{title}</p>
              <ul>
                {items.map((link) => (
                  <li key={link.label}><a href={link.href} className="hn-footer__link">{link.label}</a></li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* App badges */}
        <div className="hn-footer__apps">
          <div className="hn-stack hn-stack--16">
            <p className="hn-footer__col-title">Available Soon</p>
            <div className="hn-footer__app-buttons">
              <Button size="sm" variant="ghost" className="hn-footer__app">App Store</Button>
              <Button size="sm" variant="ghost" className="hn-footer__app">Google Play</Button>
            </div>
          </div>
          <p className="hn-footer__muted hn-footer__backed">
            <b>Backed by:</b> Hackathon Demo — HackCelestial 2026
          </p>
        </div>

        <div className="hn-footer__wordmark" aria-hidden="true">HostNexus</div>

        <div className="hn-footer__bottom">
          <span>© {new Date().getFullYear()} HostNexus Technologies Pvt. Ltd. All rights reserved.</span>
          <div className="hn-footer__bottom-meta">
            <span className="hn-footer__status"><i />All systems operational</span>
            <span>CIN: U72900MH2026PTC000001</span>
            <span>Made with care in Pune, India</span>
          </div>
        </div>
      </Container>
    </footer>
  );
}
