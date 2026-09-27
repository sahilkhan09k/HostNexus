import { BookingService } from "../services/booking.service.js";
import { PaymentService } from "../services/payment.service.js";

let intervalId: NodeJS.Timeout | null = null;

/** One tick: enforce every expired booking deadline, then retry queued/failed refunds. */
async function tick(): Promise<void> {
  await BookingService.processDeadlines();
  await PaymentService.processRefunds();
}

export function startInspectionWorker(intervalMs: number = 30000): void {
  if (intervalId) return;

  console.log(`[DeadlineWorker] Starting booking deadline & refund monitor (interval: ${intervalMs / 1000}s)`);

  // Run immediately on boot
  tick().catch((err) => {
    console.error("[DeadlineWorker] Initial run error:", err);
  });

  // Run periodically
  intervalId = setInterval(async () => {
    try {
      await tick();
    } catch (err) {
      console.error("[DeadlineWorker] Error:", err);
    }
  }, intervalMs);
}

export function stopInspectionWorker(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log("[DeadlineWorker] Stopped booking deadline & refund monitor");
  }
}
