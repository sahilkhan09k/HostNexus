# AI Workflow Rules

## Purpose

This document defines how AI coding agents must work on HostNexus.

HostNexus is developed using a context-driven, spec-based workflow. The AI must use the project's context files and the current implementation specification as the primary source of truth.

The AI is an implementation assistant. It must not independently redesign the product, invent requirements, expand scope, or rewrite working architecture without instruction.

---

# Approach

Build HostNexus incrementally using a **context-driven, spec-based development workflow**.

Before implementing any task, read and understand:

```text
context/project-overview.md
context/architecture.md
context/code-standards.md
context/ai-workflow-rules.md
context/progress-tracker.md
context/ui-context.md
```

Then read the current implementation specification provided by the developer.

The workflow is:

```text
Read Project Context
        ↓
Read Current Progress
        ↓
Read Implementation Spec
        ↓
Inspect Existing Code
        ↓
Identify Exact Scope
        ↓
Implement Only That Scope
        ↓
Verify
        ↓
Fix
        ↓
Update Progress
        ↓
Review Changes
        ↓
Commit-Ready State
```

The context files define:

* What HostNexus is
* How the system is structured
* Coding standards
* Product boundaries
* UI rules
* Current development state

The implementation specification defines the **current unit of work**.

Always implement against these sources of truth.

Do not infer or invent major behavior from scratch.

---

# Context Priority

When instructions conflict, use the following priority:

```text
1. Explicit Developer Instruction
        ↓
2. Current Implementation Specification
        ↓
3. architecture.md Invariants
        ↓
4. project-overview.md
        ↓
5. code-standards.md
        ↓
6. ui-context.md
        ↓
7. Existing Code Patterns
        ↓
8. AI Assumptions
```

Existing code may provide implementation patterns, but existing code does not override explicit architecture or project requirements.

AI assumptions have the lowest priority.

---

# Mandatory Pre-Implementation Process

Before changing code:

1. Read the relevant context files.
2. Read `context/progress-tracker.md`.
3. Read the current implementation specification.
4. Inspect the existing relevant files and folder structure.
5. Identify whether the requested functionality already exists partially.
6. Reuse existing patterns and services where appropriate.
7. Define the exact implementation boundary.
8. Check which invariants from `architecture.md` apply.
9. Check whether the task changes database schema, API contracts, authentication, business logic, AI tools, or UI.
10. Implement only after understanding the existing system.

Do not begin by blindly generating an entire application.

Do not replace existing working implementations without understanding them.

---

# Scoping Rules

* Work on one focused feature unit at a time.
* Prefer small, verifiable increments over large speculative changes.
* Do not combine unrelated system boundaries in one implementation step.
* Do not implement future features because they appear related to the current task.
* Do not perform broad refactoring while implementing a focused feature.
* Do not modify unrelated files merely to "clean up" code.
* Complete the acceptance criteria of the current specification before moving to another feature.
* Reuse existing services and infrastructure rather than duplicating logic.
* Prefer the smallest change that correctly satisfies the specification.

A feature unit should ideally be:

```text
Small enough to understand
        +
Small enough to verify
        +
Large enough to produce meaningful progress
```

---

# One Specification = One Focused Task

Each implementation specification should represent one bounded unit of work.

Examples of good units:

```text
Backend authentication foundation
```

```text
Resource CRUD API
```

```text
Resource availability service
```

```text
Booking request creation flow
```

```text
Quotation creation workflow
```

```text
Marketplace search API
```

```text
AI search_resources tool
```

Examples of bad units:

```text
Build the complete backend
```

```text
Build authentication, resources, bookings, payments,
AI, and Socket.IO
```

```text
Build the entire marketplace
```

If a task is too large to confidently verify, it must be split.

---

# When to Split Work

Split an implementation step if it combines multiple major concerns such as:

* Database schema changes and multiple unrelated features.
* Authentication implementation and unrelated marketplace functionality.
* Resource management and booking workflow changes.
* Booking logic and payment integration.
* REST API implementation and unrelated Socket.IO behavior.
* AI orchestration and unrelated frontend redesign.
* Search infrastructure and unrelated dashboard analytics.
* Multiple unrelated API domains.
* Large UI redesigns and core backend logic in the same task.
* Multiple features that cannot be verified independently.
* Behavior that is unclear or missing from the context files.

A task should also be split if:

* It changes too many unrelated files.
* The implementation cannot be tested quickly.
* The expected completion criteria are unclear.
* It requires guessing multiple product decisions.
* A failure would be difficult to isolate.

If the change cannot be verified end to end within its defined scope, the scope is too broad.

Split it.

---

# Handling Missing Requirements

Do not invent major product behavior that is not defined in the project context or current specification.

If a requirement is ambiguous:

1. Check all relevant context files.
2. Inspect existing implementation patterns.
3. Check whether the current specification defines the behavior.
4. If the ambiguity materially affects architecture, business logic, data integrity, security, or user behavior, stop implementation.
5. Add the ambiguity or open question to `context/progress-tracker.md`.
6. Request clarification from the developer before making a consequential assumption.

If a requirement is missing:

* Do not silently invent the behavior.
* Do not create unnecessary architecture for hypothetical future requirements.
* Add the missing requirement as an open question in `context/progress-tracker.md` when it blocks meaningful implementation.
* Continue only with the clearly defined portion of the task when safe.

For small implementation details that do not materially affect product behavior, use the simplest approach consistent with the existing architecture and document the assumption if necessary.

---

# Inspect Before Creating

Before creating:

* A new service
* A new controller
* A new API route
* A new component
* A new utility
* A new shared type
* A new database model
* A new AI tool
* A new infrastructure dependency

First inspect whether an equivalent implementation already exists.

Do not create duplicates such as:

```text
booking.service.ts
booking-manager.service.ts
booking-helper.service.ts
booking-utils.ts
```

when the existing booking service can be extended cleanly.

Extend existing architecture when appropriate.

Create new modules only when a new responsibility clearly exists.

---

# Backend Implementation Rules

For standard backend features, preserve the architecture:

```text
Route
  ↓
Middleware
  ↓
Controller
  ↓
Service
  ↓
Prisma / Infrastructure
```

Do not:

* Put complex business logic in routes.
* Put complex business logic in controllers.
* Access Prisma directly from frontend code.
* Duplicate business logic between controllers.
* Bypass service-layer validation.
* Let AI tools directly manipulate database records.
* Let Socket.IO handlers bypass business services.

Backend services are the reusable business logic layer.

REST APIs, Socket.IO handlers, and AI tools should reuse the same underlying domain services where appropriate.

---

# Frontend Implementation Rules

Before creating UI:

1. Read `context/ui-context.md`.
2. Inspect existing components.
3. Reuse existing design primitives.
4. Follow the project's visual tokens.
5. Follow the existing layout and component patterns.

Do not:

* Introduce random colors.
* Introduce a second design system.
* Duplicate existing UI primitives.
* Put critical business logic in client components.
* Assume frontend state is authoritative for bookings, payments, or availability.
* Add `"use client"` unnecessarily.

Every meaningful asynchronous interface should consider:

```text
Loading
Empty
Success
Error
```

---

# Database and Schema Rules

Before modifying `schema.prisma`:

1. Confirm the current domain model.
2. Check whether an existing model can represent the requirement.
3. Check relevant architecture invariants.
4. Consider relationships and ownership.
5. Consider required indexes and constraints.
6. Ensure the schema supports the current feature rather than speculative future features.

After schema changes:

* Run Prisma validation.
* Generate the Prisma client where required.
* Create and test migrations.
* Update affected services.
* Update shared contracts where required.
* Verify existing functionality affected by the schema change.

Do not create duplicate domain models for:

* Provider and seeker businesses.
* Similar booking concepts.
* Duplicate user ownership systems.

HostNexus uses a unified `Business` model.

---

# Authentication and Authorization Rules

Authentication and authorization are separate concerns.

Before implementing a protected mutation, verify:

```text
Authenticated User
        +
Business Relationship
        +
Required Permission
        +
Valid Domain State
```

Never assume:

```text
Authenticated = Authorized
```

Do not trust:

* Client-provided business IDs
* Client-provided ownership IDs
* Client-provided roles
* Client-provided booking states

Sensitive operations must validate authorization on the backend.

---

# Booking and Availability Rules

Booking logic is a protected domain.

The AI must never implement a shortcut that bypasses:

* Authentication
* Business ownership validation
* Availability validation
* Quantity or capacity validation
* Booking state validation
* Payment validation where required

Before confirming a booking:

```text
Validate User
      ↓
Validate Permission
      ↓
Validate Resource
      ↓
Validate Availability
      ↓
Validate Quantity / Capacity
      ↓
Validate State Transition
      ↓
Perform Atomic Update Where Required
```

Confirmed bookings must not create conflicting allocations.

Frontend state is never sufficient proof of availability.

AI recommendations are never sufficient proof of availability.

---

# AI Implementation Rules

AI is an orchestration layer, not the source of truth.

The AI must:

* Use controlled tools.
* Use validated backend services.
* Return information derived from real platform data.
* Respect authentication and authorization boundaries.
* Respect availability and booking rules.
* Require confirmation for important actions where defined.

The AI must not:

* Invent resources.
* Invent prices.
* Invent availability.
* Invent booking status.
* Execute arbitrary SQL.
* Directly modify protected database records.
* Bypass service-layer business logic.
* Assume search results are authoritative.

AI architecture must follow:

```text
User Request
      ↓
AI Orchestrator
      ↓
Controlled Tool
      ↓
Backend Service
      ↓
Validated Data / Action
      ↓
AI Response
```

Not:

```text
User Request
      ↓
LLM
      ↓
Direct Database Mutation
```

---

# Smart Matching Rules

The smart matching engine must remain:

* Deterministic
* Testable
* Explainable where practical
* Separate from LLM reasoning

The matching service may rank resources using:

* Price
* Distance
* Rating
* Availability
* Capacity
* Urgency

Hard constraints must be applied before or independently of ranking.

A highly ranked resource must not be presented as available unless availability has been validated.

Do not hide critical booking constraints inside a generic AI score.

---

# External Integration Rules

External providers must be isolated behind clear integration boundaries.

Examples include:

* Cloudinary
* Razorpay
* Meilisearch
* Redis
* Socket.IO
* Maps provider
* AI provider

Do not spread provider-specific implementation code throughout unrelated modules.

Examples:

```text
Cloudinary → media integration/service
Razorpay → payment integration/service
AI SDK → ai/orchestration
Meilisearch → search service
```

If a provider changes, the core business domain should require minimal modification.

---

# Protected Files

Do not modify the following unless explicitly required by the current specification or developer instruction.

### `context/*`

Do not casually rewrite project context files.

Update them only when implementation creates a genuine change to:

* Architecture
* Standards
* Scope
* Storage decisions
* Current progress
* UI system

Do not rewrite permanent context merely to match temporary implementation preferences.

---

### `components/ui/*`

Treat generated or shared UI primitives as protected.

Do not modify them for a single feature unless the task explicitly requires a shared primitive change.

Prefer composing existing UI components.

---

### Third-Party Library Internals

Do not modify:

* Files inside `node_modules`
* Generated dependency internals
* External package source code

Do not patch third-party code unless explicitly required.

---

### Generated Files

Do not manually edit generated files unless the generation workflow explicitly requires it.

Examples may include:

* Prisma generated client files
* Build output
* Generated type declarations

Modify the source configuration and regenerate instead.

---

### Environment and Secrets

Do not:

* Commit secrets.
* Hardcode credentials.
* Replace environment configuration with literal values.
* Log secrets.

Do not modify production environment configuration unless explicitly instructed.

---

# Keeping Documentation in Sync

Update the relevant context file whenever implementation creates a lasting project-level change.

Update `architecture.md` when implementation changes:

* System boundaries
* Service architecture
* Data ownership
* Storage model
* Infrastructure decisions
* Domain boundaries
* Authentication model
* Major integration architecture
* Core invariants

Update `code-standards.md` when implementation establishes:

* A new project-wide coding convention
* A new API convention
* A new file organization rule
* A reusable naming convention

Update `ui-context.md` when implementation changes:

* Design tokens
* Typography system
* Component library decisions
* Layout patterns
* Icon rules
* Visual interaction conventions

Update `project-overview.md` when implementation changes:

* Product scope
* Core user journeys
* Feature definitions
* Product principles

Update `progress-tracker.md` whenever:

* A feature unit is completed.
* A feature is partially completed.
* A blocker is discovered.
* A known issue exists.
* A requirement is ambiguous.
* An implementation decision needs follow-up.
* The next development task changes.

Do not update documentation merely because code was modified.

Update documentation when the project's persistent understanding changes.

---

# Progress Tracking Rules

After every focused implementation unit:

1. Mark the completed work.
2. Record important files created or modified.
3. Record verification performed.
4. Record known issues.
5. Record unresolved questions.
6. Define the recommended next implementation unit.

The progress tracker should answer:

```text
What is complete?
What is currently working?
What is partially complete?
What is blocked?
What remains?
What should happen next?
```

Do not mark a feature complete when it has not been verified.

---

# Verification Rules

Every implementation unit must be verified according to its scope.

Possible verification includes:

### Backend

* Type checking
* Linting
* Unit tests where available
* API endpoint testing
* Authentication testing
* Authorization testing
* Database validation
* Prisma validation
* Migration testing

### Frontend

* Type checking
* Build validation
* Visual verification
* Loading state verification
* Error state verification
* Empty state verification
* Responsive behavior verification

### Booking Features

* Valid transition testing
* Invalid transition testing
* Ownership testing
* Availability conflict testing

### AI Features

* Tool execution testing
* Real data validation
* Failure handling
* Unauthorized action prevention
* Confirmation behavior

Do not claim verification that was not actually performed.

If a verification step cannot be performed, document the reason.

---

# Before Moving to the Next Unit

The AI must confirm:

1. The current unit works end to end within its defined scope.
2. The current implementation satisfies the specification's acceptance criteria.
3. No invariant in `context/architecture.md` was violated.
4. No unrelated working functionality was intentionally broken.
5. TypeScript errors introduced by the task are resolved.
6. Relevant runtime validation works.
7. Relevant authorization and ownership checks work.
8. Relevant database schema validation or migrations are complete.
9. `context/progress-tracker.md` reflects the current state.
10. Relevant build, type-check, test, or verification commands have been run where available.
11. Known limitations are documented rather than hidden.
12. The implementation is in a clean, commit-ready state.

---

# Completion Rule

Do not move to the next feature simply because code has been written.

A feature unit is complete only when:

```text
Specification Satisfied
        +
Implementation Integrated
        +
Verification Performed
        +
No Architecture Invariant Violated
        +
Progress Updated
```

---

# Final Operating Principle

For every HostNexus development task:

```text
UNDERSTAND
    ↓
INSPECT
    ↓
SCOPE
    ↓
IMPLEMENT
    ↓
VERIFY
    ↓
FIX
    ↓
DOCUMENT PROGRESS
    ↓
REVIEW
    ↓
COMMIT-READY
```

The goal is not to generate the maximum amount of code.

The goal is to make **one correct, verifiable, context-consistent improvement at a time**.

When uncertain, preserve correctness, architecture invariants, data integrity, and scope discipline over speed or speculative feature expansion.
