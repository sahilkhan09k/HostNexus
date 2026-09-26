import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import "dotenv/config";

const prisma = new PrismaClient();

/**
 * Seeds the first admin account from environment variables.
 *
 *   ADMIN_SEED_EMAIL=...  ADMIN_SEED_PASSWORD=...  pnpm db:seed
 *
 * No credential is stored in this file. Refuses to run against production
 * unless ALLOW_PROD_SEED=1 is set explicitly, and never overwrites an existing
 * admin's password.
 */
async function main() {
  console.log("🌱 Starting database seed...");

  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PROD_SEED !== "1") {
    throw new Error("Refusing to seed a production database (set ALLOW_PROD_SEED=1 to override)");
  }

  const email = process.env.ADMIN_SEED_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_SEED_PASSWORD;
  const name = process.env.ADMIN_SEED_NAME?.trim() || "HostNexus Admin";

  if (!email || !password) {
    console.log("ℹ️  ADMIN_SEED_EMAIL / ADMIN_SEED_PASSWORD not set — skipping admin seed.");
    return;
  }
  if (password.length < 16 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    throw new Error("ADMIN_SEED_PASSWORD must be at least 16 characters and contain letters and numbers");
  }

  const existing = await prisma.admin.findUnique({ where: { email } });
  if (existing) {
    console.log(`ℹ️  Admin ${email} already exists — password left unchanged.`);
    return;
  }

  await prisma.admin.create({
    data: { email, name, passwordHash: await bcrypt.hash(password, 12) },
  });
  console.log(`✅ Admin account seeded: ${email}`); // never log the password
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
