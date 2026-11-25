import { createApp } from './app.js';
import { getContent } from './content.js';
import { closeDb, migrate } from './db.js';
import { config } from './env.js';

async function main() {
  await migrate();
  const content = await getContent();
  console.log(
    `[api] content loaded: ${content.learnTracks.length} learn tracks, ${content.lessons.size} lessons, ${content.problems.size} problems, ${content.contests.length} contests`,
  );
  console.log(
    config.databaseUrl
      ? `[api] using PostgreSQL${config.databaseSsl ? ' over TLS' : ''}`
      : '[api] using embedded PGlite at .data/pglite (set DATABASE_URL for PostgreSQL)',
  );
  if (!config.judge0.url) console.log('[api] Judge0 is not configured: code submissions will return 503');

  const app = createApp();
  const server = app.listen(config.port, config.host, () => {
    console.log(`[api] listening on http://${config.host}:${config.port}`);
  });

  let closing = false;
  const shutdown = (signal: string) => {
    if (closing) return;
    closing = true;
    console.log(`[api] ${signal} received, shutting down`);
    const timer = setTimeout(() => process.exit(1), 10_000);
    timer.unref();
    server.close(() => {
      closeDb()
        .catch((error) => console.error('[api] failed to close the database', error))
        .finally(() => process.exit(0));
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error) => {
  console.error('[api] failed to start', error);
  process.exit(1);
});
