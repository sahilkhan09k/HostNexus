import { Router, type IRouter } from "express";
import { UploadController } from "../controllers/upload.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router: IRouter = Router();

// Public upload endpoint — used during KYC document submission before login
// The authenticate middleware is applied only to the authenticated variant below
router.post("/", UploadController.uploadMedia);

// Authenticated upload (for evidence photos, resource images, etc.)
router.post("/auth", authenticate, UploadController.uploadMedia);

export default router;
