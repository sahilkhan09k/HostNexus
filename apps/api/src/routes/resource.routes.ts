import { Router, type IRouter } from "express";
import { ResourceController } from "../controllers/resource.controller.js";
import { AvailabilityController } from "../controllers/availability.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router: IRouter = Router();

// ── Public availability endpoints (no auth needed for calendar/check) ──
router.get("/:id/availability/check",    AvailabilityController.checkAvailability);
router.get("/:id/availability/calendar", AvailabilityController.getCalendar);
router.get("/:id/availability",          AvailabilityController.getWindows);

// All resource routes below require authentication
router.use(authenticate);

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
