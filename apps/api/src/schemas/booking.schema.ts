import { z } from "zod";

export const createBookingRequestSchema = z.object({
  resourceId: z.string().min(1, "Resource ID is required"),
  quantity: z.number().int().positive("Quantity must be a positive number"),
  startDate: z.string().datetime("Start date must be a valid ISO datetime"),
  endDate: z.string().datetime("End date must be a valid ISO datetime"),
  specialRequests: z.string().optional(),
  proposedPrice: z.number().positive().optional(),
});

export const updateBookingStatusSchema = z.object({
  status: z.enum(["accepted", "rejected", "cancelled", "completed"]),
  rejectionReason: z.string().optional(),
  finalPrice: z.number().positive().optional(),
});

export const renterReceivingInspectionSchema = z.object({
  status: z.enum(["ACCEPTED", "REPORTED_ISSUE"]),
  notes: z.string().optional(),
  evidenceUrls: z.array(z.string()).default([]),
  issueDescription: z.string().optional(),
});

export const returnInitiationSchema = z.object({
  notes: z.string().optional(),
  returnEvidenceUrls: z.array(z.string()).default([]),
});

export const ownerReceiptSchema = z.object({
  received: z.boolean(),
  notes: z.string().optional(),
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
  description: z.string().min(10, "Description must be at least 10 characters"),
  claimedAmountPaise: z.number().int().min(1, "Claimed amount must be greater than 0"),
  evidenceUrls: z.array(z.string()).min(1, "At least one evidence photo/video is required for a claim"),
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
  rebuttalNotes: z.string().optional(),
  rebuttalEvidenceUrls: z.array(z.string()).default([]),
});

export const adminResolveDisputeSchema = z.object({
  decision: z.enum(["REFUND_RENTER", "PAY_OWNER", "PARTIAL_SETTLEMENT", "REJECT_CLAIM"]),
  resolutionAmountPaise: z.number().int().min(0).optional(),
  resolutionNotes: z.string().min(5, "Resolution notes are required"),
});

export const bookingQuerySchema = z.object({
  status: z.string().optional(),
  bookingStatus: z.string().optional(),
  financialStatus: z.string().optional(),
  type: z.enum(["incoming", "outgoing"]).optional(),
});

export type CreateBookingRequestInput = z.infer<typeof createBookingRequestSchema>;
export type UpdateBookingStatusInput = z.infer<typeof updateBookingStatusSchema>;
export type RenterReceivingInspectionInput = z.infer<typeof renterReceivingInspectionSchema>;
export type ReturnInitiationInput = z.infer<typeof returnInitiationSchema>;
export type OwnerReceiptInput = z.infer<typeof ownerReceiptSchema>;
export type OwnerDamageClaimInput = z.infer<typeof ownerDamageClaimSchema>;
export type RenterClaimResponseInput = z.infer<typeof renterClaimResponseSchema>;
export type AdminResolveDisputeInput = z.infer<typeof adminResolveDisputeSchema>;
export type BookingQuery = z.infer<typeof bookingQuerySchema>;
