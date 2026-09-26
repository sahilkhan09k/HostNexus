import { Router, type IRouter } from "express";
import { AiController } from "../controllers/ai.controller.js";
import { aiBurstLimiter, aiDailyLimiter } from "../middleware/rate-limit.js";

const router: IRouter = Router();

// Publicly accessible AI concierge query endpoint (supports both visitors & logged-in users).
// Every call may hit a paid LLM, so it is metered per client.
router.post("/concierge", aiBurstLimiter, aiDailyLimiter, AiController.handleConciergeQuery);

export default router;
