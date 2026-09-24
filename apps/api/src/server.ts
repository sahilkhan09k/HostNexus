import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { startInspectionWorker } from "./jobs/inspection-worker.js";

const app = createApp();

app.listen(env.PORT, () => {
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
});
