import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";
const API_ORIGIN = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000").origin;
  } catch {
    return "http://localhost:5000";
  }
})();

/**
 * Content Security Policy.
 * - scripts: our own bundle + Razorpay Checkout. 'unsafe-inline' is required for
 *   Next.js hydration scripts without per-request nonces; 'unsafe-eval' only in dev (React Refresh).
 * - connect: the API, Razorpay, and the HDR lighting map the 3D hero loads (drei Environment preset).
 * - frames: only Razorpay's checkout; nobody may frame us (clickjacking).
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://checkout.razorpay.com`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${API_ORIGIN} https://images.unsplash.com https://*.razorpay.com`,
  `media-src 'self' blob: ${API_ORIGIN}`,
  "font-src 'self' data:",
  `connect-src 'self' ${API_ORIGIN} https://api.razorpay.com https://lumberjack.razorpay.com https://raw.githack.com${isDev ? " ws: wss:" : ""}`,
  "frame-src https://api.razorpay.com https://checkout.razorpay.com",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: 'camera=(), microphone=(), geolocation=(), payment=(self "https://checkout.razorpay.com" "https://api.razorpay.com")' },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Admin console must never be indexed or cached by shared caches
      {
        source: "/admin/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
};

export default nextConfig;
