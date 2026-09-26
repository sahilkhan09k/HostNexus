import { z } from "zod";

export const MAX_PAGE_SIZE = 100;

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(50),
  cursor: z.string().min(1).max(64).optional(),
});

export type Pagination = z.infer<typeof paginationSchema>;

/** Prisma args for cursor pagination; fetches one extra row to know whether there's a next page. */
export function pageArgs(p: Pagination) {
  return {
    take: p.limit + 1,
    ...(p.cursor ? { cursor: { id: p.cursor }, skip: 1 } : {}),
  };
}

/** Trims the extra row and returns the cursor for the next page (null when done). */
export function toPage<T extends { id: string }>(rows: T[], p: Pagination): { items: T[]; nextCursor: string | null } {
  const hasMore = rows.length > p.limit;
  const items = hasMore ? rows.slice(0, p.limit) : rows;
  return { items, nextCursor: hasMore ? items[items.length - 1].id : null };
}
