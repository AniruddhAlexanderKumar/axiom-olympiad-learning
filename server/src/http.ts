import type { NextFunction, Request, Response } from 'express';

export class HttpError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function wrap(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}

function statusFromError(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null;
  const candidate = error as { status?: unknown; statusCode?: unknown };
  const value =
    typeof candidate.status === 'number'
      ? candidate.status
      : typeof candidate.statusCode === 'number'
        ? candidate.statusCode
        : null;
  return value !== null && value >= 400 && value < 600 ? value : null;
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message, details: error.details });
    return;
  }
  const message = error instanceof Error ? error.message : 'Unexpected error';
  // body-parser and similar middleware attach a 4xx status to their errors.
  const clientStatus = statusFromError(error);
  if (clientStatus && clientStatus < 500) {
    const isJson = (error as { type?: string }).type === 'entity.parse.failed';
    res.status(clientStatus).json({ error: isJson ? 'Send a valid JSON body.' : 'Bad request.' });
    return;
  }
  if (process.env.NODE_ENV !== 'test') console.error('[api]', error);
  const isDbDown = /ECONNREFUSED|connect/i.test(message);
  res.status(isDbDown ? 503 : 500).json({
    error: isDbDown ? 'Database unavailable. Check DATABASE_URL.' : 'Something went wrong.',
  });
}
