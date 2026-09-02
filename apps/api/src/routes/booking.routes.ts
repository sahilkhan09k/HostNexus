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

// Get booking request by ID
router.get("/:id", BookingController.getBookingRequestById);

// Update booking status
router.patch("/:id/status", BookingController.updateBookingStatus);

export default router;
