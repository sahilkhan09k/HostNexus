You are working on the **HostNexus API project**.

The previous module, **Unit 04 – Business Management**, has already been implemented and pushed to the `dev` branch.

Your next task is to implement:

# Unit 05 – Resource Management

Before making any changes, thoroughly inspect the existing HostNexus codebase and understand its architecture. Use the existing **Business Management module** as the primary reference for implementation patterns.

## 1. First Understand the Existing Project

Inspect and understand:

* Project/folder structure
* Existing modules
* Business Management implementation
* Database schema and relationships
* Models/entities
* Controllers
* Services
* Repositories/data-access layer
* DTOs/schemas
* Routes
* Authentication
* Authorization/RBAC
* Validation
* Error handling
* API response format
* Database migrations
* Testing structure

Do not create a new architecture. Follow the existing HostNexus patterns exactly.

---

# 2. Implement Resource Management

Create a complete, production-ready Resource Management module.

Resources should belong to the appropriate existing business/property entity.

Before creating any database relationship, inspect the current schema and use the existing relationships wherever possible.

## Resource Data

The Resource entity should support the following information where appropriate to the existing architecture:

* `id`
* `business_id` or the appropriate existing parent ID
* `name`
* `description`
* `resource_type`
* `quantity`
* `unit`
* `status`
* `location`
* `is_active`
* `created_at`
* `updated_at`

Do not blindly create these fields if equivalent fields already exist elsewhere. Adapt them to the existing HostNexus data model.

---

# 3. API Endpoints

Implement REST APIs for:

### Create Resource

`POST /resources`

### Get All Resources

`GET /resources`

Support filtering where appropriate, including:

* Business/property
* Resource type
* Status
* Active/inactive

### Get Resource by ID

`GET /resources/{id}`

### Update Resource

`PUT/PATCH /resources/{id}`

### Delete Resource

`DELETE /resources/{id}`

If the existing architecture supports separate status-management endpoints, implement an appropriate endpoint for changing resource status.

Follow the existing API naming conventions instead of blindly using the paths above if the project already has a standard convention.

---

# 4. Authentication & Authorization

Use the existing authentication and RBAC system.

Follow the exact authorization approach used by Business Management.

Users must only be able to access resources belonging to businesses/properties they are authorized to access.

Prevent:

* Unauthorized resource creation
* Access to another business's resources
* Unauthorized updates
* Unauthorized deletion
* Privilege escalation

Do not bypass existing authentication or authorization middleware.

---

# 5. Validation

Implement proper request validation.

Validate:

* Required fields
* Resource name
* Resource type
* Quantity
* Unit
* Status
* Parent business/property ID
* Invalid IDs
* Empty values
* Duplicate resources where applicable
* Invalid relationships

Use the project's existing validation library and validation patterns.

Do not introduce a new validation approach unless absolutely necessary.

---

# 6. Error Handling

Use the existing HostNexus error-handling system and response format.

Correctly handle:

* `400` – Validation errors
* `401` – Unauthenticated
* `403` – Unauthorized/forbidden
* `404` – Resource not found
* `409` – Duplicate/conflict
* `500` – Internal/database errors

Do not create a new error-response structure.

---

# 7. Database

Implement all required database changes.

This may include:

* Resource model/entity
* Resource table
* Foreign keys
* Relationships
* Indexes
* Constraints
* Migrations

Follow the existing database conventions.

Ensure that:

* Relationships are correct
* Foreign keys are enforced
* Indexes are appropriate
* Timestamps are maintained
* Delete behavior is intentional
* Existing data is not broken
* No duplicate tables/relationships are introduced

---

# 8. Tests

Add tests following the existing HostNexus testing structure.

Test at minimum:

## CRUD

* Create resource
* Get resource
* List resources
* Update resource
* Delete resource

## Validation

* Missing required fields
* Invalid fields
* Invalid quantity
* Invalid status
* Invalid resource ID
* Invalid business/property ID
* Duplicate resource

## Authorization

* Unauthenticated request
* Unauthorized user
* User accessing another business's resource
* User without required role
* Unauthorized update
* Unauthorized deletion

## Edge Cases

* Resource does not exist
* Empty resource list
* Multiple resources for one business
* Deleted resource
* Invalid status transition if applicable

---

# 9. API Testing

After implementation, run the application and manually test the Resource Management APIs.

Verify:

* Authentication
* Authorization
* CRUD operations
* Validation
* Error responses
* Database persistence
* Relationships
* Filtering
* HTTP status codes
* Response structure

Also provide a **Postman-ready testing guide** containing:

* HTTP method
* Endpoint
* Headers
* Authorization requirements
* Example request body
* Expected response
* Expected status code

---

# 10. Code Quality

Follow the existing HostNexus coding standards.

Do not:

* Rewrite unrelated modules
* Modify Business Management unnecessarily
* Introduce unnecessary dependencies
* Duplicate existing utilities
* Duplicate existing database structures
* Hard-code IDs
* Bypass authentication
* Bypass authorization
* Change existing API response conventions

Keep the implementation clean, modular, maintainable, and production-ready.

---

# 11. Verification

Before declaring the task complete, run:

* Formatter
* Linter
* Type checks, if applicable
* Unit tests
* Integration/API tests
* Database migrations
* Relevant existing tests
* Full test suite where practical

Start the API and verify that it runs successfully.

Fix all errors found during implementation and testing.

---

# 12. Git

Once everything is implemented and verified:

1. Check `git status`
2. Review all changes
3. Ensure no unrelated files were modified
4. Commit the changes on the `dev` branch

Use:

`feat: implement resource management module`

Then push to:

`origin/dev`

---

# 13. Final Report

At the end, provide a concise implementation report containing:

1. What was implemented
2. Files created
3. Files modified
4. Database changes
5. API endpoints
6. Authentication/authorization rules
7. Validation rules
8. Tests added
9. Verification commands/results
10. Git commit hash
11. Push status
12. Any remaining issues

Important:

**Do not stop at creating files or writing code. Fully inspect the existing project, implement the module according to its architecture, run the application, test the APIs, fix errors, run the test suite, commit the working implementation, and push it to `origin/dev`.**
