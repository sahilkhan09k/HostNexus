/**
 * H-01 (booking ids leaked publicly), M-01 (owner phone on public profile),
 * H-07 (admin reject must end the user's sessions).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../config/database.js", () => {
  const prisma: any = {
    resource: { findUnique: vi.fn() },
    availabilityWindow: { findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    bookingRequest: { aggregate: vi.fn(), findMany: vi.fn(), count: vi.fn().mockResolvedValue(0) },
    business: { findUnique: vi.fn() },
    review: { findMany: vi.fn().mockResolvedValue([]) },
    user: { findUnique: vi.fn(), update: vi.fn() },
    refreshToken: { updateMany: vi.fn() },
    $transaction: vi.fn(async (ops: any[]) => Promise.all(ops)),
  };
  return { prisma };
});

import { prisma } from "../config/database.js";
import { AvailabilityService } from "../services/availability.service.js";
import { ReviewService } from "../services/review.service.js";
import { AdminService } from "../services/admin.service.js";

const p = prisma as any;

beforeEach(() => vi.clearAllMocks());

describe("public availability check", () => {
  it("never returns booking ids", async () => {
    p.resource.findUnique.mockResolvedValue({ id: "res-1", quantity: 10 });
    p.availabilityWindow.findFirst.mockResolvedValue({ id: "w1" });
    p.bookingRequest.aggregate.mockResolvedValue({ _sum: { quantity: 3 } });
    p.bookingRequest.findMany.mockResolvedValue([
      { startDate: new Date(), endDate: new Date(), bookingStatus: "ACTIVE", quantity: 3 },
    ]);

    const res = await AvailabilityService.checkAvailability("res-1", "2030-01-01T00:00:00Z", "2030-01-05T00:00:00Z");

    expect(res.conflicts[0]).not.toHaveProperty("bookingId");
    expect(p.bookingRequest.findMany.mock.calls[0][0].select).not.toHaveProperty("id");
  });
});

describe("public business profile", () => {
  it("does not select the owner's phone, name or user id", async () => {
    p.business.findUnique.mockResolvedValue({ id: "b1", name: "Biz", owner: { verificationStatus: "VERIFIED" }, resources: [] });
    await ReviewService.getBusinessProfile("b1");
    const select = p.business.findUnique.mock.calls[0][0].select;
    expect(select.owner).toEqual({ select: { verificationStatus: true } });
    expect(select).not.toHaveProperty("addressLine");
    expect(select).not.toHaveProperty("pincode");
  });
});

describe("admin reject", () => {
  it("revokes every session the rejected user holds", async () => {
    p.user.findUnique.mockResolvedValue({ id: "u1" });
    p.user.update.mockResolvedValue({ id: "u1", verificationStatus: "REJECTED" });

    await AdminService.rejectUser("u1", "fraud");

    expect(p.user.update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { tokenVersion: { increment: 1 } } });
    expect(p.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: "u1", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
});
