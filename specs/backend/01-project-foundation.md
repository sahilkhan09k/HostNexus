# Unit 01 — Project Foundation

> **MANDATORY FIRST STEP:** Before making any changes, read `CLAUDE.md` in the project root and follow all instructions in it. Then read all files in the `context/` directory, especially `context/progress-tracker.md`, before beginning implementation.

## Objective

Set up the initial HostNexus project foundation so the repository has a clean monorepo structure with a working frontend application, backend API, shared types package, and development tooling.

At the end of this unit, the project structure must be ready for the next development units.

---

# What We Are Building

Create the following project structure:

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
│   └── 01-project-foundation.md
│
├── apps/
│   ├── web/
│   └── api/
│
├── packages/
│   └── types/
│
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.json
├── .gitignore
└── .env.example
```

The project must use a monorepo structure.

---

# Required Technology

Use the following foundation:

| Area               | Technology                     |
| ------------------ | ------------------------------ |
| Monorepo           | pnpm workspaces                |
| Task runner        | Turborepo                      |
| Frontend           | Next.js + TypeScript           |
| Frontend styling   | Tailwind CSS                   |
| Backend            | Node.js + Express + TypeScript |
| Backend validation | Zod                            |
| Shared contracts   | TypeScript package             |
| Package manager    | pnpm                           |

Do not add database infrastructure yet.

Do not add authentication yet.

Do not add AI functionality yet.

---

# Scope

## 1. Root Monorepo Setup

Configure the project as a pnpm workspace.

The workspace must include:

```text
apps/*
packages/*
```

Configure Turborepo for shared development commands.

The root project should support appropriate commands for:

```text
dev
build
lint
typecheck
```

Use the simplest working configuration.

Do not add unnecessary Turborepo pipeline complexity.

---

## 2. Frontend Application

Create:

```text
apps/web
```

Use:

* Next.js
* TypeScript
* App Router
* Tailwind CSS

The frontend must:

* Start successfully.
* Build successfully.
* Use strict TypeScript.
* Have a basic application page.
* Be ready for future HostNexus UI development.

At this stage, do not build:

* Authentication pages
* Marketplace
* Dashboard
* Resource management
* AI Concierge
* Booking flows

A minimal placeholder page is sufficient.

The goal is application foundation, not UI implementation.

---

## 3. Backend Application

Create:

```text
apps/api
```

Use:

* Node.js
* Express
* TypeScript
* Zod

Recommended source structure:

```text
apps/api/
├── src/
│   ├── config/
│   ├── routes/
│   ├── middleware/
│   ├── utils/
│   ├── app.ts
│   └── server.ts
│
├── package.json
├── tsconfig.json
└── .env.example
```

Only create folders that are useful at this stage.

Do not create empty feature folders merely because future architecture may require them.

The backend must:

* Start successfully.
* Load environment configuration.
* Validate required environment variables.
* Create the Express application separately from server startup.
* Support centralized error handling.
* Expose a health endpoint.

---

# Health Endpoint

Implement:

```text
GET /health
```

The endpoint should return a successful response confirming that the API is running.

Use the API response conventions defined in:

```text
context/code-standards.md
```

The response should contain at minimum:

```json
{
  "success": true,
  "data": {
    "status": "ok"
  }
}
```

A timestamp may be included if useful.

Do not connect this endpoint to the database.

---

# Environment Configuration

Create a clean environment configuration system for the backend.

Environment values must be:

* Loaded from environment variables.
* Validated with Zod.
* Typed after validation.
* Accessed through a central configuration module.

Do not access `process.env` throughout the application.

Instead:

```text
process.env
    ↓
config/env.ts
    ↓
Validated configuration object
    ↓
Application
```

Required initial variables should include only what is necessary for the current project foundation.

Examples may include:

```text
NODE_ENV
PORT
```

Do not add database, payment, Cloudinary, Redis, or AI credentials yet unless required by the implementation.

Provide an `.env.example` file without real secrets.

---

# Shared Types Package

Create:

```text
packages/types
```

This package will eventually contain shared TypeScript contracts between the frontend and backend.

For this unit:

* Configure the package correctly.
* Ensure it can be imported by workspace applications if needed.
* Do not create speculative domain types.
* Do not add `User`, `Business`, `Booking`, or `Resource` types yet.

The package foundation is sufficient.

---

# TypeScript

TypeScript must be configured with strict mode.

The repository should support consistent TypeScript development across:

```text
apps/web
apps/api
packages/types
```

Do not use `any`.

Do not disable strict TypeScript checks to make the build pass.

---

# Error Handling

Set up the backend foundation for centralized error handling.

At minimum:

```text
Request
   ↓
Route
   ↓
Controller / Handler
   ↓
Error
   ↓
Centralized Error Middleware
```

The health endpoint does not need complex error scenarios.

The purpose is to establish the correct backend pattern before feature development begins.

Do not implement feature-specific error classes unless required.

Keep the implementation simple.

---

# Package Scripts

The repository should support development commands appropriate for the monorepo.

The expected developer workflow should allow:

```bash
pnpm dev
```

to start the development applications through the workspace configuration.

The repository should also support:

```bash
pnpm build
```

and:

```bash
pnpm typecheck
```

Use `pnpm lint` only if linting is configured and working correctly.

Do not add scripts that do not work.

---

# CLAUDE.md

Do not overwrite or remove the existing `CLAUDE.md`.

If the existing `CLAUDE.md` does not already instruct coding agents to use the context system, preserve its existing content and only modify it if explicitly required by the developer.

`CLAUDE.md` remains the first file the coding agent must read before implementation.

---

# Non-Goals

Do NOT implement any of the following during this unit:

* PostgreSQL
* Prisma
* Database models
* Database migrations
* Authentication
* JWT
* bcrypt
* User management
* Business profiles
* Resource management
* Availability management
* Booking workflows
* Quotations
* Reverse marketplace
* Smart matching
* Meilisearch
* Redis
* Socket.IO
* Cloudinary
* Razorpay
* Maps
* AI Concierge
* AI tools
* Production deployment

Do not add these dependencies preemptively.

They will be implemented in future focused units.

---

# Implementation Constraints

Follow:

```text
context/project-overview.md
context/architecture.md
context/code-standards.md
context/ai-workflow-rules.md
context/ui-context.md
context/progress-tracker.md
```

Do not:

* Invent new architecture.
* Add unnecessary dependencies.
* Build future features.
* Create large amounts of placeholder code.
* Create empty files for future modules.
* Refactor unrelated existing code.
* Modify protected files unless necessary.
* Use `any`.
* Disable TypeScript strict mode.
* Hardcode environment secrets.

---

# Expected Final Structure

The exact generated framework files may vary, but the resulting structure should approximately be:

```text
HostNexus/
│
├── CLAUDE.md
│
├── context/
│
├── specs/
│   └── 01-project-foundation.md
│
├── apps/
│   ├── web/
│   │   ├── app/
│   │   ├── public/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── ...
│   │
│   └── api/
│       ├── src/
│       │   ├── config/
│       │   ├── routes/
│       │   ├── middleware/
│       │   ├── app.ts
│       │   └── server.ts
│       │
│       ├── package.json
│       ├── tsconfig.json
│       └── .env.example
│
├── packages/
│   └── types/
│       ├── src/
│       ├── package.json
│       └── tsconfig.json
│
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.json
├── .env.example
└── .gitignore
```

---

# Acceptance Criteria

This unit is complete only when all of the following are true.

## Monorepo

* [ ] pnpm workspace is configured.
* [ ] Turborepo is configured.
* [ ] `apps/web` exists.
* [ ] `apps/api` exists.
* [ ] `packages/types` exists.
* [ ] Workspace dependencies install successfully.

## Frontend

* [ ] Next.js application starts successfully.
* [ ] TypeScript strict mode is enabled.
* [ ] Tailwind CSS is configured.
* [ ] The frontend builds successfully.
* [ ] A minimal application page renders.

## Backend

* [ ] Express application starts successfully.
* [ ] Application creation is separated from server startup.
* [ ] Environment variables are centrally loaded and validated.
* [ ] `GET /health` works.
* [ ] API response follows project conventions.
* [ ] Centralized error handling is configured.

## Shared Package

* [ ] `packages/types` is configured as a workspace package.
* [ ] The package is ready for future shared contracts.
* [ ] No speculative domain types were added.

## Verification

Before marking this unit complete:

* [ ] Run dependency installation.
* [ ] Run the development applications.
* [ ] Verify the frontend loads.
* [ ] Verify `GET /health`.
* [ ] Run TypeScript type checking.
* [ ] Run the production build.
* [ ] Fix implementation errors introduced by this unit.
* [ ] Do not claim verification that was not actually performed.

---

# Progress Update

After successful completion, update:

```text
context/progress-tracker.md
```

with:

## Completed

* Project monorepo foundation.
* pnpm workspace.
* Turborepo configuration.
* Next.js frontend foundation.
* Express backend foundation.
* Environment validation.
* Health endpoint.
* Shared types package.

## In Progress

* None.

## Next Up

* Unit 02 — Database Foundation.

## Session Notes

Record:

* Verification commands that were run.
* Any known limitations.
* Any unresolved setup issues.

Keep the progress tracker concise.

---

# Final Instruction

Implement only this project foundation.

Do not continue into database setup, authentication, or any other future feature after this unit is complete.

When finished:

1. Review all changed files.
2. Verify the acceptance criteria.
3. Run relevant checks.
4. Fix errors introduced by the implementation.
5. Update `context/progress-tracker.md`.
6. Stop.

The next development unit must begin from a new focused specification.
