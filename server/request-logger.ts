import type { RequestHandler } from 'express';

// Never capture payloads, cookies, query strings or signed Storage URLs.
export function requestLogger(write: (message: string) => void): RequestHandler {
  return (req, res, next) => {
    const start = Date.now();
    const path = req.path;
    res.on('finish', () => {
      if (path.startsWith('/api')) write(`${req.method} ${path} ${res.statusCode} in ${Date.now() - start}ms`);
    });
    next();
  };
}
