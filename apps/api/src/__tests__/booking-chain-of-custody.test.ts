import { describe, it, expect, vi, beforeEach } from "vitest";
import { BookingService } from "../services/booking.service.js";
import { prisma } from "../config/database.js";
import { BusinessService } from "../services/business.service.js";

// Mock dependencies
vi.mock("../config/database.js", () => ({
  prisma: {
    resource: {
      findUnique: vi.fn(),
    },
    bookingRequest: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn(),
      update: vi.fn(),
      aggregate: vi.fn(),
    },
    inspection: {
      create: vi.fn(),
    },
    evidence: {
      create: vi.fn(),
    },
    damageClaim: {
      create: vi.fn(),
      update: vi.fn(),
    },
    dispute: {
      create: vi.fn(),
      update: vi.fn(),
    },
    paymentTransaction: {
      create: vi.fn(),
    },
    bookingTimelineEvent: {
      create: vi.fn(),
    },
    $transaction: vi.fn((callback) => callback(prisma)),
    $queryRaw: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../services/business.service.js", () => ({
  BusinessService: {
    getBusinessByUserId: vi.fn(),
    verifyOwnership: vi.fn(),
  },
}));

describe("Digital Chain of Custody & Dual State Machine", () => {
  const renterUserId = "user-renter";
  const ownerUserId = "user-owner";

  const renterBusiness = { id: "biz-renter", name: "Renter Corp", ownerId: renterUserId };
  const ownerBusiness = { id: "biz-owner", name: "Owner LLC", ownerId: ownerUserId };

  const mockResource = {
    id: "res-100",
    businessId: ownerBusiness.id,
    name: "Industrial Generator",
    resourceType: "Generator/Power",
    quantity: 1,
    status: "available",
    isActive: true,
    location: "Warehouse A",
    rentAmountPaise: 200000, // ₹2,000 / day
    securityDepositPaise: 500000, // ₹5,000 deposit
    photos: ["https://example.com/gen.jpg"],
    hasPreExistingDamage: true,
    damageDescription: "Minor scratch on side cover",
    damagePhotos: ["https://example.com/scratch.jpg"],
    business: ownerBusiness,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: nothing committed on overlapping dates
    (prisma.bookingRequest.aggregate as ReturnType<typeof vi.fn>).mockResolvedValue({ _sum: { quantity: null } });
  });

  describe("quantity-aware conflict prevention", () => {
    const chairs = { ...mockResource, id: "res-chairs", quantity: 100 };
    const start = new Date(Date.now() + 86400000);
    const end   = new Date(Date.now() + 86400000 * 3);

    const pending = (quantity: number) => ({
      id: "book-p", providerId: ownerBusiness.id, seekerId: renterBusiness.id, resourceId: chairs.id,
      quantity, startDate: start, endDate: end,
      bookingStatus: "BOOKING_REQUESTED", provider: ownerBusiness, seeker: renterBusiness,
    });

    const committed = (n: number | null) =>
      (prisma.bookingRequest.aggregate as ReturnType<typeof vi.fn>).mockResolvedValue({ _sum: { quantity: n } });

    it("allows a request while other bookings leave enough units free", async () => {
      committed(10);
      (BusinessService.getBusinessByUserId as ReturnType<typeof vi.fn>).mockResolvedValue(renterBusiness);
      (prisma.resource.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(chairs);
      (prisma.bookingRequest.create as ReturnType<typeof vi.fn>).mockImplementation(({ data }) => Promise.resolve({ id: "b", ...data }));

      const b = await BookingService.createBookingRequest(renterUserId, {
        resourceId: chairs.id, quantity: 90, startDate: start.toISOString(), endDate: end.toISOString(),
      });
      expect(b.quantity).toBe(90);
      expect(prisma.$queryRaw).toHaveBeenCalled(); // resource row locked
    });

    it("rejects a request that exceeds the units left for those dates", async () => {
      committed(95);
      (BusinessService.getBusinessByUserId as ReturnType<typeof vi.fn>).mockResolvedValue(renterBusiness);
      (prisma.resource.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(chairs);

      await expect(
        BookingService.createBookingRequest(renterUserId, {
          resourceId: chairs.id, quantity: 10, startDate: start.toISOString(), endDate: end.toISOString(),
        })
      ).rejects.toThrow(/Only 5 of 100/);
      expect(prisma.bookingRequest.create).not.toHaveBeenCalled();
    });

    it("re-checks capacity on accept: second overlapping request cannot be accepted", async () => {
      committed(60); // another accepted booking already holds 60
      (BusinessService.getBusinessByUserId as ReturnType<typeof vi.fn>).mockResolvedValue(ownerBusiness);
      (prisma.bookingRequest.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(pending(50));
      (prisma.resource.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(chairs);

      await expect(
        BookingService.updateBookingStatus("book-p", ownerUserId, { status: "accepted" } as any)
      ).rejects.toThrow(/Only 40 of 100/);
      expect(prisma.bookingRequest.update).not.toHaveBeenCalled();

      // The booking being accepted is excluded from its own committed total
      const where = (prisma.bookingRequest.aggregate as ReturnType<typeof vi.fn>).mock.calls[0][0].where;
      expect(where.id).toEqual({ not: "book-p" });
    });

    it("accepts when the request still fits", async () => {
      committed(60);
      (BusinessService.getBusinessByUserId as ReturnType<typeof vi.fn>).mockResolvedValue(ownerBusiness);
      (prisma.bookingRequest.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(pending(40));
      (prisma.resource.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(chairs);
      (prisma.bookingRequest.update as ReturnType<typeof vi.fn>).mockImplementation(({ data }) => Promise.resolve({ ...pending(40), ...data }));

      const updated = await BookingService.updateBookingStatus("book-p", ownerUserId, { status: "accepted" } as any);
      expect(updated.bookingStatus).toBe("BOOKING_ACCEPTED");
    });
  });

  describe("transport", () => {
    const withTransport = { ...mockResource, transportAvailable: true, transportRatePerKmPaise: 2500 }; // ₹25/km
    const now   = Date.now();
    const start = new Date(now + 86400000).toISOString();
    const end   = new Date(now + 86400000 * 3).toISOString(); // exactly 2 days

    beforeEach(() => {
      (BusinessService.getBusinessByUserId as ReturnType<typeof vi.fn>).mockResolvedValue(renterBusiness);
      (prisma.bookingRequest.create as ReturnType<typeof vi.fn>).mockImplementation(({ data }) => Promise.resolve({ id: "b", ...data }));
    });

    it("adds the owner's per-km transport fee to the total when the renter opts in", async () => {
      (prisma.resource.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(withTransport);

      const b = await BookingService.createBookingRequest(renterUserId, {
        resourceId: withTransport.id, quantity: 1, startDate: start, endDate: end,
        transportMode: "PROVIDER", transportDistanceKm: 12.5,
      });
      expect(b.transportMode).toBe("PROVIDER");
      expect(b.transportRatePerKmPaise).toBe(2500);
      expect(b.transportFeePaise).toBe(31250); // 12.5 km × ₹25 = ₹312.50
      expect(b.totalAmountPaise).toBe(400000 + 500000 + 31250);
    });

    it("charges nothing for transport when the renter arranges their own", async () => {
      (prisma.resource.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(withTransport);

      const b = await BookingService.createBookingRequest(renterUserId, {
        resourceId: withTransport.id, quantity: 1, startDate: start, endDate: end, transportMode: "SELF",
      });
      expect(b.transportMode).toBe("SELF");
      expect(b.transportFeePaise).toBe(0);
      expect(b.totalAmountPaise).toBe(900000);
    });

    it("rejects owner transport when the listing does not offer it", async () => {
      (prisma.resource.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ ...mockResource, transportAvailable: false });

      await expect(
        BookingService.createBookingRequest(renterUserId, {
          resourceId: mockResource.id, quantity: 1, startDate: start, endDate: end,
          transportMode: "PROVIDER", transportDistanceKm: 10,
        })
      ).rejects.toThrow(/does not provide transport/);
    });
  });

  it("creates booking with commercial snapshot and exact paise calculations", async () => {
    (BusinessService.getBusinessByUserId as ReturnType<typeof vi.fn>).mockResolvedValue(renterBusiness);
    (prisma.resource.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockResource);
    (prisma.bookingRequest.create as ReturnType<typeof vi.fn>).mockImplementation(({ data }) => Promise.resolve({ id: "book-1", ...data }));

    const now = Date.now();
    const start = new Date(now + 86400000).toISOString();
    const end = new Date(now + 86400000 * 3).toISOString(); // exactly 2 days

    const booking = await BookingService.createBookingRequest(renterUserId, {
      resourceId: "res-100",
      quantity: 1,
      startDate: start,
      endDate: end,
    });

    expect(booking.rentAmountPaise).toBe(400000); // 2 days * ₹2,000 = ₹4,000 = 400000 paise
    expect(booking.securityDepositPaise).toBe(500000); // ₹5,000 = 500000 paise
    expect(booking.totalAmountPaise).toBe(900000); // ₹9,000
    expect(booking.bookingStatus).toBe("BOOKING_REQUESTED");
    expect(booking.financialStatus).toBe("PENDING_PAYMENT");
    expect(booking.listingPhotosSnapshot).toEqual(["https://example.com/gen.jpg"]);
    expect(booking.damageDisclosureSnapshot).toEqual({
      hasPreExistingDamage: true,
      damageDescription: "Minor scratch on side cover",
      damagePhotos: ["https://example.com/scratch.jpg"],
    });
  });

  it("marks handover and sets 1-hour renter inspection window", async () => {
    const bookingData = {
      id: "book-1",
      providerId: ownerBusiness.id,
      seekerId: renterBusiness.id,
      bookingStatus: "BOOKING_ACCEPTED",
      financialStatus: "FUNDS_HELD",
    };

    (prisma.bookingRequest.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(bookingData);
    (BusinessService.getBusinessByUserId as ReturnType<typeof vi.fn>).mockResolvedValue(ownerBusiness);
    (prisma.bookingRequest.update as ReturnType<typeof vi.fn>).mockImplementation(({ data }) => Promise.resolve({ ...bookingData, ...data }));

    const updated = await BookingService.markHandover("book-1", ownerUserId);

    expect(updated.bookingStatus).toBe("HANDOVER_INSPECTION");
    expect(updated.handoverInitiatedAt).toBeDefined();
    expect(updated.renterInspectionDeadline).toBeDefined();

    // 1 hour difference
    const diffMs = updated.renterInspectionDeadline!.getTime() - updated.handoverInitiatedAt!.getTime();
    expect(Math.round(diffMs / (60 * 1000))).toBe(60);
  });

  it("renter accepts resource condition: transitions to ACTIVE and releases rent to owner", async () => {
    const bookingData = {
      id: "book-1",
      providerId: ownerBusiness.id,
      seekerId: renterBusiness.id,
      bookingStatus: "HANDOVER_INSPECTION",
      financialStatus: "FUNDS_HELD",
      rentAmountPaise: 400000,
      transportFeePaise: 0,
      securityDepositPaise: 500000,
      quantity: 1,
    };

    (prisma.bookingRequest.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(bookingData);
    (BusinessService.getBusinessByUserId as ReturnType<typeof vi.fn>).mockResolvedValue(renterBusiness);
    (prisma.inspection.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "insp-1" });
    (prisma.bookingRequest.update as ReturnType<typeof vi.fn>).mockImplementation(({ data }) => Promise.resolve({ ...bookingData, ...data }));

    const result = await BookingService.renterReceivingInspection("book-1", renterUserId, {
      status: "ACCEPTED",
      notes: "Looks great, ready for deployment",
      evidenceUrls: [],
    });

    expect(result.bookingStatus).toBe("ACTIVE");
    expect(result.financialStatus).toBe("RENT_RELEASED");
    expect(prisma.paymentTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "RENT_PAYOUT",
        amountPaise: 400000,
      }),
    });
  });

  it("owner confirms physical return receipt and triggers 2-hour return inspection window", async () => {
    const bookingData = {
      id: "book-1",
      providerId: ownerBusiness.id,
      seekerId: renterBusiness.id,
      bookingStatus: "RETURN_INITIATED",
      financialStatus: "RENT_RELEASED",
      securityDepositPaise: 500000,
    };

    (prisma.bookingRequest.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(bookingData);
    (BusinessService.getBusinessByUserId as ReturnType<typeof vi.fn>).mockResolvedValue(ownerBusiness);
    (prisma.bookingRequest.update as ReturnType<typeof vi.fn>).mockImplementation(({ data }) => Promise.resolve({ ...bookingData, ...data }));

    const result = await BookingService.ownerConfirmReceipt("book-1", ownerUserId, {
      received: true,
    });

    expect(result.bookingStatus).toBe("OWNER_INSPECTION");
    expect(result.ownerReceivedAt).toBeDefined();
    expect(result.ownerInspectionDeadline).toBeDefined();

    // 2 hours window
    const diffHours = (result.ownerInspectionDeadline!.getTime() - result.ownerReceivedAt!.getTime()) / (1000 * 60 * 60);
    expect(Math.round(diffHours)).toBe(2);
  });

  it("owner accepts return intact: refunds security deposit and marks COMPLETED", async () => {
    const bookingData = {
      id: "book-1",
      providerId: ownerBusiness.id,
      seekerId: renterBusiness.id,
      bookingStatus: "OWNER_INSPECTION",
      financialStatus: "RENT_RELEASED",
      securityDepositPaise: 500000,
    };

    (prisma.bookingRequest.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(bookingData);
    (BusinessService.getBusinessByUserId as ReturnType<typeof vi.fn>).mockResolvedValue(ownerBusiness);
    (prisma.bookingRequest.update as ReturnType<typeof vi.fn>).mockImplementation(({ data }) => Promise.resolve({ ...bookingData, ...data }));

    const result = await BookingService.ownerAcceptReturn("book-1", ownerUserId);

    expect(result.bookingStatus).toBe("COMPLETED");
    expect(result.financialStatus).toBe("DEPOSIT_REFUNDED");
    expect(prisma.paymentTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "DEPOSIT_REFUND",
        amountPaise: 500000,
      }),
    });
  });

  it("auto-release worker refunds deposit when 2-hour owner inspection deadline expires without claims", async () => {
    const expiredBooking = {
      id: "book-expired",
      bookingStatus: "OWNER_INSPECTION",
      financialStatus: "RENT_RELEASED",
      securityDepositPaise: 500000,
      damageClaims: [], // No claims filed
    };

    (prisma.bookingRequest.findMany as ReturnType<typeof vi.fn>).mockImplementation(({ where }) => {
      if (where.bookingStatus === "OWNER_INSPECTION") {
        return Promise.resolve([expiredBooking]);
      }
      return Promise.resolve([]);
    });

    await BookingService.processExpiredInspections();

    expect(prisma.bookingRequest.update).toHaveBeenCalledWith({
      where: { id: "book-expired" },
      data: expect.objectContaining({
        bookingStatus: "COMPLETED",
        financialStatus: "DEPOSIT_REFUNDED",
      }),
    });
    expect(prisma.paymentTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "DEPOSIT_REFUND",
        amountPaise: 500000,
      }),
    });
  });
});
