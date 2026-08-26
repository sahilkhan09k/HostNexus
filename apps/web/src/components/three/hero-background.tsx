"use client";

/**
 * HeroBackground — full-screen luxury hotel photo background.
 *
 * Image: Grand hotel banquet hall / ballroom, warm chandelier light,
 * elegant table settings. Sourced via Unsplash CDN (free to use, no attribution
 * required under Unsplash license for product use).
 *
 * The photo fills the entire hero. A directional gradient overlay ensures
 * the left-side text stays sharp while the right side shows the photo clearly.
 */
export function HeroBackground3D() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden
    >
      {/* ── Full-screen photo ── */}
      {/* 
        Unsplash photo by Aman Bhargava — luxury hotel ballroom interior.
        URL uses Unsplash CDN with optimised parameters: 
        w=1800, fit=crop, auto=format, q=80
      */}
      <img
        src="https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=1800&fit=crop&auto=format&q=80"
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-center"
        style={{ zIndex: 0 }}
        loading="eager"
        fetchPriority="high"
      />

      {/* ── Directional overlay ──
          Left → fully opaque white (text readable)
          Center → semi-transparent
          Right → show the photo cleanly
      ── */}
      <div
        className="absolute inset-0"
        style={{
          zIndex: 1,
          background: `
            linear-gradient(
              100deg,
              rgba(250,250,249,1.00)  0%,
              rgba(250,250,249,0.97) 25%,
              rgba(250,250,249,0.80) 42%,
              rgba(250,250,249,0.30) 58%,
              rgba(250,250,249,0.08) 75%,
              rgba(250,250,249,0.04) 100%
            )
          `,
        }}
      />

      {/* ── Top & bottom fades ── */}
      <div
        className="absolute inset-x-0 top-0 h-28"
        style={{
          zIndex: 2,
          background: "linear-gradient(to bottom, rgba(250,250,249,0.95), transparent)",
        }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-32"
        style={{
          zIndex: 2,
          background: "linear-gradient(to top, rgba(250,250,249,1), rgba(250,250,249,0.4), transparent)",
        }}
      />
    </div>
  );
}
