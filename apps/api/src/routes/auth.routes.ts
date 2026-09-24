import { Router, type IRouter } from "express";
import { AuthController } from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router: IRouter = Router();

// Public routes
router.post("/register", AuthController.register);
router.post("/login", AuthController.login);
router.post("/refresh", AuthController.refresh);

// Protected routes
router.get("/me", authenticate, AuthController.getCurrentUser);
router.get("/validate", authenticate, AuthController.validateSession);

export default router;
