import type { IncomingMessage, ServerResponse } from 'node:http';
type Express = ReturnType<typeof import('../server/src/app.js').createApp>;

let ready: Promise<Express> | undefined;

async function initialize(): Promise<Express> {
  const [{ createApp }, { getContent }, { migrate }] = await Promise.all([
    import('../server/src/app.js'),
    import('../server/src/content.js'),
    import('../server/src/db.js'),
  ]);
  await Promise.all([migrate(), getContent()]);
  return createApp({ serveWeb: false });
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  let app: Express;
  try {
    ready ??= initialize().catch((error) => {
      ready = undefined;
      throw error;
    });
    app = await ready;
  } catch (error) {
    console.error('[api] initialization failed', error);
    res.writeHead(503, {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json',
    });
    res.end(JSON.stringify({ error: 'Zumi’s server is temporarily unavailable. Try again shortly.' }));
    return;
  }
  app(req, res);
}