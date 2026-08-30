import { z } from "zod";

export const createBusinessSchema = z.object({
  name: z.string().min(1, "Business name is required").max(100, "Business name must be 100 characters or less"),
});

export const updateBusinessSchema = z.object({
  name: z.string().min(1, "Business name is required").max(100, "Business name must be 100 characters or less").optional(),
}).strict();

export type CreateBusinessInput = z.infer<typeof createBusinessSchema>;
export type UpdateBusinessInput = z.infer<typeof updateBusinessSchema>;
