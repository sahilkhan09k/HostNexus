import { Router, type IRouter } from "express";
import { BookingController } from "../controllers/booking.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router: IRouter = Router();

// All booking routes require authentication
router.use(authenticate);

// Create booking request
router.post("/", BookingController.createBookingRequest);

// Get all booking requests (with optional filters)
router.get("/", BookingController.getBookingRequests);

// Get booking request by ID with full chain of custody
router.get("/:id", BookingController.getBookingRequestById);

// Accept, reject, or cancel
router.patch("/:id/status", BookingController.updateBookingStatus);

// Fund escrow (Rent + Security Deposit)
router.post("/:id/pay", BookingController.payEscrow);

// Owner marks resource handed over (starts 1-hr renter inspection timer)
router.post("/:id/handover", BookingController.markHandover);

// Renter receiving inspection (Accept resource or report issue)
router.post("/:id/renter-inspection", BookingController.renterInspection);

// Renter initiates return with return evidence
router.post("/:id/return", BookingController.initiateReturn);

// Owner confirms receipt (Fake Return Protection)
router.post("/:id/owner-receipt", BookingController.ownerReceipt);

// Owner accepts return ("Everything is OK" -> release deposit)
router.post("/:id/owner-accept-return", BookingController.ownerAcceptReturn);

// Owner files damage / missing item claim
router.post("/:id/damage-claim", BookingController.ownerDamageClaim);

// Renter responds to damage claim (Accept deduction or dispute)
router.post("/:id/claim-response", BookingController.renterRespondClaim);

// Customer Care / Admin resolves dispute
router.post("/:id/resolve-dispute", BookingController.adminResolveDispute);

// Report non-return
router.post("/:id/non-return", BookingController.reportNonReturn);

export default router;
