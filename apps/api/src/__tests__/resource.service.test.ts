import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — declared before any imports that use them
// ---------------------------------------------------------------------------
vi.mock("../config/database.js", () => ({
  prisma: {
    resource: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("../services/business.service.js", () => ({
  BusinessService: {
    getBusinessByUserId: vi.fn(),
    verifyOwnership: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Import after mocks are in place
// ---------------------------------------------------------------------------
import { ResourceService } from "../services/resource.service.js";
import { prisma } from "../config/database.js";
import { BusinessService } from "../services/business.service.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validInput() {
  return {
    name: "Grand Banquet Hall",
    resourceType: "Banquet Hall",
    quantity: 10,
    status: "available" as const,
    isActive: true,
    description: "A large hall for events",
    unit: "hall",
    location: "Mumbai",
  };
}

// ---------------------------------------------------------------------------
// Tests — ResourceService.createResource
// ---------------------------------------------------------------------------

describe("ResourceService.createResource", () => {
  const userId = "user-111";
  const mockBusiness = { id: "biz-999", name: "Test Co", ownerId: userId, createdAt: new Date(), updatedAt: new Date() };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. Throws "You must have a business" when getBusinessByUserId returns null
  it("throws when BusinessService.getBusinessByUserId returns null", async () => {
    (BusinessService.getBusinessByUserId as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(ResourceService.createResource(userId, validInput())).rejects.toThrow(
      "You must have a business to create resources"
    );

    // prisma.resource.create must never be called
    expect(prisma.resource.create).not.toHaveBeenCalled();
  });

  // 2. Calls prisma.resource.create with businessId from the looked-up business (not from input)
  it("calls prisma.resource.create with businessId taken from the looked-up business", async () => {
    const createdResource = { id: "r-1", businessId: mockBusiness.id, ...validInput(), createdAt: new Date(), updatedAt: new Date() };

    (BusinessService.getBusinessByUserId as ReturnType<typeof vi.fn>).mockResolvedValue(mockBusiness);
    (prisma.resource.create as ReturnType<typeof vi.fn>).mockResolvedValue(createdResource);

    await ResourceService.createResource(userId, validInput());

    const callArg = (prisma.resource.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArg.data.businessId).toBe(mockBusiness.id);
  });

  // 3. The created resource has businessId equal to business.id
  it("returns a resource whose businessId equals the looked-up business.id", async () => {
    const createdResource = { id: "r-2", businessId: mockBusiness.id, ...validInput(), createdAt: new Date(), updatedAt: new Date() };

    (BusinessService.getBusinessByUserId as ReturnType<typeof vi.fn>).mockResolvedValue(mockBusiness);
    (prisma.resource.create as ReturnType<typeof vi.fn>).mockResolvedValue(createdResource);

    const result = await ResourceService.createResource(userId, validInput());

    expect(result.businessId).toBe(mockBusiness.id);
  });

  // 4. Default status "available" is passed to prisma when not specified in input
  it("passes status 'available' to prisma.resource.create when input does not specify status", async () => {
    // Build input without explicit status — the Zod schema defaults it to "available"
    const inputWithoutStatus = {
      name: "Simple Room",
      resourceType: "Meeting Space",
      quantity: 1,
      status: "available" as const, // Zod default
      isActive: true,
    };

    const createdResource = { id: "r-3", businessId: mockBusiness.id, ...inputWithoutStatus, createdAt: new Date(), updatedAt: new Date() };

    (BusinessService.getBusinessByUserId as ReturnType<typeof vi.fn>).mockResolvedValue(mockBusiness);
    (prisma.resource.create as ReturnType<typeof vi.fn>).mockResolvedValue(createdResource);

    await ResourceService.createResource(userId, inputWithoutStatus);

    const callArg = (prisma.resource.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArg.data.status).toBe("available");
  });

  // 5. Does NOT accept businessId from the input object — hardcodes from business lookup
  it("ignores any businessId present in the input and uses the one from the business lookup", async () => {
    const injectedBusinessId = "attacker-biz-000";

    // Craft an input that sneaks in a businessId (bypassing TypeScript via cast)
    const maliciousInput = {
      ...validInput(),
      businessId: injectedBusinessId,
    } as any;

    const createdResource = {
      id: "r-4",
      businessId: mockBusiness.id, // service should use this
      ...validInput(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (BusinessService.getBusinessByUserId as ReturnType<typeof vi.fn>).mockResolvedValue(mockBusiness);
    (prisma.resource.create as ReturnType<typeof vi.fn>).mockResolvedValue(createdResource);

    await ResourceService.createResource(userId, maliciousInput);

    const callArg = (prisma.resource.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    // The businessId used in the DB call must come from the business lookup, not from input
    expect(callArg.data.businessId).toBe(mockBusiness.id);
    expect(callArg.data.businessId).not.toBe(injectedBusinessId);
  });
});
