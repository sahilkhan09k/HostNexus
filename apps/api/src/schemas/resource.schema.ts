import { z } from "zod";

const VALID_RESOURCE_TYPES = [
  "Banquet Hall",
  "Event Space",
  "Meeting Space",
  "Kitchen Facility",
  "Vehicle",
  "AV Equipment",
  "Catering Equipment",
  "Crockery/Cutlery",
  "Cold Storage",
  "Furniture",
  "Tent/Canopy",
  "Staff/Manpower",
  "Parking Space",
  "Generator/Power",
  "Linen/Textile",
  "Decor Items",
  "Equipment",
  "Other",
] as const;

export { VALID_RESOURCE_TYPES };

export const createResourceSchema = z.object({
  name: z
    .string()
    .min(3, "Name must be at least 3 characters")
    .max(100, "Name cannot exceed 100 characters"),
  description: z.string().max(1000, "Description must be 1000 characters or less").optional(),
  resourceType: z
    .string()
    .min(1, "Resource type is required")
    .refine(
      (val) => VALID_RESOURCE_TYPES.includes(val as any),
      "Invalid resource type"
    ),
  quantity: z
    .number()
    .int("Quantity must be a whole number")
    .min(1, "Quantity must be at least 1")
    .max(10000, "Quantity cannot exceed 10,000")
    .default(1),
  unit: z.string().max(50, "Unit must be 50 characters or less").optional(),
  status: z.enum(["available", "unavailable", "maintenance", "reserved"]).default("available"),
  location: z.string().max(200, "Location must be 200 characters or less").optional(),
  isActive: z.boolean().default(true),
});

export const updateResourceSchema = z.object({
  name: z
    .string()
    .min(3, "Name must be at least 3 characters")
    .max(100, "Name cannot exceed 100 characters")
    .optional(),
  description: z.string().max(1000, "Description must be 1000 characters or less").optional().nullable(),
  resourceType: z
    .string()
    .refine(
      (val) => VALID_RESOURCE_TYPES.includes(val as any),
      "Invalid resource type"
    )
    .optional(),
  quantity: z
    .number()
    .int("Quantity must be a whole number")
    .min(1, "Quantity must be at least 1")
    .max(10000, "Quantity cannot exceed 10,000")
    .optional(),
  unit: z.string().max(50, "Unit must be 50 characters or less").optional().nullable(),
  status: z.enum(["available", "unavailable", "maintenance", "reserved"]).optional(),
  location: z.string().max(200, "Location must be 200 characters or less").optional().nullable(),
  isActive: z.boolean().optional(),
}).strict();

export const resourceQuerySchema = z.object({
  businessId: z.string().optional(),
  resourceType: z
    .string()
    .refine(
      (val) => VALID_RESOURCE_TYPES.includes(val as any),
      "Invalid resource type"
    )
    .optional(),
  status: z.enum(["available", "unavailable", "maintenance", "reserved"]).optional(),
  isActive: z.enum(["true", "false"]).optional(),
});

export type CreateResourceInput = z.infer<typeof createResourceSchema>;
export type UpdateResourceInput = z.infer<typeof updateResourceSchema>;
export type ResourceQuery = z.infer<typeof resourceQuerySchema>;
