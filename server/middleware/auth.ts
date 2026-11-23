import type { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { isDatabaseConnected } from '../config/db.ts';
import { getAllowedOrigins } from '../config/env.ts';
import { User, type IUser, type UserRole } from '../models/User.ts';
import { verifyAccessToken } from '../utils/tokens.ts';

export interface AuthenticatedRequest extends Request {
  user?: IUser;
}

export function requireDb(_req: Request, res: Response, next: NextFunction): void {
  if (!isDatabaseConnected()) {
    res.status(503).json({
      error: 'Database connection is unavailable. Configure MONGODB_URI to enable persistence.',
      code: 'DB_UNAVAILABLE',
    });
    return;
  }
  next();
}

export async function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  if (!isDatabaseConnected()) {
    res.status(503).json({ error: 'Database connection is unavailable.', code: 'DB_UNAVAILABLE' });
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    if (!mongoose.isValidObjectId(payload.sub)) {
      res.status(401).json({ error: 'Invalid authentication token' });
      return;
    }

    // Always resolve current user & authoritative role from MongoDB, never from client claims.
    const user = await User.findById(payload.sub);
    if (!user) {
      res.status(401).json({ error: 'Account not found' });
      return;
    }
    if (!user.isActive) {
      res.status(403).json({ error: 'Account has been suspended' });
      return;
    }

    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired access token' });
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions for this action' });
      return;
    }
    next();
  };
}

export function csrfOriginGuard(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin;
  if (origin) {
    const normalized = origin.replace(/\/+$/, '');
    const allowed = getAllowedOrigins();
    const forwardedHost = typeof req.headers['x-forwarded-host'] === 'string' ? req.headers['x-forwarded-host'] : req.headers.host;
    let matchesHost = false;
    if (forwardedHost) {
      try {
        const originUrl = new URL(normalized);
        matchesHost = originUrl.host === forwardedHost;
      } catch {
        matchesHost = false;
      }
    }
    if (!matchesHost && !allowed.includes(normalized)) {
      res.status(403).json({ error: 'Cross-origin request rejected' });
      return;
    }
  }
  next();
}

export function isValidObjectIdParam(value: unknown): value is string {
  return typeof value === 'string' && mongoose.isValidObjectId(value);
}
