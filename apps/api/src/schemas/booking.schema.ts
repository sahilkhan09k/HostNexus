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

export const bookingQuerySchema = z.object({
  status: z.enum(["pending", "accepted", "rejected", "cancelled", "completed"]).optional(),
  type: z.enum(["incoming", "outgoing"]).optional(),
});

export type CreateBookingRequestInput = z.infer<typeof createBookingRequestSchema>;
export type UpdateBookingStatusInput = z.infer<typeof updateBookingStatusSchema>;
export type BookingQuery = z.infer<typeof bookingQuerySchema>;
