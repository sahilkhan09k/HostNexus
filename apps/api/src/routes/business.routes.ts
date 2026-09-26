import { Router, type IRouter } from "express";
import { BusinessController } from "../controllers/business.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { writeLimiter } from "../middleware/rate-limit.js";

const router: IRouter = Router();

// All business routes require authentication
router.use(authenticate);
router.use(writeLimiter);

// Create business
router.post("/", BusinessController.createBusiness);

// Get authenticated user's business
router.get("/me", BusinessController.getMyBusiness);

// Get business by ID (public for marketplace)
router.get("/:id", BusinessController.getBusinessById);

// Update business
router.patch("/:id", BusinessController.updateBusiness);

export default router;
