import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import "dotenv/config";

const prisma = new PrismaClient();

/**
 * Demo marketplace data: six listings in Pune and Mumbai, one per category,
 * using the landing-page photos in apps/web/public/listings.
 *
 *   npm run db:seed-demo
 *
 * Each listing belongs to its own verified demo business. The demo owners
 * get a random password that is never stored, so they can't be signed into.
 * Safe to re-run: demo accounts are reused and demo listings are updated to
 * the values below. Rent is per unit per day (as bookings charge it), so the
 * landing card's "₹6,000/day for 200 chairs" is ₹30 per chair per day.
 * No reviews are created — ratings stay empty until real renters leave them.
 */

interface DemoListing {
  owner: { email: string; name: string };
  business: { name: string; businessType: string; addressLine: string; city: "Pune" | "Mumbai"; pincode: string };
  resource: {
    name: string;
    resourceType: string;
    description: string;
    quantity: number;
    unit: string;
    location: string;
    /** Per unit per day */
    rentRupees: number;
    /** Flat, per booking */
    depositRupees: number;
    photo: string;
    transportRatePerKmRupees?: number;
  };
}

const DEMO: DemoListing[] = [
  {
    owner: { email: "demo.koregaon@example.com", name: "Aarav Deshmukh" },
    business: { name: "Koregaon Grand Hotel", businessType: "Hotel", addressLine: "North Main Road, Koregaon Park", city: "Pune", pincode: "411001" },
    resource: {
      name: "Grand Ballroom",
      resourceType: "Banquet Hall",
      description:
        "Opulent 10,000 sq.ft ballroom with crystal chandeliers and an in-house AV setup. Seats 500 guests for weddings, receptions and conferences. Valet parking and bridal room included.",
      quantity: 1,
      unit: "hall",
      location: "Koregaon Park, Pune",
      rentRupees: 45_000,
      depositRupees: 20_000,
      photo: "/listings/grand-ballroom.jpg",
    },
  },
  {
    owner: { email: "demo.bundgarden@example.com", name: "Meera Kulkarni" },
    business: { name: "Bund Garden Hospitality", businessType: "Hotel", addressLine: "Bund Garden Road", city: "Pune", pincode: "411001" },
    resource: {
      name: "Industrial Production Kitchen",
      resourceType: "Kitchen Facility",
      description:
        "Commercial production kitchen with a Rational iCombi Pro 20-grid oven, six prep stations and walk-in cold storage. Fits a team of 12 staff; ideal for catering 800+ covers.",
      quantity: 1,
      unit: "kitchen",
      location: "Bund Garden Road, Pune",
      rentRupees: 8_500,
      depositRupees: 10_000,
      photo: "/listings/production-kitchen.jpg",
    },
  },
  {
    owner: { email: "demo.vimannagar@example.com", name: "Rohan Joshi" },
    business: { name: "Viman Nagar Event Tech", businessType: "AV Rental", addressLine: "Phoenix Mall Road, Viman Nagar", city: "Pune", pincode: "411014" },
    resource: {
      name: "Full AV Conference Bundle",
      resourceType: "AV Equipment",
      description:
        "Complete conference AV kit: 4K projector with screen, four 75\" smart displays, wireless microphones and a Dolby sound system. Covers rooms up to 200 guests; technician available on request.",
      quantity: 2,
      unit: "bundle",
      location: "Viman Nagar, Pune",
      rentRupees: 12_000,
      depositRupees: 15_000,
      photo: "/listings/av-conference-bundle.jpg",
      transportRatePerKmRupees: 25,
    },
  },
  {
    owner: { email: "demo.nagarroad@example.com", name: "Sneha Patwardhan" },
    business: { name: "Skyline Suites Pune", businessType: "Hotel", addressLine: "Nagar Road, Kalyani Nagar", city: "Pune", pincode: "411006" },
    resource: {
      name: "Rooftop Terrace — 5,000 sq.ft",
      resourceType: "Event Space",
      description:
        "Open-air rooftop terrace of 5,000 sq.ft with city views, ambient lighting and a bar counter. Capacity 350 guests for cocktail evenings, sangeet and product launches.",
      quantity: 1,
      unit: "venue",
      location: "Nagar Road, Pune",
      rentRupees: 28_000,
      depositRupees: 15_000,
      photo: "/listings/rooftop-terrace.jpg",
    },
  },
  {
    owner: { email: "demo.andheri@example.com", name: "Kabir Shah" },
    business: { name: "Andheri Event Rentals", businessType: "Event Rentals", addressLine: "MIDC Road, Andheri East", city: "Mumbai", pincode: "400093" },
    resource: {
      name: "Premium Chair & Table Set ×200",
      resourceType: "Furniture",
      description:
        "200 cushioned banquet chairs with 25 round tables (8 seats each) and white covers. Suits seated dinners and conferences for up to 200 guests. Delivery and setup across Mumbai.",
      quantity: 200,
      unit: "chair",
      location: "Andheri East, Mumbai",
      rentRupees: 30, // 200 chairs ≈ ₹6,000/day
      depositRupees: 5_000,
      photo: "/listings/chair-table-set.jpg",
      transportRatePerKmRupees: 30,
    },
  },
  {
    owner: { email: "demo.santacruz@example.com", name: "Farhan Qureshi" },
    business: { name: "Santacruz Travel Co.", businessType: "Transport", addressLine: "Western Express Highway, Santacruz East", city: "Mumbai", pincode: "400055" },
    resource: {
      name: "Luxury Coach Fleet ×4 Buses",
      resourceType: "Vehicle",
      description:
        "Four air-conditioned luxury coaches with 40 reclining seats each (160 seats total), driver included. For guest transfers, airport pickups and outstation wedding travel.",
      quantity: 4,
      unit: "bus",
      location: "Santacruz, Mumbai",
      rentRupees: 5_500, // 4 buses = ₹22,000/day
      depositRupees: 25_000,
      photo: "/listings/luxury-coach-fleet.jpg",
    },
  },
];

/** Bookable from today for the next six months (calendar days at 00:00 UTC). */
function availabilityWindow() {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 6, now.getUTCDate()));
  return { fromDate: from, toDate: to, note: "Demo listing — open for bookings" };
}

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PROD_SEED !== "1") {
    throw new Error("Refusing to seed demo data into production (set ALLOW_PROD_SEED=1 to override)");
  }
  console.log("🌱 Seeding demo listings (Pune & Mumbai)...");

  for (const d of DEMO) {
    const user =
      (await prisma.user.findUnique({ where: { email: d.owner.email } })) ??
      (await prisma.user.create({
        data: {
          email: d.owner.email,
          // Random, never stored: demo owners can't be signed into
          passwordHash: await bcrypt.hash(randomBytes(32).toString("hex"), 12),
          verificationStatus: "VERIFIED",
          verificationNotes: "Demo account (seed-demo.ts)",
          ownerName: d.owner.name,
        },
      }));

    const business =
      (await prisma.business.findFirst({ where: { ownerId: user.id, name: d.business.name } })) ??
      (await prisma.business.create({
        data: { ...d.business, state: "Maharashtra", ownerId: user.id },
      }));

    const r = d.resource;
    const fields = {
      name: r.name,
      resourceType: r.resourceType,
      description: r.description,
      quantity: r.quantity,
      unit: r.unit,
      location: r.location,
      rentAmountPaise: r.rentRupees * 100,
      securityDepositPaise: r.depositRupees * 100,
      photos: [r.photo],
      transportAvailable: !!r.transportRatePerKmRupees,
      transportRatePerKmPaise: (r.transportRatePerKmRupees ?? 0) * 100,
    };

    const existing = await prisma.resource.findFirst({ where: { businessId: business.id, name: r.name } });
    if (existing) {
      await prisma.resource.update({ where: { id: existing.id }, data: fields });
      console.log(`🔄 ${r.resourceType}: ${r.name} — updated`);
      continue;
    }
    await prisma.resource.create({
      data: { ...fields, businessId: business.id, availabilityWindows: { create: availabilityWindow() } },
    });
    console.log(`✅ ${r.resourceType}: ${r.name} — ${r.location}`);
  }
}

main()
  .catch((e) => {
    console.error("❌ Demo seed failed:", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
