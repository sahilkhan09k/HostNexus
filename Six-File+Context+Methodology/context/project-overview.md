# HostNexus — Project Overview

## 1. Project Identity

**Project Name:** HostNexus

**Project Type:** AI-powered B2B marketplace for shared hospitality and event resources.

**Primary Goal:** Build a platform that allows hospitality and related businesses to discover, share, rent, book, negotiate, and manage underutilized resources through a unified marketplace powered by AI.

**Development Model:** 7-day hackathon sprint with a 2-member team.

---

## 2. The Problem

Hotels, restaurants, banquet halls, caterers, event organizers, and hospitality businesses often own expensive resources that remain underutilized for significant periods.

At the same time, other businesses may urgently need those same resources but lack:

* A trusted discovery platform
* Real-time availability information
* Transparent pricing
* Fast negotiation mechanisms
* Reliable business-to-business booking workflows
* A unified way to manage shared resources

Current processes are often fragmented across:

* Phone calls
* WhatsApp messages
* Personal networks
* Manual quotations
* Spreadsheets
* Informal vendor relationships

This creates inefficiency, wasted capacity, delayed procurement, and lost revenue.

---

## 3. The Solution

HostNexus is a unified B2B marketplace where businesses can:

* List underutilized resources
* Discover resources offered by other businesses
* Search by location, category, capacity, price, and availability
* View resources on an interactive map
* Send booking requests
* Request and negotiate quotations
* Post urgent requirements for other businesses to fulfill
* Manage bookings and resource availability
* Communicate with other businesses
* Make payments through the platform
* Track business performance and resource utilization

The primary differentiator is an **AI Concierge** that can understand natural-language requirements and help users discover, compare, evaluate, and initiate booking workflows.

---

## 4. Core Product Principle

HostNexus uses a **unified Business model**.

There are not separate applications for providers and seekers.

A single business can simultaneously:

```text id="u4jylb"
Provide Resources
       +
Discover Resources
       +
Create Booking Requests
       +
Receive Booking Requests
       +
Post Requirements
       +
Respond with Offers
```

For example, a hotel may:

* Rent out unused banquet equipment
* Rent chairs from another business
* Post an urgent requirement for additional kitchen equipment
* Receive booking requests for its own resources

The product must preserve this flexibility throughout the database design, API design, business logic, and UI.

---

## 5. Target Users

### Primary users

* Hotels
* Resorts
* Restaurants
* Banquet halls
* Caterers
* Event venues
* Event management businesses
* Equipment rental businesses
* Hospitality service providers

### Secondary use cases

The architecture should remain flexible enough to support additional B2B resource-sharing categories in the future.

---

## 6. Core Resources

Examples of resources that may be listed include:

* Banquet halls
* Event spaces
* Chairs
* Tables
* Audio equipment
* Visual equipment
* Projectors
* Speakers
* Lighting equipment
* Kitchen equipment
* Industrial ovens
* Catering equipment
* Vehicles
* Storage spaces
* Temporary event infrastructure

Each resource may have:

* Category
* Name
* Description
* Images
* Specifications
* Capacity
* Quantity
* Location
* Pricing
* Availability
* Provider information
* Ratings and reviews

Resource specifications must remain flexible enough to support different categories.

Category-specific specifications should therefore support structured dynamic data rather than forcing every resource into the same fixed schema.

---

## 7. Core User Journeys

### Journey A — Discover and Book

```text id="w5snlh"
Business
    ↓
Search Marketplace
    ↓
Apply Filters
    ↓
View Resource
    ↓
Check Availability
    ↓
Send Booking Request
    ↓
Provider Reviews Request
    ↓
Quotation / Negotiation
    ↓
Acceptance
    ↓
Payment
    ↓
Booking Confirmation
    ↓
Resource Usage
    ↓
Completion
    ↓
Review
```

---

### Journey B — List a Resource

```text id="2cahik"
Business
    ↓
Open Listing Wizard
    ↓
Select Resource Category
    ↓
Enter Resource Information
    ↓
Add Specifications
    ↓
Configure Pricing
    ↓
Configure Availability
    ↓
Upload Images
    ↓
Review Listing
    ↓
Publish Resource
```

---

### Journey C — Reverse Marketplace

```text id="ryan1v"
Business
    ↓
Post Requirement
    ↓
Specify Need, Quantity, Date and Budget
    ↓
Matching Providers Discover Requirement
    ↓
Providers Submit Offers
    ↓
Business Compares Offers
    ↓
Accept Offer
    ↓
Continue Booking Workflow
```

---

### Journey D — AI Concierge

```text id="ptxy7z"
User describes requirement naturally
        ↓
AI understands intent
        ↓
AI searches relevant resources
        ↓
AI checks availability
        ↓
AI ranks and compares options
        ↓
AI presents rich recommendations
        ↓
User selects an option
        ↓
AI initiates booking request
        ↓
User confirms important action
```

Example user requests:

* "I need a banquet hall for 200 people tomorrow."
* "Find 50 chairs under ₹5,000 near my event."
* "Compare these three projectors."
* "Find an industrial oven available next week."
* "Which option gives me the best value?"

The AI must use real platform services and data. It must not invent resource availability, prices, or bookings.

---

## 8. Core Features

### 8.1 Authentication and Business Accounts

Users must be able to:

* Register
* Log in
* Access protected functionality
* Manage their business profile

Authentication uses JWT-based access control during the hackathon implementation.

---

### 8.2 Resource Marketplace

Users must be able to:

* Browse resources
* Search resources
* Filter resources
* View resource details
* View provider information
* View pricing
* View availability
* View ratings and reviews

Primary filters include:

* Category
* Price
* Location
* Distance
* Capacity
* Availability
* Search query

---

### 8.3 Interactive Map Discovery

Marketplace discovery should support a map-based experience.

Users can:

* View resources geographically
* Interact with resource markers
* Synchronize map selection with resource cards
* Search within a geographic area

---

### 8.4 Resource Management

Businesses can:

* Create listings
* Edit listings
* Manage specifications
* Configure pricing
* Upload images
* Configure availability
* Manage resource inventory

---

### 8.5 Availability Management

Resources must support availability management including:

* Available periods
* Blocked dates
* Time slots where applicable
* Existing bookings

Availability is a critical source of truth for booking workflows.

---

### 8.6 Booking Requests

Businesses can initiate booking requests for resources.

A booking request may contain:

* Requested date/time
* Quantity
* Duration
* Add-ons
* Delivery requirements
* Budget notes
* Additional instructions

Booking workflows must prevent conflicting confirmed bookings.

---

### 8.7 Quotations and Negotiation

Providers can:

* Review requests
* Send quotations
* Counter offers
* Update pricing or terms

Seekers can:

* Accept quotations
* Reject quotations
* Submit counter offers

The workflow should support negotiation without losing the history of previous actions.

---

### 8.8 Booking Lifecycle

The planned booking lifecycle is:

```text id="m8rzke"
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

A booking may also transition to:

```text id="2d7ts3"
CANCELLED
```

State transitions must be controlled by backend business logic.

Clients must not arbitrarily assign booking states.

---

### 8.9 Reverse Marketplace Requirements

Businesses can post requirements when they cannot find a suitable resource immediately.

Requirements may include:

* Resource category
* Description
* Quantity
* Required date
* Location
* Budget
* Urgency

Other businesses can respond with offers.

---

### 8.10 Real-Time Communication

Businesses should be able to communicate regarding booking workflows.

The platform supports:

* Direct business messaging
* Booking-related communication
* Real-time status updates
* Notifications

Real-time functionality is implemented using Socket.IO.

---

### 8.11 Payments

The platform supports payment workflows through Razorpay.

The hackathon implementation should prioritize:

* Order creation
* Razorpay Checkout
* Payment verification
* Booking/payment state updates

The system may visually model an escrow-style workflow for the demo.

Do not treat HostNexus as a legally regulated escrow provider unless a real compliant escrow implementation exists.

---

### 8.12 Reviews and Trust

Businesses can review completed transactions.

Reviews may include multiple dimensions:

* Quality
* Timeliness
* Communication
* Resource condition

These values can contribute to provider trust and matching signals.

---

### 8.13 Business Dashboard

Businesses should have a unified dashboard showing:

* Revenue
* Active rentals
* Pending requests
* Resource utilization
* Booking activity
* Demand indicators
* Recent activity

The dashboard is designed for operational visibility and hackathon demonstration.

---

## 9. AI Concierge

The AI Concierge is the primary intelligence layer of HostNexus.

Its responsibilities include:

* Understanding natural-language requirements
* Searching relevant resources
* Interpreting user constraints
* Checking availability
* Comparing resources
* Estimating price ranges
* Ranking options
* Recommending the best matches
* Initiating booking requests after appropriate confirmation

### AI Architecture Principle

The AI must sit on top of existing platform services.

```text id="3o1qzq"
Resource Service
Availability Service
Booking Service
Matching Service
Pricing Data
        ↑
        │
AI Tool Layer
        ↑
        │
LLM Orchestrator
        ↑
        │
AI Concierge UI
```

The AI layer should not directly duplicate marketplace business logic.

Platform services remain the source of truth.

---

## 10. Smart Matching

HostNexus uses a weighted matching model to rank relevant resources.

The planned factors are:

```text id="d84x8t"
Price        → 0.25
Distance     → 0.30
Rating       → 0.15
Availability → 0.15
Capacity     → 0.10
Urgency      → 0.05
```

The matching engine should:

* Normalize inputs
* Handle missing information safely
* Produce explainable scores where possible
* Never override confirmed availability checks

The matching algorithm is a recommendation layer, not the final booking authority.

---

## 11. AI Tool Layer

The planned AI tools include:

```text id="g0zxog"
search_resources
check_availability
compare_resources
create_booking_request
get_price_estimate
```

Each tool must call controlled backend services.

The AI must not directly modify database records without going through validated business logic.

Important actions such as creating bookings or initiating payments should require appropriate user confirmation.

---

## 12. Hackathon Scope

HostNexus is being developed in a **7-day hackathon sprint**.

The objective is not to build every possible enterprise feature.

The objective is to build a convincing, reliable, polished end-to-end product demonstrating the core value proposition.

### Priority order

```text id="u9o5e4"
P0 — Must Work

Authentication
Resource marketplace
Resource listing
Availability
Booking request
Quotation workflow
AI discovery and matching
End-to-end demo flow
```

```text id="mkv30u"
P1 — Strong Demo Features

Interactive map
Reverse marketplace
Real-time messaging
Business dashboard
Reviews
Payments
```

```text id="jr4xgl"
P2 — Add Only If Time Allows

Advanced RAG infrastructure
Complex vector database
Redis optimization
Advanced analytics
Complex recurring availability
Additional AI agents
```

---

## 13. Development Strategy

The two developers work in parallel.

### Frontend Track

Responsible for:

* Next.js application
* UI system
* Marketplace
* Dashboard
* Booking UI
* AI chat UI
* Client-side integrations
* Demo presentation

### Backend and AI Track

Responsible for:

* Express API
* PostgreSQL
* Prisma
* Authentication
* Business logic
* Resource APIs
* Booking engine
* Matching
* AI orchestration
* Realtime server
* Payments
* Deployment support

---

## 14. Development Methodology

Development follows a context-driven AI workflow.

```text id="q1ts4v"
Permanent Context
        ↓
Current Progress
        ↓
Single Implementation Task
        ↓
AI Inspects Existing Code
        ↓
Implement Feature
        ↓
Verify
        ↓
Update Progress
        ↓
Commit and Push
```

The context directory contains the permanent project knowledge:

```text id="edpv8x"
context/
├── project-overview.md
├── architecture.md
├── code-standards.md
├── ai-workflow-rules.md
├── progress-tracker.md
└── ui-context.md
```

Implementation specifications define one focused development task at a time.

The AI must not independently begin unrelated features.

---

## 15. Definition of a Successful Demo

The ideal demonstration should tell this story:

```text id="mxq2b7"
Business needs a resource
        ↓
AI Concierge understands the requirement
        ↓
HostNexus searches real marketplace data
        ↓
AI ranks and compares options
        ↓
User checks availability
        ↓
User sends booking request
        ↓
Provider responds with quotation
        ↓
Businesses negotiate and confirm
        ↓
Payment is completed
        ↓
Booking appears in dashboards/calendar
```

The demo should make the value proposition immediately understandable:

> **HostNexus turns fragmented B2B hospitality resource sharing into an intelligent, searchable, AI-assisted marketplace.**

---

## 16. Non-Negotiable Product Rules

1. A business can both provide and seek resources.
2. The database is the source of truth.
3. Availability must be validated before confirmation.
4. Booking state transitions are controlled by backend business logic.
5. AI recommendations must use real platform data.
6. AI must not invent availability or pricing.
7. Important mutations require validated backend APIs.
8. UI must remain responsive and usable on desktop and mobile.
9. Every major feature must support loading, empty, and error states.
10. Hackathon reliability is more important than unnecessary architectural complexity.

---

## 17. Current Development Status

**Sprint:** Day 1

**Current Phase:** Context system and backend development setup.

**Next Immediate Objective:**

Create the initial project structure and backend foundation:

```text id="co4s3r"
apps/web
apps/api
packages/types
context
specs/backend
```

The first backend implementation target is:

```text id="mdqbi2"
Express + TypeScript
        ↓
Environment configuration
        ↓
PostgreSQL + Prisma
        ↓
Core schema
        ↓
JWT Authentication
```

After the foundation is working, development proceeds to resource management and the marketplace APIs.
