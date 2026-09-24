import { Router, type IRouter } from "express";
import { NegotiationController } from "../controllers/negotiation.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router: IRouter = Router();

router.use(authenticate);

// GET thread for a booking
router.get("/:bookingId", NegotiationController.get);

// Make offer / counter-offer
router.post("/:bookingId/offer", NegotiationController.makeOffer);

// Accept current pending offer
router.post("/:bookingId/accept", NegotiationController.acceptOffer);

// Reject negotiation
router.post("/:bookingId/reject", NegotiationController.rejectNegotiation);

export default router;
