import type { Prisma } from "@prisma/client";
import { prisma } from "../config/database.js";
import { RazorpayService } from "./razorpay.service.js";
import { summarizeLedger } from "./booking-rules.js";
import { badRequest, conflict, notFound } from "../utils/http-error.js";

type Tx = Prisma.TransactionClient;

const MAX_REFUND_ATTEMPTS = 5;
/** A refund stuck in PROCESSING this long (crashed mid-call) is picked up again. */
const STALE_PROCESSING_MS = 5 * 60 * 1000;

/**
 * The escrow ledger. Every movement of a booking's money is one
 * PaymentTransaction row whose `providerReference` is a unique idempotency
 * key, so the same payout or refund can never be written twice.
 *
 *   IN        ESCROW_DEPOSIT                        — the renter's captured Razorpay payment
 *   TO_RENTER FULL_REFUND, RENT_REFUND, DEPOSIT_REFUND — sent back through the Razorpay Refunds API
 *   TO_OWNER  RENT_PAYOUT, DAMAGE_PAYOUT              — queued; an admin settles them and records the UTR
 */
export class PaymentService {
  // ── Ledger writes (always inside the caller's booking transaction) ──

  static recordEscrowDeposit(tx: Tx, bookingId: string, amountPaise: number, razorpayPaymentId: string) {
    return tx.paymentTransaction.create({
      data: {
        bookingId,
        type: "ESCROW_DEPOSIT",
        direction: "IN",
        amountPaise,
        status: "COMPLETED",
        providerReference: razorpayPaymentId,
        processedAt: new Date(),
      },
    });
  }

  static queueRefund(
    tx: Tx,
    bookingId: string,
    type: "FULL_REFUND" | "RENT_REFUND" | "DEPOSIT_REFUND",
    amountPaise: number
  ) {
    if (amountPaise <= 0) return null;
    return tx.paymentTransaction.create({
      data: {
        bookingId,
        type,
        direction: "TO_RENTER",
        amountPaise,
        status: "PENDING",
        providerReference: `${type}_${bookingId}`,
      },
    });
  }

  static queuePayout(
    tx: Tx,
    bookingId: string,
    type: "RENT_PAYOUT" | "DAMAGE_PAYOUT",
    amountPaise: number
  ) {
    if (amountPaise <= 0) return null;
    return tx.paymentTransaction.create({
      data: {
        bookingId,
        type,
        direction: "TO_OWNER",
        amountPaise,
        status: "PENDING",
        providerReference: `${type}_${bookingId}`,
      },
    });
  }

  /** Money in, out and still held in escrow for a booking. */
  static async ledger(db: Tx | typeof prisma, bookingId: string) {
    const lines = await db.paymentTransaction.findMany({
      where: { bookingId },
      select: { direction: true, amountPaise: true, status: true },
    });
    return summarizeLedger(lines);
  }

  // ── Refund processing (outside any transaction — calls Razorpay) ──

  /**
   * Send queued refunds to Razorpay. Called right after a booking transaction
   * commits, and by the background worker to retry failures.
   * Each row is claimed atomically (PENDING/FAILED → PROCESSING) so two
   * processes can never refund the same line.
   */
  static async processRefunds(bookingId?: string): Promise<void> {
    const staleBefore = new Date(Date.now() - STALE_PROCESSING_MS);
    const candidates = await prisma.paymentTransaction.findMany({
      where: {
        direction: "TO_RENTER",
        ...(bookingId ? { bookingId } : {}),
        OR: [
          { status: "PENDING" },
          { status: "FAILED", attempts: { lt: MAX_REFUND_ATTEMPTS } },
          { status: "PROCESSING", updatedAt: { lt: staleBefore } },
        ],
      },
      include: { booking: { select: { razorpayPaymentId: true } } },
      orderBy: { createdAt: "asc" },
      take: 50,
    });

    for (const txn of candidates) {
      const claimed = await prisma.paymentTransaction.updateMany({
        where: { id: txn.id, status: txn.status, attempts: txn.attempts },
        data: { status: "PROCESSING", attempts: { increment: 1 } },
      });
      if (claimed.count !== 1) continue; // another process got it

      const paymentId = txn.booking.razorpayPaymentId;
      const ref = txn.providerReference!;
      try {
        if (!paymentId) throw new Error("Booking has no captured Razorpay payment to refund");

        // A previous attempt may have succeeded before we recorded it.
        const existing = txn.attempts > 0 || txn.status === "PROCESSING"
          ? await RazorpayService.findRefundByLedgerRef(paymentId, ref)
          : null;
        const refund = existing ?? await RazorpayService.refund(paymentId, txn.amountPaise, ref);

        await prisma.paymentTransaction.update({
          where: { id: txn.id },
          data: { status: "COMPLETED", razorpayRefundId: refund.id, processedAt: new Date(), failureReason: null },
        });
      } catch (err) {
        const reason = describeError(err);
        console.error(`[Payments] Refund ${ref} failed:`, reason);
        await prisma.paymentTransaction.update({
          where: { id: txn.id },
          data: { status: "FAILED", failureReason: reason.slice(0, 500) },
        });
      }
    }
  }

  // ── Admin: owner payouts and refund monitoring ──

  static async listTransactions(filter: { direction?: string; status?: string }) {
    return prisma.paymentTransaction.findMany({
      where: {
        direction: filter.direction ?? { in: ["TO_OWNER", "TO_RENTER"] },
        ...(filter.status ? { status: filter.status } : {}),
      },
      include: {
        booking: {
          select: {
            id: true,
            startDate: true,
            endDate: true,
            resource: { select: { name: true } },
            seeker:   { select: { id: true, name: true } },
            provider: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  /** Admin records that an owner payout was sent from the platform account. */
  static async markPayoutPaid(txnId: string, adminId: string, utrReference: string) {
    const txn = await prisma.paymentTransaction.findUnique({ where: { id: txnId } });
    if (!txn) throw notFound("Payout not found");
    if (txn.direction !== "TO_OWNER") throw badRequest("Only owner payouts can be marked as paid");
    if (txn.status === "COMPLETED") throw conflict("This payout is already marked as paid");

    return prisma.paymentTransaction.update({
      where: { id: txnId },
      data: {
        status: "COMPLETED",
        utrReference: utrReference.trim(),
        processedAt: new Date(),
        processedById: adminId,
      },
    });
  }

  /** Admin re-queues a refund that exhausted its automatic retries. */
  static async retryRefund(txnId: string) {
    const txn = await prisma.paymentTransaction.findUnique({ where: { id: txnId } });
    if (!txn) throw notFound("Refund not found");
    if (txn.direction !== "TO_RENTER") throw badRequest("Only renter refunds can be retried");
    if (txn.status !== "FAILED") throw conflict("Only failed refunds can be retried");

    await prisma.paymentTransaction.update({
      where: { id: txnId },
      data: { status: "PENDING", attempts: 0 },
    });
    await this.processRefunds(txn.bookingId);
    return prisma.paymentTransaction.findUnique({ where: { id: txnId } });
  }
}

function describeError(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as { error?: { description?: string }; message?: string };
    if (e.error?.description) return e.error.description;
    if (e.message) return e.message;
  }
  return String(err);
}
