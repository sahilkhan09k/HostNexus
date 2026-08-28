# Code Standards

## General

* Keep modules small, focused, and single-purpose.
* Prefer simple, explicit implementations over unnecessary abstraction.
* Fix root causes instead of layering workarounds on top of broken behavior.
* Do not mix unrelated concerns in the same module, component, controller, service, or route.
* Reuse existing utilities, services, components, and shared types before creating duplicates.
* Inspect the existing codebase before introducing a new pattern.
* Follow the architecture defined in `context/architecture.md`.
* Do not introduce dependencies unless they solve a clear requirement.
* Do not refactor unrelated working code while implementing a focused task.
* Prefer composition over large monolithic files.
* Keep functions readable and reasonably small.
* Use descriptive names that explain intent.
* Avoid magic numbers and unexplained constants.
* Add comments only when the reasoning is not obvious from the code.
* Do not leave dead code, unused imports, commented-out implementations, or debug logs in production code.
* Every implementation must consider success, loading, empty, and error states where applicable.
* Hackathon reliability is more important than unnecessary enterprise-level complexity.

---

## TypeScript

* Strict TypeScript mode is required throughout the project.
* Do not use `any`.
* Use explicit interfaces, types, generics, or narrowly scoped unknown values instead.
* Use `unknown` for untrusted external data until it has been validated.
* Validate external input at system boundaries before trusting it.
* Prefer shared types from `packages/types` when data crosses application boundaries.
* Do not duplicate the same domain type in multiple applications.
* Avoid overly broad types such as `object`, `Function`, or untyped dictionaries.
* Use enums or controlled union types for domain states such as booking status.
* Keep optional properties genuinely optional; do not use optional types to avoid defining required data.
* API response types must be predictable and consistent.
* Prisma-generated types should not automatically be exposed directly as public API contracts.

---

## Next.js Frontend

* Use the App Router.
* Default to Server Components where possible.
* Add `"use client"` only when browser interactivity, hooks, event handlers, or browser APIs require it.
* Keep page components focused on page composition and orchestration.
* Extract reusable UI and feature logic into appropriate components.
* Do not fetch the same data independently in multiple nested components without a clear reason.
* Use shared API client utilities for backend communication.
* Do not place backend business logic inside frontend components.
* Do not access the database directly from the frontend.
* Use loading, error, and empty states for asynchronous views.
* Keep client-side state local unless it is genuinely shared across multiple parts of the application.
* Avoid creating global state for data that can be fetched or derived.
* Follow the visual rules defined in `context/ui-context.md`.

### Frontend component rules

* Reuse existing components before creating new ones.
* Keep presentational components focused on rendering.
* Keep complex feature logic in hooks or dedicated utilities when appropriate.
* Do not create a large generic component with excessive conditional props.
* Prefer composition and small focused components.
* Use clear prop interfaces.
* Avoid prop drilling when composition or context is more appropriate.
* Ensure interactive components support keyboard and accessibility requirements.

---

## Express API

* Routes define endpoints and attach middleware.
* Controllers handle HTTP request and response concerns.
* Services contain business logic.
* Database access belongs inside the appropriate service or data layer.
* Controllers must not contain complex business logic.
* Routes must remain thin.
* Do not call Prisma directly from route files.
* Do not expose raw database errors to clients.
* Use centralized error handling.
* Use async/await consistently.
* Every asynchronous error must reach the centralized error handler.
* Keep route handlers focused on one responsibility.
* Do not duplicate business logic across multiple controllers.
* Reuse services for functionality needed by both APIs and AI tools.

### Backend request flow

All standard API requests should follow:

```text id="d1d7za"
Route
  ↓
Middleware
  ↓
Controller
  ↓
Service
  ↓
Prisma / External Integration
```

Do not bypass this structure without a strong reason.

---

## API Routes

* Validate and parse request input before business logic runs.
* Authentication must be enforced before protected operations.
* Ownership and authorization must be checked before mutations.
* Never trust client-provided ownership identifiers without verification.
* Use consistent response shapes.
* Use appropriate HTTP status codes.
* Return meaningful error messages without exposing internal implementation details.
* Pagination must be considered for collection endpoints.
* Filtering and sorting parameters must be validated.
* Mutating endpoints should be explicit about the state change they perform.
* State transitions must be controlled by backend business logic.

### API response format

Successful responses should follow:

```ts id="1yv6lo"
{
  success: true,
  data: {}
}
```

Successful responses with metadata may follow:

```ts id="ix9hzk"
{
  success: true,
  data: [],
  meta: {
    page: 1,
    limit: 20,
    total: 100
  }
}
```

Errors should follow:

```ts id="xw6g1u"
{
  success: false,
  error: {
    code: "RESOURCE_NOT_FOUND",
    message: "The requested resource was not found."
  }
}
```

Do not return inconsistent response structures between endpoints without a clear reason.

---

## Validation

* Use Zod for request and external data validation.
* Validate request body, query parameters, route parameters, and important headers where applicable.
* Validation occurs before business logic.
* Never assume data from the client is valid because TypeScript types exist.
* TypeScript types provide compile-time guarantees; validation protects runtime boundaries.
* Reuse validation schemas when multiple endpoints accept the same domain structure.
* Keep validation schemas close to the domain or in shared validation packages where appropriate.
* Do not silently coerce dangerous or ambiguous input.

---

## Authentication and Authorization

* Authentication determines who the user is.
* Authorization determines what the user is allowed to do.
* Never treat authentication as sufficient authorization.
* Protected mutations must verify both authentication and ownership/permissions.
* Passwords must never be stored or logged in plain text.
* Password hashes must never be returned in API responses.
* JWT secrets and credentials must come from environment variables.
* Never hardcode secrets or credentials.
* Do not expose internal authentication errors that help attackers enumerate users unnecessarily.
* Business ownership must be verified before modifying business-owned resources.

---

## Business Logic

* Business rules belong in services, not controllers or frontend components.
* A service must enforce the invariants of its domain.
* Do not allow clients to directly assign protected states.
* Booking state transitions must be explicitly validated.
* Availability must be checked before booking confirmation.
* Important operations that modify multiple records should use database transactions when required.
* Do not duplicate matching, availability, or pricing logic between the API and AI layers.
* AI tools must reuse the same underlying services used by standard APIs.

### Booking rule

The client must not be able to arbitrarily perform:

```text id="dybvke"
PENDING → CONFIRMED
```

The backend must validate:

* Current state
* Actor permissions
* Availability
* Required quotation or acceptance conditions
* Payment state when applicable

---

## Prisma and Database

* Prisma is the primary database access layer.
* Keep database schema changes intentional and documented.
* Use migrations for persistent schema changes.
* Run Prisma validation after schema modifications.
* Do not create duplicate models for concepts that should share one unified domain model.
* HostNexus uses a unified `Business` model rather than separate provider and seeker systems.
* Use foreign keys and relations to represent real domain ownership.
* Add indexes for commonly queried fields when justified.
* Avoid N+1 query patterns.
* Select only required data where practical.
* Use transactions for operations requiring atomic consistency.
* Do not expose internal database models directly without considering API contracts.

### Data integrity

The database is the source of truth for:

* Users
* Businesses
* Resources
* Availability
* Bookings
* Quotations
* Messages
* Reviews
* Payments

Do not rely solely on frontend state for critical business data.

---

## Data and Storage

### PostgreSQL

Store structured application data and relationships in PostgreSQL.

Examples:

* User data
* Business profiles
* Resource metadata
* Availability
* Bookings
* Quotations
* Reviews
* Messages
* Payment metadata

### Cloudinary or object storage

Store large media assets outside PostgreSQL.

Examples:

* Resource images
* Business images
* Other uploaded media

The database should store:

* Public URLs
* Asset identifiers
* Relevant metadata

Do not store large image or file binary content directly in PostgreSQL.

### Redis

Use Redis only when required for:

* Caching
* Temporary locks
* Short-lived state
* Rate limiting
* Real-time scaling support

Do not introduce Redis as a dependency before a feature genuinely requires it.

### Search infrastructure

Meilisearch or other search infrastructure should be used for advanced marketplace search when needed.

PostgreSQL remains the primary source of truth.

Search indexes are derived data and must not become the authoritative source for bookings or availability.

---

## AI and Agentic Features

* The AI is an orchestration and intelligence layer, not the source of truth.
* AI responses must use real platform data.
* The AI must not invent resources, prices, availability, or booking status.
* AI tools must call validated backend services.
* Do not allow the LLM to directly execute arbitrary database queries.
* Important actions must go through controlled tool functions.
* Sensitive or irreversible actions require user confirmation where appropriate.
* AI-generated recommendations must not bypass availability or booking validation.
* The matching algorithm must remain deterministic and testable where possible.
* Keep AI orchestration separate from core marketplace business logic.

### AI architecture

The intended flow is:

```text id="1zkak0"
User Request
    ↓
AI Orchestrator
    ↓
Controlled Tool / Service Call
    ↓
Platform Service
    ↓
Database / External System
    ↓
Validated Result
    ↓
AI Response
```

Never implement:

```text id="cblfwq"
LLM
 ↓
Direct uncontrolled database access
```

---

## Smart Matching

* Matching logic must be deterministic for the same normalized inputs.
* Keep scoring logic isolated in a dedicated service or module.
* Document scoring factors and weights.
* Normalize values before comparing them.
* Handle missing values explicitly.
* Availability validation always takes priority over recommendation score.
* Matching results should be explainable where practical.
* Do not hide critical constraints behind an opaque score.

The planned matching factors include:

```text id="i0f94i"
Price
Distance
Rating
Availability
Capacity
Urgency
```

The matching service may evolve, but changes must remain compatible with the project architecture.

---

## Real-Time Features

* Socket.IO is used for real-time communication and updates.
* Authenticate socket connections before exposing protected data.
* Do not trust room identifiers provided by clients without authorization checks.
* Keep Socket.IO event handlers thin.
* Reuse service-layer business logic.
* Do not duplicate REST business rules inside socket event handlers.
* Use clear and consistent event naming.
* Real-time events must not bypass database validation.

Examples:

```text id="mbrsb5"
booking:updated
quotation:created
message:created
notification:created
```

---

## Payments

* Payment secrets must never be exposed to the frontend.
* Payment order creation occurs through the backend.
* Payment verification occurs through the backend.
* Webhook or signature verification must validate authenticity where applicable.
* The frontend must not mark a payment as successful based only on client-side state.
* Payment state changes must update validated backend records.
* Do not expose secret keys in environment variables prefixed for client-side access.

Razorpay Checkout may run on the frontend, but sensitive order and verification logic remains on the backend.

---

## Styling

* Use Tailwind CSS for application styling.
* Follow `context/ui-context.md`.
* Use design tokens and semantic CSS variables where defined.
* Do not introduce arbitrary hardcoded colors in components.
* Follow the defined border radius scale.
* Reuse spacing and typography patterns.
* Avoid excessive inline style objects.
* Do not introduce another CSS framework without a strong reason.
* Use responsive utility patterns consistently.
* Support dark and light modes according to the active UI context.

---

## Component Library

* Use shadcn/ui as the base component system.
* Use existing components before creating custom primitives.
* Components from shadcn/ui should be added through the appropriate project workflow.
* Do not modify shared UI primitives unnecessarily for one page.
* Feature-specific components should compose reusable primitives.
* Use Lucide React for icons.
* Do not introduce multiple icon libraries.

---

## Error Handling

* Use centralized backend error handling.
* Create typed or structured application errors where useful.
* Expected domain errors should be distinguishable from unexpected system failures.
* Log unexpected server errors with sufficient context.
* Never expose stack traces to API clients in production.
* Frontend errors should present useful user-facing messages.
* Preserve user input after recoverable errors when possible.
* Always consider retry behavior for network-dependent operations.

---

## Logging

* Log meaningful operational events and unexpected failures.
* Do not log passwords, tokens, secrets, payment details, or sensitive user data.
* Avoid leaving development `console.log` statements in production paths.
* Logging should help diagnose failures without leaking credentials.

---

## Environment Variables

* All secrets and environment-specific configuration must use environment variables.
* Provide an `.env.example` file containing required variable names without real secrets.
* Validate required environment variables at application startup.
* Never commit `.env` files containing secrets.
* Never hardcode API keys, JWT secrets, database URLs, or payment credentials.

---

## File Organization

### Root

```text id="qtr8bd"
HostNexus/
```

Contains:

* Workspace configuration
* Turborepo configuration
* Root package configuration
* Shared context files
* Development specifications
* Application folders
* Shared packages

---

### `context/`

Contains the permanent source of truth for AI-assisted development.

```text id="f8z6ly"
context/
├── project-overview.md
├── architecture.md
├── code-standards.md
├── ai-workflow-rules.md
├── progress-tracker.md
└── ui-context.md
```

Do not place temporary implementation notes here unless they affect permanent project understanding.

---

### `specs/`

Contains focused implementation specifications.

```text id="v4ip2g"
specs/
├── backend/
└── frontend/
```

Each specification should define:

* Objective
* Scope
* Non-goals
* Acceptance criteria
* Expected files or modules
* Verification requirements

Do not place implementation code here.

---

### `apps/web/`

Contains the Next.js frontend application.

Recommended organization:

```text id="0ad0l9"
apps/web/
├── app/           # Routes and layouts
├── components/    # UI and feature components
├── hooks/         # Reusable React hooks
├── lib/           # Frontend utilities and API clients
├── types/         # Frontend-local types only
├── public/        # Static assets
└── styles/        # Global styling where required
```

Shared domain types should come from `packages/types` rather than being duplicated.

---

### `apps/api/`

Contains the Express backend.

Recommended organization:

```text id="t7qifm"
apps/api/
├── src/
│   ├── config/        # Environment and infrastructure configuration
│   ├── routes/        # Route definitions
│   ├── controllers/   # HTTP request/response handling
│   ├── services/      # Business logic
│   ├── middleware/    # Express middleware
│   ├── schemas/       # Zod validation schemas
│   ├── utils/         # Generic backend utilities
│   ├── ai/            # AI orchestration and controlled tools
│   ├── sockets/       # Socket.IO configuration and handlers
│   ├── types/         # Backend-local types
│   ├── app.ts         # Express application configuration
│   └── server.ts      # Server startup
│
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
│
└── tests/
```

---

### `packages/types/`

Contains shared TypeScript contracts used across applications.

Examples:

```text id="gsyqgq"
User
Business
Resource
Booking
Quotation
Requirement
Review
Message
API response contracts
AI response contracts
```

Only place types here when they are genuinely shared across applications.

Do not turn `packages/types` into a dumping ground for every local implementation type.

---

## Naming Conventions

### Files

Use descriptive kebab-case names where appropriate:

```text id="8khqnt"
auth.service.ts
resource.controller.ts
booking.schema.ts
smart-matching.service.ts
```

### TypeScript classes and components

Use PascalCase:

```text id="im2f6b"
ResourceService
BookingCard
AIConcierge
```

### Functions and variables

Use camelCase:

```text id="j25tm0"
createBooking
calculateMatchScore
currentBusiness
```

### Constants

Use camelCase or uppercase depending on project conventions, but remain consistent.

### API endpoints

Use plural resource naming where appropriate:

```text id="wspmfg"
GET /resources
GET /resources/:id
POST /resources
PATCH /resources/:id
```

---

## Testing and Verification

Before completing an implementation task:

* Run TypeScript type checking.
* Run relevant tests.
* Validate Prisma schema if changed.
* Run the application build where practical.
* Test affected API endpoints.
* Verify important success and failure paths.
* Fix errors caused by the implementation.
* Do not claim a feature is complete when verification is failing.

For hackathon development, prioritize tests for:

* Authentication
* Authorization
* Booking state transitions
* Availability conflict prevention
* Payment verification
* AI tool permissions

---

## Git and Commits

* One focused implementation task should normally correspond to one focused branch or logical commit sequence.
* Do not mix unrelated features in the same commit.
* Use descriptive commit messages.

Recommended format:

```text id="s3utbl"
feat(api): add resource availability endpoints
fix(booking): prevent overlapping confirmed bookings
refactor(auth): extract JWT utility
docs(context): update development progress
```

Before pushing:

* Review changed files.
* Remove unrelated modifications.
* Verify the implementation.
* Update `context/progress-tracker.md`.

---

## Final Development Rule

For every implementation task:

```text id="b6osai"
Read Context
     ↓
Inspect Existing Code
     ↓
Understand Current Progress
     ↓
Implement One Focused Task
     ↓
Verify
     ↓
Fix
     ↓
Update Progress
     ↓
Review Changes
     ↓
Commit and Push
```

Do not proceed to the next feature until the current implementation is verified or its known issues are explicitly documented in `context/progress-tracker.md`.
