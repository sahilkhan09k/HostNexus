import { createApp } from "./app.js";
import { env } from "./config/env.js";

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`
  🚀 HostNexus API Server
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Environment: ${env.NODE_ENV}
  Port: ${env.PORT}
  Health: http://localhost:${env.PORT}/health
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `);
});
