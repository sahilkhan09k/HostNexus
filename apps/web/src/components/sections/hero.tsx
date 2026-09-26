"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, TrendingDown } from "lucide-react";
import { Button, Eyebrow, NavBar, SearchBar } from "@/components/ds";
import { useAuth } from "@/contexts/auth-context";
import { Container, useScrollY } from "@/components/landing/motion";
import { HERO_AVATARS, HERO_IMAGE, NAV_LINKS } from "@/components/landing/content";
import { HeroPreviewCards } from "@/components/sections/hero-preview-cards";
import { cn } from "@/lib/utils";

export function HeroSection() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const y = useScrollY();
  const scrolled = useScrolledPast(24);

  const search = (value: string) => {
    const q = value.trim();
    router.push(q ? `/marketplace?q=${encodeURIComponent(q)}` : "/marketplace");
  };

  return (
    <section className="hn-hero">
      {/* Fixed so the nav stays reachable anywhere on the page; turns solid once the page scrolls. */}
      <header className={cn("hn-topbar", scrolled && "is-scrolled")}>
        <Container reveal={false}>
          <NavBar
            links={NAV_LINKS}
            brand="HostNexus"
            tone={scrolled ? "dark" : "light"}
            actions={
              isAuthenticated ? (
                <Button size="sm" href="/dashboard">Dashboard</Button>
              ) : (
                <div className="hn-hero__nav-actions">
                  <Button size="sm" variant="ghost" href="/login" className="hn-hero__signin">Sign In</Button>
                  <Button size="sm" href="/register">Get Started</Button>
                </div>
              )
            }
          />
        </Container>
      </header>

      <div className="hn-hero__photo" style={{ transform: `translateY(${y * 0.25}px)` }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- remote Unsplash photo, as before */}
        <img className="hn-hero__img" src={HERO_IMAGE} alt="" fetchPriority="high" />
      </div>
      <div className="hn-hero__scrim" />
      <div
        className="hn-hero__wordmark"
        aria-hidden="true"
        style={{ transform: `translateY(${y * 0.45}px)`, opacity: Math.max(0, 1 - y / 500) }}
      >
        <span>HostNexus</span>
      </div>

      <Container reveal={false} className="hn-hero__inner">
        <div className="hn-hero__grid">
          <div className="hn-hero__copy">
            <span className="hn-hero__badge">
              <span className="hn-hero__badge-dot" />
              <Eyebrow tone="light" style={{ color: "inherit" }}>AI-Powered B2B Platform</Eyebrow>
            </span>
            <h1 className="hn-hero__title">
              The Smart Way to Share<br />Hospitality Resources
            </h1>
            <p className="hn-hero__lead">
              Hotels, caterers, banquet halls and event organizers connect to share idle resources — all powered by
              an AI concierge that searches, compares, and books in seconds.
            </p>
            <SearchBar
              width={440}
              placeholder="Banquet hall in Koregaon Park, this Saturday…"
              label="Search the marketplace"
              onSubmit={search}
            />
            <div className="hn-hero__trust">
              <div className="hn-hero__avatars" aria-hidden="true">
                {HERO_AVATARS.map((initials) => <span key={initials}>{initials}</span>)}
              </div>
              <p><b>KYC-verified businesses</b> · Pune &amp; Mumbai</p>
            </div>
            <div className="hn-hero__chips">
              <div className="hn-glass-chip">
                <TrendingDown size={16} strokeWidth={1.5} />
                <div><b>₹4.8L avg. savings</b><span>per month</span></div>
              </div>
              <div className="hn-glass-chip">
                <ShieldCheck size={16} strokeWidth={1.5} />
                <div><b>100% conflict-free</b><span>zero double bookings</span></div>
              </div>
            </div>
          </div>

          <div className="hn-hero__preview">
            <div className="hn-hero__preview-label">
              <Eyebrow tone="light">Live Listings</Eyebrow>
              <span />
            </div>
            <HeroPreviewCards />
          </div>
        </div>
      </Container>
    </section>
  );
}

/** True once the page has scrolled more than `offset` px. Unlike useScrollY, not disabled by reduced motion. */
function useScrolledPast(offset: number) {
  const [past, setPast] = useState(false);
  useEffect(() => {
    const update = () => setPast(window.scrollY > offset);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [offset]);
  return past;
}
