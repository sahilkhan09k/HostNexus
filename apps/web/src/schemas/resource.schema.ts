import { z } from "zod";

/**
 * Valid resource type categories for the HostNexus marketplace.
 * These must match the backend validation schema.
 */
export const RESOURCE_TYPES = [
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

/**
 * Frontend validation schema for resource listing form.
 * Validates user input before submission to the API.
 * 
 * Requirements validated:
 * - 2.2, 2.5: Resource type selection and validation
 * - 3.1, 3.2, 3.3: Name field length constraints (3-100 chars)
 * - 3.6: Description max length (1000 chars)
 * - 4.2, 4.4, 4.5: Quantity range (1-10000)
 * - 4.6: Integer type enforcement
 * - 7.7, 7.8, 7.9: Required field validation
 */
export const resourceFormSchema = z.object({
  name: z
    .string()
    .min(3, "Name must be at least 3 characters")
    .max(100, "Name cannot exceed 100 characters"),
  
  resourceType: z.enum(RESOURCE_TYPES, {
    errorMap: () => ({ message: "Please select a resource category" }),
  }),
  
  description: z
    .string()
    .max(1000, "Description must be 1000 characters or less")
    .optional(),
  
  quantity: z
    .number({
      required_error: "Quantity is required",
      invalid_type_error: "Quantity must be a number",
    })
    .int("Quantity must be a whole number")
    .min(1, "Quantity must be at least 1")
    .max(10000, "Quantity cannot exceed 10,000"),
  
  unit: z
    .string()
    .max(50, "Unit must be 50 characters or less")
    .optional(),
  
  location: z
    .string()
    .max(200, "Location must be 200 characters or less")
    .optional(),
  
  isActive: z.boolean(),
});

/**
 * TypeScript type inferred from the resource form schema.
 * Use this type for form state management and type safety.
 */
export type ResourceFormValues = z.infer<typeof resourceFormSchema>;

/**
 * Type for resource type values.
 * Provides type safety for resource type selection.
 */
export type ResourceType = typeof RESOURCE_TYPES[number];
