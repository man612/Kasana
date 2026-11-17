import { API_PREFIX } from '../config';
import type { NextFunction, Request, Response } from 'express';

/**
 * Financial records, auth/session responses and attachments are private.
 * The default Nginx reverse proxy forwards these headers unchanged.
 *
 * Keep this before all API/auth routers. Static Vite assets and public
 * /.well-known/ metadata are outside the API prefix and remain cacheable.
 *
 * A Cloudflare Cache Rule with an overriding Edge TTL can still defeat these
 * headers; public operators must separately configure and verify edge bypass.
 */
export function privateApiCacheMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (req.path === API_PREFIX || req.path.startsWith(`${API_PREFIX}/`)) {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('CDN-Cache-Control', 'no-store');
    res.setHeader('Cloudflare-CDN-Cache-Control', 'no-store');
  }
  next();
}
