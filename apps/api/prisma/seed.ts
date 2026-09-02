import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seed...");

  const passwordHash = await bcrypt.hash("password123456", 10);

  // ============================================================
  // BUSINESS 1: Radisson Blu Pune (Hotel)
  // ============================================================
  const user1 = await prisma.user.upsert({
    where: { email: "demo@hostnexus.in" },
    update: {},
    create: {
      email: "demo@hostnexus.in",
      passwordHash,
    },
  });

  const business1 = await prisma.business.upsert({
    where: { id: "business-radisson" },
    update: {},
    create: {
      id: "business-radisson",
      name: "Radisson Blu Pune",
      ownerId: user1.id,
    },
  });

  console.log("✅ Created:", business1.name);

  const radissonResources = [
    {
      name: "Grand Ballroom",
      description: "Luxurious ballroom with chandelier lighting, wooden flooring, and state-of-the-art acoustics. Perfect for weddings, conferences, and gala dinners.",
      resourceType: "Banquet Hall",
      quantity: 1,
      unit: "hall",
      status: "available",
      location: "Koregaon Park, Pune",
      isActive: true,
    },
    {
      name: "Rooftop Terrace",
      description: "Open-air terrace with panoramic city views, ambient lighting, and weather-protected setup. Ideal for cocktail receptions and sunset events.",
      resourceType: "Event Space",
      quantity: 1,
      unit: "space",
      status: "available",
      location: "Koregaon Park, Pune",
      isActive: true,
    },
    {
      name: "Conference Room Package (3 Rooms)",
      description: "Three boardroom-style conference rooms with projectors, whiteboards, and high-speed WiFi. Capacity: 20 persons each.",
      resourceType: "Meeting Space",
      quantity: 3,
      unit: "room",
      status: "available",
      location: "Koregaon Park, Pune",
      isActive: true,
    },
    {
      name: "Industrial Kitchen",
      description: "Fully equipped commercial kitchen with gas ranges, ovens, refrigeration, and prep stations. Certified for catering operations.",
      resourceType: "Kitchen Facility",
      quantity: 1,
      unit: "kitchen",
      status: "available",
      location: "Koregaon Park, Pune",
      isActive: true,
    },
    {
      name: "Luxury Coach Fleet",
      description: "Fleet of 3 luxury air-conditioned coaches (45-seater each) with reclining seats, entertainment systems, and professional drivers.",
      resourceType: "Vehicle",
      quantity: 3,
      unit: "coach",
      status: "available",
      location: "Pune",
      isActive: true,
    },
    {
      name: "Premium AV Equipment Bundle",
      description: "Professional audio-visual setup: 4K projector, 12-channel mixer, wireless mics, LED stage lighting, and control booth.",
      resourceType: "AV Equipment",
      quantity: 2,
      unit: "set",
      status: "available",
      location: "Koregaon Park, Pune",
      isActive: true,
    },
  ];

  for (const resource of radissonResources) {
    await prisma.resource.create({
      data: { ...resource, businessId: business1.id },
    });
  }

  // ============================================================
  // BUSINESS 2: Royal Caterers Mumbai (Catering)
  // ============================================================
  const user2 = await prisma.user.upsert({
    where: { email: "contact@royalcaterers.in" },
    update: {},
    create: {
      email: "contact@royalcaterers.in",
      passwordHash,
    },
  });

  const business2 = await prisma.business.upsert({
    where: { id: "business-royal-caterers" },
    update: {},
    create: {
      id: "business-royal-caterers",
      name: "Royal Caterers Mumbai",
      ownerId: user2.id,
    },
  });

  console.log("✅ Created:", business2.name);

  const cateringResources = [
    {
      name: "Buffet Setup for 200 Guests",
      description: "Complete buffet arrangement with chafing dishes, serving stations, linens, and presentation decor.",
      resourceType: "Catering Equipment",
      quantity: 5,
      unit: "setup",
      status: "available",
      location: "Andheri, Mumbai",
      isActive: true,
    },
    {
      name: "Premium Crockery & Cutlery Set",
      description: "Fine dining porcelain plates, stainless steel cutlery, glassware for 500 guests. Includes washing and packaging.",
      resourceType: "Crockery/Cutlery",
      quantity: 500,
      unit: "set",
      status: "available",
      location: "Andheri, Mumbai",
      isActive: true,
    },
    {
      name: "Cold Storage Van (Refrigerated)",
      description: "Temperature-controlled refrigerated van for food transportation. Capacity: 2000 kg, -5°C to 5°C.",
      resourceType: "Cold Storage",
      quantity: 2,
      unit: "van",
      status: "available",
      location: "Mumbai",
      isActive: true,
    },
    {
      name: "Live Counter Stations",
      description: "Interactive live cooking stations: Pasta, Chaat, Dosa, and Grills. Includes gas setup, chef uniforms, and ingredients.",
      resourceType: "Catering Equipment",
      quantity: 4,
      unit: "station",
      status: "available",
      location: "Andheri, Mumbai",
      isActive: true,
    },
  ];

  for (const resource of cateringResources) {
    await prisma.resource.create({
      data: { ...resource, businessId: business2.id },
    });
  }

  // ============================================================
  // BUSINESS 3: EventPro Bengaluru (Event Organizer)
  // ============================================================
  const user3 = await prisma.user.upsert({
    where: { email: "hello@eventpro.in" },
    update: {},
    create: {
      email: "hello@eventpro.in",
      passwordHash,
    },
  });

  const business3 = await prisma.business.upsert({
    where: { id: "business-eventpro" },
    update: {},
    create: {
      id: "business-eventpro",
      name: "EventPro Bengaluru",
      ownerId: user3.id,
    },
  });

  console.log("✅ Created:", business3.name);

  const eventProResources = [
    {
      name: "Modular Stage Platform",
      description: "Customizable modular stage system (20ft x 30ft), adjustable height, black carpet finish, ramps, and stage skirting.",
      resourceType: "Furniture",
      quantity: 1,
      unit: "set",
      status: "available",
      location: "Whitefield, Bengaluru",
      isActive: true,
    },
    {
      name: "LED Video Wall (10ft x 8ft)",
      description: "High-resolution P3.9 indoor LED video wall with controller, media player, and technical support.",
      resourceType: "AV Equipment",
      quantity: 1,
      unit: "wall",
      status: "available",
      location: "Whitefield, Bengaluru",
      isActive: true,
    },
    {
      name: "Premium Tent & Canopy (50x50)",
      description: "Weather-resistant premium white tent with AC ducting, flooring, sidewalls, and decorative draping. Capacity: 500 guests.",
      resourceType: "Tent/Canopy",
      quantity: 2,
      unit: "tent",
      status: "available",
      location: "Bengaluru",
      isActive: true,
    },
    {
      name: "Event Furniture Package (Chiavari Chairs + Round Tables)",
      description: "Elegant gold Chiavari chairs (200 units) + round tables (25 units) with white linens and centerpiece risers.",
      resourceType: "Furniture",
      quantity: 1,
      unit: "package",
      status: "available",
      location: "Whitefield, Bengaluru",
      isActive: true,
    },
    {
      name: "Professional Photographer & Videographer Team",
      description: "Team of 2 photographers + 2 videographers with DSLR cameras, drone, gimbal, and lighting. 8-hour coverage.",
      resourceType: "Staff/Manpower",
      quantity: 3,
      unit: "team",
      status: "available",
      location: "Bengaluru",
      isActive: true,
    },
  ];

  for (const resource of eventProResources) {
    await prisma.resource.create({
      data: { ...resource, businessId: business3.id },
    });
  }

  // ============================================================
  // BUSINESS 4: Taj Banquets Delhi (Banquet Venue)
  // ============================================================
  const user4 = await prisma.user.upsert({
    where: { email: "bookings@tajbanquets.in" },
    update: {},
    create: {
      email: "bookings@tajbanquets.in",
      passwordHash,
    },
  });

  const business4 = await prisma.business.upsert({
    where: { id: "business-taj-banquets" },
    update: {},
    create: {
      id: "business-taj-banquets",
      name: "Taj Banquets Delhi",
      ownerId: user4.id,
    },
  });

  console.log("✅ Created:", business4.name);

  const tajResources = [
    {
      name: "Crystal Ballroom",
      description: "Opulent ballroom with crystal chandeliers, marble flooring, and gold accents. Capacity: 800 guests. Built-in AV system included.",
      resourceType: "Banquet Hall",
      quantity: 1,
      unit: "hall",
      status: "available",
      location: "Connaught Place, Delhi",
      isActive: true,
    },
    {
      name: "Poolside Lawn",
      description: "Beautifully landscaped lawn with poolside views, fairy lighting, and gazebo. Perfect for garden weddings and receptions.",
      resourceType: "Event Space",
      quantity: 1,
      unit: "lawn",
      status: "available",
      location: "Connaught Place, Delhi",
      isActive: true,
    },
    {
      name: "VIP Lounge & Bride Room",
      description: "Private lounge with makeup stations, vanity mirrors, comfortable seating, and refreshments area.",
      resourceType: "Meeting Space",
      quantity: 2,
      unit: "room",
      status: "available",
      location: "Connaught Place, Delhi",
      isActive: true,
    },
    {
      name: "Premium Linen Collection",
      description: "Designer table linens, chair covers, napkins, and runners in multiple colors. Includes washing and pressing.",
      resourceType: "Linen/Textile",
      quantity: 300,
      unit: "set",
      status: "available",
      location: "Delhi",
      isActive: true,
    },
  ];

  for (const resource of tajResources) {
    await prisma.resource.create({
      data: { ...resource, businessId: business4.id },
    });
  }

  // ============================================================
  // BUSINESS 5: Sunshine Resorts Goa (Resort)
  // ============================================================
  const user5 = await prisma.user.upsert({
    where: { email: "info@sunshineresorts.goa" },
    update: {},
    create: {
      email: "info@sunshineresorts.goa",
      passwordHash,
    },
  });

  const business5 = await prisma.business.upsert({
    where: { id: "business-sunshine-goa" },
    update: {},
    create: {
      id: "business-sunshine-goa",
      name: "Sunshine Resorts Goa",
      ownerId: user5.id,
    },
  });

  console.log("✅ Created:", business5.name);

  const goaResources = [
    {
      name: "Beachfront Venue",
      description: "Private beach access with seating for 300 guests, sunset views, bonfire setup, and beach decor.",
      resourceType: "Event Space",
      quantity: 1,
      unit: "venue",
      status: "available",
      location: "Calangute Beach, Goa",
      isActive: true,
    },
    {
      name: "Water Sports Equipment Bundle",
      description: "Jet skis, parasailing equipment, banana boats, and kayaks with safety gear and trained operators.",
      resourceType: "Equipment",
      quantity: 10,
      unit: "set",
      status: "available",
      location: "Calangute Beach, Goa",
      isActive: true,
    },
    {
      name: "Guest Accommodation Block (20 Rooms)",
      description: "Block booking of 20 deluxe rooms with sea view, breakfast included, and shuttle service.",
      resourceType: "Other",
      quantity: 20,
      unit: "room",
      status: "available",
      location: "Calangute, Goa",
      isActive: true,
    },
    {
      name: "Portable Generator (50 KVA)",
      description: "Silent diesel generator with automatic voltage regulator, fuel tank, and technical support.",
      resourceType: "Generator/Power",
      quantity: 2,
      unit: "generator",
      status: "available",
      location: "Goa",
      isActive: true,
    },
  ];

  for (const resource of goaResources) {
    await prisma.resource.create({
      data: { ...resource, businessId: business5.id },
    });
  }

  // ============================================================
  // BUSINESS 6: Metro Parking Solutions Mumbai (Parking Provider)
  // ============================================================
  const user6 = await prisma.user.upsert({
    where: { email: "parking@metrosolutions.in" },
    update: {},
    create: {
      email: "parking@metrosolutions.in",
      passwordHash,
    },
  });

  const business6 = await prisma.business.upsert({
    where: { id: "business-metro-parking" },
    update: {},
    create: {
      id: "business-metro-parking",
      name: "Metro Parking Solutions",
      ownerId: user6.id,
    },
  });

  console.log("✅ Created:", business6.name);

  const parkingResources = [
    {
      name: "Multi-Level Parking Facility (200 Cars)",
      description: "Secure multi-level parking with CCTV, 24/7 security, valet service, and easy access to event venue.",
      resourceType: "Parking Space",
      quantity: 200,
      unit: "slot",
      status: "available",
      location: "Bandra, Mumbai",
      isActive: true,
    },
    {
      name: "Valet Parking Staff (10 Attendants)",
      description: "Professional valet attendants with uniforms, walkie-talkies, and parking management system.",
      resourceType: "Staff/Manpower",
      quantity: 10,
      unit: "person",
      status: "available",
      location: "Mumbai",
      isActive: true,
    },
  ];

  for (const resource of parkingResources) {
    await prisma.resource.create({
      data: { ...resource, businessId: business6.id },
    });
  }

  // ============================================================
  // BUSINESS 7: Decor Dreams Hyderabad (Decoration)
  // ============================================================
  const user7 = await prisma.user.upsert({
    where: { email: "decor@decordreams.in" },
    update: {},
    create: {
      email: "decor@decordreams.in",
      passwordHash,
    },
  });

  const business7 = await prisma.business.upsert({
    where: { id: "business-decor-dreams" },
    update: {},
    create: {
      id: "business-decor-dreams",
      name: "Decor Dreams Hyderabad",
      ownerId: user7.id,
    },
  });

  console.log("✅ Created:", business7.name);

  const decorResources = [
    {
      name: "Floral Decoration Package (Premium)",
      description: "Fresh flower arrangements: stage backdrop, entrance arch, table centerpieces, and ceiling draping.",
      resourceType: "Decor Items",
      quantity: 5,
      unit: "package",
      status: "available",
      location: "Banjara Hills, Hyderabad",
      isActive: true,
    },
    {
      name: "LED Dance Floor (20ft x 20ft)",
      description: "Interactive LED dance floor with customizable patterns, music sync, and wireless control.",
      resourceType: "Decor Items",
      quantity: 1,
      unit: "floor",
      status: "available",
      location: "Hyderabad",
      isActive: true,
    },
    {
      name: "Themed Decor Props Collection",
      description: "Vintage props, rustic furniture, neon signs, photo booth backdrops, and Instagram-worthy setups.",
      resourceType: "Decor Items",
      quantity: 50,
      unit: "piece",
      status: "available",
      location: "Banjara Hills, Hyderabad",
      isActive: true,
    },
  ];

  for (const resource of decorResources) {
    await prisma.resource.create({
      data: { ...resource, businessId: business7.id },
    });
  }

  // ============================================================
  // SUMMARY
  // ============================================================
  const totalBusinesses = 7;
  const totalResources = radissonResources.length + cateringResources.length + eventProResources.length + tajResources.length + goaResources.length + parkingResources.length + decorResources.length;

  console.log("");
  console.log("🎉 SEED COMPLETE!");
  console.log("═══════════════════════════════════════════");
  console.log(`✅ ${totalBusinesses} Businesses Created`);
  console.log(`✅ ${totalResources} Resources Listed`);
  console.log("");
  console.log("📧 Demo Accounts:");
  console.log("─────────────────────────────────────────");
  console.log("1. demo@hostnexus.in           → Radisson Blu Pune");
  console.log("2. contact@royalcaterers.in    → Royal Caterers Mumbai");
  console.log("3. hello@eventpro.in           → EventPro Bengaluru");
  console.log("4. bookings@tajbanquets.in     → Taj Banquets Delhi");
  console.log("5. info@sunshineresorts.goa    → Sunshine Resorts Goa");
  console.log("6. parking@metrosolutions.in   → Metro Parking Solutions");
  console.log("7. decor@decordreams.in        → Decor Dreams Hyderabad");
  console.log("");
  console.log("🔑 Password for all: password123456");
  console.log("═══════════════════════════════════════════");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
