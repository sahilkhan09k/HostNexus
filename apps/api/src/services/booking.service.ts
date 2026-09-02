import { prisma } from "../config/database.js";
import { BusinessService } from "./business.service.js";
import type { CreateBookingRequestInput, UpdateBookingStatusInput, BookingQuery } from "../schemas/booking.schema.js";

interface SafeBookingRequest {
  id: string;
  seekerId: string;
  providerId: string;
  resourceId: string;
  quantity: number;
  startDate: Date;
  endDate: Date;
  totalDays: number | null;
  specialRequests: string | null;
  status: string;
  proposedPrice: number | null;
  finalPrice: number | null;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class BookingService {
  /**
   * Create a new booking request
   */
  static async createBookingRequest(
    userId: string,
    input: CreateBookingRequestInput
  ): Promise<SafeBookingRequest> {
    // Get seeker's business (the one requesting)
    const seekerBusiness = await BusinessService.getBusinessByUserId(userId);

    if (!seekerBusiness) {
      throw new Error("You must have a business to create booking requests");
    }

    // Get the resource to find the provider
    const resource = await prisma.resource.findUnique({
      where: { id: input.resourceId },
      include: { business: true },
    });

    if (!resource) {
      throw new Error("Resource not found");
    }

    if (!resource.isActive) {
      throw new Error("This resource is not available for booking");
    }

    // Can't book your own resource
    if (resource.businessId === seekerBusiness.id) {
      throw new Error("You cannot book your own resource");
    }

    // Calculate total days
    const startDate = new Date(input.startDate);
    const endDate = new Date(input.endDate);
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    if (totalDays <= 0) {
      throw new Error("End date must be after start date");
    }

    // Create booking request
    const bookingRequest = await prisma.bookingRequest.create({
      data: {
        seekerId: seekerBusiness.id,
        providerId: resource.businessId,
        resourceId: input.resourceId,
        quantity: input.quantity,
        startDate,
        endDate,
        totalDays,
        specialRequests: input.specialRequests || null,
        proposedPrice: input.proposedPrice || null,
        status: "pending",
      },
    });

    return bookingRequest;
  }

  /**
   * Get all booking requests for a user's business
   */
  static async getBookingRequests(userId: string, query: BookingQuery): Promise<any[]> {
    // Get user's business
    const business = await BusinessService.getBusinessByUserId(userId);

    if (!business) {
      throw new Error("You must have a business to view booking requests");
    }

    // Build where clause based on type
    let where: any = {};

    if (query.type === "incoming") {
      // Requests TO this business (as provider)
      where.providerId = business.id;
    } else if (query.type === "outgoing") {
      // Requests FROM this business (as seeker)
      where.seekerId = business.id;
    } else {
      // All requests (both incoming and outgoing)
      where.OR = [
        { providerId: business.id },
        { seekerId: business.id },
      ];
    }

    if (query.status) {
      where.status = query.status;
    }

    // Get booking requests with related data
    const bookingRequests = await prisma.bookingRequest.findMany({
      where,
      include: {
        resource: {
          select: {
            id: true,
            name: true,
            resourceType: true,
            location: true,
          },
        },
        seeker: {
          select: {
            id: true,
            name: true,
          },
        },
        provider: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return bookingRequests;
  }

  /**
   * Get a booking request by ID
   */
  static async getBookingRequestById(bookingId: string): Promise<any | null> {
    const bookingRequest = await prisma.bookingRequest.findUnique({
      where: { id: bookingId },
      include: {
        resource: {
          select: {
            id: true,
            name: true,
            description: true,
            resourceType: true,
            location: true,
            quantity: true,
            unit: true,
          },
        },
        seeker: {
          select: {
            id: true,
            name: true,
          },
        },
        provider: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return bookingRequest;
  }

  /**
   * Update booking status (accept, reject, cancel, complete)
   */
  static async updateBookingStatus(
    bookingId: string,
    userId: string,
    input: UpdateBookingStatusInput
  ): Promise<SafeBookingRequest> {
    // Get booking request
    const bookingRequest = await prisma.bookingRequest.findUnique({
      where: { id: bookingId },
    });

    if (!bookingRequest) {
      throw new Error("Booking request not found");
    }

    // Get user's business
    const business = await BusinessService.getBusinessByUserId(userId);

    if (!business) {
      throw new Error("You must have a business to update bookings");
    }

    // Verify user has permission to update
    const isProvider = bookingRequest.providerId === business.id;
    const isSeeker = bookingRequest.seekerId === business.id;

    if (!isProvider && !isSeeker) {
      throw new Error("You do not have permission to update this booking");
    }

    // Validate status transitions
    if (input.status === "accepted" && !isProvider) {
      throw new Error("Only the resource provider can accept bookings");
    }

    if (input.status === "rejected" && !isProvider) {
      throw new Error("Only the resource provider can reject bookings");
    }

    if (input.status === "cancelled" && !isSeeker) {
      throw new Error("Only the requester can cancel bookings");
    }

    // Update booking request
    const updatedBooking = await prisma.bookingRequest.update({
      where: { id: bookingId },
      data: {
        status: input.status,
        rejectionReason: input.rejectionReason || null,
        finalPrice: input.finalPrice || bookingRequest.proposedPrice || null,
      },
    });

    return updatedBooking;
  }

  /**
   * Verify if user has access to a booking
   */
  static async verifyBookingAccess(bookingId: string, userId: string): Promise<boolean> {
    const booking = await prisma.bookingRequest.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      return false;
    }

    const business = await BusinessService.getBusinessByUserId(userId);

    if (!business) {
      return false;
    }

    return booking.providerId === business.id || booking.seekerId === business.id;
  }
}
