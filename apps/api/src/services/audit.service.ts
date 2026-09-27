import type { Request } from "express";
import { prisma } from "../config/database.js";
import { logger, redact } from "../utils/logger.js";

export type AuditAction =
  | "AUTH_LOGIN_SUCCESS"
  | "AUTH_LOGIN_FAILED"
  | "AUTH_REGISTER"
  | "AUTH_LOGOUT"
  | "AUTH_REFRESH_REUSE_DETECTED"
  | "ADMIN_LOGIN_SUCCESS"
  | "ADMIN_LOGIN_FAILED"
  | "ADMIN_USER_APPROVED"
  | "ADMIN_USER_REJECTED"
  | "ADMIN_DISPUTE_RESOLVED"
  | "ADMIN_KYC_DOCUMENT_VIEWED"
  | "PAYMENT_VERIFIED"
  | "PAYMENT_VERIFY_FAILED"
  | "PAYMENT_WEBHOOK"
  | "BOOKING_CANCELLED_REFUND";

export interface AuditEntry {
  action: AuditAction;
  actorType: "USER" | "ADMIN" | "SYSTEM" | "ANONYMOUS";
  actorId?: string | null;
  targetType?: string;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
  req?: Request;
}

/**
 * Record a security-relevant event. Never throws: audit failures are logged
 * but must not break the request that triggered them.
 */
export async function audit(entry: AuditEntry): Promise<void> {
  const ip = entry.req?.ip ?? null;
  const userAgent = entry.req?.get?.("user-agent")?.slice(0, 300) ?? null;
  const metadata = entry.metadata ? (redact(entry.metadata) as object) : undefined;
  try {
    await prisma.auditLog.create({
      data: {
        action: entry.action,
        actorType: entry.actorType,
        actorId: entry.actorId ?? null,
        targetType: entry.targetType ?? null,
        targetId: entry.targetId ?? null,
        ip,
        userAgent,
        metadata: metadata as any,
      },
    });
  } catch (err) {
    logger.error("Failed to write audit log", { action: entry.action, err });
  }
}
