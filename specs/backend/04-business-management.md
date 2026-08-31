# UNIT 04 — BUSINESS MANAGEMENT

# IMPORTANT — READ BEFORE DOING ANYTHING

You are working on the HostNexus project.

Before writing, modifying, deleting, or creating ANY code:

1. Read the root `CLAUDE.md`.
2. Read all relevant files inside `context/`.
3. Read:
   - `context/project-overview.md`
   - `context/architecture.md`
   - `context/code-standards.md`
   - `context/ai-workflow-rules.md`
   - `context/progress-tracker.md`
   - `context/ui-context.md`
4. Read this complete specification.
5. Inspect the existing implementation of:
   - Unit 01 — Project Foundation
   - Unit 02 — Database Foundation
   - Unit 03 — Authentication
6. Understand the existing code before making changes.

DO NOT start coding immediately.

First understand how the existing backend is structured and reuse its patterns.

The existing codebase and context files are the source of truth.

Do not invent a new architecture if the existing architecture already provides a suitable solution.

---

# 1. OBJECTIVE

Implement the complete **Business Management backend module** for HostNexus.

At the end of this unit, an authenticated HostNexus user must be able to:

1. Create their business.
2. View their own business.
3. Update their own business.

The system must correctly enforce the relationship:

```text
User
  ↓
Authenticated through JWT
  ↓
Business
  ↓
Owned by that User