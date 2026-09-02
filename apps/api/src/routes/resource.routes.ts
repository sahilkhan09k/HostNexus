import { Router, type IRouter } from "express";
import { ResourceController } from "../controllers/resource.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router: IRouter = Router();

// All resource routes require authentication
router.use(authenticate);

// Create resource
router.post("/", ResourceController.createResource);

// Get all resources from all businesses (Marketplace)
// MUST be before /:id to avoid "all" being treated as an ID
router.get("/all", ResourceController.getAllResources);

// Get user's own resources (with optional filters)
router.get("/", ResourceController.getResources);

// Get resource by ID
router.get("/:id", ResourceController.getResourceById);

// Update resource
router.patch("/:id", ResourceController.updateResource);

// Delete resource
router.delete("/:id", ResourceController.deleteResource);

export default router;
