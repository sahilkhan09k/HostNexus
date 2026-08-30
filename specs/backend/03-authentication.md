# Unit 03 — Authentication

## First: Read Context

Before doing anything:

1. Read `CLAUDE.md`.
2. Read the relevant files inside `context/`.
3. Read `context/progress-tracker.md`.
4. Inspect the existing implementation of Units 01 and 02.
5. Do not rewrite or break existing functionality.

The context files and existing architecture are the source of truth.

---

## Objective

Implement the basic HostNexus authentication system.

The user should be able to:

Register → securely store password → Login → receive JWT → access protected API.

---

## Implement

### 1. Registration

Create:

`POST /api/auth/register`

Requirements:

- Validate input with Zod.
- Accept email and password.
- Check for duplicate email.
- Hash password using bcrypt.
- Store the user using the existing Prisma client.
- Never store plaintext passwords.
- Never return `passwordHash`.

### 2. Login

Create:

`POST /api/auth/login`

Requirements:

- Validate input.
- Find the user.
- Verify the password using bcrypt.
- Generate a signed JWT on successful authentication.
- Return the JWT and safe user information.
- Use a consistent error for invalid credentials.

### 3. JWT Authentication

Add:

`JWT_SECRET`

to the environment configuration.

Use the existing environment validation system.

Requirements:

- JWT must have an expiration.
- Keep the payload minimal, preferably using the user ID as `sub`.
- Never hardcode the secret.
- Never expose the secret.
- Never put real secrets in Git, context files, or source code.

### 4. Authentication Middleware

Create reusable JWT authentication middleware.

It must:

- Read `Authorization: Bearer <token>`.
- Verify the JWT.
- Reject missing, malformed, invalid, or expired tokens.
- Attach the authenticated user's ID to the request.
- Use proper TypeScript types; do not use `any`.

### 5. Current User

Create:

`GET /api/auth/me`

This route must be protected by the authentication middleware.

It should:

- Identify the user from the verified JWT.
- Fetch the user from PostgreSQL through Prisma.
- Return safe user information.
- Never return `passwordHash`.

---

## Architecture

Follow the existing backend architecture:

Route → Middleware → Controller → Service → Prisma

Keep authentication logic in appropriate services/controllers rather than putting everything inside routes.

Reuse the Prisma client and environment configuration already created in Unit 02.

Do not create duplicate database clients or configuration systems.

---

## Do NOT Implement

Do not work on:

- Business authorization
- Business CRUD
- Resources
- Availability
- Bookings
- Payments
- AI
- Redis
- Meilisearch
- Socket.IO
- OAuth
- Email verification
- Password reset
- Refresh tokens
- Any unrelated feature

Keep this unit limited to basic authentication.

---

## Verification

After implementation:

- Test registration.
- Test duplicate registration.
- Test login with correct credentials.
- Test login with incorrect credentials.
- Test missing/invalid JWT.
- Test expired JWT if practical.
- Test authenticated `/api/auth/me`.
- Confirm `passwordHash` is never returned.
- Confirm `/health` still works.
- Confirm `/health/db` still works.
- Run type checking.
- Run the production build.

Do not claim anything passed unless you actually verified it.

---

## Finish

Update `context/progress-tracker.md` with the actual completed work and verification results.

Review your changes and make sure no unrelated functionality was modified.

Then stop.

**Do not start the next unit automatically.**