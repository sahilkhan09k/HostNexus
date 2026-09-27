import { Router, type IRouter } from "express";
import { ResourceController } from "../controllers/resource.controller.js";
import { AvailabilityController } from "../controllers/availability.controller.js";
import { BookingWeatherController } from "../controllers/booking-weather.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { writeLimiter, publicReadLimiter } from "../middleware/rate-limit.js";

const router: IRouter = Router();

// ── Public availability endpoints (no auth needed for calendar/check) ──
router.get("/:id/availability/check",    publicReadLimiter, AvailabilityController.checkAvailability);
router.get("/:id/availability/calendar", publicReadLimiter, AvailabilityController.getCalendar);
router.get("/:id/availability",          publicReadLimiter, AvailabilityController.getWindows);
// Forecast for the chosen booking dates + its impact on the rental and transport
router.get("/:id/weather-impact",        publicReadLimiter, BookingWeatherController.check);

// All resource routes below require authentication
router.use(authenticate);
router.use(writeLimiter);

// Create resource
router.post("/", ResourceController.createResource);

// Marketplace — MUST be before /:id
router.get("/all", ResourceController.getAllResources);

// Own resources
router.get("/", ResourceController.getResources);

// Single resource
router.get("/:id", ResourceController.getResourceById);

// Update / delete
router.patch("/:id", ResourceController.updateResource);
router.delete("/:id", ResourceController.deleteResource);

// Availability management (owner only — authenticate already applied above)
router.put("/:id/availability", AvailabilityController.setWindows);

export default router;
