import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting seed...");

  // Seed Users with their Businesses
  const user1 = await prisma.user.upsert({
    where: { email: "john@grandhotel.com" },
    update: {},
    create: {
      email: "john@grandhotel.com",
      passwordHash: "$2a$10$dummyhashfordevpurposesonly1234567890", // Placeholder hash
      businesses: {
        create: {
          name: "Grand Plaza Hotel",
        },
      },
    },
    include: {
      businesses: true,
    },
  });

  const user2 = await prisma.user.upsert({
    where: { email: "sarah@elegantcatering.com" },
    update: {},
    create: {
      email: "sarah@elegantcatering.com",
      passwordHash: "$2a$10$dummyhashfordevpurposesonly1234567890", // Placeholder hash
      businesses: {
        create: {
          name: "Elegant Events Catering",
        },
      },
    },
    include: {
      businesses: true,
    },
  });

  const user3 = await prisma.user.upsert({
    where: { email: "mike@starlight.com" },
    update: {},
    create: {
      email: "mike@starlight.com",
      passwordHash: "$2a$10$dummyhashfordevpurposesonly1234567890", // Placeholder hash
      businesses: {
        create: {
          name: "Starlight Event Management",
        },
      },
    },
    include: {
      businesses: true,
    },
  });

  console.log("✅ Seeded users:");
  console.log("  -", user1.email, "→", user1.businesses[0].name);
  console.log("  -", user2.email, "→", user2.businesses[0].name);
  console.log("  -", user3.email, "→", user3.businesses[0].name);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ Seed failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
