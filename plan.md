# 🏨 HostNexus — 7-Day 2-Member Execution & Master Plan

> **Project:** HostNexus — Smart B2B Marketplace for Shared Hospitality Resources  
> **Sprint Duration:** 7 Days (Hackathon Fast-Track)  
> **Team Structure:** 2 Engineers (High-Velocity Dual Tracks)  
> **Leadership:** You (Team Lead & Full Frontend + Client Integration)  
> **Backend & AI Partner:** Aditya (Backend, Database, AI Engine & Server Integrations)  

---

## 👥 1. Team Roles & Ownership Matrix (2-Member Setup)

In a 2-person team, efficiency comes from clear ownership: **You own everything the user sees and interacts with (including client-side API/SDK integrations)**, while **Aditya owns the entire data, server, AI intelligence, and background processing pipeline**.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           2-MEMBER WORK DIVISION                                │
├───────────────────────────────────────┬─────────────────────────────────────────┤
│ 👑 TEAM LEAD (YOU)                    │ ⚙️ ADITYA                               │
│ Frontend, Client Integrations & Setup │ Backend, Database, AI & Cloud Services  │
├───────────────────────────────────────┼─────────────────────────────────────────┤
│ • Initial Monorepo & Scaffolding      │ • Express + TypeScript API Server       │
│ • Vibecoding Next.js 15 App Router UI │ • Prisma ORM & PostgreSQL Migrations    │
│ • Component Design System (shadcn/UI) │ • Core REST API Endpoints & Auth        │
│ • Interactive AI Concierge Chat UI    │ • Atomic Booking & Double-Booking Lock  │
│ • Split Map Discovery & Filters       │ • LangChain RAG & Embedding Pipeline    │
│ • Business Dashboard & Analytics UI   │ • MCP Tool Execution Server             │
│ • RFQ Negotiation & Calendar Manager  │ • Smart Matching Scoring Algorithm      │
│ • Client Integration: React Query,    │ • Server-Side Integrations: Razorpay,   │
│   Socket.IO client, Razorpay Checkout,│   Cloudinary CDN, Resend Email Webhooks │
│   Google Maps SDK, Cloudinary Widget  │ • Realtime Socket.IO Server             │
│ • Presentation Deck & Live Demo Pitch │ • Production Deployment & DB Seeding    │
└───────────────────────────────────────┴─────────────────────────────────────────┘
```

---

## ⚡ 2. 2-Person Parallel Execution Protocol (Zero-Blockers)

To prevent either person from waiting on the other:

1. **Shared Contract on Day 1 Morning (`packages/types`):**  
   Spend the first 2 hours locking TypeScript types for `User`, `Resource`, `BookingRequest`, `Quotation`, `Review`, and `AIChatPayload`.
2. **Frontend Mock-First Vibecoding:**  
   You start vibecoding UI components using structured local mock states / static JSON files immediately. You are never blocked waiting for backend APIs to go live.
3. **Backend Route Delivery & Contract Matching:**  
   Aditya develops endpoints adhering strictly to the shared contract types.
4. **Seamless "Flip-the-Switch" Integration:**  
   Once Aditya’s endpoint is pushed, you switch your frontend hook from the mock data to the live API endpoint in minutes.
5. **Nightly 15-Minute Sync (8:30 PM):**  
   Merge feature branches to `develop`, verify integrated flows, and set the next day's priority endpoints.

---

## 🗓️ 3. 7-Day Day-by-Day Master Roadmap (2-Member Track)

```
Day 1: Project Scaffolding, DB Schema, Auth & Core UI Shell
Day 2: Resource Inventory Engine, Map Discovery & Listing Wizard
Day 3: Booking State Machine, Double-Booking Locks & RFQ Timeline
Day 4: AI Concierge Chatbot, RAG Pipeline & MCP Tool Layer
Day 5: Real-time Sockets, Razorpay Escrow & Business Dashboards
Day 6: Full Integration, Realistic Seeding, Polish & Animations
Day 7: Live Cloud Deployment, Video Recording & Pitch Deck
```

---

### 📅 DAY 1: Monorepo Scaffolding, Database Setup & Core UI Shell
*Goal: Working repo, database schema deployed, authentication working, and landing page live.*

| Member | Focus Area | Detailed Tasks |
|---|---|---|
| **👑 You (Lead)** | **Scaffolding + UI Foundation** | 1. Initialize Turborepo / Next.js 15 App Router (`apps/web`) and Express API (`apps/api`).<br>2. Set up Tailwind CSS, Lucide icons, fonts (Inter/Outfit), Framer Motion, and shadcn/ui library.<br>3. Define shared contract types in `packages/types` with Aditya.<br>4. Build the core layout: Global Navbar with notification pill, Business Portal Sidebar, responsive footer.<br>5. Vibecode the high-impact **Hero Landing Page** with resource search bar, category pills, live platform stats, and dark/modern glassmorphism. |
| **⚙️ Aditya** | **Backend Setup & DB Architecture** | 1. Initialize Express + TypeScript server with CORS, Helmet, and logging.<br>2. Set up Prisma ORM connected to PostgreSQL (Docker or Supabase/Neon).<br>3. Implement Prisma schema models: `Business`, `Resource`, `Availability`, `BookingRequest`, `Quotation`, `Review`, `Message`.<br>4. Run initial migrations and verify connection.<br>5. Implement Auth service & routes: `POST /api/auth/register`, `POST /api/auth/login` (JWT token + bcrypt hashing + auth middleware). |

**🔥 Day 1 Checkpoint (8:30 PM):** Both apps run locally; Landing page renders cleanly; Backend can register/login users and issue JWTs.

---

### 📅 DAY 2: Marketplace Discovery, Listings & Inventory Engine
*Goal: Complete resource browsing, map view discovery, detail pages, and listing creation.*

| Member | Focus Area | Detailed Tasks |
|---|---|---|
| **👑 You (Lead)** | **Marketplace UI & Listing Wizard** | 1. Vibecode the **Resource Marketplace Grid/List View** with faceted filters (category, price slider, date range, distance).<br>2. Build the **Split Map Discovery View** (interactive Google Maps/Mapbox markers on right, cards on left).<br>3. Vibecode the **Resource Detail Page** (image carousel, detailed specs JSON viewer, pricing tiers, provider trust badge, availability mini-calendar).<br>4. Vibecode the multi-step **"List a Resource" Wizard** (category selector, specs dynamic fields, pricing rules, photo dropzone).<br>5. Wire Cloudinary upload widget for instant image uploads on frontend. |
| **⚙️ Aditya** | **Resource CRUD & Availability APIs** | 1. Implement `POST /api/resources` (create resource listing with JSON specs validation).<br>2. Implement `GET /api/resources` (filtering by category, price, location bounding box, query search).<br>3. Implement `GET /api/resources/:id` (full details with provider info and reviews).<br>4. Implement `POST /api/resources/:id/availability` (set blocked dates, hourly slots, and recurring availability rules).<br>5. Integrate Cloudinary backend signature generation route. |

**🔥 Day 2 Checkpoint (8:30 PM):** Users can create rich listings with photos and browse/filter/view them on the interactive map.

---

### 📅 DAY 3: Booking Workflow, Atomic Scheduling & Negotiations
*Goal: End-to-end booking requests, quote counter-offers, and double-booking prevention.*

| Member | Focus Area | Detailed Tasks |
|---|---|---|
| **👑 You (Lead)** | **Booking, RFQ & Calendar UI** | 1. Vibecode the **Booking Request Modal** (date/time range picker, quantity selector, add-on checkboxes, delivery options, budget note).<br>2. Vibecode the **RFQ & Negotiation Timeline** (interactive quote card, counter-offer form, visual acceptance status banner).<br>3. Build the **Interactive Business Calendar Manager** (monthly/weekly grid showing confirmed bookings, pending requests, blocked slots).<br>4. Vibecode the **Post-a-Requirement (Reverse Marketplace)** page where seekers post urgent needs. |
| **⚙️ Aditya** | **Booking Engine & Transactions** | 1. Implement atomic booking creation (`POST /api/bookings`) with PostgreSQL transaction lock to **strictly prevent double-booking**.<br>2. Implement quotation engine (`POST /api/bookings/:id/quote`, `POST /api/bookings/:id/counter-offer`).<br>3. Implement booking state machine transitions (PENDING → QUOTED → NEGOTIATING → ACCEPTED → CONFIRMED → IN_USE → COMPLETED → CANCELLED).<br>4. Implement reverse marketplace requirement posting & bidding APIs (`/api/requirements`, `/api/requirements/:id/offers`). |

**🔥 Day 3 Checkpoint (8:30 PM):** Full booking lifecycle works — seeker requests, provider quotes/counters, calendar updates, and conflicting bookings are blocked.

---

### 📅 DAY 4: AI Concierge, RAG Pipeline & MCP Tool Layer
*Goal: The #1 demo differentiator — autonomous AI agent that searches, compares, and books.*

| Member | Focus Area | Detailed Tasks |
|---|---|---|
| **👑 You (Lead)** | **AI Concierge Chat UI** | 1. Vibecode a floating and fullscreen **AI Concierge Chat Interface** with streaming message bubble effects.<br>2. Build rich **Tool Execution UI Cards** rendered inside chat: Resource Preview Cards, Side-by-Side Comparison Tables, and "1-Click Send Booking Request" action cards.<br>3. Add suggested prompt chips ("Need banquet for 200 in Pune", "Rent 50 chairs tomorrow under ₹5k", "Find industrial ovens").<br>4. Connect frontend chat hook to backend streaming SSE endpoint. |
| **⚙️ Aditya** | **RAG Pipeline, MCP Server & Matching** | 1. Build LangChain / Gemini RAG pipeline: Chunk and embed resource listings into vector database (Pinecone or in-memory vector store).<br>2. Build MCP Tool Server exposing tools: `search_resources`, `check_availability`, `compare_resources`, `create_booking_request`, `get_price_estimate`.<br>3. Implement **Smart Matching Algorithm** with 6 weighted factors (Price: 0.25, Distance: 0.30, Rating: 0.15, Availability: 0.15, Capacity: 0.10, Urgency: 0.05).<br>4. Create `POST /api/chat` orchestrator endpoint combining LLM reasoning + RAG context + MCP tool execution. |

**🔥 Day 4 Checkpoint (8:30 PM):** AI Concierge understands natural language, retrieves real platform resources, shows comparison cards, and creates bookings autonomously.

---

### 📅 DAY 5: Real-Time Chat, Payments & Analytics Dashboards
*Goal: Live WebSockets, Razorpay escrow payment, and business analytics.*

| Member | Focus Area | Detailed Tasks |
|---|---|---|
| **👑 You (Lead)** | **Dashboards & Payment UI** | 1. Vibecode the **Unified Business Dashboard** (revenue metrics, asset utilization gauge, active rentals, pending requests, demand charts).<br>2. Integrate **Razorpay Checkout Modal** on frontend for seamless payment flow.<br>3. Vibecode the **In-App Direct Chat Drawer** between businesses with real-time message stream.<br>4. Vibecode the **Handover Checklist & Digital Inspection Modal** (condition checklist at delivery and return).<br>5. Vibecode the **Multi-Dimensional Review Modal** (Quality, Timeliness, Communication, Condition). |
| **⚙️ Aditya** | **Socket.IO, Razorpay & Analytics APIs** | 1. Set up Socket.IO server for real-time 1-on-1 business messaging and live booking status updates.<br>2. Build Razorpay backend order generation (`POST /api/payments/create-order`) and signature verification route (`POST /api/payments/verify`).<br>3. Implement Escrow state management (funds held → released on return inspection completion).<br>4. Build Analytics aggregation APIs (`GET /api/analytics/business/:id` — revenue trends, utilization rate, category demand).<br>5. Implement Review & Trust Score calculation engine. |

**🔥 Day 5 Checkpoint (8:30 PM):** Real-time messaging works; Razorpay test payment successfully locks booking and updates business analytics.

---

### 📅 DAY 6: End-to-End Integration, Data Seeding & UI Polish
*Goal: Zero broken buttons, rich animations, realistic dataset, seamless end-to-end demo flow.*

| Member | Focus Area | Detailed Tasks |
|---|---|---|
| **👑 You (Lead)** | **UI Polish, Micro-Animations & Tour** | 1. Add sleek micro-interactions, page transition animations, skeleton loaders, and empty states.<br>2. Polish mobile and desktop responsiveness across all pages.<br>3. Build an interactive **Guided Demo Walkthrough Tour** (spotlight tooltips walking judges through the platform).<br>4. Dark/Light mode refinement with high-contrast, premium styling. |
| **⚙️ Aditya** | **Comprehensive Seeding & Backend Polish** | 1. Write and run a master seed script creating 5 realistic business profiles (hotels, caterers, banquet halls, AV rental vendors in Pune/Mumbai) and 35+ rich listings with real photos and specs.<br>2. Seed realistic past bookings, reviews, and analytics history so dashboards look populated and lively.<br>3. Add Redis caching for fast search responses (<50ms).<br>4. Conduct full API sanity testing and error handling audit. |

**🔥 Day 6 Checkpoint (8:30 PM):** Complete user journey works seamlessly from discovery to review with rich, realistic hospitality data.

---

### 📅 DAY 7: Deployment, Presentation, Demo Video & Submission
*Goal: Live production URL, backup local setup, pitch slide deck, and recorded demo.*

| Member | Focus Area | Detailed Tasks |
|---|---|---|
| **👑 You (Lead)** | **Presentation, Pitch & Live Demo** | 1. Create a modern, visually stunning slide deck (Problem, Market Gap, Solution, AI Architecture, Live Demo flow, Business Model).<br>2. Rehearse and stage the live presentation flow.<br>3. Capture final screenshots for documentation. |
| **⚙️ Aditya** | **Production Deployment & Demo Recording** | 1. Deploy Frontend on Vercel and Backend on Render/Railway with Supabase/Neon PostgreSQL.<br>2. Configure production environment variables, CORS, and SSL.<br>3. Record a 3-minute high-definition backup demo video demonstrating the full workflow.<br>4. Finalize repository README with live links, architecture diagrams, and submission documentation. |

---

## 🏗️ 4. Project Structure for 2 Members

```
HostNexus/
├── apps/
│   ├── web/                        # 👑 YOUR DOMAIN (Next.js 15 App Router)
│   │   ├── app/
│   │   │   ├── (auth)/             # Login, Register, Onboarding
│   │   │   ├── (marketplace)/      # Discovery, Map, Resource Details, Post Requirement
│   │   │   ├── (dashboard)/        # Business Portal, Inventory, Calendar, RFQs, Analytics
│   │   │   ├── (ai)/               # AI Concierge Chatbot
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx            # Hero Landing Page
│   │   ├── components/             # Reusable UI components
│   │   │   ├── ui/                 # Buttons, dialogs, inputs, tabs (shadcn)
│   │   │   ├── marketplace/        # ResourceCard, FilterBar, MapView, BookingDrawer
│   │   │   ├── dashboard/          # MetricsCard, CalendarView, QuotationTimeline
│   │   │   └── ai/                 # ChatBox, ToolCards, SuggestionPills
│   │   ├── hooks/                  # TanStack Query & Socket client hooks
│   │   └── lib/                    # API client, Razorpay helper, utils
│   │
│   └── api/                        # ⚙️ ADITYA'S DOMAIN (Express.js + TypeScript)
│       ├── src/
│       │   ├── config/             # DB, Redis, Cloudinary, Gemini configs
│       │   ├── controllers/        # Auth, Resource, Booking, Quote, Chat, Analytics
│       │   ├── services/           # Availability, Matching, RAG, Notification
│       │   ├── mcp/                # MCP Server & Tool Definitions
│       │   ├── sockets/            # Realtime Socket.IO handlers
│       │   ├── middlewares/        # Auth, Validation, Error Handling
│       │   └── server.ts
│       └── prisma/
│           ├── schema.prisma       # Database models
│           ├── migrations/
│           └── seed.ts             # Master demo seed script
│
├── packages/
│   └── types/                      # 🤝 SHARED CONTRACT (Day 1 Morning)
│       └── src/index.ts
│
├── docker-compose.yml              # Local Postgres + Redis
└── plan.md                         # This Master Plan
```

---

## 🔄 5. Daily Git & Sync Cadence

- **Branches:**
  - `feat/fe-<name>`: Your frontend and client integration work.
  - `feat/be-<name>`: Aditya's backend, DB, and AI work.
  - `main`: Clean, integrated, deployable master branch.
- **Daily Checkpoints:**
  - **09:30 AM:** Morning 10-minute kickoff (review daily endpoints & UI targets).
  - **08:30 PM:** Evening sync (merge to `main`, verify end-to-end integration, celebrate progress).

---

## 🚀 6. Next Steps: Immediate Day 1 Kickoff

1. **Step 1:** Scaffold the monorepo structure with `apps/web`, `apps/api`, and `packages/types`.
2. **Step 2:** Write `packages/types/src/index.ts` with all core entity types.
3. **Step 3:** Aditya initializes Prisma + PostgreSQL schema while you build the Next.js 15 Landing Page & Navigation Shell.
