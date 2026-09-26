import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seed...");

  // ============================================================
  // ADMIN ACCOUNT
  // ============================================================
  const adminPasswordHash = await bcrypt.hash("Admin@HostNexus2026", 10);
  await prisma.admin.upsert({
    where: { email: "admin@hostnexus.in" },
    update: {},
    create: {
      email: "admin@hostnexus.in",
      passwordHash: adminPasswordHash,
      name: "HostNexus Admin",
    },
  });
  console.log("✅ Admin account seeded: admin@hostnexus.in / Admin@HostNexus2026");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
