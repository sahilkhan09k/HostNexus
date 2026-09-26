import { Prisma } from "@prisma/client";
import { prisma } from "../config/database.js";
import { conflict } from "../utils/http-error.js";

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
  "OWNER_INSPECTION",
  "DISPUTED",
];

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Booking dates are inclusive calendar days: a booking for the 10th–12th uses
 * the unit on the 10th, 11th and 12th, so it conflicts with one starting on the 12th.
 */
function overlapWhere(start: Date, end: Date) {
  return {
    bookingStatus: { in: CAPACITY_HOLDING_STATUSES },
    startDate: { lte: end },
    endDate:   { gte: start },
  };
}

/**
 * Units already committed for the inclusive range [start, end]. Sums every overlapping holding booking,
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

/** Committed units per resource for [start, end], for filtering many listings at once. */
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

/**
 * The most units booked on any single day from `fromDay` onwards. A listing's
 * quantity can't be lowered below this without breaking accepted bookings.
 */
export async function getPeakCommittedQuantity(db: Db, resourceId: string, fromDay: Date): Promise<number> {
  const bookings = await db.bookingRequest.findMany({
    where: { resourceId, bookingStatus: { in: CAPACITY_HOLDING_STATUSES }, endDate: { gte: fromDay } },
    select: { startDate: true, endDate: true, quantity: true },
  });
  // Sweep line over day boundaries: +q on the first day, -q the day after the last.
  const DAY = 24 * 60 * 60 * 1000;
  const deltas = new Map<number, number>();
  for (const b of bookings) {
    const from = Math.max(b.startDate.getTime(), fromDay.getTime());
    const after = b.endDate.getTime() + DAY;
    deltas.set(from, (deltas.get(from) ?? 0) + b.quantity);
    deltas.set(after, (deltas.get(after) ?? 0) - b.quantity);
  }
  let running = 0, peak = 0;
  for (const t of [...deltas.keys()].sort((a, b) => a - b)) {
    running += deltas.get(t)!;
    peak = Math.max(peak, running);
  }
  return peak;
}

/** Throws (409) if fewer than `quantity` units are free for [start, end]. */
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
    throw conflict(
      free <= 0
        ? "This resource is fully booked for the requested dates."
        : `Only ${free} of ${resource.quantity} unit(s) are free for the requested dates (requested ${quantity}).`
    );
  }
}
