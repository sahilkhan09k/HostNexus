import { Router, type IRouter } from "express";
import { BookingController } from "../controllers/booking.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { paymentLimiter, writeLimiter } from "../middleware/rate-limit.js";

const router: IRouter = Router();

// All booking routes require authentication
router.use(authenticate);
router.use(writeLimiter);

// ── CRUD ──────────────────────────────────────────────────────────────
// Create booking request
router.post("/", BookingController.createBookingRequest);

// Get all booking requests (with optional filters)
router.get("/", BookingController.getBookingRequests);

// Get booking request by ID with full chain of custody
router.get("/:id", BookingController.getBookingRequestById);

// ── STATUS TRANSITIONS ────────────────────────────────────────────────
// Accept / reject (owner), cancel (renter before handover, owner after accepting)
router.patch("/:id/status", BookingController.updateBookingStatus);

// ── RAZORPAY PAYMENT — TWO-STEP ───────────────────────────────────────
// Step 1: Create Razorpay order (returns orderId + keyId for frontend checkout)
router.post("/:id/pay", paymentLimiter, BookingController.createPaymentOrder);

// Step 2: Verify Razorpay signature and fund escrow
//         Body: { razorpayOrderId, razorpayPaymentId, razorpaySignature }
router.post("/:id/pay/verify", paymentLimiter, BookingController.verifyPayment);

// ── HANDOVER & INSPECTION ─────────────────────────────────────────────
// Owner enters the renter's handover code + condition photos (starts 1-hr renter inspection timer)
router.post("/:id/handover", BookingController.markHandover);

// Renter receiving inspection (Accept resource or report issue)
router.post("/:id/renter-inspection", BookingController.renterInspection);

// Owner accepts (full refund) or contests (admin) an issue the renter reported at handover
router.post("/:id/handover-response", BookingController.ownerHandoverResponse);

// ── RETURN FLOW ───────────────────────────────────────────────────────
// Renter initiates return with return evidence
router.post("/:id/return", BookingController.initiateReturn);

// Owner confirms receipt (Fake Return Protection)
router.post("/:id/owner-receipt", BookingController.ownerReceipt);

// Owner accepts return ("Everything is OK" → release deposit)
router.post("/:id/owner-accept-return", BookingController.ownerAcceptReturn);

// ── DAMAGE CLAIMS & DISPUTES ──────────────────────────────────────────
// Owner files damage / missing item claim
router.post("/:id/damage-claim", BookingController.ownerDamageClaim);

// Renter responds to damage claim (Accept deduction or dispute)
router.post("/:id/claim-response", BookingController.renterRespondClaim);

// Admin dispute resolution lives at /api/admin/disputes/:bookingId/resolve (admin token).

// Report non-return (owner — after rental period ends)
router.post("/:id/non-return", BookingController.reportNonReturn);

export default router;
