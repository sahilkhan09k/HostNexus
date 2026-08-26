<div align="center">

# 🏨 HostNexus

### **Smart B2B Marketplace for Shared Hospitality Resources**

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js_15-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-010101?style=for-the-badge&logo=socketdotio&logoColor=white)](https://socket.io/)
[![LangChain](https://img.shields.io/badge/LangChain-1C3C3C?style=for-the-badge&logo=langchain&logoColor=white)](https://js.langchain.com/)
[![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)

> **HostNexus** is an AI-powered B2B marketplace that enables hospitality businesses — hotels, restaurants, caterers, banquet venues, resorts, and event organizers — to discover, share, request, negotiate, and coordinate resources with each other in real-time.

**🔗 Live Demo:** [Coming Soon] &nbsp;|&nbsp; **📹 Demo Video:** [Coming Soon] &nbsp;|&nbsp; **📊 Presentation:** [Coming Soon]

</div>

---

## 📋 Table of Contents

- [Problem Statement](#-problem-statement)
- [Our Solution](#-our-solution--hostnexus)
- [Key Features](#-key-features)
- [System Architecture](#-system-architecture)
- [Tech Stack](#-tech-stack)
- [AI & Intelligence Layer](#-ai--intelligence-layer-the-differentiator)
- [Database Design](#-database-design)
- [Feature Modules (Detailed)](#-feature-modules-detailed)
- [Problem Statement Coverage Map](#-problem-statement-coverage-map)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [API Documentation](#-api-documentation)
- [Screenshots](#-screenshots)
- [Future Roadmap](#-future-roadmap)
- [Team](#-team)
- [License](#-license)

---

## 🔍 Problem Statement

> **PS ID — 1: Hospitality Resource Exchange — Smart B2B Marketplace for Shared Resources**

Hospitality businesses such as **hotels, restaurants, caterers, banquet venues, resorts, and event organizers** frequently experience a **resource mismatch**:

- A business may have **unused banquet space, parking capacity, vehicles, kitchen capacity, furniture, audio-visual equipment**, or other resources
- Another business may **urgently need** the same resource for a limited period

### The Current Reality (The Problem)

| Pain Point | Impact |
|---|---|
| Discovery depends on **personal contacts, phone calls, WhatsApp groups, and brokers** | Slow, unreliable, limited reach |
| **No visibility** into what's available nearby | Missed opportunities for both parties |
| **No transparency** on availability windows or pricing | Time wasted on repeated inquiries |
| **No way to verify** if a resource meets specific requirements | Last-minute surprises and failures |
| **Underutilized assets** sitting idle | Revenue loss for providers |
| **Unnecessary rental/procurement costs** | Budget overruns for seekers |
| **Last-minute shortages** during peak demand | Event failures, reputation damage |
| **Inefficient resource management** across businesses | Industry-wide waste |

### What the Hackathon Demands

The platform must support **both sides** of the marketplace:

**Resource Providers** should be able to:
- ✅ List resources with type, quantity, capacity, location, availability, pricing, and conditions
- ✅ Define availability and prevent conflicting bookings
- ✅ Receive and manage requests from other businesses
- ✅ Accept, reject, or negotiate requests

**Resource Seekers** should be able to:
- ✅ Search or post requirements for specific resources
- ✅ Specify quantity, location, date/time, budget, capacity, and other constraints
- ✅ Discover and compare available resources from multiple providers
- ✅ Submit requests and track their status through fulfilment

**Practical Challenges** to address:
- ✅ Real-time availability & scheduling conflicts
- ✅ Location and distance considerations
- ✅ Pricing, quantity, and resource compatibility
- ✅ Minimum rental periods & transportation/logistics
- ✅ Request prioritization & intelligent matching

---

## 💡 Our Solution — HostNexus

**HostNexus** ("Host" = Hospitality + "Nexus" = Central Connection) is a comprehensive **AI-powered B2B marketplace** that transforms how hospitality businesses discover, share, and coordinate resources.

### What Makes HostNexus Different?

```
┌─────────────────────────────────────────────────────────────────┐
│                    🏨 HostNexus Platform                         │
│                                                                  │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐    │
│  │   DISCOVER    │   │    SHARE     │   │     COORDINATE   │    │
│  │              │   │              │   │                  │    │
│  │ • AI Search  │   │ • List       │   │ • Negotiate      │    │
│  │ • Map View   │   │ • Calendar   │   │ • Book           │    │
│  │ • Recommend  │   │ • Price      │   │ • Track          │    │
│  │ • Compare    │   │ • Bundle     │   │ • Review         │    │
│  └──────────────┘   └──────────────┘   └──────────────────┘    │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              🤖 AI CONCIERGE (Agentic Chatbot)            │   │
│  │  "I need 50 chairs near Koregaon Park this Saturday"      │   │
│  │  → Searches → Compares → Checks Availability → Books     │   │
│  │  Powered by: RAG + MCP + Smart Matching + Gemini LLM     │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Value Proposition

| When You Share Resources | When You Need Resources | For the Industry |
|---|---|---|
| 💰 Monetize idle/underutilized assets | 🔍 Discover resources in seconds, not days | 🌍 Reduce industry-wide waste |
| 📊 Utilization analytics & demand insights | 💡 AI-recommended best-fit options | 📈 Enable collaborative economy |
| 🤝 Direct B2B connections, no brokers | 💬 Transparent pricing & negotiation | 🔒 Verified, trusted transactions |
| 📅 Automated calendar & conflict prevention | 📋 Track requests from submission to fulfilment | ⚡ Faster, more efficient operations |

---

## ⭐ Key Features

### 🏗️ Core Marketplace Features

| # | Feature | Description |
|---|---|---|
| 1 | **Unified Business Profiles** | Every registered business can both list resources AND rent resources — one account, full access to the marketplace with verified profiles, GST/PAN, trade licenses |
| 2 | **Rich Resource Listings** | List any hospitality resource with photos, specs, dynamic pricing (hourly/daily/weekly), conditions, and availability calendars |
| 3 | **Smart Discovery & Search** | Full-text search (Meilisearch), advanced multi-filter system, interactive map-based discovery with distance calculation |
| 4 | **Post-a-Requirement (Reverse Marketplace)** | Businesses post what they need → Other businesses bid with quotes — solving the "I don't know who has what" problem |
| 5 | **RFQ & Negotiation Engine** | Multi-provider Request for Quotes, counter-offers, in-app messaging with full negotiation audit trail |
| 6 | **Booking & Conflict Management** | Real-time availability, atomic booking with double-booking prevention, status tracking through entire lifecycle |
| 7 | **Payments & Escrow** | Secure payments via Razorpay (UPI/Cards/Net Banking), escrow for trust, auto-invoicing with GST compliance |
| 8 | **Ratings & Trust System** | Dual reviews, multi-dimensional ratings, trust scores, verified review badges, dispute resolution |
| 9 | **Analytics Dashboards** | Unified dashboard: resource utilization, revenue, demand trends, spending analytics, booking history. Admin: platform-wide KPIs |
| 10 | **Real-time Notifications** | Push, email, SMS, in-app notification center — for every booking lifecycle event |

### 🤖 AI-Powered Differentiators

| # | Feature | Technology | Description |
|---|---|---|---|
| 11 | **AI Smart Matching Engine** | Custom Algorithm | Multi-factor weighted scoring (price, distance, rating, availability, capacity, urgency) to rank resources |
| 12 | **AI Concierge Chatbot** | LangChain + Gemini + MCP | Natural language interface: "I need a banquet for 200 in Pune Saturday" → AI searches, compares, books |
| 13 | **RAG Knowledge Base** | LangChain + Pinecone | AI grounded in actual resource catalog — no hallucinations, answers with real data |
| 14 | **MCP Tool Integration** | Model Context Protocol | AI can perform real actions: check availability, create bookings, fetch quotes autonomously |
| 15 | **Demand Forecasting** | ML Models | Predict upcoming demand by category, location, and season — helping providers prepare |
| 16 | **Dynamic Pricing Suggestions** | AI Analytics | AI-recommended pricing based on demand, competition, and booking patterns |

### 🚀 Extra Differentiators (Beyond PS Requirements)

| # | Feature | Description |
|---|---|---|
| 17 | **Resource Bundling** | Package multiple resources together (e.g., "Wedding Setup" = chairs + tables + tent + AV) |
| 18 | **Handover Checklists** | Digital condition tracking at delivery and return — prevents disputes |
| 19 | **Delivery Cost Estimator** | Auto-calculate transportation costs based on distance, weight, and quantity |
| 20 | **Calendar Sync** | Export bookings to Google Calendar / Outlook |
| 21 | **QR Codes for Resources** | Physical resource tags linking to digital listings |
| 22 | **WhatsApp Integration** | Send booking summaries via WhatsApp Business API |

---

## 🏗️ System Architecture

### High-Level Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                   │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                    Next.js 15 (App Router)                          │  │
│   │                                                                     │  │
│   │  ┌───────────┐  ┌───────────┐  ┌────────────┐  ┌──────────────┐   │  │
│   │  │ Business   │  │ Marketplace│  │  AI Chat   │  │   Admin      │   │  │
│   │  │ Dashboard  │  │   Pages   │  │  Interface │  │   Panel      │   │  │
│   │  └───────────┘  └───────────┘  └────────────┘  └──────────────┘   │  │
│   │                                                                     │  │
│   │  ┌───────────┐  ┌───────────┐  ┌────────────┐  ┌──────────────┐   │  │
│   │  │ AI Chat   │  │  Booking  │  │  Calendar   │  │   Map View   │   │  │
│   │  │ Interface │  │   Flow    │  │   Manager   │  │   Discovery  │   │  │
│   │  └───────────┘  └───────────┘  └────────────┘  └──────────────┘   │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
                │                    │                    │
                │ HTTPS/REST         │ WebSocket          │ Server Actions
                ▼                    ▼                    ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                             API GATEWAY LAYER                               │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                  Express.js + Node.js Backend                       │  │
│   │                                                                     │  │
│   │  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌────────────────┐   │  │
│   │  │ Auth     │  │ Resource │  │  Booking   │  │  Payment       │   │  │
│   │  │ Service  │  │ Service  │  │  Service   │  │  Service       │   │  │
│   │  └──────────┘  └──────────┘  └───────────┘  └────────────────┘   │  │
│   │                                                                     │  │
│   │  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌────────────────┐   │  │
│   │  │ Search   │  │ Chat/    │  │ Notification│ │  Analytics     │   │  │
│   │  │ Service  │  │ Message  │  │  Service   │  │  Service       │   │  │
│   │  └──────────┘  └──────────┘  └───────────┘  └────────────────┘   │  │
│   │                                                                     │  │
│   │  ┌─────────────────── Socket.IO Server ──────────────────────┐    │  │
│   │  │ Real-time: Availability • Chat • Notifications • Status   │    │  │
│   │  └──────────────────────────────────────────────────────────┘    │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
                │                    │                    │
                ▼                    ▼                    ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                          AI / INTELLIGENCE LAYER                            │
│                                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  RAG Pipeline │  │  MCP Server  │  │ Smart Match  │  │  Demand      │  │
│  │  (LangChain)  │  │  (Tools)     │  │  Algorithm   │  │  Forecaster  │  │
│  │               │  │              │  │              │  │              │  │
│  │ Embed catalog │  │ check_avail  │  │ Price:  0.25 │  │ Seasonal     │  │
│  │ Semantic srch │  │ create_book  │  │ Dist:   0.30 │  │ Event-based  │  │
│  │ Context→LLM  │  │ get_quotes   │  │ Rating: 0.15 │  │ Historical   │  │
│  │ Grounded ans │  │ search_res   │  │ Avail:  0.15 │  │ trends       │  │
│  └──────┬───────┘  └──────┬───────┘  │ Cap:    0.10 │  └──────────────┘  │
│         │                  │          │ Urgency:0.05 │                     │
│         ▼                  ▼          └──────────────┘                     │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │          🤖 Agentic AI Chatbot (Orchestrator)                       │  │
│  │  User Intent → Reasoning (LLM) → Planning → Tool Execution (MCP)  │  │
│  │                          ↕ RAG for Knowledge                        │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
                │                    │                    │
                ▼                    ▼                    ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                              DATA LAYER                                     │
│                                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  PostgreSQL   │  │    Redis     │  │  Pinecone/   │  │  Meilisearch │  │
│  │  + Prisma     │  │              │  │  Qdrant      │  │              │  │
│  │               │  │              │  │              │  │              │  │
│  │ • Businesses  │  │ • Cache      │  │ • Resource   │  │ • Full-text  │  │
│  │ • Resources   │  │ • Sessions   │  │   embeddings │  │   search     │  │
│  │ • Bookings    │  │ • Pub/Sub    │  │ • Semantic   │  │ • Faceted    │  │
│  │ • Transactions│  │ • Job Queue  │  │   search     │  │   filtering  │  │
│  │ • Reviews     │  │ • Rate Limit │  │ • RAG store  │  │ • Typo-      │  │
│  │ • Messages    │  │              │  │              │  │   tolerant   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
                │                    │                    │
                ▼                    ▼                    ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL SERVICES                                   │
│                                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Razorpay  │  │ Google   │  │ Gemini / │  │ Resend / │  │Cloudinary│  │
│  │ (Payment) │  │ Maps API │  │ OpenAI   │  │ Twilio   │  │ (Media)  │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
```

### Request Flow — How a Booking Works

```
Seeker                    Platform                    Provider
  │                          │                           │
  ├── Search/Chat ──────────►│                           │
  │                          ├── AI Matching ──►         │
  │                          ├── Search Index ──►        │
  │   ◄── Ranked Results ───┤                           │
  │                          │                           │
  ├── Submit Request ───────►│                           │
  │                          ├── Validate ──►            │
  │                          ├── Check Availability ──►  │
  │                          ├── Notify Provider ───────►│
  │                          │                           │
  │                          │   ◄── Accept/Reject/Quote─┤
  │   ◄── Quote Received ───┤                           │
  │                          │                           │
  ├── Accept Quote ─────────►│                           │
  │                          ├── Lock Calendar ──►       │
  │                          ├── Process Payment ──►     │
  │                          ├── Confirm Booking ───────►│
  │   ◄── Confirmed ────────┤                           │
  │                          │                           │
  │   ◄── Real-time Status ──┤──── Status Updates ──────►│
  │                          │                           │
  ├── Mark Complete ────────►│                           │
  │                          ├── Release Payment ──────►│
  │   ◄── Review Prompt ────┤── Review Prompt ─────────►│
  │                          │                           │
  ├── Leave Review ─────────►│   ◄── Leave Review ──────┤
  │                          │                           │
```

---

## 🧰 Tech Stack

### Complete Technology Map

| Layer | Technology | Purpose | Why This Choice |
|---|---|---|---|
| **Frontend** | Next.js 15 (App Router) | SSR, Server Components, Server Actions | SEO via SSR, streaming UI, React Server Components for performance |
| **Backend** | Express.js + Node.js | REST API, business logic, middleware | Fast, flexible, massive ecosystem, team familiarity |
| **Language** | TypeScript (end-to-end) | Type safety across stack | Shared types between frontend & backend, fewer runtime errors |
| **Primary Database** | PostgreSQL | Relational data store | ACID compliance for bookings/payments, prevents double-booking with constraints |
| **ORM** | Prisma | Database toolkit | Type-safe queries, auto-generated types, migrations, schema management |
| **Cache / Pub-Sub** | Redis | Caching, sessions, real-time sync | Sub-millisecond reads, pub/sub for Socket.IO scaling, BullMQ job queue |
| **Vector Database** | Pinecone / Qdrant | AI embeddings storage | Semantic search for RAG pipeline, resource similarity matching |
| **Search Engine** | Meilisearch | Full-text search | Typo-tolerant, faceted filtering, <50ms response, easy self-hosted |
| **Real-time** | Socket.IO | WebSocket communication | Live availability, real-time chat, booking status broadcasts |
| **Job Queue** | BullMQ (Redis-backed) | Background task processing | Email dispatch, AI matching jobs, scheduled notifications, embedding updates |
| **AI / LLM** | Google Gemini 2.0 | Language model | Reasoning engine for chatbot, embeddings, tool-calling support |
| **RAG Framework** | LangChain.js | AI orchestration | Document loading, embedding, vector search, chain composition |
| **MCP Server** | @modelcontextprotocol/sdk | AI tool integration | Expose platform actions as tools for AI agent to call autonomously |
| **AI Chat UI** | Vercel AI SDK | Streaming chat interface | useChat hook, streaming responses, tool call rendering |
| **Payments** | Razorpay | Payment gateway | UPI, Cards, Net Banking, split payments, GST-compliant invoicing |
| **Maps** | Google Maps Platform | Geolocation & mapping | Map-based discovery, distance matrix, geocoding, place search |
| **Auth** | Auth.js (NextAuth v5) | Authentication | Google OAuth, email magic links, JWT sessions, RBAC middleware |
| **Email** | Resend | Transactional email | React-based email templates, high deliverability, developer-friendly |
| **SMS** | Twilio / MSG91 | SMS notifications | Critical booking alerts, OTP verification |
| **Media Storage** | Cloudinary | Image/video CDN | Upload, transform, optimize images on-the-fly, responsive delivery |
| **Monorepo** | Turborepo | Build system | Shared packages, parallel builds, caching, dependency management |
| **Containerization** | Docker Compose | Development environment | PostgreSQL, Redis, Meilisearch in containers for consistent setup |
| **Validation** | Zod | Schema validation | End-to-end validation for API requests, forms, and database operations |
| **UI Components** | shadcn/ui + Radix | Component library | Accessible, customizable, production-ready components |
| **Styling** | Tailwind CSS | Utility-first CSS | Rapid UI development, consistent design tokens, responsive design |
| **Charts** | Recharts | Dashboard visualizations | Revenue charts, utilization graphs, demand heatmaps |
| **Calendar** | react-big-calendar | Booking calendar UI | Drag-drop scheduling, multi-resource views, timezone support |
| **Forms** | React Hook Form + Zod | Form management | Performant forms, schema-based validation, type inference |
| **State Management** | Zustand + React Query | Client state + server state | Lightweight global state + cached server data with auto-revalidation |

---

## 🤖 AI & Intelligence Layer (The Differentiator)

The AI layer is the core differentiator of HostNexus. It transforms the platform from a "listing directory" into an **intelligent resource coordination system**.

### 1. RAG Pipeline (Retrieval-Augmented Generation)

**Purpose:** Grounds the AI chatbot in actual platform data — preventing hallucinations and ensuring every answer references real resources.

```
┌─────────────────────────────────────────────────────────────────┐
│                      RAG Pipeline Architecture                    │
│                                                                   │
│  ╔═══════════════════════╗         ╔═══════════════════════╗     │
│  ║   DATA INGESTION      ║         ║   QUERY PIPELINE      ║     │
│  ║                       ║         ║                       ║     │
│  ║  Resource Listings ───╬──┐      ║  User Query ──────────╬──┐  │
│  ║  Business Profiles ───╬──┤      ║         │             ║  │  │
│  ║  Platform FAQs    ───╬──┤      ║         ▼             ║  │  │
│  ║  Past Reviews     ───╬──┤      ║  Embedding Model      ║  │  │
│  ║  Booking History  ───╬──┤      ║  (text-embedding-3)   ║  │  │
│  ║                       ║  │      ║         │             ║  │  │
│  ╚═══════════════════════╝  │      ║         ▼             ║  │  │
│                              │      ║  Semantic Search      ║  │  │
│         ┌────────────────────┘      ║  (Pinecone/Qdrant)   ║  │  │
│         ▼                           ║         │             ║  │  │
│  ┌─────────────────┐               ║         ▼             ║  │  │
│  │ Chunking +      │               ║  Top-K Relevant       ║  │  │
│  │ Embedding Model │               ║  Chunks Retrieved     ║  │  │
│  │ (Gemini/OpenAI) │               ║         │             ║  │  │
│  └────────┬────────┘               ║         ▼             ║  │  │
│           ▼                         ║  LLM (Gemini 2.0)    ║  │  │
│  ┌─────────────────┐               ║  + Context Chunks     ║  │  │
│  │  Vector Database │◄──────────────║  + System Prompt      ║  │  │
│  │  (Pinecone)      │               ║         │             ║  │  │
│  └─────────────────┘               ║         ▼             ║  │  │
│                                     ║  Grounded Response    ║  │  │
│                                     ╚═══════════════════════╝  │  │
└─────────────────────────────────────────────────────────────────┘
```

**How it works:**
1. **Ingestion (Nightly Batch):** All resource listings, business profiles, reviews, and FAQs are chunked and embedded into vectors using Gemini's embedding model, then stored in Pinecone
2. **Query Time:** User's natural language query is embedded → semantic search finds top-K relevant chunks → chunks are injected as context into the LLM prompt
3. **Grounded Response:** The LLM generates a response that is factually grounded in real platform data

**Example:**
```
User: "Which venues near Andheri can host 200 guests for a wedding this Saturday under ₹50,000?"

RAG retrieves: 3 relevant venue listings from vector DB
LLM generates: "Based on available listings, here are 3 venues near Andheri:
  1. Royal Banquet Hall - ₹45,000/day, capacity 250, 2.3km away, ★4.5
  2. Garden View Events - ₹38,000/day, capacity 200, 3.1km away, ★4.2
  3. Hotel Prestige Hall - ₹52,000/day (negotiable), capacity 300, 1.8km away, ★4.7
  
  Shall I check availability and send a booking request?"
```

---

### 2. MCP Server (Model Context Protocol)

**Purpose:** Gives the AI agent the ability to **perform real actions** on the platform — not just answer questions, but actually check availability, create bookings, and send messages.

```
┌────────────────────────────────────────────────────────────────┐
│                    MCP Server (Express.js)                       │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    AVAILABLE TOOLS                          │ │
│  │                                                            │ │
│  │  🔧 search_resources(category, location, dates, budget)   │ │
│  │     → Returns matching resources with scores              │ │
│  │                                                            │ │
│  │  🔧 check_availability(resource_id, start_date, end_date) │ │
│  │     → Returns availability status + conflicts             │ │
│  │                                                            │ │
│  │  🔧 get_resource_details(resource_id)                     │ │
│  │     → Returns full resource info with images, specs       │ │
│  │                                                            │ │
│  │  🔧 compare_resources(resource_ids[])                     │ │
│  │     → Returns side-by-side comparison table               │ │
│  │                                                            │ │
│  │  🔧 get_price_estimate(resource_id, duration, quantity)   │ │
│  │     → Returns calculated price with breakdowns            │ │
│  │                                                            │ │
│  │  🔧 create_booking_request(seeker_id, resource_id, ...)   │ │
│  │     → Creates a new booking request in the system         │ │
│  │                                                            │ │
│  │  🔧 get_quotes(requirement_id)                            │ │
│  │     → Returns all quotes received for a requirement       │ │
│  │                                                            │ │
│  │  🔧 send_message(to_business_id, content)                 │ │
│  │     → Sends an in-app message to a business               │ │
│  │                                                            │ │
│  │  🔧 get_booking_status(booking_id)                        │ │
│  │     → Returns current status of a booking                 │ │
│  │                                                            │ │
│  │  🔧 get_nearby_providers(latitude, longitude, radius_km)  │ │
│  │     → Returns providers within radius with resources      │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  Transport: HTTP (Streamable) or stdio                          │
│  Auth: JWT token passthrough from user session                  │
└────────────────────────────────────────────────────────────────┘
```

**Implementation approach:**
```typescript
// MCP Server Tool Definition Example
server.tool(
  "search_resources",
  "Search for hospitality resources based on category, location, dates, and budget",
  {
    category: z.enum(["BANQUET_HALL", "FURNITURE", "VEHICLE", ...]),
    location: z.string().describe("City or area name"),
    start_date: z.string().describe("ISO date string"),
    end_date: z.string().describe("ISO date string"),
    budget_max: z.number().optional(),
    quantity: z.number().optional(),
  },
  async ({ category, location, start_date, end_date, budget_max, quantity }) => {
    // Call internal search service
    const results = await searchService.findResources({
      category, location, start_date, end_date, budget_max, quantity
    });
    // Apply smart matching score
    const ranked = matchingEngine.rank(results, { budget_max, location });
    return { content: [{ type: "text", text: JSON.stringify(ranked) }] };
  }
);
```

---

### 3. Smart Matching Algorithm

**Purpose:** Automatically ranks resources based on how well they match a seeker's requirements, considering multiple weighted factors.

```
┌──────────────────────────────────────────────────────────────┐
│              SMART MATCHING SCORE CALCULATION                  │
│                                                                │
│  Score = Σ (Weight_i × Factor_i)                              │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                                                         │  │
│  │  Factor              Weight   Calculation               │  │
│  │  ──────────────────  ──────   ─────────────────────     │  │
│  │                                                         │  │
│  │  🏷️ Price Score       0.25    1 - (price / budget)      │  │
│  │  📍 Distance Score    0.30    1 - (distance / max_km)   │  │
│  │  ⭐ Rating Score      0.15    rating / 5.0              │  │
│  │  📅 Availability      0.15    1.0 if exact match        │  │
│  │  📦 Capacity Score    0.10    1 if meets qty, else      │  │
│  │                               available_qty / needed    │  │
│  │  ⏰ Urgency Bonus     0.05    1 / days_until_needed     │  │
│  │                                                         │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                │
│  Additional Boosts:                                            │
│  • +0.05 if provider has >95% fulfillment rate                │
│  • +0.03 if provider responded to last request within 1 hour  │
│  • +0.02 if resource was positively reviewed by similar biz   │
│  • -0.10 if provider has active disputes                      │
│                                                                │
│  Personalization Layer:                                        │
│  • Adjust weights based on seeker's historical preferences    │
│  • Collaborative filtering: "Businesses like yours booked..." │
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

---

### 4. Agentic AI Chatbot (The "Concierge")

**Purpose:** An autonomous AI assistant that understands natural language, plans multi-step workflows, and executes them using MCP tools — the **#1 demo feature**.

```
┌────────────────────────────────────────────────────────────────────┐
│                  AGENTIC CHATBOT WORKFLOW                            │
│                                                                      │
│  User: "I need a banquet hall for 200 guests in Pune next           │
│         Saturday, budget around 1 lakh, with AV equipment"           │
│                                                                      │
│  Step 1: INTENT RECOGNITION (LLM)                                   │
│  ┌──────────────────────────────────────────┐                       │
│  │ Intent: SEARCH + BOOK                    │                       │
│  │ Entities:                                │                       │
│  │   - Resource: Banquet Hall               │                       │
│  │   - Capacity: 200 guests                 │                       │
│  │   - Location: Pune                       │                       │
│  │   - Date: Next Saturday (2026-08-30)     │                       │
│  │   - Budget: ₹1,00,000                    │                       │
│  │   - Add-on: AV Equipment                 │                       │
│  └──────────────────────────────────────────┘                       │
│                                                                      │
│  Step 2: PLANNING (LLM Reasoning)                                   │
│  ┌──────────────────────────────────────────┐                       │
│  │ Plan:                                    │                       │
│  │ 1. Search banquet halls in Pune          │                       │
│  │ 2. Filter by capacity ≥ 200             │                       │
│  │ 3. Check availability for Aug 30         │                       │
│  │ 4. Search AV equipment near top results  │                       │
│  │ 5. Compare top 3 options                 │                       │
│  │ 6. Present recommendations              │                       │
│  │ 7. On user approval → create request     │                       │
│  └──────────────────────────────────────────┘                       │
│                                                                      │
│  Step 3: EXECUTION (MCP Tool Calls)                                 │
│  ┌──────────────────────────────────────────┐                       │
│  │ → search_resources("BANQUET_HALL",       │                       │
│  │     "Pune", "2026-08-30", budget=100000) │                       │
│  │   Result: 5 halls found                  │                       │
│  │                                          │                       │
│  │ → check_availability(hall_1, "Aug 30")   │                       │
│  │   Result: ✅ Available                    │                       │
│  │                                          │                       │
│  │ → check_availability(hall_2, "Aug 30")   │                       │
│  │   Result: ❌ Booked                       │                       │
│  │                                          │                       │
│  │ → compare_resources([hall_1, hall_3])     │                       │
│  │   Result: Comparison table               │                       │
│  │                                          │                       │
│  │ → search_resources("AV_EQUIPMENT",       │                       │
│  │     "Pune", "2026-08-30")                │                       │
│  │   Result: 3 AV providers found           │                       │
│  └──────────────────────────────────────────┘                       │
│                                                                      │
│  Step 4: RESPONSE (Streamed to user)                                │
│  ┌──────────────────────────────────────────┐                       │
│  │ "I found 3 available options:            │                       │
│  │                                          │                       │
│  │  1. 🏆 Royal Pune Banquet - ₹85,000     │                       │
│  │     Capacity: 250, Rating: 4.6/5         │                       │
│  │     AV included, 2.1km from city center  │                       │
│  │                                          │                       │
│  │  2. Grand Plaza Hall - ₹92,000           │                       │
│  │     Capacity: 300, Rating: 4.4/5         │                       │
│  │     AV extra ₹5,000, 3.5km away          │                       │
│  │                                          │                       │
│  │  3. Heritage Event Space - ₹78,000       │                       │
│  │     Capacity: 200, Rating: 4.2/5         │                       │
│  │     No AV, nearest provider: ₹8,000      │                       │
│  │                                          │                       │
│  │  Would you like me to send a booking     │                       │
│  │  request to any of these?"               │                       │
│  └──────────────────────────────────────────┘                       │
│                                                                      │
│  Step 5: HUMAN-IN-THE-LOOP                                          │
│  ┌──────────────────────────────────────────┐                       │
│  │ User: "Yes, book option 1 with AV"       │                       │
│  │                                          │                       │
│  │ → create_booking_request(                │                       │
│  │     resource: hall_1,                    │                       │
│  │     date: "2026-08-30",                  │                       │
│  │     add_ons: ["AV Equipment"],           │                       │
│  │     quantity: 1                          │                       │
│  │   )                                      │                       │
│  │ Result: ✅ Request #BK-2834 created       │                       │
│  │                                          │                       │
│  │ "Done! Booking request #BK-2834 has been │                       │
│  │  sent to Royal Pune Banquet. You'll be   │                       │
│  │  notified once they respond."            │                       │
│  └──────────────────────────────────────────┘                       │
└────────────────────────────────────────────────────────────────────┘
```

---

## 🗄️ Database Design

### Entity-Relationship Overview

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│   Business   │ 1───* │   Resource   │ 1───* │ Availability │
│              │       │              │       │              │
│ id           │       │ id           │       │ id           │
│ name         │       │ businessId   │       │ resourceId   │
│ type         │       │ category     │       │ startDate    │
│ email        │       │ title        │       │ endDate      │
│ verified     │       │ description  │       │ isAvailable  │
│ trustScore   │       │ specs (JSON) │       └──────────────┘
│ lat/lng      │       │ images[]     │
└──────┬───────┘       │ pricing      │       ┌──────────────┐
       │               │ quantity     │       │   Message    │
       │               │ lat/lng      │       │              │
       │               │ conditions   │       │ id           │
       │               └──────┬───────┘       │ senderId     │
       │                      │               │ receiverId   │
       │        ┌─────────────┘               │ bookingId    │
       │        │                             │ content      │
       ▼        ▼                             │ timestamp    │
┌──────────────────┐                          └──────────────┘
│ BookingRequest   │                                ▲
│                  │                                │
│ id               │────────────────────────────────┘
│ seekerId         │
│ providerId       │       ┌──────────────┐
│ resourceId       │ 1───* │  Quotation   │
│ quantity         │       │              │
│ startDate        │       │ id           │
│ endDate          │       │ bookingReqId │
│ budget           │       │ amount       │
│ specialRequests  │       │ breakdown    │
│ status           │       │ validUntil   │
└──────┬───────────┘       │ terms        │
       │                   └──────────────┘
       │
       │ 1───*  ┌──────────────┐
       └───────►│ Transaction  │
                │              │       ┌──────────────┐
                │ id           │       │    Review     │
                │ bookingReqId │       │              │
                │ amount       │       │ id           │
                │ type         │       │ reviewerId   │
                │ status       │       │ revieweeId   │
                │ gateway      │       │ resourceId   │
                │ gatewayId    │       │ bookingReqId │
                └──────────────┘       │ rating       │
                                       │ dimensions   │
                                       │ comment      │
                                       │ photos[]     │
                                       └──────────────┘
```

### Core Prisma Schema

```prisma
// ============================================================
// ENUMS
// ============================================================

enum BusinessType {
  HOTEL
  RESTAURANT
  CATERER
  BANQUET_VENUE
  RESORT
  EVENT_ORGANIZER
  EQUIPMENT_VENDOR
  OTHER
}

enum ResourceCategory {
  BANQUET_HALL
  PARKING_SPACE
  VEHICLE
  KITCHEN_FACILITY
  FURNITURE
  AV_EQUIPMENT
  CROCKERY_CUTLERY
  LINEN_TEXTILE
  STAFF_MANPOWER
  COLD_STORAGE
  GENERATOR_POWER
  DECOR_ITEMS
  TENT_CANOPY
  CATERING_EQUIPMENT
  OTHER
}

enum ListingStatus {
  DRAFT
  ACTIVE
  PAUSED
  ARCHIVED
}

enum BookingStatus {
  PENDING          // Seeker submitted request
  QUOTED           // Provider sent a quote
  NEGOTIATING      // Counter-offers in progress
  ACCEPTED         // Both parties agreed
  CONFIRMED        // Payment processed
  IN_USE           // Resource currently in use
  COMPLETED        // Resource returned/event done
  CANCELLED        // Cancelled by either party
  DISPUTED         // Dispute raised
  EXPIRED          // Quote/request expired
}

enum TransactionType {
  BOOKING_PAYMENT
  SECURITY_DEPOSIT
  REFUND
  PLATFORM_COMMISSION
  PAYOUT
}

enum TransactionStatus {
  PENDING
  COMPLETED
  FAILED
  REFUNDED
}

// ============================================================
// MODELS
// ============================================================

model Business {
  id              String         @id @default(cuid())
  name            String
  type            BusinessType
  email           String         @unique
  phone           String
  passwordHash    String
  gstNumber       String?
  panNumber       String?
  tradeLicense    String?        // Document URL
  address         String
  city            String
  state           String
  pincode         String
  latitude        Float
  longitude       Float
  verified        Boolean        @default(false)
  verifiedAt      DateTime?
  trustScore      Float          @default(0)
  profileImage    String?
  coverImage      String?
  description     String?        @db.Text
  specialties     String[]
  certifications  String[]       // Document URLs
  website         String?
  
  // Relations
  resources          Resource[]
  sentRequests       BookingRequest[]   @relation("seeker")
  receivedRequests   BookingRequest[]   @relation("provider")
  reviewsGiven       Review[]           @relation("reviewer")
  reviewsReceived    Review[]           @relation("reviewee")
  sentMessages       Message[]          @relation("sender")
  receivedMessages   Message[]          @relation("receiver")
  requirements       Requirement[]
  notifications      Notification[]
  
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  @@index([city, type])
  @@index([latitude, longitude])
}

model Resource {
  id              String            @id @default(cuid())
  businessId      String
  business        Business          @relation(fields: [businessId], references: [id])
  category        ResourceCategory
  subcategory     String?
  title           String
  description     String            @db.Text
  specifications  Json              // { dimensions, capacity, power, weight, etc. }
  images          String[]
  virtualTourUrl  String?
  
  // Pricing
  pricePerHour    Float?
  pricePerDay     Float?
  pricePerWeek    Float?
  customPricing   Json?             // Peak/off-peak rates, bulk discounts
  negotiable      Boolean           @default(true)
  
  // Inventory
  totalQuantity   Int
  availableQty    Int
  minRentalHours  Int?
  maxRentalDays   Int?
  
  // Location
  location        String
  latitude        Float
  longitude       Float
  deliveryRadius  Float?            // Max delivery distance in km
  
  // Terms
  conditions      Json              // { deposit, cancellation, insurance, transport, setup_time }
  
  status          ListingStatus     @default(ACTIVE)
  viewCount       Int               @default(0)
  bookingCount    Int               @default(0)
  
  // Relations
  availability    Availability[]
  bookings        BookingRequest[]
  reviews         Review[]
  
  // Vector embedding ID for AI search
  embeddingId     String?
  
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  @@index([category, city_implicit])
  @@index([latitude, longitude])
  @@index([businessId])
  @@fulltext([title, description])
}

model Availability {
  id              String    @id @default(cuid())
  resourceId      String
  resource        Resource  @relation(fields: [resourceId], references: [id])
  startDate       DateTime
  endDate         DateTime
  isAvailable     Boolean   @default(true)
  recurrence      String?   // RRULE for recurring patterns
  bufferBefore    Int?      // Minutes of buffer before booking
  bufferAfter     Int?      // Minutes of buffer after booking
  
  createdAt       DateTime  @default(now())

  @@unique([resourceId, startDate, endDate])
  @@index([resourceId, startDate, endDate, isAvailable])
}

model BookingRequest {
  id              String          @id @default(cuid())
  requestNumber   String          @unique @default(cuid()) // Human-readable: BK-XXXX
  
  seekerId        String
  seeker          Business        @relation("seeker", fields: [seekerId], references: [id])
  providerId      String
  provider        Business        @relation("provider", fields: [providerId], references: [id])
  resourceId      String
  resource        Resource        @relation(fields: [resourceId], references: [id])
  
  quantity        Int
  startDate       DateTime
  endDate         DateTime
  budget          Float?
  specialRequests String?         @db.Text
  deliveryMethod  String?         // "SELF_PICKUP", "PROVIDER_DELIVERY", "THIRD_PARTY"
  deliveryAddress String?
  
  status          BookingStatus   @default(PENDING)
  
  // Relations
  quotations      Quotation[]
  messages        Message[]
  transactions    Transaction[]
  reviews         Review[]
  
  cancelledBy     String?
  cancelReason    String?
  cancelledAt     DateTime?
  
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  @@index([seekerId, status])
  @@index([providerId, status])
  @@index([resourceId, startDate, endDate])
}

model Quotation {
  id              String          @id @default(cuid())
  bookingReqId    String
  bookingRequest  BookingRequest  @relation(fields: [bookingReqId], references: [id])
  
  amount          Float
  breakdown       Json            // { base_price, delivery, setup, tax, discount }
  validUntil      DateTime
  terms           String?         @db.Text
  isCounterOffer  Boolean         @default(false)
  
  status          String          @default("PENDING") // PENDING, ACCEPTED, REJECTED, EXPIRED
  
  createdAt       DateTime        @default(now())

  @@index([bookingReqId])
}

model Requirement {
  id              String          @id @default(cuid())
  businessId      String
  business        Business        @relation(fields: [businessId], references: [id])
  
  title           String
  category        ResourceCategory
  description     String          @db.Text
  quantity        Int
  location        String
  latitude        Float?
  longitude       Float?
  startDate       DateTime
  endDate         DateTime
  budgetMin       Float?
  budgetMax       Float?
  specifications  Json?
  
  status          String          @default("OPEN") // OPEN, FULFILLED, CLOSED, EXPIRED
  
  // Providers can respond with offers
  offers          RequirementOffer[]
  
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  @@index([category, status])
  @@index([location])
}

model RequirementOffer {
  id              String          @id @default(cuid())
  requirementId   String
  requirement     Requirement     @relation(fields: [requirementId], references: [id])
  providerId      String
  resourceId      String
  
  proposedPrice   Float
  message         String?         @db.Text
  
  status          String          @default("PENDING") // PENDING, ACCEPTED, REJECTED
  
  createdAt       DateTime        @default(now())

  @@index([requirementId])
}

model Review {
  id              String          @id @default(cuid())
  reviewerId      String
  reviewer        Business        @relation("reviewer", fields: [reviewerId], references: [id])
  revieweeId      String
  reviewee        Business        @relation("reviewee", fields: [revieweeId], references: [id])
  resourceId      String?
  resource        Resource?       @relation(fields: [resourceId], references: [id])
  bookingReqId    String?
  bookingRequest  BookingRequest? @relation(fields: [bookingReqId], references: [id])
  
  overallRating   Float           // 1.0 - 5.0
  dimensions      Json            // { quality, timeliness, communication, value, condition }
  comment         String?         @db.Text
  photos          String[]
  
  isVerified      Boolean         @default(true) // Only from completed bookings
  
  createdAt       DateTime        @default(now())

  @@unique([reviewerId, bookingReqId])
  @@index([revieweeId])
  @@index([resourceId])
}

model Message {
  id              String          @id @default(cuid())
  senderId        String
  sender          Business        @relation("sender", fields: [senderId], references: [id])
  receiverId      String
  receiver        Business        @relation("receiver", fields: [receiverId], references: [id])
  bookingReqId    String?
  bookingRequest  BookingRequest? @relation(fields: [bookingReqId], references: [id])
  
  content         String          @db.Text
  attachments     String[]        // File URLs
  isRead          Boolean         @default(false)
  
  createdAt       DateTime        @default(now())

  @@index([senderId, receiverId])
  @@index([bookingReqId])
}

model Transaction {
  id              String            @id @default(cuid())
  bookingReqId    String
  bookingRequest  BookingRequest    @relation(fields: [bookingReqId], references: [id])
  
  type            TransactionType
  amount          Float
  currency        String            @default("INR")
  status          TransactionStatus @default(PENDING)
  
  gatewayName     String            // "RAZORPAY", "STRIPE"
  gatewayOrderId  String?
  gatewayPayId    String?
  gatewaySignature String?
  
  metadata        Json?             // Gateway-specific data
  
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  @@index([bookingReqId])
  @@index([gatewayOrderId])
}

model Notification {
  id              String    @id @default(cuid())
  businessId      String
  business        Business  @relation(fields: [businessId], references: [id])
  
  type            String    // BOOKING_REQUEST, QUOTE_RECEIVED, PAYMENT, REVIEW, SYSTEM
  title           String
  message         String
  link            String?   // Deep link to relevant page
  isRead          Boolean   @default(false)
  
  createdAt       DateTime  @default(now())

  @@index([businessId, isRead, createdAt])
}
```

---

## 📦 Feature Modules (Detailed)

### Module 1: Authentication & Business Onboarding

> **Design Decision:** Every business gets a **unified account** — no provider/seeker role selection. Once registered and verified, any business can both **list resources for sharing** and **rent resources from others**.

| Feature | Description | Priority |
|---|---|---|
| **Unified Registration** | Single registration flow for all businesses — every account gets full access to both list and rent resources | 🔴 Must |
| **Business Verification** | GST/PAN verification, trade license upload, physical address proof | 🔴 Must |
| **KYC Document Upload** | ID verification for authorized representatives | 🟡 Should |
| **Business Profile Builder** | Company name, type (Hotel/Restaurant/Caterer/Banquet/Resort/Event Org), capacity, specialties, photos, certifications | 🔴 Must |
| **OAuth + Magic Link Auth** | Google/Email-based SSO for fast onboarding | 🔴 Must |
| **Role-Based Access Control** | Admin, Manager, Staff roles within a single business account (internal team hierarchy, not provider/seeker split) | 🟡 Should |
| **Onboarding Wizard** | Guided multi-step setup with progress tracking | 🟡 Should |

### Module 2: Resource Listing & Management (Share Your Resources)

| Feature | Description | Priority |
|---|---|---|
| **Resource Categories** | Predefined taxonomy: Banquet Halls, Parking Spaces, Vehicles, Kitchen/Cooking Facilities, Furniture, AV Equipment, Crockery/Cutlery, Linen, Staff/Manpower, Cold Storage, Generators, Decor Items, Tents/Canopies, Catering Equipment | 🔴 Must |
| **Rich Listing Creator** | Title, description, high-res photos (multi-upload), 360° virtual tour links, specifications (dimensions, capacity, power requirements) | 🔴 Must |
| **Dynamic Pricing Engine** | Base price, hourly/daily/weekly rates, peak/off-peak pricing, bulk discounts, negotiable flag | 🔴 Must |
| **Availability Calendar** | Interactive calendar with date-range blocking, recurring availability patterns, blackout dates, minimum rental period enforcement | 🔴 Must |
| **Condition & Terms** | Security deposit, cancellation policy, damage liability, insurance requirements, transportation included/excluded, setup/teardown time buffers | 🔴 Must |
| **Inventory Quantity Tracking** | Track total units, available units, booked units in real-time | 🔴 Must |
| **Resource Bundling** | Create packages (e.g., "Wedding Setup Bundle" = 200 chairs + 20 tables + 1 tent + AV system) | 🟢 Nice |
| **Listing Templates** | Save and reuse listing configurations for frequently shared resources | 🟡 Should |
| **Photo AI Auto-Tagging** | Automatically tag/categorize uploaded resource images using AI | 🟢 Nice |
| **QR Code for Resources** | Generate QR codes for physical resource tags linking to their digital listing | 🟢 Nice |

### Module 3: Discovery & Search (Find Resources You Need)

| Feature | Description | Priority |
|---|---|---|
| **Smart Search Bar** | Full-text search with auto-suggestions, typo tolerance, synonym handling | 🔴 Must |
| **Advanced Filters** | Category, sub-category, location/radius, date range, price range, quantity, capacity, rating, availability status | 🔴 Must |
| **Map-Based Discovery** | Interactive map showing nearby resources with cluster markers, distance calculation | 🔴 Must |
| **AI-Powered Recommendations** | "You might also need..." suggestions based on event type, past bookings, and similar business profiles | 🔴 Must |
| **Saved Searches & Alerts** | Save filter combinations and get notified when matching resources are listed | 🟡 Should |
| **Compare Resources** | Side-by-side comparison of up to 3-4 resources on specs, pricing, reviews | 🟡 Should |
| **Post a Requirement** | "Reverse marketplace" — businesses post what they need, other businesses can respond with offers | 🔴 Must |
| **Wishlist / Shortlist** | Save resources for later consideration | 🟡 Should |
| **Sort by Smart Score** | AI-ranked results considering price, distance, rating, availability, urgency, and business preferences | 🔴 Must |
| **Nearby & Trending** | Show trending resources in the area and recently popular categories | 🟢 Nice |

### Module 4: Request, Negotiation & Booking

| Feature | Description | Priority |
|---|---|---|
| **Request Submission** | Detailed request form: resource, quantity, dates, delivery/pickup preference, special requirements, budget range | 🔴 Must |
| **Multi-Provider RFQ** | Send a single request to multiple providers for competitive quotes | 🔴 Must |
| **Real-Time Chat/Messaging** | In-app messaging between provider and seeker with file/image sharing | 🔴 Must |
| **Quotation System** | Providers generate formal quotes with itemized pricing, validity period, terms | 🔴 Must |
| **Counter-Offer Negotiation** | Back-and-forth negotiation thread on price, terms, dates with full audit trail | 🔴 Must |
| **Instant Booking** | For standardized resources with fixed pricing — one-click book | 🟡 Should |
| **Booking Confirmation Workflow** | Provider reviews → Accepts/Rejects/Counters → Seeker confirms → Booking finalized | 🔴 Must |
| **Conflict Detection** | Auto-detect and prevent double-booking or overbooking with real-time calendar sync | 🔴 Must |
| **Request Status Tracking** | Full lifecycle: Submitted → Under Review → Quoted → Negotiating → Accepted → Confirmed → In-Use → Completed → Reviewed | 🔴 Must |
| **Automated Reminders** | Upcoming booking reminders, pending response alerts, expiring quote notifications | 🟡 Should |
| **Cancellation Management** | Policy-based cancellation with automatic refund calculation | 🟡 Should |

### Module 5: Payments & Financial Management

| Feature | Description | Priority |
|---|---|---|
| **Secure Payment Gateway** | Razorpay/Stripe integration for deposits, partial payments, full payments | 🔴 Must |
| **Escrow System** | Hold payment until resource delivery is confirmed by both parties | 🟡 Should |
| **Split Payments** | Platform commission auto-deduction before provider payout | 🟡 Should |
| **Invoice Generation** | GST-compliant auto-generated invoices with download/email options | 🔴 Must |
| **Multiple Payment Modes** | UPI, Net Banking, Cards, Wallet, Credit terms for verified businesses | 🟡 Should |
| **Security Deposit Handling** | Collect, hold, and release security deposits with damage claim workflow | 🟡 Should |
| **Transaction History** | Complete ledger of all payments, refunds, and pending amounts | 🔴 Must |
| **Revenue Dashboard** | Monthly/quarterly earnings, top-performing resources, payout schedule | 🟡 Should |

### Module 6: Ratings, Reviews & Trust

| Feature | Description | Priority |
|---|---|---|
| **Dual Reviews** | Both the listing business and the renting business rate each other post-transaction | 🔴 Must |
| **Multi-Dimensional Ratings** | Rate on: Resource Quality, Timeliness, Communication, Value for Money, Condition | 🔴 Must |
| **Verified Review Badges** | Only businesses with completed transactions can leave reviews | 🔴 Must |
| **Trust Score / Reputation System** | Aggregate score based on reviews, response time, completion rate, verification status | 🟡 Should |
| **Dispute Resolution** | In-app dispute filing with platform mediation workflow | 🟡 Should |
| **Photo Reviews** | Attach photos of actual resource condition at delivery/return | 🟢 Nice |

### Module 7: Analytics & Dashboards

| Feature | Description | Priority |
|---|---|---|
| **Unified Business Dashboard** | Combined view: resource utilization rate, booking frequency, revenue per resource, peak demand periods, spending analytics, frequently booked categories, upcoming bookings (both as lister and renter) | 🔴 Must |
| **Platform Admin Dashboard** | Total transactions, active users, revenue, category performance, geographic distribution | 🔴 Must |
| **Demand Forecasting** | AI-predicted demand trends by category, location, and season | 🟢 Nice |
| **Resource Utilization Reports** | Idle vs. booked time analysis with optimization suggestions | 🟡 Should |
| **Competitive Pricing Insights** | How your pricing compares to similar listings in your area | 🟢 Nice |

### Module 8: Notifications & Communication

| Feature | Description | Priority |
|---|---|---|
| **Push Notifications** | Real-time alerts for new requests, quotes, booking status changes, messages | 🔴 Must |
| **Email Notifications** | Templated emails for booking confirmations, reminders, receipts | 🔴 Must |
| **SMS Alerts** | Critical notifications via SMS (booking confirmed, payment received) | 🟡 Should |
| **In-App Notification Center** | Centralized feed of all activity with read/unread status | 🔴 Must |
| **WhatsApp Integration** | Send booking summaries and reminders via WhatsApp Business API | 🟢 Nice |

### Module 9: AI & Intelligent Features

| Feature | Description | Priority |
|---|---|---|
| **AI Smart Matching Engine** | Multi-factor weighted scoring (price, distance, rating, availability, capacity, urgency) to rank resources | 🔴 Must |
| **AI Concierge Chatbot** | Natural language interface with autonomous action execution via MCP | 🔴 Must |
| **RAG Knowledge Base** | AI grounded in actual resource catalog — no hallucinations | 🔴 Must |
| **MCP Tool Integration** | Expose platform actions as tools for AI agent | 🔴 Must |
| **Demand Prediction** | Predict high-demand resources by category, location, season | 🟡 Should |
| **Dynamic Pricing Suggestions** | AI-recommended pricing based on demand and competition | 🟡 Should |
| **Auto-Categorization** | Automatically categorize and tag new resource listings | 🟡 Should |
| **Anomaly Detection** | Flag suspicious listings, fake reviews, unusual patterns | 🟢 Nice |

### Module 10: Calendar & Scheduling

| Feature | Description | Priority |
|---|---|---|
| **Interactive Booking Calendar** | Visual calendar with drag-drop management for all bookings | 🔴 Must |
| **Multi-Resource Calendar View** | See availability across all listed resources in one view | 🟡 Should |
| **Buffer Time Management** | Automatic gap between bookings for setup/teardown | 🟡 Should |
| **Recurring Availability** | Set resources as available on specific day patterns | 🟡 Should |
| **Calendar Sync** | Export/sync with Google Calendar, Outlook | 🟢 Nice |
| **Timezone Support** | Store in UTC, display in local timezone | 🔴 Must |

### Module 11: Logistics & Coordination

| Feature | Description | Priority |
|---|---|---|
| **Delivery/Pickup Coordination** | Specify self-pickup, provider-delivered, or third-party logistics | 🟡 Should |
| **Distance Calculator** | Show distance between provider and seeker locations | 🔴 Must |
| **Delivery Cost Estimator** | Auto-calculate transportation costs based on distance, weight, quantity | 🟡 Should |
| **Handover Checklist** | Digital checklist for resource condition at delivery and return | 🟡 Should |
| **Live Tracking** | GPS tracking for resource delivery/pickup | 🟢 Nice |

### Module 12: Admin & Platform Management

| Feature | Description | Priority |
|---|---|---|
| **Business Verification Queue** | Admin workflow to review and approve registrations | 🔴 Must |
| **Content Moderation** | Review and approve/flag listings and reviews | 🔴 Must |
| **Commission Management** | Configure platform commission rates by category | 🟡 Should |
| **User Management** | View, edit, suspend, or delete user accounts | 🔴 Must |
| **Category & Taxonomy Management** | Add/edit resource categories and subcategories | 🔴 Must |
| **System Health Monitoring** | Uptime, error rates, API latency monitoring | 🟢 Nice |
| **Audit Logs** | Complete trail of all admin and system actions | 🟡 Should |

---

## ✅ Problem Statement Coverage Map

Every single requirement from the PS is mapped to a specific feature in HostNexus:

### Core Problems Solved

| Problem from PS | HostNexus Solution | Module |
|---|---|---|
| Resource mismatch between businesses | Smart Matching Engine + Post-a-Requirement (reverse marketplace) | 3, 9 |
| Unused banquet space, parking, vehicles, kitchen, furniture, AV | 14-category resource taxonomy covering ALL mentioned resource types | 2 |
| Dependent on personal contacts, phone calls, WhatsApp, brokers | Entire digital marketplace replaces informal channels | All |
| Difficulty knowing what's available nearby | Map-Based Discovery + Meilisearch + Distance Calculator | 3, 11 |
| Unknown availability windows | Real-time Availability Calendar with live updates via Socket.IO | 10 |
| Opaque pricing | Transparent Dynamic Pricing Engine with hourly/daily/weekly rates | 2 |
| Can't verify if resource meets requirements | Advanced Filters + Specifications + Compare + AI Matching | 3, 9 |
| Underutilized assets | Resource Utilization Analytics + Demand Forecasting | 7, 9 |
| Unnecessary rental/procurement costs | Multi-Provider RFQ for competitive pricing | 4 |
| Last-minute shortages | Demand Prediction + Saved Search Alerts + AI Recommendations | 9, 3 |
| Inefficient resource management | Unified Business Dashboard + Calendar Management + Analytics | 7, 10 |

### Provider-Side Requirements (All ✅)

| PS Requirement | Feature | Status |
|---|---|---|
| List resources with type, quantity, capacity, location, availability, pricing, conditions | Rich Listing Creator + Dynamic Pricing + Conditions + Availability Calendar | ✅ |
| Define availability and prevent conflicting bookings | Availability Calendar + Conflict Detection + PostgreSQL constraints | ✅ |
| Receive and manage requests | Business Dashboard (Incoming Requests tab) + Booking Request Flow | ✅ |
| Accept, reject, or negotiate requests | Booking Confirmation Workflow + Counter-Offer Negotiation | ✅ |

### Seeker-Side Requirements (All ✅)

| PS Requirement | Feature | Status |
|---|---|---|
| Search or post requirements | Smart Search + Post-a-Requirement (reverse marketplace) | ✅ |
| Specify quantity, location, date/time, budget, capacity, constraints | Request Submission form with all specified fields | ✅ |
| Discover and compare from multiple providers | Compare Resources + Multi-Provider RFQ | ✅ |
| Submit requests and track through fulfilment | Request Status Tracking (10-stage lifecycle) | ✅ |

### Practical Challenges (All ✅)

| Challenge from PS | Solution | Technology |
|---|---|---|
| Real-time availability | Live calendar updates | Socket.IO + Redis Pub/Sub |
| Scheduling conflicts | Atomic booking + conflict detection | PostgreSQL UNIQUE + SELECT FOR UPDATE |
| Location and distance | Map view + distance calculator | Google Maps API + PostGIS |
| Pricing | Dynamic pricing + RFQ | Custom pricing engine |
| Quantity | Inventory tracking | Available vs. total qty tracking |
| Resource compatibility | Detailed specs + AI matching | JSON specs + weighted scoring |
| Minimum rental periods | minRentalHours field enforcement | Database constraint + validation |
| Transportation/logistics | Delivery coordination module | Logistics Module (11) |
| Request prioritization | Smart Match scoring | Multi-factor weighted algorithm |

### Intelligent Matching (All ✅)

| Factor from PS | Smart Match Score Weight | Implementation |
|---|---|---|
| Price | 0.25 | 1 - (price / budget) |
| Distance | 0.30 | 1 - (distance / max_radius) |
| Availability | 0.15 | 1.0 if exact date match |
| Suitability | 0.10 | Capacity/quantity match score |
| Urgency | 0.05 | 1 / days_until_needed |
| Business preferences | 0.15 | Rating + historical behavior + collaborative filtering |

### Additional Features from PS (All ✅)

| Feature Mentioned | HostNexus Module | Status |
|---|---|---|
| Business profiles | Module 1 — Business Profile Builder | ✅ |
| Ratings and reviews | Module 6 — Dual Reviews + Trust Score | ✅ |
| Quotation requests | Module 4 — Multi-Provider RFQ + Quotation System | ✅ |
| Negotiation | Module 4 — Counter-Offer Negotiation | ✅ |
| Notifications | Module 8 — Push + Email + SMS + In-App | ✅ |
| Booking calendars | Module 10 — Interactive Booking Calendar | ✅ |
| Transaction tracking | Module 5 — Transaction History + Ledger | ✅ |
| Resource utilization analytics | Module 7 — Utilization Reports + Dashboards | ✅ |
| Dashboards | Module 7 — Provider + Seeker + Admin Dashboards | ✅ |

### 🌟 Extra Differentiators (Beyond PS)

| # | Differentiator | Competitive Advantage |
|---|---|---|
| 1 | **AI Agentic Chatbot with MCP** | Natural language booking — no other platform does this for B2B hospitality |
| 2 | **RAG-Powered Knowledge Base** | AI answers grounded in real data, not hallucinations |
| 3 | **Reverse Marketplace** | Seekers post needs → Providers compete with offers |
| 4 | **Resource Bundling** | Package multiple resources for event-based bookings |
| 5 | **Escrow Payments** | Trust mechanism for B2B transactions |
| 6 | **Demand Forecasting** | Predict future resource demand using ML |
| 7 | **Trust / Reputation Score** | Beyond simple star ratings — composite business reliability score |
| 8 | **Handover Checklists** | Digital condition tracking at delivery and return |
| 9 | **WhatsApp Integration** | Meet businesses where they already communicate |
| 10 | **QR Codes** | Physical-digital bridge for resource inventory |

---

## 📁 Project Structure

```
hostnexus/
│
├── 📁 apps/
│   ├── 📁 web/                              # Next.js 15 Frontend (App Router)
│   │   ├── 📁 app/
│   │   │   ├── 📁 (auth)/                   # Authentication Pages
│   │   │   │   ├── login/                    #   Login page
│   │   │   │   ├── register/                 #   Multi-step registration
│   │   │   │   ├── verify/                   #   Email/phone verification
│   │   │   │   └── onboarding/               #   Business profile setup wizard
│   │   │   │
│   │   │   ├── 📁 (dashboard)/               # Protected Dashboard Routes (Unified)
│   │   │   │   ├── overview/                 #   Unified business dashboard
│   │   │   │   ├── 📁 listings/              #   Share: Manage your resource listings
│   │   │   │   │   ├── page.tsx              #     All your listings
│   │   │   │   │   ├── new/                  #     Create new listing
│   │   │   │   │   └── [id]/edit/            #     Edit existing listing
│   │   │   │   ├── 📁 explore/               #   Rent: Search & discover resources
│   │   │   │   │   └── page.tsx              #     Marketplace exploration
│   │   │   │   ├── 📁 requirements/          #   Rent: Post & manage requirements
│   │   │   │   │   ├── page.tsx              #     Your requirements
│   │   │   │   │   └── new/                  #     Post new requirement
│   │   │   │   ├── 📁 bookings/              #   All bookings (as lister & renter)
│   │   │   │   │   └── page.tsx              #     Unified booking management
│   │   │   │   ├── calendar/                 #   Availability calendar manager
│   │   │   │   ├── analytics/                #   Revenue, utilization & spending
│   │   │   │   ├── messages/                 #   All conversations
│   │   │   │   ├── reviews/                  #   Reviews given & received
│   │   │   │   ├── shortlist/                #   Saved/wishlisted resources
│   │   │   │   ├── profile/                  #   Business profile settings
│   │   │   │   └── notifications/            #   Notification center
│   │   │   │
│   │   │   ├── 📁 (marketplace)/             # Public Marketplace Pages
│   │   │   │   ├── resources/                #   Browse all resources
│   │   │   │   ├── resources/[id]/           #   Resource detail page
│   │   │   │   ├── map/                      #   Map-based discovery view
│   │   │   │   ├── compare/                  #   Resource comparison page
│   │   │   │   ├── categories/               #   Browse by category
│   │   │   │   └── requirements/             #   Public requirement board
│   │   │   │
│   │   │   ├── 📁 admin/                     # Platform Admin Panel
│   │   │   │   ├── dashboard/                #   Admin KPI dashboard
│   │   │   │   ├── verifications/            #   Business verification queue
│   │   │   │   ├── moderation/               #   Content moderation
│   │   │   │   ├── users/                    #   User management
│   │   │   │   ├── categories/               #   Category management
│   │   │   │   ├── transactions/             #   Transaction monitoring
│   │   │   │   └── settings/                 #   Platform settings
│   │   │   │
│   │   │   ├── 📁 chat/                      # AI Chatbot Interface
│   │   │   │   └── page.tsx                  #   Full-page AI concierge
│   │   │   │
│   │   │   ├── 📁 api/                       # Next.js API Routes (BFF)
│   │   │   │   ├── auth/                     #   Auth endpoints
│   │   │   │   ├── chat/                     #   AI chat streaming endpoint
│   │   │   │   └── webhooks/                 #   Payment webhooks
│   │   │   │
│   │   │   ├── layout.tsx                    # Root layout
│   │   │   ├── page.tsx                      # Landing page
│   │   │   └── globals.css                   # Global styles
│   │   │
│   │   ├── 📁 components/                    # Shared UI Components
│   │   │   ├── ui/                           #   shadcn/ui base components
│   │   │   ├── layout/                       #   Header, Footer, Sidebar, Nav
│   │   │   ├── resources/                    #   ResourceCard, ResourceGrid, ResourceDetail
│   │   │   ├── booking/                      #   BookingForm, BookingStatus, BookingCard
│   │   │   ├── calendar/                     #   AvailabilityCalendar, BookingCalendar
│   │   │   ├── chat/                         #   ChatBubble, ChatInput, ChatWindow
│   │   │   ├── map/                          #   MapView, MapMarker, MapSearch
│   │   │   ├── dashboard/                    #   StatsCard, Charts, Tables
│   │   │   ├── reviews/                      #   ReviewCard, RatingStars, ReviewForm
│   │   │   └── common/                       #   Loaders, Modals, Toasts, Empty States
│   │   │
│   │   ├── 📁 lib/                           # Utilities & Configuration
│   │   │   ├── api.ts                        #   API client (fetch wrapper)
│   │   │   ├── auth.ts                       #   Auth.js configuration
│   │   │   ├── socket.ts                     #   Socket.IO client setup
│   │   │   ├── utils.ts                      #   Helper functions
│   │   │   └── validations.ts                #   Zod schemas (shared)
│   │   │
│   │   ├── 📁 hooks/                         # Custom React Hooks
│   │   │   ├── useSocket.ts                  #   Socket.IO connection hook
│   │   │   ├── useBooking.ts                 #   Booking state management
│   │   │   ├── useSearch.ts                  #   Search with debounce
│   │   │   └── useNotifications.ts           #   Real-time notifications
│   │   │
│   │   ├── 📁 stores/                        # Zustand State Stores
│   │   │   ├── authStore.ts                  #   User/business auth state
│   │   │   ├── chatStore.ts                  #   Chat state
│   │   │   └── notificationStore.ts          #   Notification state
│   │   │
│   │   ├── next.config.ts                    # Next.js configuration
│   │   ├── tailwind.config.ts                # Tailwind CSS configuration
│   │   ├── tsconfig.json                     # TypeScript configuration
│   │   └── package.json
│   │
│   └── 📁 server/                            # Express.js Backend
│       ├── 📁 src/
│       │   ├── 📁 controllers/               # Route Handlers
│       │   │   ├── auth.controller.ts        #   Auth: login, register, verify
│       │   │   ├── business.controller.ts    #   Business profile CRUD
│       │   │   ├── resource.controller.ts    #   Resource listing CRUD
│       │   │   ├── booking.controller.ts     #   Booking request lifecycle
│       │   │   ├── search.controller.ts      #   Search & discovery
│       │   │   ├── payment.controller.ts     #   Payment processing
│       │   │   ├── review.controller.ts      #   Reviews & ratings
│       │   │   ├── message.controller.ts     #   In-app messaging
│       │   │   ├── notification.controller.ts#   Notification management
│       │   │   ├── requirement.controller.ts #   Requirement posting & offers
│       │   │   ├── analytics.controller.ts   #   Dashboard data
│       │   │   └── admin.controller.ts       #   Admin operations
│       │   │
│       │   ├── 📁 services/                  # Business Logic Layer
│       │   │   ├── auth.service.ts
│       │   │   ├── business.service.ts
│       │   │   ├── resource.service.ts
│       │   │   ├── booking.service.ts
│       │   │   ├── search.service.ts
│       │   │   ├── payment.service.ts
│       │   │   ├── review.service.ts
│       │   │   ├── notification.service.ts
│       │   │   ├── analytics.service.ts
│       │   │   └── availability.service.ts   #   Calendar & conflict logic
│       │   │
│       │   ├── 📁 middleware/                # Express Middleware
│       │   │   ├── auth.middleware.ts        #   JWT verification
│       │   │   ├── rbac.middleware.ts        #   Role-based access control
│       │   │   ├── validation.middleware.ts  #   Zod request validation
│       │   │   ├── rateLimiter.middleware.ts #   Redis-based rate limiting
│       │   │   ├── upload.middleware.ts      #   Cloudinary file upload
│       │   │   └── error.middleware.ts       #   Global error handler
│       │   │
│       │   ├── 📁 routes/                    # API Route Definitions
│       │   │   ├── auth.routes.ts
│       │   │   ├── business.routes.ts
│       │   │   ├── resource.routes.ts
│       │   │   ├── booking.routes.ts
│       │   │   ├── search.routes.ts
│       │   │   ├── payment.routes.ts
│       │   │   ├── review.routes.ts
│       │   │   ├── message.routes.ts
│       │   │   ├── requirement.routes.ts
│       │   │   ├── analytics.routes.ts
│       │   │   ├── admin.routes.ts
│       │   │   └── index.ts                  #   Route aggregator
│       │   │
│       │   ├── 📁 socket/                    # Socket.IO Event Handlers
│       │   │   ├── index.ts                  #   Socket server setup
│       │   │   ├── availability.socket.ts    #   Real-time availability events
│       │   │   ├── chat.socket.ts            #   Real-time messaging
│       │   │   ├── booking.socket.ts         #   Booking status broadcasts
│       │   │   └── notification.socket.ts    #   Push notification delivery
│       │   │
│       │   ├── 📁 jobs/                      # BullMQ Background Jobs
│       │   │   ├── email.job.ts              #   Send transactional emails
│       │   │   ├── sms.job.ts                #   Send SMS notifications
│       │   │   ├── embedding.job.ts          #   Update resource embeddings
│       │   │   ├── matching.job.ts           #   Run matching for requirements
│       │   │   ├── reminder.job.ts           #   Scheduled booking reminders
│       │   │   ├── analytics.job.ts          #   Compute weekly analytics
│       │   │   └── cleanup.job.ts            #   Expire old quotes/requests
│       │   │
│       │   ├── 📁 ai/                        # AI / Intelligence Layer
│       │   │   ├── 📁 matching/              #   Smart Matching Engine
│       │   │   │   ├── scorer.ts             #     Multi-factor scoring
│       │   │   │   ├── weights.ts            #     Weight configuration
│       │   │   │   └── personalization.ts    #     Collaborative filtering
│       │   │   │
│       │   │   ├── 📁 rag/                   #   RAG Pipeline
│       │   │   │   ├── embedder.ts           #     Document embedding
│       │   │   │   ├── retriever.ts          #     Semantic search
│       │   │   │   ├── chain.ts              #     LLM chain with context
│       │   │   │   └── ingestor.ts           #     Batch ingestion job
│       │   │   │
│       │   │   ├── 📁 mcp/                   #   MCP Server
│       │   │   │   ├── server.ts             #     MCP server setup
│       │   │   │   ├── tools.ts              #     Tool definitions
│       │   │   │   └── transport.ts          #     HTTP/stdio transport
│       │   │   │
│       │   │   └── 📁 chatbot/               #   Agentic Chatbot
│       │   │       ├── agent.ts              #     Agent orchestrator
│       │   │       ├── prompts.ts            #     System prompts
│       │   │       └── memory.ts             #     Conversation memory (Redis)
│       │   │
│       │   ├── 📁 utils/                     # Shared Utilities
│       │   │   ├── logger.ts                 #   Winston logger
│       │   │   ├── geo.ts                    #   Distance calculations
│       │   │   ├── pricing.ts                #   Price calculation helpers
│       │   │   ├── invoice.ts                #   Invoice PDF generation
│       │   │   └── constants.ts              #   App-wide constants
│       │   │
│       │   ├── 📁 config/                    # Configuration
│       │   │   ├── database.ts               #   Prisma client
│       │   │   ├── redis.ts                  #   Redis client
│       │   │   ├── meilisearch.ts            #   Meilisearch client
│       │   │   ├── cloudinary.ts             #   Cloudinary setup
│       │   │   ├── razorpay.ts               #   Razorpay setup
│       │   │   └── env.ts                    #   Environment variables (Zod)
│       │   │
│       │   └── app.ts                        # Express app entry point
│       │
│       ├── 📁 prisma/
│       │   ├── schema.prisma                 # Database schema
│       │   ├── seed.ts                       # Database seeder
│       │   └── 📁 migrations/               # Auto-generated migrations
│       │
│       ├── tsconfig.json
│       └── package.json
│
├── 📁 packages/                              # Shared Packages (Monorepo)
│   ├── 📁 shared-types/                      # Shared TypeScript Types
│   │   ├── src/
│   │   │   ├── business.types.ts
│   │   │   ├── resource.types.ts
│   │   │   ├── booking.types.ts
│   │   │   ├── api.types.ts                  #   API request/response shapes
│   │   │   └── index.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── 📁 validations/                       # Shared Zod Schemas
│   │   ├── src/
│   │   │   ├── resource.schema.ts
│   │   │   ├── booking.schema.ts
│   │   │   ├── auth.schema.ts
│   │   │   └── index.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── 📁 ui/                               # Shared UI Components (optional)
│       ├── src/
│       ├── tsconfig.json
│       └── package.json
│
├── 📁 docker/                                # Docker Configuration
│   ├── docker-compose.yml                    #   PostgreSQL, Redis, Meilisearch
│   ├── docker-compose.prod.yml               #   Production overrides
│   └── Dockerfile                            #   Production build
│
├── .env.example                              # Environment variables template
├── .gitignore
├── turbo.json                                # Turborepo configuration
├── package.json                              # Root package.json
├── pnpm-workspace.yaml                       # pnpm workspace config
└── README.md                                 # This file
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18+ (LTS recommended)
- **pnpm** v8+ (package manager)
- **Docker** & **Docker Compose** (for databases)
- **Google Cloud** account (for Maps API & Gemini API)
- **Razorpay** account (for payments — test mode)

### Environment Variables

Create a `.env` file in both `apps/web` and `apps/server`:

```env
# ============================================================
# DATABASE
# ============================================================
DATABASE_URL="postgresql://user:password@localhost:5432/hostnexus"

# ============================================================
# REDIS
# ============================================================
REDIS_URL="redis://localhost:6379"

# ============================================================
# AUTH
# ============================================================
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# ============================================================
# AI / LLM
# ============================================================
GEMINI_API_KEY="your-gemini-api-key"
# OR
OPENAI_API_KEY="your-openai-api-key"

# ============================================================
# VECTOR DATABASE
# ============================================================
PINECONE_API_KEY="your-pinecone-api-key"
PINECONE_INDEX="hostnexus-resources"
# OR
QDRANT_URL="http://localhost:6333"

# ============================================================
# SEARCH
# ============================================================
MEILISEARCH_HOST="http://localhost:7700"
MEILISEARCH_API_KEY="your-meilisearch-master-key"

# ============================================================
# PAYMENTS
# ============================================================
RAZORPAY_KEY_ID="your-razorpay-key-id"
RAZORPAY_KEY_SECRET="your-razorpay-key-secret"

# ============================================================
# MAPS
# ============================================================
GOOGLE_MAPS_API_KEY="your-google-maps-api-key"

# ============================================================
# MEDIA
# ============================================================
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"

# ============================================================
# EMAIL
# ============================================================
RESEND_API_KEY="your-resend-api-key"

# ============================================================
# SMS (OPTIONAL)
# ============================================================
TWILIO_ACCOUNT_SID="your-twilio-sid"
TWILIO_AUTH_TOKEN="your-twilio-token"
TWILIO_PHONE_NUMBER="+1234567890"
```

### Installation & Setup

```bash
# 1. Clone the repository
git clone https://github.com/your-team/hostnexus.git
cd hostnexus

# 2. Install dependencies
pnpm install

# 3. Start infrastructure services (PostgreSQL, Redis, Meilisearch)
docker-compose up -d

# 4. Setup database
cd apps/server
pnpm prisma migrate dev --name init
pnpm prisma db seed
cd ../..

# 5. Start development servers
pnpm dev
```

This will start:
- **Frontend:** http://localhost:3000 (Next.js)
- **Backend API:** http://localhost:5000 (Express.js)
- **Socket.IO:** ws://localhost:5000 (WebSocket)
- **Meilisearch:** http://localhost:7700 (Search dashboard)

### Docker Compose (Infrastructure)

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: hostnexus
      POSTGRES_PASSWORD: hostnexus_dev
      POSTGRES_DB: hostnexus
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  meilisearch:
    image: getmeili/meilisearch:v1.11
    ports:
      - "7700:7700"
    environment:
      MEILI_MASTER_KEY: "hostnexus-search-key"
    volumes:
      - meilisearch_data:/meili_data

volumes:
  postgres_data:
  redis_data:
  meilisearch_data:
```

---

## 📚 API Documentation

### Base URL

```
Development: http://localhost:5000/api/v1
Production:  https://api.hostnexus.com/v1
```

### Authentication

All protected endpoints require a Bearer token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

### Core API Endpoints

#### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/register` | Register new business |
| POST | `/auth/login` | Login with email/password |
| POST | `/auth/magic-link` | Send magic link email |
| GET | `/auth/verify/:token` | Verify email/magic link |
| POST | `/auth/google` | Google OAuth login |
| GET | `/auth/me` | Get current user profile |

#### Resources
| Method | Endpoint | Description |
|---|---|---|
| GET | `/resources` | List all resources (paginated, filtered) |
| GET | `/resources/:id` | Get resource details |
| POST | `/resources` | Create new resource listing |
| PUT | `/resources/:id` | Update resource listing |
| DELETE | `/resources/:id` | Delete resource listing |
| GET | `/resources/:id/availability` | Get resource availability calendar |
| PUT | `/resources/:id/availability` | Update availability |
| GET | `/resources/categories` | List all resource categories |
| POST | `/resources/compare` | Compare multiple resources |

#### Search & Discovery
| Method | Endpoint | Description |
|---|---|---|
| GET | `/search` | Full-text search with filters |
| GET | `/search/map` | Geo-bounded search for map view |
| GET | `/search/nearby` | Find resources within radius |
| GET | `/search/trending` | Trending resources & categories |
| GET | `/search/recommendations` | AI-powered recommendations |

#### Bookings
| Method | Endpoint | Description |
|---|---|---|
| POST | `/bookings` | Create booking request |
| GET | `/bookings` | List my bookings (as seeker or provider) |
| GET | `/bookings/:id` | Get booking details |
| PUT | `/bookings/:id/status` | Update booking status |
| POST | `/bookings/:id/quote` | Submit quotation for a request |
| POST | `/bookings/:id/counter` | Counter-offer on a quote |
| POST | `/bookings/:id/accept` | Accept a booking/quote |
| POST | `/bookings/:id/reject` | Reject a booking/quote |
| POST | `/bookings/:id/cancel` | Cancel a booking |

#### Requirements (Reverse Marketplace)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/requirements` | Post a new requirement |
| GET | `/requirements` | List open requirements |
| GET | `/requirements/:id` | Get requirement details |
| POST | `/requirements/:id/offer` | Submit an offer (provider) |
| PUT | `/requirements/:id/offer/:offerId` | Accept/reject offer |

#### Payments
| Method | Endpoint | Description |
|---|---|---|
| POST | `/payments/create-order` | Create Razorpay order |
| POST | `/payments/verify` | Verify payment signature |
| GET | `/payments/transactions` | Transaction history |
| POST | `/payments/refund` | Initiate refund |

#### Reviews
| Method | Endpoint | Description |
|---|---|---|
| POST | `/reviews` | Submit review |
| GET | `/reviews/business/:id` | Get reviews for a business |
| GET | `/reviews/resource/:id` | Get reviews for a resource |

#### Messages
| Method | Endpoint | Description |
|---|---|---|
| GET | `/messages/conversations` | List conversations |
| GET | `/messages/:conversationId` | Get messages in conversation |
| POST | `/messages` | Send message |

#### Analytics
| Method | Endpoint | Description |
|---|---|---|
| GET | `/analytics/dashboard` | Unified business dashboard data (listings, rentals, revenue, spending) |
| GET | `/analytics/utilization` | Resource utilization stats |
| GET | `/analytics/revenue` | Revenue breakdown |

#### AI Chatbot
| Method | Endpoint | Description |
|---|---|---|
| POST | `/chat` | Send message to AI chatbot (streaming) |
| GET | `/chat/history` | Get chat history |

#### Admin
| Method | Endpoint | Description |
|---|---|---|
| GET | `/admin/dashboard` | Platform-wide KPIs |
| GET | `/admin/verifications` | Pending business verifications |
| PUT | `/admin/verifications/:id` | Approve/reject business |
| GET | `/admin/moderation` | Content moderation queue |
| PUT | `/admin/moderation/:id` | Approve/flag content |

---

## 📸 Screenshots

> Screenshots will be added as the UI is built. Key screens include:
> 1. Landing Page with value proposition
> 2. Resource Marketplace (Grid + Map view)
> 3. Resource Detail Page with availability calendar
> 4. AI Chatbot Concierge in action
> 5. Booking Request & Negotiation Flow
> 6. Unified Business Dashboard (listings + rentals + analytics)
> 7. Admin Panel with verification queue

---

## 🗺️ Future Roadmap

| Phase | Feature | Timeline |
|---|---|---|
| **v1.1** | Mobile App (React Native) | Post-hackathon |
| **v1.2** | Multi-language support (Hindi, Marathi, etc.) | Post-hackathon |
| **v1.3** | IoT Integration (smart locks, sensors for cold storage) | Future |
| **v1.4** | Insurance marketplace integration | Future |
| **v1.5** | Blockchain-based contract management | Future |
| **v2.0** | Agent-to-Agent (A2A) protocol — automated B2B negotiation | Future |
| **v2.1** | White-label solution for hospitality chains | Future |

---

## 👥 Team

| Name | Role | GitHub |
|---|---|---|
| Team Member 1 | Full-Stack Developer | [@handle](https://github.com/) |
| Team Member 2 | Full-Stack Developer | [@handle](https://github.com/) |
| Team Member 3 | AI/ML Engineer | [@handle](https://github.com/) |
| Team Member 4 | UI/UX Designer | [@handle](https://github.com/) |

---

## 📄 License

This project is built for **HackCelestial Hackathon** and is licensed under the [MIT License](LICENSE).

---

<div align="center">

**Built with ❤️ for HackCelestial**

*Transforming B2B hospitality resource management through AI-powered marketplace intelligence*

</div>
