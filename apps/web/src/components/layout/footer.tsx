import {
  Building2, Mail, Phone, MapPin,
  Globe, Rss, Send, MessageCircle,
  ArrowRight, ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = {
  Platform: [
    { label: "Marketplace",       href: "#marketplace" },
    { label: "AI Concierge",      href: "#ai-concierge" },
    { label: "Business Dashboard",href: "#dashboard" },
    { label: "How It Works",      href: "#how-it-works" },
    { label: "List a Resource",   href: "#list" },
    { label: "Pricing",           href: "#pricing" },
  ],
  Company: [
    { label: "About Us",     href: "#" },
    { label: "Blog",         href: "#" },
    { label: "Careers",      href: "#" },
    { label: "Press Kit",    href: "#" },
    { label: "Contact Us",   href: "#" },
    { label: "Partnerships", href: "#" },
  ],
  Support: [
    { label: "Help Centre",       href: "#" },
    { label: "API Documentation", href: "#" },
    { label: "System Status",     href: "#" },
    { label: "Community Forum",   href: "#" },
    { label: "Report an Issue",   href: "#" },
  ],
  Legal: [
    { label: "Privacy Policy",  href: "#" },
    { label: "Terms of Service",href: "#" },
    { label: "Cookie Policy",   href: "#" },
    { label: "Refund Policy",   href: "#" },
    { label: "GST Information", href: "#" },
  ],
};

const SOCIAL = [
  { Icon: Globe,         label: "Website",   href: "#" },
  { Icon: MessageCircle, label: "LinkedIn",   href: "#" },
  { Icon: Send,          label: "Instagram",  href: "#" },
  { Icon: Rss,           label: "YouTube",    href: "#" },
];

export function Footer() {
  return (
    <footer className="border-t border-stone-200 bg-white">

      {/* ── Newsletter strip ── */}
      <div className="border-b border-stone-100 bg-stone-50/60">
        <div className="mx-auto flex max-w-screen-xl flex-col items-start justify-between gap-4 px-5 py-6 sm:items-center md:flex-row md:px-10 lg:px-16">
          <div>
            <p className="text-sm font-semibold text-stone-800">
              Get notified when new resources go live
            </p>
            <p className="text-xs text-stone-500">
              New banquet halls, kitchens, and AV packages added daily across Pune &amp; Mumbai.
            </p>
          </div>
          <div className="flex w-full max-w-sm items-center gap-2">
            <input
              type="email"
              placeholder="your@business.com"
              className="flex-1 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-800 placeholder:text-stone-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
            <button
              type="button"
              className="flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 active:scale-[0.97]"
            >
              Subscribe <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Main grid ── */}
      <div className="mx-auto max-w-screen-xl px-5 py-14 md:px-10 lg:px-16">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-3 lg:grid-cols-6">

          {/* Brand column */}
          <div className="col-span-2 md:col-span-3 lg:col-span-2">
            <a href="/" className="inline-flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 shadow-sm">
                <Building2 className="h-4 w-4 text-white" strokeWidth={2.2} />
              </div>
              <span className="font-display text-lg font-bold tracking-tight text-stone-900">
                Host<span className="text-emerald-600">Nexus</span>
              </span>
            </a>

            <p className="mt-4 max-w-xs text-sm leading-relaxed text-stone-500">
              India&apos;s AI-powered B2B marketplace for hospitality resource sharing — connecting hotels,
              caterers, banquet halls, and event organizers across Pune and Mumbai.
            </p>

            {/* Contact details */}
            <ul className="mt-6 space-y-2.5">
              <li>
                <a
                  href="tel:+912012345678"
                  className="flex items-center gap-2 text-sm text-stone-500 transition-colors hover:text-emerald-600"
                >
                  <Phone className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  +91 20 1234 5678
                </a>
              </li>
              <li>
                <a
                  href="mailto:hello@hostnexus.in"
                  className="flex items-center gap-2 text-sm text-stone-500 transition-colors hover:text-emerald-600"
                >
                  <Mail className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  hello@hostnexus.in
                </a>
              </li>
              <li className="flex items-start gap-2 text-sm text-stone-500">
                <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5 text-emerald-500" />
                <span>Koregaon Park, Pune — 411001, Maharashtra, India</span>
              </li>
            </ul>

            {/* Social icons */}
            <div className="mt-6 flex items-center gap-2">
              {SOCIAL.map(({ Icon, label, href }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg border border-stone-200 text-stone-400",
                    "transition-all duration-150 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-600"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>

            {/* Trust badges */}
            <div className="mt-6 flex flex-wrap gap-2">
              {["ISO 27001 Compliant", "SSL Secured", "GST Registered"].map((badge) => (
                <span
                  key={badge}
                  className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-[10px] font-semibold text-stone-500"
                >
                  {badge}
                </span>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(LINKS).map(([title, items]) => (
            <div key={title}>
              <p className="mb-4 text-xs font-bold uppercase tracking-widest text-stone-900">{title}</p>
              <ul className="space-y-2.5">
                {items.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="inline-flex items-center gap-1 text-sm text-stone-500 transition-colors hover:text-emerald-600"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* ── App store badges ── */}
        <div className="mt-12 flex flex-col items-start gap-4 border-t border-stone-100 pt-10 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-stone-400">Available Soon</p>
            <div className="mt-2 flex gap-3">
              {["App Store", "Google Play"].map((store) => (
                <a
                  key={store}
                  href="#"
                  className={cn(
                    "flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5",
                    "text-sm font-medium text-stone-600 transition-all hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                  )}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {store}
                </a>
              ))}
            </div>
          </div>
          <div className="text-xs text-stone-400">
            <p className="font-semibold text-stone-600">Backed by:</p>
            <p className="mt-1">Hackathon Demo — HackCelestial 2026</p>
          </div>
        </div>
      </div>

      {/* ── Bottom bar ── */}
      <div className="border-t border-stone-100">
        <div className="mx-auto flex max-w-screen-xl flex-col items-center justify-between gap-3 px-5 py-5 text-xs text-stone-400 md:flex-row md:px-10 lg:px-16">
          <p>© {new Date().getFullYear()} HostNexus Technologies Pvt. Ltd. All rights reserved.</p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              All systems operational
            </span>
            <span className="hidden sm:inline">·</span>
            <span>CIN: U72900MH2026PTC000001</span>
            <span className="hidden sm:inline">·</span>
            <span>Made with care in Pune, India 🇮🇳</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
