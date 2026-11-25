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
  if (process.env.NODE_ENV !== 'test') console.error('[api]', error);
  const isDbDown = /ECONNREFUSED|connect/i.test(message);
  res.status(isDbDown ? 503 : 500).json({
    error: isDbDown ? 'Database unavailable. Check DATABASE_URL.' : 'Something went wrong.',
  });
}
