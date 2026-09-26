import { prisma } from "../config/database.js";
import { BusinessService } from "./business.service.js";
import { CAPACITY_HOLDING_STATUSES, getCommittedQuantity } from "./capacity.js";

export interface CreateWindowInput {
  fromDate: string; // ISO date string
  toDate: string;
  note?: string;
}

// ─── Helpers ──────────────────────────────────────────────────

/** All active bookings that overlap with [start, end] for a resource */
async function getOverlappingBookings(resourceId: string, start: Date, end: Date) {
  return prisma.bookingRequest.findMany({
    where: {
      resourceId,
      bookingStatus: {
        notIn: ["CANCELLED", "COMPLETED"],
      },
      // Overlap: booking starts before end AND booking ends after start
      startDate: { lte: end },
      endDate:   { gte: start },
    },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      bookingStatus: true,
      seeker: { select: { id: true, name: true } },
    },
  });
}

// ─── Service ──────────────────────────────────────────────────

export class AvailabilityService {

  /** Create a new availability window for a resource */
  static async createWindow(
    userId: string,
    resourceId: string,
    input: CreateWindowInput
  ) {
    const business = await BusinessService.getBusinessByUserId(userId);
    if (!business) throw new Error("No business found for this user");

    const resource = await prisma.resource.findUnique({ where: { id: resourceId } });
    if (!resource) throw new Error("Resource not found");
    if (resource.businessId !== business.id)
      throw new Error("Unauthorized: You can only manage your own resources");

    const from = new Date(input.fromDate);
    const to   = new Date(input.toDate);
    if (isNaN(from.getTime()) || isNaN(to.getTime()))
      throw new Error("Invalid date format");
    if (to < from) throw new Error("End date must be after start date");

    return prisma.availabilityWindow.create({
      data: {
        resourceId,
        fromDate: from,
        toDate:   to,
        note:     input.note ?? null,
      },
    });
  }

  /** Replace all windows for a resource (bulk set) */
  static async setWindows(
    userId: string,
    resourceId: string,
    windows: CreateWindowInput[]
  ) {
    const business = await BusinessService.getBusinessByUserId(userId);
    if (!business) throw new Error("No business found for this user");

    const resource = await prisma.resource.findUnique({ where: { id: resourceId } });
    if (!resource) throw new Error("Resource not found");
    if (resource.businessId !== business.id)
      throw new Error("Unauthorized: You can only manage your own resources");

    // Validate all first
    const parsed = windows.map((w, i) => {
      const from = new Date(w.fromDate);
      const to   = new Date(w.toDate);
      if (isNaN(from.getTime()) || isNaN(to.getTime()))
        throw new Error(`Window ${i + 1}: invalid date`);
      if (to < from)
        throw new Error(`Window ${i + 1}: end date must be after start date`);
      return { fromDate: from, toDate: to, note: w.note ?? null, resourceId };
    });

    return prisma.$transaction(async (tx) => {
      await tx.availabilityWindow.deleteMany({ where: { resourceId } });
      if (parsed.length > 0) {
        await tx.availabilityWindow.createMany({ data: parsed });
      }
      return tx.availabilityWindow.findMany({
        where: { resourceId },
        orderBy: { fromDate: "asc" },
      });
    });
  }

  /** Delete a single window */
  static async deleteWindow(userId: string, windowId: string) {
    const business = await BusinessService.getBusinessByUserId(userId);
    if (!business) throw new Error("No business found");

    const window = await prisma.availabilityWindow.findUnique({
      where: { id: windowId },
      include: { resource: true },
    });
    if (!window) throw new Error("Window not found");
    if (window.resource.businessId !== business.id)
      throw new Error("Unauthorized");

    await prisma.availabilityWindow.delete({ where: { id: windowId } });
  }

  /** Get all windows for a resource (public — for calendar display) */
  static async getWindows(resourceId: string) {
    return prisma.availabilityWindow.findMany({
      where: { resourceId },
      orderBy: { fromDate: "asc" },
    });
  }

  /**
   * Check if a resource is available for a requested date range.
   *
   * A resource is available when ALL of these are true:
   *   1. At least one AvailabilityWindow covers the entire [start, end] span.
   *   2. Accepted/active bookings overlapping the span leave >= `quantity` units free.
   *      Pending requests don't hold stock (same rule as booking create/accept).
   *
   * Returns an object with `available: boolean` and details on why not.
   */
  static async checkAvailability(
    resourceId: string,
    startDate: string,
    endDate: string,
    quantity = 1
  ) {
    const start = new Date(startDate);
    const end   = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()))
      throw new Error("Invalid date format");

    const resource = await prisma.resource.findUnique({
      where: { id: resourceId },
      select: { id: true, quantity: true },
    });
    if (!resource) throw new Error("Resource not found");

    // 1. Does any window fully cover the request?
    const coveringWindow = await prisma.availabilityWindow.findFirst({
      where: {
        resourceId,
        fromDate: { lte: start },
        toDate:   { gte: end },
      },
    });

    // 2. How many units do overlapping accepted/active bookings hold?
    const committed = await getCommittedQuantity(prisma, resourceId, start, end);
    const availableQuantity = Math.max(0, resource.quantity - committed);
    const conflicts = await prisma.bookingRequest.findMany({
      where: {
        resourceId,
        bookingStatus: { in: CAPACITY_HOLDING_STATUSES },
        startDate: { lt: end },
        endDate:   { gt: start },
      },
      select: { id: true, startDate: true, endDate: true, bookingStatus: true, quantity: true },
    });

    const available = !!coveringWindow && availableQuantity >= quantity;

    return {
      available,
      coveredByWindow: !!coveringWindow,
      totalQuantity: resource.quantity,
      availableQuantity,
      conflicts: conflicts.map((b) => ({
        bookingId: b.id,
        startDate: b.startDate,
        endDate:   b.endDate,
        status:    b.bookingStatus,
        quantity:  b.quantity,
      })),
      message: !coveringWindow
        ? "Resource is not available during this period (no availability window set)"
        : availableQuantity < quantity
        ? `Only ${availableQuantity} of ${resource.quantity} unit(s) free for this period`
        : "Resource is available",
    };
  }

  /**
   * Returns unavailable date ranges for a resource for a given month.
   * Used by the frontend calendar to shade booked days.
   *
   * month: "YYYY-MM"
   */
  static async getUnavailableDates(resourceId: string, month: string) {
    const [year, mon] = month.split("-").map(Number);
    if (!year || !mon) throw new Error("month must be YYYY-MM format");

    const monthStart = new Date(year, mon - 1, 1);
    const monthEnd   = new Date(year, mon, 0, 23, 59, 59); // last day of month

    // Active bookings within this month
    const bookings = await getOverlappingBookings(resourceId, monthStart, monthEnd);

    // All availability windows for context
    const windows = await prisma.availabilityWindow.findMany({
      where: {
        resourceId,
        fromDate: { lte: monthEnd },
        toDate:   { gte: monthStart },
      },
      orderBy: { fromDate: "asc" },
    });

    return {
      bookedRanges: bookings.map((b) => ({
        from:   b.startDate.toISOString().split("T")[0],
        to:     b.endDate.toISOString().split("T")[0],
        status: b.bookingStatus,
      })),
      availableWindows: windows.map((w) => ({
        id:   w.id,
        from: w.fromDate.toISOString().split("T")[0],
        to:   w.toDate.toISOString().split("T")[0],
        note: w.note,
      })),
    };
  }
}
