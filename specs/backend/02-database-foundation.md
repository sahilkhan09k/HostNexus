# Unit 02 — Database Foundation

> **MANDATORY FIRST STEP:** Before making any changes, read `CLAUDE.md` in the project root. Then read all files in `context/`, especially `architecture.md`, `code-standards.md`, `ai-workflow-rules.md`, `project-overview.md`, and `progress-tracker.md`.

## Objective

Set up the HostNexus PostgreSQL + Prisma database foundation.

This unit establishes the initial database infrastructure and the first two core domain entities:

* `User`
* `Business`

At the end of this unit:

```text
Express API
     ↓
Prisma
     ↓
PostgreSQL
     ↓
User + Business data
```

must work successfully.

---

# Scope

Implement ONLY the following:

1. PostgreSQL connection configuration
2. Prisma installation and configuration
3. Initial Prisma schema
4. `User` model
5. `Business` model
6. User → Business relationship
7. Prisma migration
8. Prisma client configuration
9. Database connection verification
10. Development seed script
11. Required environment configuration
12. Basic database health verification

Do not implement authentication or any other business feature.

---

# 1. PostgreSQL Configuration

Use PostgreSQL as defined in:

```text
context/architecture.md
```

The backend must obtain its database connection through:

```env
DATABASE_URL=
```

Do not hardcode the database connection string anywhere.

Do not commit the real `DATABASE_URL`.

The real database URL must remain in the developer's local environment.

---

# 2. Environment Validation

Extend the existing backend environment configuration to support:

```env
DATABASE_URL=
```

Use the existing environment validation approach.

`DATABASE_URL` must be validated at application startup.

Do not access:

```ts
process.env.DATABASE_URL
```

throughout the application.

Use the centralized environment configuration already established in Unit 01.

---

# 3. Prisma Setup

Add Prisma to:

```text
apps/api
```

Configure Prisma to use PostgreSQL.

Create:

```text
apps/api/prisma/schema.prisma
```

Configure the Prisma client according to the current Prisma version being installed.

Do not use outdated Prisma configuration patterns if the installed version requires a newer configuration approach.

Follow the official/current Prisma conventions supported by the installed version.

---

# 4. Initial Database Schema

Create ONLY the following core models:

```text
User
Business
```

Do not create the entire HostNexus database schema yet.

The relationship should conceptually be:

```text
User
  │
  └── Business
```

A user must be able to own/manage a business.

---

# User Model

The `User` model should contain the minimum information required for the current foundation.

At minimum:

```text
id
email
passwordHash
createdAt
updatedAt
```

Requirements:

* `id` must be a unique primary identifier.
* `email` must be unique.
* `passwordHash` must never be exposed through normal API responses.
* Password hashing itself is NOT part of this task.
* Do not add authentication logic yet.

Do not store plaintext passwords.

---

# Business Model

The `Business` model should contain the minimum foundation required for HostNexus.

At minimum:

```text
id
name
createdAt
updatedAt
ownerId
```

Requirements:

* `id` must be a unique primary identifier.
* `name` is required.
* `ownerId` establishes ownership by a `User`.
* The relationship must be represented using a proper Prisma relation.

Do not add resource, booking, payment, or marketplace fields yet.

---

# User → Business Relationship

Implement the relationship:

```text
User
  ↓
Business
```

A business has an owner.

The schema must support querying:

```text
User → Business
```

and:

```text
Business → Owner
```

Use Prisma relations and foreign keys.

Do not implement authorization logic in this unit.

Authorization will be implemented later.

---

# 5. Prisma Migration

Create the initial Prisma migration.

The migration must create the required PostgreSQL tables for:

```text
User
Business
```

Verify that the migration can be applied successfully to the configured development database.

Do not manually modify the generated migration SQL unless there is a demonstrated requirement.

---

# 6. Prisma Client

Create a centralized Prisma client that can be reused by backend services.

The client should not be instantiated separately in every controller or service.

Use a reusable database module, for example:

```text
apps/api/src/config/database.ts
```

or another location consistent with the existing architecture.

The exact filename may differ if the existing project structure has a better location.

The important requirement is:

```text
One reusable Prisma client
        ↓
Backend services
```

Do not create multiple unnecessary Prisma client instances.

---

# 7. Database Health Verification

Add a simple database connectivity verification mechanism.

The project already has:

```http
GET /health
```

Do not make the existing lightweight health endpoint unnecessarily dependent on the database.

Instead, add a separate database health endpoint such as:

```http
GET /health/db
```

The endpoint should:

1. Attempt a minimal database query.
2. Return success if PostgreSQL is reachable.
3. Return an appropriate failure response if the database is unavailable.

Use the project's standard API response format.

Expected successful response conceptually:

```json
{
  "success": true,
  "data": {
    "status": "ok"
  }
}
```

Do not expose database credentials or internal connection details in the response.

---

# 8. Seed Data

Create a Prisma seed script for development.

Seed a small amount of realistic data.

Create approximately:

```text
2–3 Users
2–3 Businesses
```

Example businesses may include:

```text
Hotel
Restaurant
Event Management Company
```

The exact names are not important.

The seed data must demonstrate the:

```text
User → Business
```

relationship.

Do not create resources, bookings, payments, or other future entities.

---

# 9. Seed Safety

The seed script must be safe to run repeatedly during development.

Avoid creating uncontrolled duplicate users/businesses every time the seed command runs.

Use appropriate Prisma operations such as:

```text
upsert
```

or another clean deterministic strategy.

Do not use random data that changes every execution unless there is a specific reason.

---

# 10. Database Scripts

Add appropriate scripts to `apps/api/package.json` or the workspace configuration for common Prisma operations.

The developer should be able to perform the equivalent of:

```bash
pnpm prisma generate
```

```bash
pnpm prisma migrate dev
```

```bash
pnpm prisma db seed
```

Use the project's package manager:

```text
pnpm
```

Do not introduce npm/yarn-specific workflows.

---

# 11. Prisma Commands

After implementation, verify the appropriate commands for the installed Prisma version.

At minimum, verify:

```bash
pnpm prisma validate
```

```bash
pnpm prisma generate
```

and the development migration.

If the exact command differs because of the installed Prisma version, follow the current Prisma tooling rather than forcing an outdated command.

---

# 12. API Integration

The Express application must be able to initialize the database layer without crashing when the database is correctly configured.

Do not add database calls to unrelated endpoints.

Only the database health endpoint needs to explicitly verify connectivity in this unit.

Future services will use the centralized Prisma client.

---

# Non-Goals

Do NOT implement:

```text
❌ Authentication
❌ JWT
❌ bcrypt
❌ Login
❌ Registration API
❌ Authorization
❌ Resource model
❌ Resource CRUD
❌ Availability
❌ Booking
❌ Quotations
❌ Requirements
❌ Reviews
❌ Messaging
❌ Payments
❌ Razorpay
❌ Redis
❌ Meilisearch
❌ Cloudinary
❌ Socket.IO
❌ AI Concierge
❌ AI tools
❌ Smart Matching
```

Do not create database models for these features yet.

They will be introduced through separate implementation units.

---

# Implementation Rules

Follow:

```text
context/project-overview.md
context/architecture.md
context/code-standards.md
context/ai-workflow-rules.md
context/ui-context.md
context/progress-tracker.md
```

Important:

* Inspect the existing backend before modifying it.
* Reuse the existing environment configuration.
* Reuse the existing error-handling architecture.
* Do not rewrite Unit 01 unnecessarily.
* Do not duplicate configuration.
* Do not hardcode credentials.
* Do not commit real `.env` values.
* Do not use `any`.
* Do not create speculative models.
* Do not modify unrelated frontend code.

---

# Expected Structure

After completion, the relevant backend structure should approximately contain:

```text
apps/api/
│
├── src/
│   ├── config/
│   │   ├── env.ts
│   │   └── database.ts
│   │
│   ├── routes/
│   │   ├── health.routes.ts
│   │   └── ...
│   │
│   ├── middleware/
│   │
│   ├── app.ts
│   └── server.ts
│
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
│
├── .env.example
├── package.json
└── tsconfig.json
```

The exact structure may differ if the existing architecture provides a better location.

Do not create empty folders merely to match this example.

---

# Acceptance Criteria

This unit is complete only when:

### Prisma

* [ ] Prisma is installed in `apps/api`.
* [ ] PostgreSQL is configured.
* [ ] `schema.prisma` exists.
* [ ] `User` model exists.
* [ ] `Business` model exists.
* [ ] User → Business relationship works.
* [ ] Prisma schema validates.
* [ ] Prisma client generates successfully.

### Database

* [ ] Development PostgreSQL database connects successfully.
* [ ] Migration applies successfully.
* [ ] Database contains the required tables.
* [ ] No future feature tables were unnecessarily created.

### Environment

* [ ] `DATABASE_URL` is validated.
* [ ] Real credentials are not committed.
* [ ] `.env.example` documents the required variable.

### Seed

* [ ] Seed script exists.
* [ ] Seed creates realistic development users.
* [ ] Seed creates businesses.
* [ ] Seed demonstrates User → Business ownership.
* [ ] Seed can be safely rerun without uncontrolled duplicates.

### API

* [ ] Existing `GET /health` still works.
* [ ] `GET /health/db` verifies database connectivity.
* [ ] Database credentials are never returned by the API.
* [ ] Existing Unit 01 functionality still works.

### Verification

Run the appropriate:

```bash
pnpm install
pnpm prisma validate
pnpm prisma generate
pnpm prisma migrate dev
pnpm prisma db seed
pnpm typecheck
pnpm build
```

Also verify:

```text
GET /health
GET /health/db
```

Do not claim a check passed unless it was actually run.

---

# Progress Tracker Update

After successful completion, update:

```text
context/progress-tracker.md
```

Keep it concise.

Example:

```md
## Current Phase

- Backend Core

## Current Goal

- Establish database foundation.

## Completed

- Unit 01 — Project Foundation
- Unit 02 — Database Foundation

## In Progress

- None

## Next Up

- Unit 03 — Authentication

## Open Questions

- None currently

## Architecture Decisions

- None beyond architecture.md

## Session Notes

- PostgreSQL + Prisma foundation is working.
- User and Business models are implemented.
- Database health endpoint verified.
- Seed data verified.
```

---

# Completion Protocol

When the implementation is finished:

1. Review the existing code and all changes.
2. Verify every acceptance criterion.
3. Run the relevant Prisma commands.
4. Run type checking.
5. Run the production build.
6. Verify `/health`.
7. Verify `/health/db`.
8. Verify seed data.
9. Fix errors introduced by this task.
10. Update `context/progress-tracker.md`.
11. Report:

* Files created
* Files modified
* Database models added
* Commands executed
* Verification results
* Any remaining issue

12. Stop.

**Do not begin Unit 03 or implement authentication automatically.**
