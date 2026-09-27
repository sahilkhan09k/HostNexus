import express, { type Express } from "express";
import path from "path";
import cors from "cors";
import helmet from "helmet";
import { env, isProduction, allowedOrigins } from "./config/env.js";
import healthRoutes from "./routes/health.routes.js";
import healthDbRoutes from "./routes/health-db.routes.js";
import authRoutes from "./routes/auth.routes.js";
import businessRoutes from "./routes/business.routes.js";
import resourceRoutes from "./routes/resource.routes.js";
import bookingRoutes from "./routes/booking.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import reviewRoutes from "./routes/review.routes.js";
import negotiationRoutes from "./routes/negotiation.routes.js";
import aiRoutes from "./routes/ai.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import { handleRazorpayWebhook } from "./controllers/webhook.controller.js";
import { errorHandler } from "./middleware/error-handler.js";
import { globalLimiter } from "./middleware/rate-limit.js";
import { INLINE_MEDIA_EXT } from "./utils/file-sniff.js";

export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");

  // Client IPs (rate limits, audit log) come from X-Forwarded-For only for the
  // exact number of proxies in front of us — never `true`, which lets clients spoof it
  if (env.TRUST_PROXY_HOPS !== undefined) app.set("trust proxy", env.TRUST_PROXY_HOPS);
  else if (isProduction) app.set("trust proxy", 1);

  // Security headers. This is a JSON API: nothing it serves should run scripts or be framed.
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'none'"],
          formAction: ["'none'"],
        },
      },
      crossOriginResourcePolicy: { policy: "same-origin" },
      hsts: isProduction ? { maxAge: 63072000, includeSubDomains: true, preload: true } : false,
    })
  );

  // CORS: explicit allowlist from FRONTEND_URL. Requests without an Origin
  // (server-to-server, Razorpay webhooks, curl) are not affected by CORS.
  app.use(
    cors({
      origin: (origin, callback) => callback(null, !origin || allowedOrigins.includes(origin)),
      credentials: false, // auth is a Bearer header, not cookies
      maxAge: 600,
    })
  );

  app.use(globalLimiter);

  // Razorpay webhook needs the raw bytes to verify its signature — mount before any JSON parser
  app.post("/api/webhooks/razorpay", express.raw({ type: "application/json", limit: "1mb" }), handleRazorpayWebhook);

  // Uploads carry their own (larger, per-route) body limits and must run before the global parser
  app.use("/api/upload", uploadRoutes);

  // Everything else: small JSON bodies only. No urlencoded parser — the API never takes form posts.
  app.use(express.json({ limit: "100kb" }));

  // Public media. Served with a sandbox CSP and nosniff; anything that isn't a known
  // image/video type is forced to download instead of rendering on this origin.
  app.use(
    "/uploads",
    (_req, res, next) => {
      res.setHeader("Content-Security-Policy", "default-src 'none'; img-src 'self'; media-src 'self'; sandbox");
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      res.setHeader("X-Content-Type-Options", "nosniff");
      next();
    },
    express.static(path.join(process.cwd(), "uploads"), {
      index: false,
      dotfiles: "deny",
      fallthrough: false,
      setHeaders(res, filePath) {
        if (!INLINE_MEDIA_EXT.test(filePath)) res.setHeader("Content-Disposition", "attachment");
      },
    })
  );

  // Health endpoints
  app.use("/health", healthRoutes);
  app.use("/health/db", healthDbRoutes);

  // API routes
  app.use("/api/auth", authRoutes);
  app.use("/api/business", businessRoutes);
  app.use("/api/resources", resourceRoutes);
  app.use("/api/bookings", bookingRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/reviews", reviewRoutes);
  app.use("/api/negotiations", negotiationRoutes);
  app.use("/api/ai", aiRoutes);
  app.use("/api/notifications", notificationRoutes);

  // Unknown routes → JSON 404 (no framework fingerprinting)
  app.use((_req, res) => {
    res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Not found" } });
  });

  // Centralized error handling
  app.use(errorHandler);

  return app;
}
