import { z } from "zod";

// Evidence must be files uploaded through /api/upload — ownership is checked in the service
const mediaUrl = z.string().min(1).max(500);
const evidenceList = z.array(mediaUrl).max(20, "At most 20 files");
const requiredEvidence = (message: string) => evidenceList.min(1, message);
const note = z.string().max(2000);

// Dates are calendar days ("YYYY-MM-DD" or an ISO datetime) and INCLUSIVE:
// startDate = endDate is a one-day booking.
const calendarDate = z.string().max(40).refine((v) => !isNaN(Date.parse(v)), "Must be a valid date");

export const createBookingRequestSchema = z.object({
  resourceId:      z.string().min(1, "Resource ID is required"),
  quantity:        z.number().int().positive("Quantity must be a positive number"),
  startDate:       calendarDate,
  endDate:         calendarDate,
  specialRequests: z.string().max(2000).optional(),
  // SELF = renter arranges transport; PROVIDER = owner delivers at their per-km rate
  transportMode:       z.enum(["SELF", "PROVIDER"]).optional(), // omitted = SELF
  transportDistanceKm: z.number().positive("Distance must be greater than 0").max(5000, "Distance cannot exceed 5,000 km").optional(),
}).strict().refine(
  (data) => data.transportMode !== "PROVIDER" || data.transportDistanceKm !== undefined,
  { message: "Distance (km) is required when choosing the owner's transport", path: ["transportDistanceKm"] }
);

// accepted / rejected: owner, while requested.
// cancelled: renter before handover, or owner after accepting (before handover).
// Completion is handled by ownerAcceptReturn. Price changes only happen through negotiation.
export const updateBookingStatusSchema = z.object({
  status:          z.enum(["accepted", "rejected", "cancelled"]),
  rejectionReason: z.string().max(1000).optional(),
}).strict();

/** Owner at physical handover: the renter's code plus condition photos. */
export const handoverSchema = z.object({
  handoverCode: z.string().regex(/^\d{6}$/, "Enter the renter's 6-digit handover code"),
  evidenceUrls: requiredEvidence("Upload at least one photo of the item's condition at handover"),
  notes:        note.optional(),
});

export const renterReceivingInspectionSchema = z.object({
  status:           z.enum(["ACCEPTED", "REPORTED_ISSUE"]),
  receivedQuantity: z.number().int().min(0).optional(), // defaults to the booked quantity
  notes:            note.optional(),
  evidenceUrls:     evidenceList.default([]),
  issueDescription: note.optional(),
}).superRefine((data, ctx) => {
  if (data.status !== "REPORTED_ISSUE") return;
  if (!data.issueDescription || data.issueDescription.trim().length < 10) {
    ctx.addIssue({ code: "custom", path: ["issueDescription"], message: "Describe the issue in at least 10 characters" });
  }
  if (data.evidenceUrls.length < 1) {
    ctx.addIssue({ code: "custom", path: ["evidenceUrls"], message: "Upload at least one photo of the issue" });
  }
});

/** Owner's answer to an issue the renter raised at handover. */
export const ownerHandoverResponseSchema = z.object({
  action: z.enum(["ACCEPT", "CONTEST"]),
  notes:  note.optional(),
}).refine(
  (d) => d.action !== "CONTEST" || (d.notes?.trim().length ?? 0) >= 10,
  { message: "Explain why you contest the issue (at least 10 characters)", path: ["notes"] }
);

export const returnInitiationSchema = z.object({
  returnedQuantity:   z.number().int().min(1).optional(), // defaults to the booked quantity
  notes:              note.optional(),
  returnEvidenceUrls: requiredEvidence("Upload at least one photo of the item as you return it"),
});

export const ownerReceiptSchema = z.object({
  received:         z.boolean(),
  receivedQuantity: z.number().int().min(1).optional(), // defaults to what the renter returned
  notes:            note.optional(),
});

export const ownerAcceptReturnSchema = z.object({
  notes: note.optional(),
});

export const ownerDamageClaimSchema = z.object({
  claimType: z.enum([
    "DAMAGE",
    "MISSING_ITEM",
    "MISSING_QUANTITY",
    "WRONG_ITEM_RETURNED",
    "SEVERE_STAIN",
    "RETURN_NOT_RECEIVED",
    "OTHER",
  ]),
  description:        z.string().min(10, "Description must be at least 10 characters").max(2000),
  // FIX #15: Schema-level note — upper bound enforced in service against actual deposit
  claimedAmountPaise: z.number().int().min(1, "Claimed amount must be greater than 0"),
  evidenceUrls:       evidenceList.min(1, "At least one evidence photo/video is required"),
});

export const renterClaimResponseSchema = z.object({
  action: z.enum(["ACCEPT", "DISPUTE"]),
  reason: z
    .enum([
      "PRE_EXISTING_DAMAGE",
      "NOT_CAUSED_BY_RENTER",
      "AFTER_RETURN",
      "NORMAL_WEAR_TEAR",
      "INCORRECT_AMOUNT",
      "OTHER",
    ])
    .optional(),
  rebuttalNotes:        note.optional(),
  rebuttalEvidenceUrls: evidenceList.default([]),
});

// RETURN_CLAIM disputes: REFUND_RENTER | REJECT_CLAIM | PAY_OWNER | PARTIAL_SETTLEMENT (split of the deposit)
// HANDOVER_ISSUE disputes: FULL_REFUND | REJECT_ISSUE | PARTIAL_REFUND (part of rent + transport back to renter)
export const adminResolveDisputeSchema = z.object({
  decision:              z.enum([
    "REFUND_RENTER", "PAY_OWNER", "PARTIAL_SETTLEMENT", "REJECT_CLAIM",
    "FULL_REFUND", "REJECT_ISSUE", "PARTIAL_REFUND",
  ]),
  resolutionAmountPaise: z.number().int().min(0).optional(),
  resolutionNotes:       z.string().min(5, "Resolution notes are required").max(2000),
});

export const bookingQuerySchema = z.object({
  status:          z.string().max(40).optional(),
  bookingStatus:   z.string().max(40).optional(),
  financialStatus: z.string().max(40).optional(),
  type:            z.enum(["incoming", "outgoing"]).optional(),
});

// ── Razorpay Payment Schemas ────────────────────────────────────────────

/** Payload sent from frontend after Razorpay checkout completes */
export const razorpayVerifySchema = z.object({
  razorpayOrderId:   z.string().regex(/^order_[A-Za-z0-9]{6,40}$/, "Razorpay order ID is required"),
  razorpayPaymentId: z.string().regex(/^pay_[A-Za-z0-9]{6,40}$/, "Razorpay payment ID is required"),
  razorpaySignature: z.string().regex(/^[a-f0-9]{64}$/, "Razorpay signature is required"),
});

// ── Inferred Types ──────────────────────────────────────────────────────

export type CreateBookingRequestInput  = z.infer<typeof createBookingRequestSchema>;
export type UpdateBookingStatusInput   = z.infer<typeof updateBookingStatusSchema>;
export type RenterReceivingInspectionInput = z.infer<typeof renterReceivingInspectionSchema>;
export type ReturnInitiationInput      = z.infer<typeof returnInitiationSchema>;
export type OwnerReceiptInput          = z.infer<typeof ownerReceiptSchema>;
export type HandoverInput              = z.infer<typeof handoverSchema>;
export type OwnerHandoverResponseInput = z.infer<typeof ownerHandoverResponseSchema>;
export type OwnerDamageClaimInput      = z.infer<typeof ownerDamageClaimSchema>;
export type RenterClaimResponseInput   = z.infer<typeof renterClaimResponseSchema>;
export type AdminResolveDisputeInput   = z.infer<typeof adminResolveDisputeSchema>;
export type BookingQuery               = z.infer<typeof bookingQuerySchema>;
export type RazorpayVerifyInput        = z.infer<typeof razorpayVerifySchema>;
