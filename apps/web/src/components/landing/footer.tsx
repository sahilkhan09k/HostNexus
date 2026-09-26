import { Mail } from "lucide-react";
import { Container } from "./motion";
import { FOOTER_LINKS } from "./content";

export function LandingFooter() {
  return (
    <footer className="hn-footer">
      <Container className="hn-footer__inner">
        <div className="hn-footer__grid">
          <div className="hn-footer__brand">
            <span className="hn-footer__logo">HostNexus</span>
            <p className="hn-footer__muted">
              The B2B marketplace for hotels, caterers, banquet halls and event organizers to share idle resources.
            </p>
            <a href="mailto:hello@hostnexus.in" className="hn-footer__mail">
              <Mail size={14} strokeWidth={1.5} />hello@hostnexus.in
            </a>
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

        <div className="hn-footer__bottom">
          <span>© {new Date().getFullYear()} HostNexus Technologies Pvt. Ltd.</span>
          <div className="hn-footer__bottom-meta">
            <a href="#" className="hn-footer__link">Privacy Policy</a>
            <a href="#" className="hn-footer__link">Terms of Service</a>
            <span>Made in Pune, India</span>
          </div>
        </div>
      </Container>
    </footer>
  );
}
