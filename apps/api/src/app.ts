import express, { type Express } from "express";
import path from "path";
import cors from "cors";
import helmet from "helmet";
import healthRoutes from "./routes/health.routes.js";
import healthDbRoutes from "./routes/health-db.routes.js";
import authRoutes from "./routes/auth.routes.js";
import businessRoutes from "./routes/business.routes.js";
import resourceRoutes from "./routes/resource.routes.js";
import bookingRoutes from "./routes/booking.routes.js";
import messageRoutes from "./routes/message.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import reviewRoutes from "./routes/review.routes.js";
import negotiationRoutes from "./routes/negotiation.routes.js";
import aiRoutes from "./routes/ai.routes.js";
import { errorHandler } from "./middleware/error-handler.js";

export function createApp(): Express {
  const app = express();

  // Security middleware with cross-origin resource policy for uploaded media
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );

  // CORS configuration
  app.use(
    cors({
      origin: process.env.NODE_ENV === "production" ? process.env.FRONTEND_URL : "*",
      credentials: true,
    })
  );

  // Body parsing middleware (supporting larger base64 media uploads)
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // Static uploads directory
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  // Health endpoints
  app.use("/health", healthRoutes);
  app.use("/health/db", healthDbRoutes);

  // API routes
  app.use("/api/auth", authRoutes);
  app.use("/api/business", businessRoutes);
  app.use("/api/resources", resourceRoutes);
  app.use("/api/bookings", bookingRoutes);
  app.use("/api/messages", messageRoutes);
  app.use("/api/upload", uploadRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/reviews", reviewRoutes);
  app.use("/api/negotiations", negotiationRoutes);
  app.use("/api/ai", aiRoutes);

  // Centralized error handling
  app.use(errorHandler);

  return app;
}
