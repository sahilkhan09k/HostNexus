import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ResourceService } from "../services/resource.service.js";
import { prisma } from "../config/database.js";

vi.mock("../config/database.js", async () => {
  const { createFakePrisma } = await import("./helpers/fake-prisma.js");
  return { prisma: createFakePrisma() };
});

vi.mock("../services/business.service.js", async () => {
  const { prisma } = await import("../config/database.js");
  const store = () => (prisma as any).__store;
  return {
    BusinessService: {
      getBusinessByUserId: async (userId: string) => store().business.find((b: any) => b.ownerId === userId) ?? null,
      verifyOwnership: async (businessId: string, userId: string) =>
        store().business.find((b: any) => b.id === businessId)?.ownerId === userId,
    },
  };
});

vi.mock("../services/rag/vector-store.js", () => ({
  VectorStoreService: { indexSingleResource: vi.fn(async () => {}), deleteResource: vi.fn(async () => {}) },
}));

const db = prisma as any;
const OWNER = "user-owner";

function booking(id: string, startDate: string, endDate: string, quantity: number, bookingStatus: string) {
  db.__seed("bookingRequest", {
    id, resourceId: "res-1", seekerId: "biz-renter", providerId: "biz-owner",
    startDate: new Date(startDate), endDate: new Date(endDate), quantity, bookingStatus,
  });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-01T04:30:00.000Z"));
  db.__reset();
  db.__seed("user", { id: OWNER, verificationStatus: "VERIFIED" });
  db.__seed("business", { id: "biz-owner", name: "Owner", ownerId: OWNER });
  db.__seed("resource", { id: "res-1", businessId: "biz-owner", name: "Chairs", resourceType: "Chairs", quantity: 100 });
});

afterEach(() => vi.useRealTimers());

describe("deleting a listing (#8)", () => {
  it("is blocked while a booking is still in progress", async () => {
    booking("b1", "2026-10-03", "2026-10-05", 10, "ACTIVE");
    await expect(ResourceService.deleteResource("res-1", OWNER)).rejects.toMatchObject({
      statusCode: 409, code: "LISTING_HAS_OPEN_BOOKINGS",
    });
    expect(db.__store.resource[0].deletedAt).toBeNull();
  });

  it("soft-deletes once every booking is finished, keeping the history", async () => {
    booking("b1", "2026-09-03", "2026-09-05", 10, "COMPLETED");
    await ResourceService.deleteResource("res-1", OWNER);
    expect(db.__store.resource).toHaveLength(1);
    expect(db.__store.resource[0]).toMatchObject({ isActive: false });
    expect(db.__store.resource[0].deletedAt).toBeInstanceOf(Date);
    expect(db.__store.bookingRequest).toHaveLength(1);
    expect(await ResourceService.getResourceById("res-1")).toBeNull();
  });

  it("only the owner can delete", async () => {
    await expect(ResourceService.deleteResource("res-1", "someone-else")).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe("lowering quantity (#22)", () => {
  it("can't go below the busiest future day", async () => {
    booking("b1", "2026-10-03", "2026-10-05", 40, "BOOKING_ACCEPTED");
    booking("b2", "2026-10-05", "2026-10-06", 30, "ACTIVE");      // overlaps b1 on the 5th → 70
    booking("b3", "2026-10-10", "2026-10-10", 50, "BOOKING_ACCEPTED");
    booking("b4", "2026-10-05", "2026-10-05", 90, "BOOKING_REQUESTED"); // pending: holds no stock
    booking("b5", "2026-09-20", "2026-09-22", 95, "COMPLETED");         // past

    await expect(ResourceService.updateResource("res-1", OWNER, { quantity: 69 } as any)).rejects.toMatchObject({
      statusCode: 409, code: "QUANTITY_BELOW_BOOKED",
    });
    await expect(ResourceService.updateResource("res-1", OWNER, { quantity: 70 } as any)).resolves.toMatchObject({ quantity: 70 });
  });

  it("raising quantity is always allowed", async () => {
    booking("b1", "2026-10-03", "2026-10-05", 100, "ACTIVE");
    await expect(ResourceService.updateResource("res-1", OWNER, { quantity: 120 } as any)).resolves.toMatchObject({ quantity: 120 });
  });
});
