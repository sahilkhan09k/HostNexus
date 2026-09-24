import { BookingService } from "../services/booking.service.js";

let intervalId: NodeJS.Timeout | null = null;

export function startInspectionWorker(intervalMs: number = 30000): void {
  if (intervalId) return;

  console.log(`[InspectionWorker] Starting automated inspection deadline monitor (interval: ${intervalMs / 1000}s)`);

  // Run immediately on boot
  BookingService.processExpiredInspections().catch((err) => {
    console.error("[InspectionWorker] Initial inspection check error:", err);
  });

  // Run periodically
  intervalId = setInterval(async () => {
    try {
      await BookingService.processExpiredInspections();
    } catch (err) {
      console.error("[InspectionWorker] Error running processExpiredInspections:", err);
    }
  }, intervalMs);
}

export function stopInspectionWorker(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log("[InspectionWorker] Stopped automated inspection deadline monitor");
  }
}
