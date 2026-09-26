import { z } from "zod";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

const optionalSecret = z.string().min(16).optional();

const envSchema = z
  .object({
    // No default: a host that forgets NODE_ENV must not silently run in development mode
    NODE_ENV: z.enum(["development", "production", "test"]),
    PORT: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().int().positive()).default("5000"),
    DATABASE_URL: z.string().url("DATABASE_URL must be a valid database connection string"),
    JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters long"),
    REFRESH_TOKEN_SECRET: z.string().min(32, "REFRESH_TOKEN_SECRET must be at least 32 characters long"),
    // Optional: when unset, a separate admin signing key is derived from JWT_SECRET (see admin.service.ts)
    ADMIN_JWT_SECRET: z.string().min(32).optional(),

    // Comma-separated allowlist of browser origins allowed by CORS
    FRONTEND_URL: z.string().optional(),
    // Number of reverse-proxy hops in front of the API (Render/Railway/Fly = 1, Cloudflare + LB = 2)
    TRUST_PROXY_HOPS: z.string().regex(/^\d+$/).transform(Number).optional(),

    RAZORPAY_KEY_ID: z.string().regex(/^rzp_(test|live)_/, "RAZORPAY_KEY_ID must start with rzp_test_ or rzp_live_").optional(),
    RAZORPAY_KEY_SECRET: optionalSecret,
    RAZORPAY_WEBHOOK_SECRET: optionalSecret,

    GEMINI_API_KEY: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),
    GROQ_API_KEY: z.string().optional(),
    // Separate key for KYC extraction so concierge traffic can't exhaust the registration quota
    GROQ_KYC_API_KEY: z.string().optional(),
    GSTIN_API_KEY: z.string().optional(),
    CHROMA_API_KEY: z.string().optional(),
    CHROMA_HOST: z.string().optional(),
    CHROMA_SERVER_URL: z.string().optional(),
    CHROMA_TENANT: z.string().optional(),
    CHROMA_DATABASE: z.string().optional(),
    PRISMA_LOG_QUERIES: z.enum(["true", "false"]).optional(),
  })
  .superRefine((e, ctx) => {
    if (e.NODE_ENV === "production") {
      for (const key of ["FRONTEND_URL", "RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET", "ADMIN_JWT_SECRET"] as const) {
        if (!e[key]) ctx.addIssue({ code: "custom", path: [key], message: `${key} is required in production` });
      }
      if (e.RAZORPAY_KEY_ID && !e.RAZORPAY_KEY_ID.startsWith("rzp_live_")) {
        ctx.addIssue({ code: "custom", path: ["RAZORPAY_KEY_ID"], message: "Live Razorpay key required in production" });
      }
    } else if (e.RAZORPAY_KEY_ID?.startsWith("rzp_live_")) {
      ctx.addIssue({ code: "custom", path: ["RAZORPAY_KEY_ID"], message: "Live Razorpay key must not be used outside production" });
    }
    if (e.JWT_SECRET === e.REFRESH_TOKEN_SECRET) {
      ctx.addIssue({ code: "custom", path: ["REFRESH_TOKEN_SECRET"], message: "REFRESH_TOKEN_SECRET must differ from JWT_SECRET" });
    }
  });

function validateEnv() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error("❌ Invalid environment variables:");
    console.error(result.error.flatten().fieldErrors);
    throw new Error("Environment validation failed");
  }

  return result.data;
}

export const env = validateEnv();

export const isProduction = env.NODE_ENV === "production";

/** Browser origins allowed to call the API. Development falls back to the local Next.js dev server. */
export const allowedOrigins: string[] = (env.FRONTEND_URL ?? (isProduction ? "" : "http://localhost:3000"))
  .split(",")
  .map((s) => s.trim().replace(/\/$/, ""))
  .filter(Boolean);
