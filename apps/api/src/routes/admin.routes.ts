import { Router, type IRouter } from "express";
import { AdminController } from "../controllers/admin.controller.js";
import { authenticateAdmin } from "../middleware/admin.middleware.js";
import { adminLoginLimiter } from "../middleware/rate-limit.js";

const router: IRouter = Router();

// Public admin login
router.post("/login", adminLoginLimiter, AdminController.login);

// All routes below require a valid admin token
router.use(authenticateAdmin);

router.post("/logout", AdminController.logout);
router.get("/summary", AdminController.getSummary);
router.get("/users", AdminController.listUsers);
router.patch("/users/:id/approve", AdminController.approveUser);
router.patch("/users/:id/reject", AdminController.rejectUser);

// Private KYC documents (never served from /uploads)
router.get("/kyc/:file", AdminController.getKycDocument);

// Customer Care dispute resolution
router.get("/disputes", AdminController.listDisputes);
router.post("/bookings/:id/resolve-dispute", AdminController.resolveDispute);

export default router;
