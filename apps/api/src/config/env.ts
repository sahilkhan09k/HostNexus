import { z } from "zod";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().int().positive()).default("5000"),
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid database connection string"),
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
