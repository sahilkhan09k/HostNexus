import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters long"),
  // Personal
  ownerName: z.string().min(2, "Full name is required"),
  phone: z.string().min(10, "Valid phone number is required"),
  // Business
  businessName: z.string().min(2, "Business name must be at least 2 characters long"),
  businessType: z.string().min(2, "Business type is required"),
  // Address
  addressLine: z.string().min(5, "Address is required"),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  pincode: z.string().regex(/^\d{6}$/, "Enter a valid 6-digit pincode"),
  // KYC documents (file URLs after upload)
  gstCertificateUrl: z.string().min(1, "GST Certificate is required"),
  aadhaarUrl: z.string().min(1, "Aadhaar document is required"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const adminLoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type AdminLoginInput = z.infer<typeof adminLoginSchema>;
