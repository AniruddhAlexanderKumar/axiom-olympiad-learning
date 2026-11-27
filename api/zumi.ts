import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from '../server/src/app.js';
import { getContent } from '../server/src/content.js';
import { migrate } from '../server/src/db.js';

const app = createApp({ serveWeb: false });
let ready: Promise<unknown> | undefined;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    ready ??= Promise.all([migrate(), getContent()]).catch((error) => {
      ready = undefined;
      throw error;
    });
    await ready;
  } catch (error) {
    console.error('[api] initialization failed', error);
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Service temporarily unavailable.' }));
    return;
  }
  app(req, res);
}