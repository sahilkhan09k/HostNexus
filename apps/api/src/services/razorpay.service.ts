import Razorpay from "razorpay";
import crypto from "crypto";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
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

  /**
   * Verify Razorpay payment signature (HMAC-SHA256).
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

    return expectedSignature === razorpaySignature;
  }

  /**
   * Fetch a payment from Razorpay to confirm captured status.
   */
  static async fetchPayment(paymentId: string) {
    return razorpay.payments.fetch(paymentId);
  }
}
