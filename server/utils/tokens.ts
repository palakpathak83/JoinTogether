import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { getEnv } from '../config/env.ts';

export const REFRESH_COOKIE_NAME = 'jt_refresh';

export interface AccessTokenPayload {
  sub: string;
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  type: 'refresh';
}

export function signAccessToken(userId: string): string {
  const { jwtAccessSecret } = getEnv();
  return jwt.sign({ sub: userId, type: 'access' } satisfies AccessTokenPayload, jwtAccessSecret, {
    expiresIn: '15m',
  });
}

export function signRefreshToken(userId: string): { token: string; tokenHash: string; expiresAt: Date } {
  const { jwtRefreshSecret } = getEnv();
  const jti = crypto.randomUUID();
  const token = jwt.sign({ sub: userId, jti, type: 'refresh' } satisfies RefreshTokenPayload, jwtRefreshSecret, {
    expiresIn: '7d',
  });
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return { token, tokenHash, expiresAt };
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const { jwtAccessSecret } = getEnv();
  const decoded = jwt.verify(token, jwtAccessSecret) as jwt.JwtPayload;
  if (!decoded || decoded.type !== 'access' || typeof decoded.sub !== 'string') {
    throw new Error('Invalid access token');
  }
  return { sub: decoded.sub, type: 'access' };
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const { jwtRefreshSecret } = getEnv();
  const decoded = jwt.verify(token, jwtRefreshSecret) as jwt.JwtPayload;
  if (!decoded || decoded.type !== 'refresh' || typeof decoded.sub !== 'string' || typeof decoded.jti !== 'string') {
    throw new Error('Invalid refresh token');
  }
  return { sub: decoded.sub, jti: decoded.jti, type: 'refresh' };
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function isHttpsRequest(req: Request): boolean {
  const forwardedProto = req.headers['x-forwarded-proto'];
  if (typeof forwardedProto === 'string' && forwardedProto.split(',')[0].trim() === 'https') {
    return true;
  }
  return req.secure;
}

export function setRefreshCookie(req: Request, res: Response, refreshToken: string): void {
  const secure = isHttpsRequest(req);
  const maxAge = 7 * 24 * 60 * 60 * 1000;
  if (secure) {
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      partitioned: true,
      path: '/api/auth',
      maxAge,
    });
  } else {
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/api/auth',
      maxAge,
    });
  }
}

export function clearRefreshCookie(req: Request, res: Response): void {
  const secure = isHttpsRequest(req);
  if (secure) {
    res.clearCookie(REFRESH_COOKIE_NAME, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      partitioned: true,
      path: '/api/auth',
    });
  } else {
    res.clearCookie(REFRESH_COOKIE_NAME, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/api/auth',
    });
  }
}
