import type { CorsOptions, CorsOptionsDelegate } from 'cors';
import { getAllowedOrigins, getEnv } from '../config/env.ts';

export const corsOptionsDelegate: CorsOptionsDelegate = (req, callback) => {
  const originHeader = req.headers.origin;
  if (!originHeader) {
    callback(null, { origin: true, credentials: true });
    return;
  }

  const normalizedOrigin = originHeader.replace(/\/+$/, '');
  const allowed = getAllowedOrigins();

  const forwardedHost = req.headers['x-forwarded-host'];
  const hostHeader =
    (typeof forwardedHost === 'string' ? forwardedHost.split(',')[0].trim() : undefined) ||
    req.headers.host;

  let isSameHost = false;
  if (hostHeader) {
    try {
      const originUrl = new URL(normalizedOrigin);
      isSameHost = originUrl.host === hostHeader;
    } catch {
      isSameHost = false;
    }
  }

  if (isSameHost || allowed.includes(normalizedOrigin) || getEnv().nodeEnv === 'test') {
    const opts: CorsOptions = {
      origin: normalizedOrigin,
      credentials: true,
    };
    callback(null, opts);
    return;
  }

  callback(new Error('Not allowed by CORS'));
};
