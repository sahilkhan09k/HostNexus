import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { startInspectionWorker } from "./jobs/inspection-worker.js";
import { VectorStoreService } from "./services/rag/vector-store.js";

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

  // Initialize Vector Database & Index
  VectorStoreService.init().catch((err) => console.error("Vector Store init error:", err));
});

