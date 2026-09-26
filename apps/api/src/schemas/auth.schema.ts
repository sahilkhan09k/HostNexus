import { z } from "zod";

// bcrypt only uses the first 72 bytes — reject longer passwords instead of silently truncating
const newPassword = z
  .string()
  .min(10, "Password must be at least 10 characters long")
  .max(72, "Password must be at most 72 characters long")
  .refine((p) => /[A-Za-z]/.test(p) && /[0-9]/.test(p), "Password must contain letters and numbers")
  .refine((p) => !COMMON_PASSWORDS.has(p.toLowerCase()), "This password is too common");

const COMMON_PASSWORDS = new Set([
  "password123", "password1234", "qwerty12345", "1234567890", "12345678910", "iloveyou123",
  "admin12345", "welcome123", "abc1234567", "hostnexus123", "password@123", "passw0rd123",
]);

/** Reference returned by POST /api/upload/kyc — a private PDF, never a public URL */
export const KYC_DOCUMENT_REF = /^\/kyc\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/;

export const registerSchema = z.object({
  email: z.string().email("Invalid email address").max(254).transform((e) => e.toLowerCase()),
  password: newPassword,
  // Personal
  ownerName: z.string().min(2, "Full name is required").max(100),
  phone: z.string().regex(/^\+?[0-9 -]{10,15}$/, "Valid phone number is required"),
  // Business
  businessName: z.string().min(2, "Business name must be at least 2 characters long").max(100),
  businessType: z.string().min(2, "Business type is required").max(60),
  // Address
  addressLine: z.string().min(5, "Address is required").max(300),
  city: z.string().min(2, "City is required").max(80),
  state: z.string().min(2, "State is required").max(80),
  pincode: z.string().regex(/^\d{6}$/, "Enter a valid 6-digit pincode"),
  // KYC: GST certificate reference from /api/upload/kyc — GSTIN is extracted and verified server-side
  gstCertificateUrl: z.string().regex(KYC_DOCUMENT_REF, "Please upload your GST certificate again"),
}).strict();

export const loginSchema = z.object({
  email: z.string().email("Invalid email address").max(254).transform((e) => e.toLowerCase()),
  password: z.string().min(1, "Password is required").max(1024),
});

export const adminLoginSchema = z.object({
  email: z.string().email("Invalid email address").max(254).transform((e) => e.toLowerCase()),
  password: z.string().min(1, "Password is required").max(1024),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1).max(2048),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type AdminLoginInput = z.infer<typeof adminLoginSchema>;
