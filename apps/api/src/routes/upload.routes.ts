import express, { Router, type IRouter } from "express";
import { UploadController } from "../controllers/upload.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { uploadLimiter, kycUploadLimiter } from "../middleware/rate-limit.js";

const router: IRouter = Router();

// This router is mounted before the global 100kb JSON parser (see app.ts),
// so each route declares its own, larger, body limit. Base64 adds ~33%.
const mediaBody = express.json({ limit: "42mb" });
const kycBody = express.json({ limit: "7mb" });

// Pre-registration KYC: GST certificate PDF only, stored privately
router.post("/kyc", kycUploadLimiter, kycBody, UploadController.uploadKycDocument);

// Media / evidence uploads require a signed-in user (auth before parsing the large body)
router.post("/", authenticate, uploadLimiter, mediaBody, UploadController.uploadMedia);
router.post("/auth", authenticate, uploadLimiter, mediaBody, UploadController.uploadMedia);

export default router;
