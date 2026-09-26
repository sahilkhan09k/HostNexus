import { Router, type IRouter } from "express";
import { AuthController } from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { loginIpLimiter, loginAccountLimiter, registerLimiter, refreshLimiter } from "../middleware/rate-limit.js";

const router: IRouter = Router();

// Public routes
router.post("/register", registerLimiter, AuthController.register);
router.post("/login", loginIpLimiter, loginAccountLimiter, AuthController.login);
router.post("/refresh", refreshLimiter, AuthController.refresh);
router.post("/logout", refreshLimiter, AuthController.logout);

// Protected routes
router.get("/me", authenticate, AuthController.getCurrentUser);
router.get("/validate", authenticate, AuthController.validateSession);

export default router;
