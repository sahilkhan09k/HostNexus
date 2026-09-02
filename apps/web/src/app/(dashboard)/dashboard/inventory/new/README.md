# Resource Listing Form

## Overview

The Resource Listing Form lets authenticated business owners create a new resource listing on the HostNexus B2B hospitality marketplace. A resource is any rentable asset — a banquet hall, AV equipment, a vehicle, staff — that a business wants to make discoverable and bookable by other businesses.

The form collects resource details, validates all input client-side before submission, and POSTs to the API. On success the user is shown a confirmation banner and automatically redirected to their inventory page. Unsaved-changes guards prevent accidental data loss during navigation.

---

## Route

```
/dashboard/inventory/new
```

Accessible only to authenticated users. Unauthenticated visitors are redirected to `/login`.

---

## File Structure

```
apps/web/src/app/(dashboard)/dashboard/inventory/new/
├── page.tsx                          # Page component — layout, auth guard, navigation guards
├── README.md                         # This file
├── _components/
│   ├── resource-form.tsx             # Controlled form UI component
│   └── __tests__/
│       └── resource-form.test.tsx    # Component tests
└── _hooks/
    └── use-resource-form.ts          # All form state, validation, and submission logic

Supporting files (shared across features):
apps/web/src/schemas/
├── resource.schema.ts                # Zod validation schema + RESOURCE_TYPES constant
└── __tests__/
    └── resource.schema.test.ts       # Schema unit tests
```

---

## Validation Rules

| Field          | Required | Constraints                                                        | Error Message                              |
|----------------|----------|--------------------------------------------------------------------|--------------------------------------------|
| `resourceType` | ✅ Yes   | Must be one of the 18 valid `RESOURCE_TYPES`                       | "Please select a resource category"        |
| `name`         | ✅ Yes   | 3–100 characters                                                   | "Name must be at least 3 characters" / "Name cannot exceed 100 characters" |
| `description`  | ❌ No    | Max 1000 characters                                                | "Description must be 1000 characters or less" |
| `quantity`     | ✅ Yes   | Integer, 1–10 000, defaults to `1`                                 | "Quantity must be at least 1" / "Quantity cannot exceed 10,000" |
| `unit`         | ❌ No    | Max 50 characters                                                  | "Unit must be 50 characters or less"       |
| `location`     | ❌ No    | Max 200 characters                                                 | "Location must be 200 characters or less"  |
| `isActive`     | ✅ Yes   | Boolean, defaults to `true`                                        | —                                          |

Validation fires on **blur** for each field (Requirement 7.1) and again on **submit** for all fields at once (Requirement 7.5). On a failed submit the form scrolls to the first invalid field.

---

## API Integration

### Endpoint

```
POST /api/resources
Authorization: Bearer <jwt>
Content-Type: application/json
```

### Request Body

```jsonc
{
  "name": "Grand Banquet Hall",
  "resourceType": "Banquet Hall",
  "description": "Seats 500 guests, full AV setup included.",  // optional
  "quantity": 1,
  "unit": "hall",                   // optional
  "location": "Mumbai, Maharashtra", // optional
  "isActive": true,
  "status": "available"             // always sent as "available" from the form
}
```

Optional fields (`description`, `unit`, `location`) are omitted from the request body when their value is an empty string (Requirement 8.3).

### Responses

| Status | Meaning                       | Action in UI                                         |
|--------|-------------------------------|------------------------------------------------------|
| `201`  | Resource created              | Show success banner, redirect to `/dashboard/inventory` after 1.5 s |
| `400`  | Validation failed             | Surface `error.message` from response body in the error banner |
| `401`  | Token missing / expired       | Display "Session expired. Please log in again."      |
| `403`  | No business account for user  | Display "No business account found. Please contact support." |
| other  | Unexpected server error       | Display "Failed to create resource. Please try again." |

The API base URL is read from `process.env.NEXT_PUBLIC_API_URL` (falls back to `http://localhost:5000`).  
The JWT is read from `localStorage` under the key `hostnexus_token`.

---

## State Management

All form state lives in the `useResourceForm` hook (`_hooks/use-resource-form.ts`). `ResourceForm` is a pure UI component — it receives state and handlers as a destructured return value.

### Key state fields

| Field         | Type           | Description                                                        |
|---------------|----------------|--------------------------------------------------------------------|
| `values`      | `FormValues`   | Current value of every form field                                  |
| `errors`      | `FormErrors`   | Per-field validation error messages (key present only when invalid) |
| `touched`     | `FormTouched`  | Tracks which fields the user has blurred at least once             |
| `isSubmitting`| `boolean`      | `true` while the API request is in-flight; disables the form       |
| `submitError` | `string\|null` | Server or network error message shown in the error banner          |
| `isDirty`     | `boolean`      | Derived: `true` when any field differs from `DEFAULT_VALUES`       |

### Key handlers

| Handler        | Description                                                          |
|----------------|----------------------------------------------------------------------|
| `handleChange` | Updates a field value; clears the field's error if it is now valid   |
| `handleBlur`   | Marks a field as touched; runs per-field validation                  |
| `handleSubmit` | Full validation → sets all fields touched → POSTs to API             |
| `resetForm`    | Resets all state to defaults (sets `isDirty` back to `false`)        |

The `isDirty` flag is derived (not stored) from `values` so it can never go stale. `NewResourcePage` lifts `isDirty` via the `onDirtyChange` callback and uses it to attach a `beforeunload` listener and control the cancel-confirmation dialog.

---

## Design System

This feature follows the HostNexus design system rules:

| Token / Pattern          | Usage                                                              |
|--------------------------|--------------------------------------------------------------------|
| Canvas background        | `bg-[#090D16]` — never white or pure black                        |
| Card container           | `bg-white/4 border border-white/8 backdrop-blur-md rounded-2xl`   |
| Primary accent           | Emerald — submit button `bg-emerald-600 hover:bg-emerald-700`     |
| Focus ring               | `focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30`  |
| Error state              | `border-rose-500/60`, error text `text-rose-400`                  |
| Error banner             | `border-rose-500/30 bg-rose-500/10`                               |
| Success banner           | `border-emerald-500/30 bg-emerald-500/10`                         |
| Input base               | `bg-white/5 border border-white/10 rounded-xl text-white`         |
| Label                    | `text-sm font-medium text-slate-300`                              |
| Body / UI font           | `Plus Jakarta Sans` (`--font-plus-jakarta`)                       |
| Display headings         | `Outfit` (`--font-outfit`) via `font-display` Tailwind class      |
| Micro-interaction timing | `transition-all duration-150` (150 ms ease-out)                   |
| Icon library             | Lucide React only — no raw emoji                                   |
| Class merging            | `cn()` from `@/lib/utils` everywhere                              |

---

## Running Tests

### Web (frontend validation, hook logic, component rendering)

```bash
# From workspace root
cd apps/web && npx vitest run

# Watch mode
cd apps/web && npx vitest

# Specific test files
cd apps/web && npx vitest run src/schemas/__tests__/resource.schema.test.ts
cd apps/web && npx vitest run src/app/\(dashboard\)/dashboard/inventory/new/_components/__tests__/resource-form.test.tsx
```

### API (schema validation, service logic)

```bash
# From workspace root
cd apps/api && npx vitest run

# Watch mode
cd apps/api && npx vitest

# Specific test file
cd apps/api && npx vitest run src/__tests__/resource.schema.test.ts
```

### From workspace root (both apps via Turbo)

```bash
npx turbo run test
```
