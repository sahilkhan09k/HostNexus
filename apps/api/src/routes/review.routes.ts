import { Router, type IRouter } from "express";
import { ReviewController } from "../controllers/review.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { writeLimiter, publicReadLimiter } from "../middleware/rate-limit.js";

const router: IRouter = Router();

// Public — business reputation visible to anyone browsing marketplace
router.get("/business/:id", publicReadLimiter, ReviewController.getBusinessProfile);

// Auth-protected
router.use(authenticate);
router.use(writeLimiter);
router.post("/",              ReviewController.submit);
router.get("/my-dashboard",   ReviewController.getMyReputation);

export default router;
