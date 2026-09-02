import { describe, it, expect, vi, beforeEach } from "vitest";
import { ResourceController } from "../controllers/resource.controller.js";

// ---------------------------------------------------------------------------
// Mock the resource service
// ---------------------------------------------------------------------------
vi.mock("../services/resource.service.js", () => ({
  ResourceService: {
    createResource: vi.fn(),
    getResources: vi.fn(),
    getResourceById: vi.fn(),
    updateResource: vi.fn(),
    deleteResource: vi.fn(),
    verifyResourceAccess: vi.fn(),
    getAllResources: vi.fn(),
  },
}));

// Mock schema validation — we want to control what parse() returns
vi.mock("../schemas/resource.schema.js", () => ({
  createResourceSchema: {
    parse: vi.fn(),
  },
  updateResourceSchema: {
    parse: vi.fn(),
  },
  resourceQuerySchema: {
    parse: vi.fn((q) => q),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRes() {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
  };
  // Make res.status().json() chainable
  res.status.mockReturnValue(res);
  return res;
}

function makeNext() {
  return vi.fn();
}

// ---------------------------------------------------------------------------
// Import mocked modules so we can control them per-test
// ---------------------------------------------------------------------------
import { ResourceService } from "../services/resource.service.js";
import { createResourceSchema } from "../schemas/resource.schema.js";

// ---------------------------------------------------------------------------
// Tests — ResourceController.createResource
// ---------------------------------------------------------------------------

describe("ResourceController.createResource", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. Returns 401 when req.userId is undefined
  it("returns 401 JSON when req.userId is undefined", async () => {
    const req = { userId: undefined, body: {} } as any;
    const res = makeRes();
    const next = makeNext();

    await ResourceController.createResource(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: "UNAUTHORIZED" }),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  // 2. Calls createResourceSchema.parse then ResourceService.createResource with userId + parsed input
  it("calls schema.parse and then ResourceService.createResource with userId and parsed input", async () => {
    const userId = "user-abc";
    const rawBody = { name: "Hall", resourceType: "Banquet Hall", quantity: 1 };
    const parsedInput = { name: "Hall", resourceType: "Banquet Hall", quantity: 1, status: "available", isActive: true };

    (createResourceSchema.parse as ReturnType<typeof vi.fn>).mockReturnValue(parsedInput);
    (ResourceService.createResource as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "r-1", ...parsedInput, businessId: "biz-1" });

    const req = { userId, body: rawBody } as any;
    const res = makeRes();
    const next = makeNext();

    await ResourceController.createResource(req, res as any, next);

    expect(createResourceSchema.parse).toHaveBeenCalledWith(rawBody);
    expect(ResourceService.createResource).toHaveBeenCalledWith(userId, parsedInput);
  });

  // 3. Returns 201 with { success: true, data: { resource } } on success
  it("returns 201 with success response on successful creation", async () => {
    const userId = "user-abc";
    const parsedInput = { name: "Hall", resourceType: "Banquet Hall", quantity: 1, status: "available", isActive: true };
    const createdResource = { id: "r-1", businessId: "biz-1", ...parsedInput };

    (createResourceSchema.parse as ReturnType<typeof vi.fn>).mockReturnValue(parsedInput);
    (ResourceService.createResource as ReturnType<typeof vi.fn>).mockResolvedValue(createdResource);

    const req = { userId, body: parsedInput } as any;
    const res = makeRes();
    const next = makeNext();

    await ResourceController.createResource(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { resource: createdResource },
    });
    expect(next).not.toHaveBeenCalled();
  });

  // 4. Calls next(error) when ResourceService.createResource throws
  it("calls next(error) when ResourceService.createResource throws", async () => {
    const userId = "user-abc";
    const parsedInput = { name: "Hall", resourceType: "Banquet Hall", quantity: 1, status: "available", isActive: true };
    const serviceError = new Error("You must have a business to create resources");

    (createResourceSchema.parse as ReturnType<typeof vi.fn>).mockReturnValue(parsedInput);
    (ResourceService.createResource as ReturnType<typeof vi.fn>).mockRejectedValue(serviceError);

    const req = { userId, body: parsedInput } as any;
    const res = makeRes();
    const next = makeNext();

    await ResourceController.createResource(req, res as any, next);

    expect(next).toHaveBeenCalledWith(serviceError);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  // 5. Returns 401 when userId is missing (no token scenario)
  it("returns 401 when userId is absent — no token scenario", async () => {
    // Simulate a request where auth middleware did not set userId (no token)
    const req = { body: { name: "Hall" } } as any; // no userId property at all

    const res = makeRes();
    const next = makeNext();

    await ResourceController.createResource(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: "UNAUTHORIZED",
          message: "User not authenticated",
        }),
      })
    );
    // Service must never be called when unauthenticated
    expect(ResourceService.createResource).not.toHaveBeenCalled();
  });
});
