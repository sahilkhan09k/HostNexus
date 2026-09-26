import { Router, type IRouter } from "express";
import { AiController } from "../controllers/ai.controller.js";

const router: IRouter = Router();

// Publicly accessible AI concierge query endpoint (supports both visitors & logged-in users)
router.post("/concierge", AiController.handleConciergeQuery);

export default router;
