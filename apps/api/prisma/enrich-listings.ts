import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Enriching marketplace listings with realistic pricing and dedicated chair/table inventory...");

  // 1. Update existing resources with realistic prices
  const priceUpdates: Record<string, { rent: number; deposit: number }> = {
    "Grand Ballroom": { rent: 4500000, deposit: 1500000 },
    "Rooftop Terrace": { rent: 2800000, deposit: 1000000 },
    "Conference Room Package (3 Rooms)": { rent: 1500000, deposit: 500000 },
    "Industrial Kitchen": { rent: 1200000, deposit: 500000 },
    "Luxury Coach Fleet": { rent: 1800000, deposit: 500000 },
    "Premium AV Equipment Bundle": { rent: 850000, deposit: 300000 },
    "Buffet Setup for 200 Guests": { rent: 1500000, deposit: 500000 },
    "Premium Crockery & Cutlery Set": { rent: 4000, deposit: 1500 },
    "Cold Storage Van (Refrigerated)": { rent: 950000, deposit: 300000 },
    "Live Counter Stations": { rent: 600000, deposit: 200000 },
    "Modular Stage Platform": { rent: 2200000, deposit: 800000 },
    "LED Video Wall (10ft x 8ft)": { rent: 3500000, deposit: 1200000 },
    "Premium Tent & Canopy (50x50)": { rent: 2500000, deposit: 800000 },
    "Event Furniture Package (Chiavari Chairs + Round Tables)": { rent: 3000000, deposit: 1000000 },
    "Professional Photographer & Videographer Team": { rent: 4000000, deposit: 500000 },
    "Crystal Ballroom": { rent: 6000000, deposit: 2000000 },
    "Poolside Lawn": { rent: 3500000, deposit: 1000000 },
    "VIP Lounge & Bride Room": { rent: 1200000, deposit: 400000 },
    "Premium Linen Collection": { rent: 5000, deposit: 2000 },
    "Beachfront Venue": { rent: 5000000, deposit: 1500000 },
    "Floral Decoration Package (Premium)": { rent: 1800000, deposit: 500000 },
    "LED Dance Floor (20ft x 20ft)": { rent: 2000000, deposit: 600000 },
  };

  for (const [name, prices] of Object.entries(priceUpdates)) {
    await prisma.resource.updateMany({
      where: { name },
      data: {
        rentAmountPaise: prices.rent,
        securityDepositPaise: prices.deposit,
      },
    });
  }
  console.log("✅ Updated pricing on existing listings");

  // 2. Add specific Chair & Table inventory if not already present
  const radissonBiz = await prisma.business.findFirst({ where: { name: { contains: "Radisson" } } });
  const eventProBiz = await prisma.business.findFirst({ where: { name: { contains: "EventPro" } } });

  const targetBizId = eventProBiz?.id || radissonBiz?.id;

  if (targetBizId) {
    const dedicatedInventory = [
      {
        name: "Gold Chiavari Banquet Chairs",
        description: "Elegant gold-lacquered Chiavari ballroom chairs with cushioned ivory seats. Sturdy hardwood construction, stackable up to 8 high. Perfect for weddings, corporate galas, and banquets.",
        resourceType: "Furniture",
        quantity: 300,
        unit: "chairs",
        status: "available",
        location: "Koregaon Park, Pune",
        isActive: true,
        rentAmountPaise: 15000, // ₹150 / chair / day
        securityDepositPaise: 5000, // ₹50 / chair
        photos: [
          "https://images.unsplash.com/photo-1549497538-303791108f95?auto=format&fit=crop&w=800&q=80"
        ],
        hasPreExistingDamage: false,
        damageDescription: null,
      },
      {
        name: "Round Banquet Dining Tables (6ft, 10-Seater)",
        description: "6-foot commercial round banquet tables with solid finished wooden tops and heavy-duty folding steel legs. Easily seats 8 to 10 guests per table. Standard height 30 inches.",
        resourceType: "Furniture",
        quantity: 60,
        unit: "tables",
        status: "available",
        location: "Koregaon Park, Pune",
        isActive: true,
        rentAmountPaise: 60000, // ₹600 / table / day
        securityDepositPaise: 20000, // ₹200 / table
        photos: [
          "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=800&q=80"
        ],
        hasPreExistingDamage: true,
        damageDescription: "Minor hairline varnish scratch on table edge #4 and #7, fully documented with pre-existing photos.",
      },
      {
        name: "Rectangular Catering Buffet Tables (6ft)",
        description: "Heavy-duty 6-foot rectangular folding tables with impact-resistant blow-molded tops and powder-coated steel legs. Ideal for food presentation, bar stations, and check-in desks.",
        resourceType: "Furniture",
        quantity: 45,
        unit: "tables",
        status: "available",
        location: "Andheri, Mumbai",
        isActive: true,
        rentAmountPaise: 45000, // ₹450 / table / day
        securityDepositPaise: 15000, // ₹150 / table
        photos: [
          "https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&w=800&q=80"
        ],
        hasPreExistingDamage: false,
      }
    ];

    const windowStart = new Date();
    windowStart.setHours(0, 0, 0, 0);
    const windowEnd = new Date(windowStart);
    windowEnd.setMonth(windowEnd.getMonth() + 6);

    for (const item of dedicatedInventory) {
      const existing = await prisma.resource.findFirst({ where: { name: item.name } });
      if (!existing) {
        const created = await prisma.resource.create({
          data: {
            ...item,
            businessId: targetBizId,
          }
        });

        await prisma.availabilityWindow.create({
          data: {
            resourceId: created.id,
            fromDate: windowStart,
            toDate: windowEnd,
            note: "Available for instant booking",
          }
        });
        console.log(`✅ Created dedicated inventory: ${item.name} (${item.quantity} ${item.unit})`);
      } else {
        await prisma.resource.update({
          where: { id: existing.id },
          data: {
            rentAmountPaise: item.rentAmountPaise,
            securityDepositPaise: item.securityDepositPaise,
            quantity: item.quantity,
          }
        });
        console.log(`✅ Updated dedicated inventory: ${item.name}`);
      }
    }
  }

  console.log("🎉 Marketplace listings successfully enriched!");
}

main()
  .catch((e) => {
    console.error("❌ Enrichment failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
