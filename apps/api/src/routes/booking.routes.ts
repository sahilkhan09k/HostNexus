import { Router, type IRouter } from "express";
import { BookingController } from "../controllers/booking.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router: IRouter = Router();

// All booking routes require authentication
router.use(authenticate);

// ── CRUD ──────────────────────────────────────────────────────────────
// Create booking request
router.post("/", BookingController.createBookingRequest);

// Get all booking requests (with optional filters)
router.get("/", BookingController.getBookingRequests);

// Get booking request by ID with full chain of custody
router.get("/:id", BookingController.getBookingRequestById);

// ── STATUS TRANSITIONS ────────────────────────────────────────────────
// Accept, reject, or cancel  (removed "completed" — use owner-accept-return)
router.patch("/:id/status", BookingController.updateBookingStatus);

// ── RAZORPAY PAYMENT — TWO-STEP ───────────────────────────────────────
// Step 1: Create Razorpay order (returns orderId + keyId for frontend checkout)
router.post("/:id/pay", BookingController.createPaymentOrder);

// Step 2: Verify Razorpay signature and fund escrow
//         Body: { razorpayOrderId, razorpayPaymentId, razorpaySignature }
router.post("/:id/pay/verify", BookingController.verifyPayment);

// ── HANDOVER & INSPECTION ─────────────────────────────────────────────
// Owner marks resource handed over (starts 1-hr renter inspection timer)
router.post("/:id/handover", BookingController.markHandover);

// Renter receiving inspection (Accept resource or report issue)
router.post("/:id/renter-inspection", BookingController.renterInspection);

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

// Customer Care / Admin resolves dispute (requires Admin JWT)
router.post("/:id/resolve-dispute", BookingController.adminResolveDispute);

// Report non-return (owner — after rental period ends)
router.post("/:id/non-return", BookingController.reportNonReturn);

export default router;
