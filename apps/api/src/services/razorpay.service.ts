import Razorpay from "razorpay";
import crypto from "crypto";
import { env } from "../config/env.js";
import { httpError } from "../utils/http-error.js";

let client: Razorpay | null = null;

/** Lazily constructed so a missing key fails the payment request, not server start-up in dev. */
function razorpay(): Razorpay {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw httpError(503, "PAYMENTS_UNAVAILABLE", "Payments are not configured");
  }
  client ??= new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET });
  return client;
}

/** Constant-time comparison of two hex/ASCII strings */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

export interface RazorpayPaymentSummary {
  id: string;
  order_id: string | null;
  status: string;
  amount: number;
  currency: string;
}

export class RazorpayService {
  /**
   * Create a Razorpay order for the given amount (in paise).
   * Returns the full order object including id, amount, currency.
   */
  static async createOrder(
    amountPaise: number,
    bookingId: string
  ): Promise<{
    orderId: string;
    amount: number;
    currency: string;
    keyId: string;
  }> {
    const order = await razorpay().orders.create({
      amount: amountPaise,           // Razorpay expects amount in paise
      currency: "INR",
      receipt: `bk_${bookingId.slice(0, 30)}`,
      notes: {
        bookingId,
        platform: "HostNexus",
      },
    });

    return {
      orderId: order.id,
      amount: order.amount as number,
      currency: order.currency,
      keyId: env.RAZORPAY_KEY_ID!,
    };
  }

  static keyId(): string {
    return env.RAZORPAY_KEY_ID ?? "";
  }

  /**
   * Verify Razorpay checkout signature (HMAC-SHA256, constant-time compare).
   * Signature = HMAC_SHA256(razorpay_order_id + "|" + razorpay_payment_id, key_secret)
   */
  static verifySignature(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string
  ): boolean {
    if (!env.RAZORPAY_KEY_SECRET) {
      throw httpError(503, "PAYMENTS_UNAVAILABLE", "Payments are not configured");
    }
    const expectedSignature = crypto
      .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");

    return safeEqual(expectedSignature, razorpaySignature);
  }

  /** Verify a webhook delivery against the RAW request body. */
  static verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
    if (!env.RAZORPAY_WEBHOOK_SECRET) {
      throw httpError(503, "PAYMENTS_UNAVAILABLE", "Webhook secret is not configured");
    }
    const expected = crypto.createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest("hex");
    return safeEqual(expected, signature);
  }

  /**
   * Fetch a payment from Razorpay (server-to-server) so amount, currency,
   * order and status come from Razorpay rather than the browser.
   */
  static async fetchPayment(paymentId: string): Promise<RazorpayPaymentSummary> {
    const p = (await razorpay().payments.fetch(paymentId)) as any;
    return {
      id: String(p.id),
      order_id: p.order_id ? String(p.order_id) : null,
      status: String(p.status),
      amount: Number(p.amount),
      currency: String(p.currency),
    };
  }

  /** Capture an authorized payment (no-op path when the order auto-captures). */
  static async capturePayment(paymentId: string, amountPaise: number): Promise<RazorpayPaymentSummary> {
    const p = (await razorpay().payments.capture(paymentId, amountPaise, "INR")) as any;
    return {
      id: String(p.id),
      order_id: p.order_id ? String(p.order_id) : null,
      status: String(p.status),
      amount: Number(p.amount),
      currency: String(p.currency),
    };
  }

  /** All payment attempts made against an order (to recover a payment whose verify call never arrived). */
  static async fetchOrderPayments(orderId: string) {
    const res = await razorpay().orders.fetchPayments(orderId);
    return res.items;
  }

  /**
   * Refund part or all of a captured payment. `ledgerRef` is stored in the
   * refund notes so a retry can detect a refund that already went through.
   */
  static async refund(paymentId: string, amountPaise: number, ledgerRef: string) {
    return razorpay().payments.refund(paymentId, {
      amount: amountPaise,
      speed: "normal",
      notes: { ledgerRef, platform: "HostNexus" },
    });
  }

  /** Find an existing refund on a payment by our ledger reference. */
  static async findRefundByLedgerRef(paymentId: string, ledgerRef: string) {
    const res = await razorpay().payments.fetchMultipleRefund(paymentId, { count: 100 } as any);
    return res.items.find((r) => (r.notes as Record<string, string> | undefined)?.ledgerRef === ledgerRef) ?? null;
  }
}
