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
router.patch("/users/:id/suspend", AdminController.suspendUser);
router.patch("/users/:id/reinstate", AdminController.reinstateUser);

// Dispute console
router.get("/disputes", AdminController.listDisputes);
router.post("/disputes/:bookingId/resolve", AdminController.resolveDispute);

// Escrow ledger: owner payouts (settled manually with a UTR) and renter refunds (Razorpay)
router.get("/transactions", AdminController.listTransactions);
router.post("/transactions/:id/mark-paid", AdminController.markPayoutPaid);
router.post("/transactions/:id/retry", AdminController.retryRefund);

// Private KYC documents (never served from /uploads)
router.get("/kyc/:file", AdminController.getKycDocument);

// Older path for the same action
router.post("/bookings/:id/resolve-dispute", AdminController.resolveDispute);

export default router;
