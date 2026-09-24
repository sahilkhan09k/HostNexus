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
      findMany: vi.fn(),
      update: vi.fn(),
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
  });

  it("creates booking with commercial snapshot and exact paise calculations", async () => {
    (BusinessService.getBusinessByUserId as ReturnType<typeof vi.fn>).mockResolvedValue(renterBusiness);
    (prisma.resource.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockResource);
    (prisma.bookingRequest.create as ReturnType<typeof vi.fn>).mockImplementation(({ data }) => Promise.resolve({ id: "book-1", ...data }));

    const start = new Date(Date.now() + 86400000).toISOString();
    const end = new Date(Date.now() + 86400000 * 3).toISOString(); // 2 days

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
