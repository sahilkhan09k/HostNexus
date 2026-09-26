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

export const resourceFormSchema = z
  .object({
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

    unit: z.string().max(50, "Unit must be 50 characters or less").optional(),

    location: z
      .string()
      .max(200, "Location must be 200 characters or less")
      .optional(),

    isActive: z.boolean().default(true),

    // Commercial Terms (INR entered in ₹, converted to paise on submission)
    rentAmount: z
      .number({
        invalid_type_error: "Rent amount must be a number",
      })
      .min(0, "Rent cannot be negative")
      .default(0),

    securityDeposit: z
      .number({
        invalid_type_error: "Security deposit must be a number",
      })
      .min(0, "Security deposit cannot be negative")
      .default(0),

    photos: z.array(z.string()).default([]),

    // Chain of Custody pre-existing condition disclosure
    hasPreExistingDamage: z.boolean().default(false),
    damageDescription: z.string().optional(),
    damagePhotos: z.array(z.string()).default([]),

    // Owner-provided transport (₹ per km, converted to paise on submission)
    transportAvailable: z.boolean().default(false),
    transportRatePerKm: z
      .number({
        invalid_type_error: "Transport rate must be a number",
      })
      .min(0, "Transport rate cannot be negative")
      .default(0),
  })
  .refine(
    (data) => !data.transportAvailable || data.transportRatePerKm > 0,
    {
      message: "Enter how much you charge per km for transport",
      path: ["transportRatePerKm"],
    }
  )
  .refine(
    (data) => {
      if (data.hasPreExistingDamage) {
        return Boolean(data.damageDescription && data.damageDescription.trim().length >= 5);
      }
      return true;
    },
    {
      message: "Please describe the pre-existing damage (at least 5 characters)",
      path: ["damageDescription"],
    }
  )
  .refine(
    (data) => {
      if (data.hasPreExistingDamage) {
        return data.damagePhotos && data.damagePhotos.length > 0;
      }
      return true;
    },
    {
      message: "Please upload at least one photo showing the pre-existing damage",
      path: ["damagePhotos"],
    }
  );

export type ResourceFormValues = z.infer<typeof resourceFormSchema>;
export type ResourceType = typeof RESOURCE_TYPES[number];
