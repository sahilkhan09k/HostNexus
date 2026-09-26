import { Prisma } from "@prisma/client";
import { prisma } from "../config/database.js";

/**
 * Single source of truth for "is there enough of this resource left for these dates?"
 * Used by booking creation, owner accept, the availability check endpoint and the
 * marketplace date filter so they can never disagree.
 */

/** Statuses in which a booking holds units of a resource. Pending requests do NOT hold stock. */
export const CAPACITY_HOLDING_STATUSES = [
  "BOOKING_ACCEPTED",
  "HANDOVER_INSPECTION",
  "ACTIVE",
  "RETURN_INITIATED",
  "RETURN_NOT_RECEIVED",
  "OWNER_INSPECTION",
  "DISPUTED",
  "NON_RETURNED",
];

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Overlap is half-open: [startDate, endDate). A booking ending on the 12th does not
 * conflict with one starting on the 12th (totalDays is computed the same way).
 */
function overlapWhere(start: Date, end: Date) {
  return {
    bookingStatus: { in: CAPACITY_HOLDING_STATUSES },
    startDate: { lt: end },
    endDate:   { gt: start },
  };
}

/**
 * Units already committed for [start, end). Sums every overlapping holding booking,
 * which is conservative (two bookings on disjoint days inside the range both count).
 */
export async function getCommittedQuantity(
  db: Db,
  resourceId: string,
  start: Date,
  end: Date,
  excludeBookingId?: string
): Promise<number> {
  const agg = await db.bookingRequest.aggregate({
    where: {
      resourceId,
      ...overlapWhere(start, end),
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
    },
    _sum: { quantity: true },
  });
  return agg._sum.quantity ?? 0;
}

/** Committed units per resource for [start, end), for filtering many listings at once. */
export async function getCommittedQuantities(
  resourceIds: string[],
  start: Date,
  end: Date
): Promise<Map<string, number>> {
  if (resourceIds.length === 0) return new Map();
  const rows = await prisma.bookingRequest.groupBy({
    by: ["resourceId"],
    where: { resourceId: { in: resourceIds }, ...overlapWhere(start, end) },
    _sum: { quantity: true },
  });
  return new Map(rows.map((r) => [r.resourceId, r._sum.quantity ?? 0]));
}

/**
 * Takes a row lock on the resource so concurrent create/accept calls for the same
 * resource serialise. Must be called inside an interactive transaction.
 */
export async function lockResource(tx: Prisma.TransactionClient, resourceId: string) {
  await tx.$queryRaw`SELECT id FROM "resources" WHERE id = ${resourceId} FOR UPDATE`;
}

/** Throws if fewer than `quantity` units are free for [start, end). */
export async function assertCapacity(
  db: Db,
  resource: { id: string; quantity: number },
  quantity: number,
  start: Date,
  end: Date,
  excludeBookingId?: string
) {
  const committed = await getCommittedQuantity(db, resource.id, start, end, excludeBookingId);
  const free = resource.quantity - committed;
  if (quantity > free) {
    throw new Error(
      free <= 0
        ? "This resource is fully booked for the requested dates."
        : `Only ${free} of ${resource.quantity} unit(s) are free for the requested dates (requested ${quantity}).`
    );
  }
}
