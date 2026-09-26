import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/database.js";
import { RazorpayService } from "../services/razorpay.service.js";
import { BookingService } from "../services/booking.service.js";
import { audit } from "../services/audit.service.js";
import { HttpError } from "../utils/http-error.js";
import { logger } from "../utils/logger.js";

/**
 * POST /api/webhooks/razorpay
 * Mounted with express.raw() BEFORE the JSON parser: the signature is computed
 * over the exact bytes Razorpay sent, so the body must not be re-serialised.
 */
export async function handleRazorpayWebhook(req: Request, res: Response): Promise<void> {
  const signature = req.header("x-razorpay-signature") ?? "";
  const eventId = req.header("x-razorpay-event-id") ?? "";
  const raw = req.body;

  if (!Buffer.isBuffer(raw) || !signature) {
    res.status(400).json({ success: false, error: { code: "BAD_WEBHOOK", message: "Missing body or signature" } });
    return;
  }

  try {
    if (!RazorpayService.verifyWebhookSignature(raw, signature)) {
      logger.warn("Razorpay webhook with invalid signature", { eventId });
      res.status(400).json({ success: false, error: { code: "BAD_SIGNATURE", message: "Invalid signature" } });
      return;
    }
  } catch (err) {
    const status = err instanceof HttpError ? err.statusCode : 500;
    res.status(status).json({ success: false, error: { code: "WEBHOOK_UNAVAILABLE", message: "Webhook not configured" } });
    return;
  }

  let event: any;
  try {
    event = JSON.parse(raw.toString("utf8"));
  } catch {
    res.status(400).json({ success: false, error: { code: "BAD_WEBHOOK", message: "Malformed JSON" } });
    return;
  }

  // Idempotency: Razorpay retries deliveries; process each event id once
  if (eventId) {
    try {
      await prisma.razorpayWebhookEvent.create({ data: { id: eventId, event: String(event?.event ?? "unknown") } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        res.status(200).json({ success: true, data: { duplicate: true } });
        return;
      }
      throw err;
    }
  }

  try {
    const type = String(event?.event ?? "");
    if (type === "payment.captured" || type === "order.paid") {
      const payment = event?.payload?.payment?.entity;
      const orderId = payment?.order_id ?? event?.payload?.order?.entity?.id;
      if (typeof orderId === "string" && typeof payment?.id === "string") {
        // Amount/status are re-fetched from Razorpay inside; the webhook body is only a hint
        const funded = await BookingService.fundEscrowFromWebhook(orderId, payment.id);
        await audit({ action: "PAYMENT_WEBHOOK", actorType: "SYSTEM", targetType: "RazorpayOrder", targetId: orderId,
          metadata: { event: type, paymentId: payment.id, funded } });
      }
    }
    res.status(200).json({ success: true });
  } catch (err) {
    // Let Razorpay retry: forget the event id so the retry is processed
    if (eventId) await prisma.razorpayWebhookEvent.delete({ where: { id: eventId } }).catch(() => {});
    logger.error("Razorpay webhook processing failed", { eventId, err });
    res.status(500).json({ success: false, error: { code: "WEBHOOK_FAILED", message: "Processing failed" } });
  }
}
