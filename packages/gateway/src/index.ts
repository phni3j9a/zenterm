import { config } from './config.js';
import { buildApp } from './app.js';

const app = await buildApp();
let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  app.log.info({ signal }, 'shutting down gateway');

  try {
    await app.close();
    process.exit(0);
  } catch (error) {
    app.log.error({ err: error, signal }, 'failed to shut down cleanly');
    process.exit(1);
  }
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void shutdown(signal);
  });
}

try {
  const address = await app.listen({
    port: config.PORT,
    host: config.HOST
  });

  app.log.info({ address }, 'palmsh-gateway listening');
} catch (error) {
  app.log.error({ err: error }, 'failed to start gateway');
  process.exit(1);
}
