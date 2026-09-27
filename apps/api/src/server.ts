import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { disconnectDatabase } from "./config/database.js";
import { startInspectionWorker, stopInspectionWorker } from "./jobs/inspection-worker.js";
import { VectorStoreService } from "./services/rag/vector-store.js";
import { logger } from "./utils/logger.js";
import { initRealtime, closeRealtime } from "./services/notifications/realtime.service.js";
import { EmailService } from "./services/notifications/email.service.js";

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`
  🚀 HostNexus API Server (MVP v2)
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Environment: ${env.NODE_ENV}
  Port: ${env.PORT}
  Health: http://localhost:${env.PORT}/health
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `);

  // Start background auto-inspection deadline ticker
  startInspectionWorker(30000);

  // Initialize Vector Database & Index
  VectorStoreService.init().catch((err) => logger.error("Vector Store init error", { err }));

  // Surface bad SMTP credentials at boot instead of on the first notification
  if (EmailService.isEnabled()) {
    void EmailService.verify().then((ok) => ok && logger.info("SMTP connection verified"));
  } else {
    logger.warn("Email notifications disabled (EMAIL_USER/EMAIL_PASSWORD not set or EMAIL_ENABLED=false)");
  }
});

// Realtime notifications share the HTTP server (same port, path /socket.io)
initRealtime(server);

// Graceful shutdown: stop accepting requests, stop the worker, close the DB pool
let shuttingDown = false;
function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`Received ${signal}, shutting down`);
  stopInspectionWorker();
  void closeRealtime();
  EmailService.close();
  server.close(() => {
    disconnectDatabase().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection", { reason: reason instanceof Error ? reason : String(reason) });
});
