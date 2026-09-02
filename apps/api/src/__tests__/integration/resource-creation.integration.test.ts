/**
 * Integration tests for the resource creation endpoint.
 *
 * Strategy: mock ONLY the Prisma client and BusinessService.
 * The real ResourceController → ResourceService → createResourceSchema
 * pipeline runs end-to-end; only the DB call and business lookup are stubbed.
 *
 * Tasks covered:
 *   12.1 — Happy path (controller + service + schema all succeed)
 *   12.2 — Auth failure (no userId on req)
 *   12.3 — Validation failure (ZodError bubbles to next())
 *   12.4 — No business account (service throws, next() receives error)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ZodError } from "zod";

// ---------------------------------------------------------------------------
// Mock Prisma — only the DB layer is replaced
// ---------------------------------------------------------------------------
vi.mock("../../config/database.js", () => ({
  prisma: {
    resource: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    business: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

// ---------------------------------------------------------------------------
// Mock BusinessService — keeps tests focused on the resource creation path
// ---------------------------------------------------------------------------
vi.mock("../../services/business.service.js", () => ({
  BusinessService: {
    getBusinessByUserId: vi.fn(),
    verifyOwnership: vi.fn(),
    createBusiness: vi.fn(),
    getBusinessById: vi.fn(),
    updateBusiness: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Import subjects AFTER mocks are registered
// ---------------------------------------------------------------------------
import { ResourceController } from "../../controllers/resource.controller.js";
import { prisma } from "../../config/database.js";
import { BusinessService } from "../../services/business.service.js";

// ---------------------------------------------------------------------------
// Typed mock helpers
// ---------------------------------------------------------------------------
const mockPrismaResourceCreate = prisma.resource.create as ReturnType<typeof vi.fn>;
const mockGetBusinessByUserId = BusinessService.getBusinessByUserId as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Request / response factory
// ---------------------------------------------------------------------------
interface ReqOverrides {
  userId?: string;
  body?: Record<string, unknown>;
}

function makeRequest(overrides: ReqOverrides = {}) {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
  };
  // Allow chaining: res.status(201).json(...)
  res.status.mockReturnValue(res);

  const next = vi.fn();

  const req = {
    userId: overrides.userId,
    body: overrides.body ?? {},
    params: {},
    query: {},
  } as any;

  return { req, res, next };
}

// ---------------------------------------------------------------------------
// Shared fixture data
// ---------------------------------------------------------------------------
const MOCK_BUSINESS = {
  id: "biz-abc-123",
  name: "Test Venue Co.",
  ownerId: "user-xyz-999",
  createdAt: new Date("2024-01-01T00:00:00Z"),
  updatedAt: new Date("2024-01-01T00:00:00Z"),
};

const VALID_BODY = {
  name: "Grand Ballroom",
  resourceType: "Banquet Hall",
  quantity: 1,
  status: "available",
  isActive: true,
};

const MOCK_CREATED_RESOURCE = {
  id: "res-001",
  businessId: MOCK_BUSINESS.id,
  name: "Grand Ballroom",
  description: null,
  resourceType: "Banquet Hall",
  quantity: 1,
  unit: null,
  status: "available",
  location: null,
  isActive: true,
  createdAt: new Date("2024-06-01T10:00:00Z"),
  updatedAt: new Date("2024-06-01T10:00:00Z"),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Resource Creation — Integration (controller + service + schema)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Task 12.1 — Happy path
  // -------------------------------------------------------------------------
  describe("12.1 — Happy path: valid request creates resource successfully", () => {
    it("returns 201 with success:true and the created resource in data", async () => {
      mockGetBusinessByUserId.mockResolvedValue(MOCK_BUSINESS);
      mockPrismaResourceCreate.mockResolvedValue(MOCK_CREATED_RESOURCE);

      const { req, res, next } = makeRequest({
        userId: "user-xyz-999",
        body: VALID_BODY,
      });

      await ResourceController.createResource(req, res as any, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { resource: MOCK_CREATED_RESOURCE },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("calls prisma.resource.create with the correct businessId from the user's business", async () => {
      mockGetBusinessByUserId.mockResolvedValue(MOCK_BUSINESS);
      mockPrismaResourceCreate.mockResolvedValue(MOCK_CREATED_RESOURCE);

      const { req, res, next } = makeRequest({
        userId: "user-xyz-999",
        body: VALID_BODY,
      });

      await ResourceController.createResource(req, res as any, next);

      expect(mockPrismaResourceCreate).toHaveBeenCalledOnce();
      const callArg = mockPrismaResourceCreate.mock.calls[0][0];
      expect(callArg.data).toMatchObject({
        businessId: MOCK_BUSINESS.id,
        name: "Grand Ballroom",
        resourceType: "Banquet Hall",
        quantity: 1,
        status: "available",
        isActive: true,
      });
    });
  });

  // -------------------------------------------------------------------------
  // Task 12.2 — Auth failure
  // -------------------------------------------------------------------------
  describe("12.2 — Auth failure: missing userId returns 401", () => {
    it("returns 401 with UNAUTHORIZED error code when req.userId is undefined", async () => {
      const { req, res, next } = makeRequest({
        // No userId — simulates unauthenticated request
        body: VALID_BODY,
      });

      await ResourceController.createResource(req, res as any, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: "UNAUTHORIZED" }),
        })
      );
    });

    it("never calls prisma.resource.create on an unauthenticated request", async () => {
      const { req, res, next } = makeRequest({ body: VALID_BODY });

      await ResourceController.createResource(req, res as any, next);

      expect(mockPrismaResourceCreate).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Task 12.3 — Validation failure (ZodError path)
  // -------------------------------------------------------------------------
  describe("12.3 — Validation failure: invalid body produces ZodError via next()", () => {
    it("calls next() with a ZodError when name is too short and resourceType is missing", async () => {
      // Real createResourceSchema.parse() will throw — name is 2 chars, resourceType absent
      const { req, res, next } = makeRequest({
        userId: "user-xyz-999",
        body: { name: "AB" }, // fails min(3) + missing required resourceType
      });

      await ResourceController.createResource(req, res as any, next);

      expect(next).toHaveBeenCalledOnce();
      const thrownError = next.mock.calls[0][0];
      expect(thrownError).toBeInstanceOf(ZodError);
    });

    it("does not call res.status when validation throws — error goes to middleware", async () => {
      const { req, res, next } = makeRequest({
        userId: "user-xyz-999",
        body: { name: "AB" },
      });

      await ResourceController.createResource(req, res as any, next);

      expect(res.status).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Task 12.4 — No business account
  // -------------------------------------------------------------------------
  describe("12.4 — No business account: service throws, error forwarded via next()", () => {
    it("calls next() with the 'must have a business' error when user has no business", async () => {
      mockGetBusinessByUserId.mockResolvedValue(null); // user has no business

      const { req, res, next } = makeRequest({
        userId: "user-xyz-999",
        body: VALID_BODY,
      });

      await ResourceController.createResource(req, res as any, next);

      expect(next).toHaveBeenCalledOnce();
      const thrownError = next.mock.calls[0][0];
      expect(thrownError).toBeInstanceOf(Error);
      expect((thrownError as Error).message).toBe("You must have a business to create resources");
    });

    it("does not call res.status when the service throws — error goes to middleware", async () => {
      mockGetBusinessByUserId.mockResolvedValue(null);

      const { req, res, next } = makeRequest({
        userId: "user-xyz-999",
        body: VALID_BODY,
      });

      await ResourceController.createResource(req, res as any, next);

      expect(res.status).not.toHaveBeenCalled();
    });
  });
});

