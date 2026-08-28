# Architecture Context

## Stack

| Layer            | Technology                          | Role                                                          |
| ---------------- | ----------------------------------- | ------------------------------------------------------------- |
| Monorepo         | pnpm + Turborepo                    | Manage applications and shared packages                       |
| Frontend         | Next.js + TypeScript                | Web application, marketplace, dashboard, AI UI                |
| UI               | Tailwind CSS + shadcn/ui + Radix UI | Design system and reusable UI primitives                      |
| Animation        | Framer Motion                       | Purposeful UI transitions and interactions                    |
| Icons            | Lucide React                        | Consistent icon system                                        |
| Backend          | Node.js + Express + TypeScript      | REST API and core platform services                           |
| API Validation   | Zod                                 | Runtime validation of external input                          |
| Authentication   | JWT + bcrypt                        | User authentication and password security                     |
| Database ORM     | Prisma                              | Type-safe database access and migrations                      |
| Database         | PostgreSQL                          | Primary source of truth for platform data                     |
| Media Storage    | Cloudinary                          | Resource and business image storage                           |
| Search           | Meilisearch                         | Fast marketplace resource search                              |
| Cache / Locks    | Redis                               | Optional caching, temporary locks, and short-lived state      |
| Real-Time        | Socket.IO                           | Messaging, notifications, and live updates                    |
| Maps             | Google Maps or Mapbox               | Geographic resource discovery                                 |
| Payments         | Razorpay                            | Payment order creation, checkout, and verification            |
| AI Orchestration | LLM provider / AI SDK               | Natural-language understanding and AI Concierge orchestration |
| AI Tools         | Controlled service-layer tools      | Search, availability, comparison, and booking actions         |
| Smart Matching   | Custom TypeScript service           | Resource ranking and recommendation scoring                   |
| Package Manager  | pnpm                                | Workspace dependency management                               |
| Deployment       | TBD                                 | Final application and infrastructure deployment               |

---

# Repository Structure

```text
HostNexus/
│
├── CLAUDE.md
│
├── context/
│   ├── project-overview.md
│   ├── architecture.md
│   ├── code-standards.md
│   ├── ai-workflow-rules.md
│   ├── progress-tracker.md
│   └── ui-context.md
│
├── specs/
│   ├── backend/
│   └── frontend/
│
├── apps/
│   ├── web/
│   └── api/
│
├── packages/
│   └── types/
│
├── docker/
│
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── .env.example
```

---

## System Boundaries

### `context/`

Owns the persistent knowledge required for AI-assisted development.

Contains:

* Product requirements
* Technical architecture
* Code standards
* AI workflow rules
* UI standards
* Current implementation progress

This folder is the source of truth for how the project should be understood.

Changes to this folder should be intentional because future coding agents use it as persistent context.

---

### `specs/`

Owns focused implementation specifications.

```text
specs/
├── backend/
└── frontend/
```

Each specification represents one bounded implementation task.

A specification defines:

* Objective
* Scope
* Non-goals
* Acceptance criteria
* Expected implementation boundaries
* Verification requirements

Specifications do not contain production application code.

---

### `apps/web/`

Owns the HostNexus frontend application.

Responsibilities include:

* Landing page
* Authentication UI
* Marketplace
* Resource discovery
* Search and filtering UI
* Interactive map UI
* Resource details
* Resource listing wizard
* Booking UI
* Quotation and negotiation UI
* Business dashboard
* Calendar
* Messaging UI
* AI Concierge UI
* Client-side payment initiation
* Client-side Socket.IO integration

The frontend does not:

* Directly access PostgreSQL
* Implement authoritative booking logic
* Verify payments
* Determine final authorization
* Bypass backend validation

The frontend communicates with the backend through controlled API clients.

---

### `apps/api/`

Owns the HostNexus backend and platform business logic.

Responsibilities include:

* REST API
* Authentication
* Authorization
* Business ownership validation
* Resource management
* Availability logic
* Booking workflows
* Booking state transitions
* Quotation workflows
* Requirement marketplace
* Review management
* Payment verification
* Socket.IO server
* AI orchestration
* AI tool execution
* Smart matching
* Database access
* External service integration

The backend is the authoritative application layer between clients and infrastructure.

Recommended structure:

```text
apps/api/
├── src/
│   ├── config/
│   ├── routes/
│   ├── controllers/
│   ├── services/
│   ├── middleware/
│   ├── schemas/
│   ├── utils/
│   ├── ai/
│   ├── sockets/
│   ├── types/
│   ├── app.ts
│   └── server.ts
│
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
│
├── tests/
└── package.json
```

---

### `packages/types/`

Owns shared TypeScript contracts.

Contains types genuinely shared between applications, such as:

* User-facing domain contracts
* Resource contracts
* Booking contracts
* Quotation contracts
* Requirement contracts
* Shared API response contracts
* AI result contracts

This package must not become a dumping ground for every implementation-specific type.

Prisma implementation details should not automatically be exported as public shared types.

---

### `docker/`

Owns local development infrastructure configuration.

May include services such as:

* PostgreSQL
* Redis
* Meilisearch

Application code must not depend on Docker-specific paths or assumptions.

---

# Backend Architecture

## Request Flow

Standard API requests follow:

```text
Client
  ↓
Express Route
  ↓
Middleware
  ↓
Controller
  ↓
Service
  ↓
Prisma / External Service
  ↓
Database / Infrastructure
```

### Route

Owns:

* Endpoint definition
* HTTP method
* Middleware composition

Routes must remain thin.

---

### Middleware

Owns cross-cutting request concerns such as:

* Authentication
* Authorization context
* Validation
* Error propagation
* Rate limiting when implemented

Middleware must not contain feature-specific business workflows.

---

### Controller

Owns:

* Reading validated request data
* Calling the appropriate service
* Returning HTTP responses

Controllers must not contain complex business logic.

---

### Service

Owns:

* Domain business logic
* State transition rules
* Ownership checks where domain-specific
* Database transactions
* Coordination between infrastructure services
* Reusable business operations

The same services should be reusable by:

* REST controllers
* Socket handlers
* AI tools
* Background processes where introduced

---

### Prisma / Infrastructure Layer

Owns:

* Database access
* Queries
* Transactions
* Persistence

External infrastructure integrations include:

* Cloudinary
* Razorpay
* Redis
* Meilisearch
* Socket.IO
* Map providers
* AI providers

---

# Frontend Architecture

Recommended frontend structure:

```text
apps/web/
├── app/
│   ├── (public)/
│   ├── (auth)/
│   ├── dashboard/
│   └── api/
│
├── components/
│   ├── ui/
│   ├── marketplace/
│   ├── booking/
│   ├── dashboard/
│   ├── ai/
│   └── shared/
│
├── hooks/
│
├── lib/
│   ├── api/
│   ├── utils/
│   └── constants/
│
├── types/
│
├── styles/
│
└── public/
```

## Frontend Data Flow

```text
Page / Server Component
        ↓
Feature Component
        ↓
API Client / Server Action where appropriate
        ↓
Express API
        ↓
Backend Service
```

The frontend may manage temporary UI state, but critical business state remains authoritative on the backend.

---

# Domain Architecture

## Core Entities

The core domain includes:

```text
User
   ↓
Business
   ├── Resources
   ├── Booking Requests
   ├── Requirements
   ├── Reviews
   └── Messages
```

Additional major entities include:

```text
Resource
├── Availability
├── Booking Requests
├── Confirmed Bookings
└── Reviews
```

```text
Booking
├── Quotation History
├── Messages
├── Payment
└── Reviews
```

```text
Requirement
└── Offers
```

The exact Prisma schema may evolve, but the unified domain model must remain intact.

---

# Unified Business Model

HostNexus does not maintain separate provider and seeker applications.

A `Business` may simultaneously:

```text
Own Resources
      +
List Resources
      +
Receive Booking Requests
      +
Search Other Resources
      +
Create Booking Requests
      +
Post Requirements
      +
Submit Offers
```

The architecture must not assume that a business permanently belongs to one role.

Roles are determined by the action being performed.

---

# Storage Model

## PostgreSQL

PostgreSQL is the primary source of truth.

It stores structured and relational application data including:

* Users
* Businesses
* Business ownership
* Resources
* Resource metadata
* Availability records
* Booking requests
* Booking state
* Quotations
* Requirements
* Offers
* Messages
* Reviews
* Payment records
* Notifications
* AI conversation metadata where required

Critical business state must not exist only in frontend state, search indexes, or AI context.

---

## Cloudinary

Cloudinary stores media assets including:

* Resource images
* Business images
* Uploaded marketplace media

PostgreSQL stores:

* Asset identifiers
* URLs
* Ownership relationships
* Relevant metadata

Large binary media files must not be stored directly in PostgreSQL.

---

## Meilisearch

Meilisearch stores searchable indexes for marketplace discovery.

Examples:

* Resource names
* Categories
* Descriptions
* Locations
* Searchable specifications

Meilisearch is derived infrastructure.

PostgreSQL remains authoritative.

A search result must not be treated as final confirmation of:

* Availability
* Ownership
* Booking status

Critical data must be validated through platform services.

---

## Redis

Redis stores short-lived or derived data when required.

Potential uses include:

* Caching
* Temporary availability locks
* Rate limiting
* Session-adjacent state
* Real-time scaling support

Redis is not the primary source of truth for bookings or resources.

---

# Authentication and Access Model

## Authentication

Users authenticate using:

```text
Email / Credentials
      ↓
Password Verification
      ↓
JWT Generation
      ↓
Authenticated API Request
      ↓
JWT Middleware
      ↓
Authenticated User Context
```

Passwords are hashed using bcrypt.

JWT verification occurs on protected backend routes.

---

## Ownership

A user may own or manage a business.

Business-owned entities include:

* Resources
* Availability configuration
* Resource media
* Booking responses
* Requirements
* Offers

Before mutation, the backend must verify that the authenticated user has permission to perform the action.

The client must not be trusted to provide ownership information.

---

## Access Control

Access control is based on:

```text
Authenticated User
        +
Business Relationship
        +
Action Permission
```

Examples:

A business may:

* Edit only its own resources.
* Manage availability only for its own resources.
* Respond to booking requests directed to its resources.
* Submit booking requests for other businesses' resources.
* View conversations it participates in.
* Mutate booking state only when the transition is valid and authorized.

Authentication does not automatically grant authorization.

Every sensitive mutation must verify the appropriate business relationship and permission.

---

# Booking Architecture

## Booking Lifecycle

The planned lifecycle is:

```text
PENDING
   ↓
QUOTED
   ↓
NEGOTIATING
   ↓
ACCEPTED
   ↓
CONFIRMED
   ↓
IN_USE
   ↓
COMPLETED
```

Alternative terminal or exceptional state:

```text
CANCELLED
```

State transitions are controlled by backend business logic.

The client cannot directly assign arbitrary booking states.

---

## Booking Validation Flow

Before confirmation:

```text
Booking Request
      ↓
Validate User
      ↓
Validate Business Permission
      ↓
Validate Resource
      ↓
Validate Availability
      ↓
Validate Quantity / Capacity
      ↓
Validate Booking State
      ↓
Transaction / Lock if required
      ↓
Confirm Booking
```

The exact locking mechanism may evolve based on implementation complexity.

The critical requirement is that confirmed bookings must not create conflicting resource allocations.

---

# Availability Architecture

Availability is a domain service, not merely a frontend calendar feature.

Availability may consider:

* Resource quantity
* Existing confirmed bookings
* Blocked periods
* Requested dates
* Requested time range
* Resource-specific rules

The availability service is the authoritative interface used by:

* Marketplace resource details
* Booking service
* AI tools
* Matching service

No AI or frontend component should independently decide that a resource is available.

---

# Quotation and Negotiation Architecture

Quotation workflows belong to the booking domain.

The system supports:

```text
Booking Request
      ↓
Provider Quotation
      ↓
Customer Acceptance
      ↓
OR
Counter Offer
      ↓
Further Negotiation
```

Quotation history should remain traceable.

The active booking state and active quotation must remain consistent.

Business rules belong in the service layer.

---

# AI Architecture

## Principle

AI is an orchestration layer above the platform's existing services.

```text
User
  ↓
AI Concierge
  ↓
Intent Understanding
  ↓
Tool Selection
  ↓
Controlled Tool Call
  ↓
Platform Service
  ↓
PostgreSQL / Search / External Service
  ↓
Validated Result
  ↓
AI Response
```

The AI does not own core business rules.

---

## AI Responsibilities

The AI Concierge can:

* Understand natural-language requirements
* Search resources
* Interpret constraints
* Check availability
* Compare resources
* Estimate price ranges from platform data
* Rank relevant resources
* Explain recommendations
* Initiate supported actions after confirmation

---

## Controlled AI Tools

The planned tool layer includes:

```text
search_resources
check_availability
compare_resources
get_price_estimate
create_booking_request
```

Each tool must call validated service-layer functionality.

Tools must not:

* Run arbitrary SQL
* Directly bypass authorization
* Modify protected state without validation
* Invent unavailable platform data

---

# Smart Matching Architecture

Smart matching is implemented as a dedicated deterministic service.

The planned scoring factors include:

```text
Price        → 0.25
Distance     → 0.30
Rating       → 0.15
Availability → 0.15
Capacity     → 0.10
Urgency      → 0.05
```

The matching service:

1. Receives normalized requirements.
2. Retrieves candidate resources.
3. Applies hard constraints.
4. Validates relevant availability.
5. Calculates weighted scores.
6. Produces ranked results.

Hard constraints take priority over recommendation scores.

A high-scoring unavailable resource must not be recommended as available.

---

# Real-Time Architecture

Socket.IO supports:

* Messages
* Notifications
* Booking updates
* Quotation updates

Example event names:

```text
message:created
booking:updated
quotation:created
notification:created
```

Socket handlers must:

```text
Authenticate
      ↓
Authorize
      ↓
Call Service
      ↓
Persist State
      ↓
Emit Event
```

Socket events must not bypass service-layer validation.

---

# Payment Architecture

Payment flow:

```text
Booking / Accepted Quotation
        ↓
Backend Creates Razorpay Order
        ↓
Frontend Opens Razorpay Checkout
        ↓
Payment Completion
        ↓
Backend Verifies Payment
        ↓
Payment Record Updated
        ↓
Booking State Updated
```

The frontend must not authoritatively mark payments as successful.

Sensitive payment verification occurs on the backend.

---

# Search Architecture

Marketplace search may combine:

```text
Search Query
      ↓
Meilisearch Candidate Retrieval
      ↓
PostgreSQL Validation
      ↓
Availability / Constraint Filtering
      ↓
Smart Matching
      ↓
Ranked Results
```

Search infrastructure optimizes discovery.

Authoritative services validate final results.

---

# External Integration Boundaries

## Cloudinary

Frontend:

* Selects/uploads media through an approved upload flow.

Backend:

* Controls credentials/signatures when required.
* Stores asset metadata and ownership.

---

## Maps

The frontend is responsible for:

* Rendering maps
* Displaying markers
* User interactions

The backend is responsible for:

* Providing validated resource location data.
* Supporting geographic filtering where implemented.

---

## Razorpay

Frontend:

* Displays checkout.

Backend:

* Creates payment orders.
* Stores payment records.
* Verifies payment authenticity.

---

## Socket.IO

Frontend:

* Maintains authorized connection.
* Subscribes to allowed events.
* Updates UI state.

Backend:

* Authenticates connections.
* Authorizes rooms/events.
* Persists authoritative state before broadcasting.

---

# Invariants

1. **The database is the source of truth for critical platform state.** Search indexes, frontend state, caches, and AI context are derived layers.

2. **A Business is a unified participant.** The system must not permanently classify a business as only a provider or only a seeker.

3. **Controllers and UI components do not own core business rules.** Business logic belongs in backend services.

4. **Authentication does not imply authorization.** Protected mutations must validate ownership or business permissions.

5. **Availability must be validated by the backend before booking confirmation.**

6. **Clients cannot arbitrarily transition booking states.** Every transition must be validated by the booking service.

7. **Confirmed bookings must not create conflicting resource allocations.**

8. **AI tools must use controlled platform services.** AI must not directly bypass authorization, validation, or business logic.

9. **AI recommendations must not invent platform data.** Resource availability, pricing, ownership, and booking state must come from validated sources.

10. **Search infrastructure is not authoritative.** Meilisearch and cached results must not override PostgreSQL or availability validation.

11. **Payment success is determined by backend verification, not frontend state.**

12. **Large media files are stored outside PostgreSQL.** The database stores relationships and metadata.

13. **All external input is validated at runtime before business logic trusts it.**

14. **Critical multi-record operations use atomic database transactions when consistency requires them.**

15. **Every focused implementation task must preserve existing working functionality unless the task explicitly changes it.**

---

# Architecture Decision Rule

When making an architectural decision, prioritize:

```text
Correctness
    ↓
Data integrity
    ↓
Security and authorization
    ↓
Simplicity
    ↓
Reusability
    ↓
Performance
    ↓
Advanced optimization
```

For the 7-day hackathon, prefer a working, understandable, reliable implementation over unnecessary distributed-system complexity.
