import Razorpay from "razorpay";
import crypto from "crypto";
import { safeEqual } from "./booking-rules.js";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_placeholder",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "placeholder_secret",
});

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
    const order = await razorpay.orders.create({
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
      keyId: process.env.RAZORPAY_KEY_ID!,
    };
  }

  static keyId(): string {
    return process.env.RAZORPAY_KEY_ID!;
  }

  /**
   * Verify Razorpay payment signature (HMAC-SHA256), in constant time.
   * Must be called after the frontend completes the checkout.
   *
   * Signature = HMAC_SHA256(razorpay_order_id + "|" + razorpay_payment_id, key_secret)
   */
  static verifySignature(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string
  ): boolean {
    const body = `${razorpayOrderId}|${razorpayPaymentId}`;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
      .update(body)
      .digest("hex");

    return safeEqual(expectedSignature, razorpaySignature);
  }

  /**
   * Fetch a payment from Razorpay to confirm its order, amount and status.
   */
  static async fetchPayment(paymentId: string) {
    return razorpay.payments.fetch(paymentId);
  }

  /** All payment attempts made against an order (to recover a payment whose verify call never arrived). */
  static async fetchOrderPayments(orderId: string) {
    const res = await razorpay.orders.fetchPayments(orderId);
    return res.items;
  }

  /** Capture an authorized payment (needed when the account doesn't auto-capture). */
  static async capturePayment(paymentId: string, amountPaise: number) {
    return razorpay.payments.capture(paymentId, amountPaise, "INR");
  }

  /**
   * Refund part or all of a captured payment. `ledgerRef` is stored in the
   * refund notes so a retry can detect a refund that already went through.
   */
  static async refund(paymentId: string, amountPaise: number, ledgerRef: string) {
    return razorpay.payments.refund(paymentId, {
      amount: amountPaise,
      speed: "normal",
      notes: { ledgerRef, platform: "HostNexus" },
    });
  }

  /** Find an existing refund on a payment by our ledger reference. */
  static async findRefundByLedgerRef(paymentId: string, ledgerRef: string) {
    const res = await razorpay.payments.fetchMultipleRefund(paymentId, { count: 100 } as any);
    return res.items.find((r) => (r.notes as Record<string, string> | undefined)?.ledgerRef === ledgerRef) ?? null;
  }
}
