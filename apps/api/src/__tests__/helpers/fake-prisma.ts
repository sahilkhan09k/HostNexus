/**
 * A small in-memory stand-in for the Prisma client, covering just the query
 * shapes the booking, negotiation and payment services use. It lets tests run
 * whole booking lifecycles and check the escrow ledger end to end.
 */

type Row = Record<string, any>;

const TABLES = [
  "user", "business", "resource", "availabilityWindow", "bookingRequest", "inspection", "evidence",
  "damageClaim", "dispute", "paymentTransaction", "bookingTimelineEvent", "negotiation",
  "negotiationOffer", "admin", "upload",
] as const;
type Table = (typeof TABLES)[number];

const DEFAULTS: Partial<Record<Table, Row>> = {
  bookingRequest: {
    bookingStatus: "BOOKING_REQUESTED", financialStatus: "PENDING_PAYMENT", status: "pending",
    rentAmountPaise: 0, securityDepositPaise: 0, totalAmountPaise: 0, transportMode: "SELF",
    transportDistanceKm: null, transportRatePerKmPaise: 0, transportFeePaise: 0,
    handoverCode: null, handoverCodeAttempts: 0, razorpayOrderId: null, razorpayOrderAmountPaise: null,
    razorpayPaymentId: null, paymentDeadline: null, handoverDeadline: null, renterInspectionDeadline: null,
    ownerReceiptDeadline: null, ownerInspectionDeadline: null, acceptedAt: null, fundedAt: null,
    returnedQuantity: null, receivedQuantity: null, ownerReceivedQuantity: null, cancelledBy: null,
  },
  paymentTransaction: {
    direction: "IN", status: "PENDING", attempts: 0, razorpayRefundId: null, utrReference: null,
    failureReason: null, processedAt: null, processedById: null,
  },
  dispute: { kind: "RETURN_CLAIM", raisedByRole: "OWNER", status: "OPEN", responseDeadline: null, damageClaimId: null },
  damageClaim: { status: "PENDING" },
  negotiation: { status: "OPEN" },
  negotiationOffer: { status: "PENDING" },
  resource: { deletedAt: null, isActive: true, transportAvailable: false, transportRatePerKmPaise: 0 },
};

const UNIQUE: Partial<Record<Table, string[]>> = {
  paymentTransaction: ["providerReference"],
  bookingRequest: ["razorpayPaymentId", "razorpayOrderId"],
  negotiation: ["bookingId"],
};

export class UniqueConstraintError extends Error {
  code = "P2002";
}

const isDate = (v: unknown): v is Date => v instanceof Date;
const eq = (a: any, b: any) => (isDate(a) || isDate(b) ? a?.getTime?.() === b?.getTime?.() : a === b);
const cmp = (a: any, b: any) => (isDate(a) ? a.getTime() : a) - (isDate(b) ? b.getTime() : b);

export function createFakePrisma() {
  const store: Record<Table, Row[]> = Object.fromEntries(TABLES.map((t) => [t, []])) as any;
  let seq = 0;

  const byId = (t: Table, id: string) => store[t].find((r) => r.id === id) ?? null;

  // Relation filters used by the services
  const relationFilter: Record<string, (row: Row, cond: Row) => boolean> = {
    "dispute.booking": (r, c) => matches("bookingRequest", byId("bookingRequest", r.bookingId), c),
    "negotiationOffer.negotiation": (r, c) => matches("negotiation", byId("negotiation", r.negotiationId), c),
    "resource.business": (r, c) => matches("business", byId("business", r.businessId), c),
    "business.owner": (r, c) => matches("user", byId("user", r.ownerId), c),
    "bookingRequest.seeker": (r, c) => matches("business", byId("business", r.seekerId), c),
    "bookingRequest.provider": (r, c) => matches("business", byId("business", r.providerId), c),
  };

  function matchValue(v: any, cond: any): boolean {
    if (cond === null || typeof cond !== "object" || isDate(cond)) return eq(v, cond);
    return Object.entries(cond).every(([op, x]) => {
      switch (op) {
        case "in": return (x as any[]).some((y) => eq(v, y));
        case "notIn": return !(x as any[]).some((y) => eq(v, y));
        case "not": return x !== null && typeof x === "object" && !isDate(x) ? !matchValue(v, x) : !eq(v, x);
        case "equals": return eq(v, x);
        case "lt": return v != null && cmp(v, x) < 0;
        case "lte": return v != null && cmp(v, x) <= 0;
        case "gt": return v != null && cmp(v, x) > 0;
        case "gte": return v != null && cmp(v, x) >= 0;
        default: throw new Error(`fake-prisma: unsupported operator ${op}`);
      }
    });
  }

  function matches(table: Table, row: Row | null, where: Row = {}): boolean {
    if (!row) return false;
    return Object.entries(where).every(([key, cond]) => {
      if (cond === undefined) return true;
      if (key === "OR") return (cond as Row[]).some((w) => matches(table, row, w));
      if (key === "AND") return (cond as Row[]).every((w) => matches(table, row, w));
      const rel = relationFilter[`${table}.${key}`];
      if (rel) return rel(row, cond);
      return matchValue(row[key], cond);
    });
  }

  function withIncludes(table: Table, row: Row, include?: Row): Row {
    if (!include) return { ...row };
    const out: Row = { ...row };
    const sub = (v: any) => (typeof v === "object" ? v : undefined);
    const many = (t: Table, key: string, spec: any) => {
      let rows = store[t].filter((r) => r[key] === row.id);
      if (spec?.where) rows = rows.filter((r) => matches(t, r, spec.where));
      rows = sortRows(rows, spec?.orderBy);
      if (spec?.take) rows = rows.slice(0, spec.take);
      return rows.map((r) => withIncludes(t, r, sub(spec)?.include));
    };
    for (const [rel, spec] of Object.entries(include)) {
      if (!spec) continue;
      const one = (t: Table, id: string | null) => {
        const r = id ? byId(t, id) : null;
        return r ? withIncludes(t, r, sub(spec)?.include) : null;
      };
      switch (`${table}.${rel}`) {
        case "bookingRequest.resource": out.resource = one("resource", row.resourceId); break;
        case "bookingRequest.seeker": out.seeker = one("business", row.seekerId); break;
        case "bookingRequest.provider": out.provider = one("business", row.providerId); break;
        case "bookingRequest.inspections": out.inspections = many("inspection", "bookingId", spec); break;
        case "bookingRequest.evidence": out.evidence = many("evidence", "bookingId", spec); break;
        case "bookingRequest.damageClaims": out.damageClaims = many("damageClaim", "bookingId", spec); break;
        case "bookingRequest.disputes": out.disputes = many("dispute", "bookingId", spec); break;
        case "bookingRequest.paymentTransactions": out.paymentTransactions = many("paymentTransaction", "bookingId", spec); break;
        case "bookingRequest.timelineEvents": out.timelineEvents = many("bookingTimelineEvent", "bookingId", spec); break;
        case "bookingRequest.negotiation": {
          const n = store.negotiation.find((r) => r.bookingId === row.id);
          out.negotiation = n ? withIncludes("negotiation", n, sub(spec)?.include) : null;
          break;
        }
        case "negotiation.offers": out.offers = many("negotiationOffer", "negotiationId", spec); break;
        case "negotiationOffer.proposer": out.proposer = one("business", row.proposerId); break;
        case "resource.business": out.business = one("business", row.businessId); break;
        case "resource.availabilityWindows": out.availabilityWindows = many("availabilityWindow", "resourceId", spec); break;
        case "business.owner": out.owner = one("user", row.ownerId); break;
        case "dispute.damageClaim": out.damageClaim = one("damageClaim", row.damageClaimId); break;
        case "dispute.booking": out.booking = one("bookingRequest", row.bookingId); break;
        case "damageClaim.disputes": out.disputes = many("dispute", "damageClaimId", spec); break;
        case "inspection.evidence": out.evidence = many("evidence", "inspectionId", spec); break;
        case "paymentTransaction.booking": out.booking = one("bookingRequest", row.bookingId); break;
        default: throw new Error(`fake-prisma: unsupported include ${table}.${rel}`);
      }
    }
    return out;
  }

  function sortRows(rows: Row[], orderBy?: Row | Row[]) {
    const o = Array.isArray(orderBy) ? orderBy[0] : orderBy;
    if (!o) return rows;
    const [key, dir] = Object.entries(o)[0] as [string, "asc" | "desc"];
    return [...rows].sort((a, b) => (dir === "desc" ? -1 : 1) * cmp(a[key], b[key]));
  }

  function applyData(row: Row, data: Row) {
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) continue;
      if (v && typeof v === "object" && !isDate(v) && !Array.isArray(v) && "increment" in v) row[k] = (row[k] ?? 0) + v.increment;
      else row[k] = v;
    }
  }

  function checkUnique(table: Table, row: Row) {
    for (const col of UNIQUE[table] ?? []) {
      if (row[col] == null) continue;
      if (store[table].some((r) => r !== row && r[col] === row[col])) {
        throw new UniqueConstraintError(`Unique constraint failed on ${table}.${col}`);
      }
    }
  }

  function model(table: Table) {
    return {
      findUnique: async ({ where, include }: Row) => {
        const r = store[table].find((x) => matches(table, x, where));
        return r ? withIncludes(table, r, include) : null;
      },
      findUniqueOrThrow: async ({ where, include }: Row) => {
        const r = store[table].find((x) => matches(table, x, where));
        if (!r) throw new Error(`${table} not found`);
        return withIncludes(table, r, include);
      },
      findFirst: async ({ where, include, orderBy }: Row = {}) => {
        const r = sortRows(store[table].filter((x) => matches(table, x, where)), orderBy)[0];
        return r ? withIncludes(table, r, include) : null;
      },
      findMany: async ({ where, include, orderBy, take }: Row = {}) => {
        let rows = sortRows(store[table].filter((x) => matches(table, x, where)), orderBy);
        if (take) rows = rows.slice(0, take);
        return rows.map((r) => withIncludes(table, r, include));
      },
      count: async ({ where }: Row = {}) => store[table].filter((x) => matches(table, x, where)).length,
      aggregate: async ({ where, _sum }: Row) => {
        const rows = store[table].filter((x) => matches(table, x, where));
        const sums: Row = {};
        for (const k of Object.keys(_sum ?? {})) sums[k] = rows.length ? rows.reduce((s, r) => s + (r[k] ?? 0), 0) : null;
        return { _sum: sums };
      },
      groupBy: async ({ by, where, _sum }: Row) => {
        const groups = new Map<string, Row[]>();
        for (const r of store[table].filter((x) => matches(table, x, where))) {
          const key = JSON.stringify((by as string[]).map((k) => r[k]));
          groups.set(key, [...(groups.get(key) ?? []), r]);
        }
        return [...groups.values()].map((rows) => {
          const out: Row = Object.fromEntries((by as string[]).map((k) => [k, rows[0][k]]));
          out._sum = Object.fromEntries(Object.keys(_sum ?? {}).map((k) => [k, rows.reduce((s, r) => s + (r[k] ?? 0), 0)]));
          return out;
        });
      },
      create: async ({ data, include }: Row) => {
        const now = new Date(Date.now() + ++seq); // strictly increasing createdAt keeps ordering stable
        const row: Row = { id: data.id ?? `${table}-${seq}`, ...(DEFAULTS[table] ?? {}), createdAt: now, updatedAt: now };
        applyData(row, data);
        checkUnique(table, row);
        store[table].push(row);
        return withIncludes(table, row, include);
      },
      update: async ({ where, data, include }: Row) => {
        const row = store[table].find((x) => matches(table, x, where));
        if (!row) throw new Error(`${table} to update not found`);
        const before = { ...row };
        applyData(row, data);
        row.updatedAt = new Date(Date.now() + ++seq);
        try {
          checkUnique(table, row);
        } catch (e) {
          Object.assign(row, before);
          throw e;
        }
        return withIncludes(table, row, include);
      },
      updateMany: async ({ where, data }: Row) => {
        const rows = store[table].filter((x) => matches(table, x, where));
        for (const r of rows) {
          applyData(r, data);
          r.updatedAt = new Date(Date.now() + ++seq);
        }
        return { count: rows.length };
      },
    };
  }

  const client: Row = Object.fromEntries(TABLES.map((t) => [t, model(t)]));

  /**
   * Interactive transactions roll back on error, like Postgres: the store is
   * snapshotted before the callback and restored if it throws.
   */
  client.$transaction = async (fn: (tx: any) => Promise<any>) => {
    const snapshot = Object.fromEntries(TABLES.map((t) => [t, store[t].map((r) => ({ ...r }))]));
    try {
      return await fn(client);
    } catch (e) {
      for (const t of TABLES) store[t] = snapshot[t] as Row[];
      throw e;
    }
  };
  client.$queryRaw = async () => [];

  client.__store = store;
  client.__reset = () => {
    for (const t of TABLES) store[t] = [];
    seq = 0;
  };
  client.__seed = (table: Table, row: Row) => {
    const now = new Date(Date.now() + ++seq);
    const full = { ...(DEFAULTS[table] ?? {}), createdAt: now, updatedAt: now, ...row };
    store[table].push(full);
    return full;
  };
  return client;
}
