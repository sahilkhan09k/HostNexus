import type { KnowledgeDocument } from "./types.js";

export const HOSTNEXUS_KNOWLEDGE_DOCUMENTS: KnowledgeDocument[] = [
  {
    id: "policy-damage-and-compensation",
    title: "Product Damage, Claims & Security Deposit Resolution Policy",
    category: "damage_and_disputes",
    section: "Platform Rules §4.1: Damage Handling & Compensation",
    keywords: [
      "damage", "damaged", "broken", "loss", "compensation", "repair", 
      "security deposit", "claim", "dispute", "what happens if product gets damage",
      "ruined", "scratch", "dent", "missing", "protection", "deposit refund"
    ],
    rulesSummary: [
      "All rentals are covered by a security deposit held in third-party Escrow.",
      "Owners have a strict 2-hour inspection window upon return to report damages.",
      "Evidence-backed comparison: pre-existing disclosure photos vs. return photos.",
      "Renter can accept or dispute the claim within the platform.",
      "Independent Admin arbitration evaluates time-stamped proof and determines settlement.",
      "Unauthorized deductions are impossible: escrow protects both owner and renter."
    ],
    content: `
### What Happens If a Product Gets Damaged During Rental?

At HostNexus, we implement an **immutable, multi-stage Chain of Custody & Escrow Protection Pipeline** specifically engineered so that neither owners nor renters are exploited if damage occurs:

1. **Escrow Guarantee**:
   Before any booking becomes active, the renter deposits both the rental amount and the full Security Deposit into HostNexus's verified Razorpay Escrow. Funds are safely frozen until return verification.

2. **Pre-Existing Baseline (Stage 1 & 2)**:
   - When the owner lists the item, any pre-existing imperfections must be declared with photos.
   - When the renter receives the item at handover, they have a mandatory **1-hour Receiving Inspection Window** to upload timestamped photos/videos and confirm initial condition. Any condition not reported at handover is presumed to have arrived in declared condition.

3. **Return Inspection Window (2 Hours)**:
   - When the rental period ends, the renter initiates the return with handover photos.
   - Once the owner confirms physical receipt of the resource, the system starts a strict **2-Hour Owner Inspection Deadline**.
   - If damage is found, the owner must file an official **Damage Claim** through the dashboard before the 2-hour timer expires.

4. **Damage Claim Specifications**:
   - The owner selects the claim category:
     * \`DAMAGE\` (physical breakage, crack, mechanical failure)
     * \`SEVERE_STAIN\` (fabric ruin, chemical discoloration on linens/furniture)
     * \`MISSING_ITEM\` or \`MISSING_QUANTITY\` (e.g. 5 out of 40 chairs missing)
     * \`WRONG_ITEM_RETURNED\`
   - The owner submits: detailed description, required repair/replacement cost (in ₹ paise), and high-resolution photo/video evidence.

5. **Renter Right to Respond & Dispute**:
   - The renter receives an immediate alert and can review the claim.
   - If the renter agrees: the claimed amount is deducted from their held security deposit and released to the owner; the remainder of the deposit is instantly refunded to the renter.
   - If the renter disagrees (e.g., claiming the damage was pre-existing or caused by normal wear and tear), they can file an official **Dispute** with counter-evidence.

6. **HostNexus Admin Arbitration**:
   - A dedicated HostNexus operations arbiter reviews the full cryptographic audit trail side-by-side:
     * Photo 1: Initial Listing snapshot
     * Photo 2: Renter's Receiving Inspection photos
     * Photo 3: Renter's Return Initiation photos
     * Photo 4: Owner's Damage Claim photos
   - The Admin issues a final binding decision:
     * \`REFUND_RENTER\`: If damage was pre-existing or normal wear-and-tear, 100% of the deposit is refunded to the renter.
     * \`PAY_OWNER\`: If renter caused the damage, verified repair costs are paid directly to the owner from the deposit.
     * \`PARTIAL_SETTLEMENT\`: Compromise amount if both parties share partial responsibility.
     * \`REJECT_CLAIM\`: If owner's claim lacks evidence or was filed after the deadline.
`
  },
  {
    id: "policy-chain-of-custody",
    title: "Chain of Custody & Handover Inspection Protocol",
    category: "chain_of_custody",
    section: "Operational Guidelines §2.3: Verification Stages",
    keywords: [
      "handover", "inspection", "receiving", "pickup", "delivery", 
      "deadline", "1 hour", "photo", "evidence", "check", "verification"
    ],
    rulesSummary: [
      "Mandatory 1-hour inspection deadline upon physical receipt by renter.",
      "Renter must upload clear photos/videos of received equipment.",
      "Marking 'ACCEPTED' transitions booking into ACTIVE status.",
      "Reporting an issue immediately pauses escrow rent release."
    ],
    content: `
### Chain of Custody Protocol

To eliminate the "he-said-she-said" dilemma in B2B hospitality sharing, HostNexus enforces a 4-point verification chain:

- **Stage 1 (Listing Condition Snapshot)**: When creating an inventory listing, the provider documents any wear or prior damage. This is permanently snapshotted into the booking contract at creation.
- **Stage 2 (Handover & Receiving Inspection)**: Upon physical handover, the seeker has exactly **1 hour** to inspect the equipment and either:
  * Click **Accept**: Confirms good condition, begins the rental period.
  * Click **Report Issue**: Flags defects, missing counts, or improper functioning with instant evidence submission.
- **Stage 3 (Return Initiation)**: Seeker uploads handover photos when returning goods.
- **Stage 4 (Owner Return Inspection)**: Provider has **2 hours** after receipt to inspect and report any discrepancies.
`
  },
  {
    id: "policy-escrow-and-payments",
    title: "Escrow Financial Mechanism & Security Deposits",
    category: "financial_escrow",
    section: "Financial Terms §3.0: Fund Flow & Safety",
    keywords: [
      "escrow", "payment", "razorpay", "security deposit", "payout", 
      "refund", "safe", "money", "transaction", "hold", "release"
    ],
    rulesSummary: [
      "100% of rental fees and deposits are held in RBI-compliant Escrow via Razorpay.",
      "Owner receives rent payout only after handover inspection is approved.",
      "Security deposit remains held throughout active rental.",
      "Deposit is automatically refunded once return inspection succeeds without claims."
    ],
    content: `
### Escrow Financial Mechanism

HostNexus uses an institutional-grade Escrow architecture powered by Razorpay:

1. **Booking Confirmation**: Once an owner accepts a booking request, the renter funds the escrow covering Rent + Security Deposit.
2. **Funds Held**: Funds are held in a secure, non-interest escrow account. The owner cannot withdraw funds prematurely, and the renter cannot cancel without owner notification.
3. **Rent Release**: Rental payout is released to the owner's bank account after the renter completes the receiving inspection.
4. **Deposit Refund**: The security deposit is automatically credited back to the renter's payment method after the owner accepts the return inspection or after the 2-hour inspection window lapses with zero claims.
`
  },
  {
    id: "policy-pricing-and-negotiation",
    title: "Price Negotiation & Counter-Offer Guidelines",
    category: "negotiation",
    section: "Marketplace Rules §1.4: Direct B2B Negotiation",
    keywords: [
      "negotiate", "negotiation", "counter offer", "discount", "bargain", 
      "reduce price", "bulk discount", "offers", "cheaper", "quote"
    ],
    rulesSummary: [
      "Seekers can request a lower price or bulk discount before payment.",
      "Providers can accept the counter-offer, suggest an alternate price, or reject.",
      "Once agreed, the revised price automatically updates the booking contract."
    ],
    content: `
### Price Negotiation Guidelines

HostNexus accommodates real-world B2B volume discounting through in-app negotiation:
- **How to Negotiate**: On any booking request before payment, click **Negotiate Price**.
- **Proposing Offers**: Enter your desired daily or total rental price along with a note (e.g., "Renting 30 chairs + 40 tables for 3 days; requesting ₹120/chair instead of ₹150").
- **Provider Response**: The provider receives an in-app ping and can Accept, Counter with another price, or Decline.
- **Contract Update**: If accepted, the booking total adjusts seamlessly and you proceed to escrow funding.
`
  },
  {
    id: "policy-kyc-and-verification",
    title: "B2B Trust & KYC Verification Standards",
    category: "kyc_verification",
    section: "Trust & Safety §1.1: Verification Requirements",
    keywords: [
      "kyc", "gst", "gstin", "aadhaar", "verification", "verified badge", 
      "trust", "business registration", "legitimate", "fake"
    ],
    rulesSummary: [
      "Every business must submit GST Certificate and Government ID.",
      "HostNexus administrative team manually inspects tax and business records.",
      "Verified businesses receive the green 'Verified Business' badge."
    ],
    content: `
### KYC & Business Trust Standards

HostNexus is strictly an invite-and-verified B2B community for hotels, banquet venues, caterers, and event planners:
- All users must register a commercial entity.
- Only the GST registration certificate is uploaded during onboarding.
- HostNexus reads the GSTIN from the certificate and checks it against GST registry records instantly; businesses with an active GSTIN are verified automatically and can sign in right away.
- An unregistered, cancelled or unreadable GSTIN blocks sign-up until a correct certificate is uploaded.
- Unverified users cannot list commercial inventory or receive escrow payouts.
`
  },
  {
    id: "platform-inventory-and-categories",
    title: "Resource Types & Equipment Catalog",
    category: "how_to_use",
    section: "Catalog §2.0: Categories & Units",
    keywords: [
      "categories", "furniture", "chairs", "tables", "banquet hall", "kitchen", 
      "av equipment", "sound system", "projector", "cold storage", "catering", 
      "crockery", "cutlery", "tents", "generator", "staff", "vehicles"
    ],
    rulesSummary: [
      "18 supported hospitality categories including Furniture, Banquet Halls, Kitchens, and AV.",
      "Listings specify quantity, unit of measure, location, and daily rental rates.",
      "Real-time calendar availability windows prevent double-booking."
    ],
    content: `
### Available Inventory Categories on HostNexus

HostNexus supports comprehensive asset sharing across the hospitality sector:
- **Furniture**: Chiavari chairs, banquet stacking chairs, round banquet tables (8-10 pax), buffet tables, modular lounge sofas, high bar tables.
- **Banquet Halls & Event Spaces**: Grand Ballrooms, poolside lawns, conference suites, rooftop terraces with full guest capacity specifications.
- **Commercial Kitchen Facilities & Catering Equipment**: Industrial ovens, commercial ranges, refrigerated vans, chafing dish sets, tandoor stations, live cooking counters.
- **Crockery & Cutlery**: Fine bone china, stainless steel cutlery, glassware collections for 100 to 1,000+ guest banquets.
- **AV Equipment & Lighting**: 4K laser projectors, LED P3.9 video walls, line-array sound systems, wireless mics, moving head stage lighting.
- **Power & Utility**: Silent diesel generators (25kVA - 125kVA), water misters, industrial portable AC units.
- **Event Staff & Manpower**: Certified chefs, banquet service captains, valet drivers, licensed sound engineers.
`
  },
  {
    id: "faq-how-to-order-multiple-items",
    title: "How to Order Multiple Items (Chairs, Tables, Staging, Catering)",
    category: "how_to_use",
    section: "User Guide §3.1: Bulk & Multi-Item Ordering",
    keywords: [
      "how to order", "multiple items", "bulk", "order chairs", "order tables", 
      "chairs and tables", "event setup", "date", "calendar", "availability"
    ],
    rulesSummary: [
      "Specify items, quantities, and dates to the AI Concierge for instant matches.",
      "AI finds complementary items from top verified providers in your city.",
      "You can book individual listings or contact providers directly via chat."
    ],
    content: `
### Multi-Item and Bulk Ordering Process

When planning an event requiring multiple resources (for example: 30 chairs, 40 tables, AV setup, and commercial kitchen):
1. **AI Concierge Matching**: Type your exact list and date (e.g., "I need 30 banquet chairs and 40 tables in Pune on Oct 28th"). The Concierge matches available inventory against real-time database stocks, validates dates, and displays verified cards with direct booking links.
2. **Direct Booking**: Click **Book** on any matching card to open the resource page, select your required quantity, and submit a booking request.
3. **Multi-Vendor or Single-Provider**: You can bundle complementary assets from the same provider (e.g. EventPro Bengaluru or Radisson Blu) to save on delivery logistics, or source items from multiple specialized providers.
4. **Negotiate & Fund**: Once the owner confirms inventory availability, negotiate bulk rates if needed, then fund the escrow to secure the reservation.
`
  }
];
