import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import healthRoutes from "./routes/health.routes.js";
import healthDbRoutes from "./routes/health-db.routes.js";
import authRoutes from "./routes/auth.routes.js";
import businessRoutes from "./routes/business.routes.js";
import resourceRoutes from "./routes/resource.routes.js";
import { errorHandler } from "./middleware/error-handler.js";

export function createApp(): Express {
  const app = express();

  // Security middleware
  app.use(helmet());
  
  // CORS configuration
  app.use(cors({
    origin: process.env.NODE_ENV === "production" 
      ? process.env.FRONTEND_URL 
      : "*",
    credentials: true,
  }));

  // Body parsing middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health endpoints
  app.use("/health", healthRoutes);
  app.use("/health/db", healthDbRoutes);

  // API routes
  app.use("/api/auth", authRoutes);
  app.use("/api/business", businessRoutes);
  app.use("/api/resources", resourceRoutes);

  // Centralized error handling
  app.use(errorHandler);

  return app;
}
