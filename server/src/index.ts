import { createApp } from './app.js';
import { getContent } from './content.js';
import { migrate } from './db.js';
import { config } from './env.js';

async function main() {
  await migrate();
  const content = await getContent();
  console.log(
    `[api] content loaded: ${content.learnTracks.length} learn tracks, ${content.lessons.size} lessons, ${content.problems.size} problems, ${content.contests.length} contests`,
  );
  if (!config.databaseUrl) console.log('[api] using embedded PGlite at .data/pglite (set DATABASE_URL for PostgreSQL)');
  if (!config.judge0.url) console.log('[api] Judge0 is not configured: code submissions will return 503');
  if (!config.googleClientId) console.log('[api] Google sign-in is not configured (GOOGLE_CLIENT_ID)');

  const app = createApp();
  app.listen(config.port, '0.0.0.0', () => {
    console.log(`[api] listening on http://localhost:${config.port}`);
  });
}

main().catch((error) => {
  console.error('[api] failed to start', error);
  process.exit(1);
});
