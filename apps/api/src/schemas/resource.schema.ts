import { z } from "zod";

export const createResourceSchema = z.object({
  name: z.string().min(1, "Resource name is required").max(200, "Resource name must be 200 characters or less"),
  description: z.string().max(1000, "Description must be 1000 characters or less").optional(),
  resourceType: z.string().min(1, "Resource type is required").max(100, "Resource type must be 100 characters or less"),
  quantity: z.number().int().positive("Quantity must be a positive integer").default(1),
  unit: z.string().max(50, "Unit must be 50 characters or less").optional(),
  status: z.enum(["available", "unavailable", "maintenance", "reserved"]).default("available"),
  location: z.string().max(200, "Location must be 200 characters or less").optional(),
  isActive: z.boolean().default(true),
});

export const updateResourceSchema = z.object({
  name: z.string().min(1, "Resource name is required").max(200, "Resource name must be 200 characters or less").optional(),
  description: z.string().max(1000, "Description must be 1000 characters or less").optional().nullable(),
  resourceType: z.string().min(1, "Resource type is required").max(100, "Resource type must be 100 characters or less").optional(),
  quantity: z.number().int().positive("Quantity must be a positive integer").optional(),
  unit: z.string().max(50, "Unit must be 50 characters or less").optional().nullable(),
  status: z.enum(["available", "unavailable", "maintenance", "reserved"]).optional(),
  location: z.string().max(200, "Location must be 200 characters or less").optional().nullable(),
  isActive: z.boolean().optional(),
}).strict();

export const resourceQuerySchema = z.object({
  businessId: z.string().optional(),
  resourceType: z.string().optional(),
  status: z.enum(["available", "unavailable", "maintenance", "reserved"]).optional(),
  isActive: z.enum(["true", "false"]).optional(),
});

export type CreateResourceInput = z.infer<typeof createResourceSchema>;
export type UpdateResourceInput = z.infer<typeof updateResourceSchema>;
export type ResourceQuery = z.infer<typeof resourceQuerySchema>;
