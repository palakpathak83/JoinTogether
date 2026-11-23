import bcrypt from 'bcryptjs';
import { Router, type Response } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { getEnv } from '../config/env.ts';
import { authenticate, csrfOriginGuard, requireDb, type AuthenticatedRequest } from '../middleware/auth.ts';
import { getSystemConfig, SystemConfig } from '../models/SystemConfig.ts';
import { User, type IUser } from '../models/User.ts';
import {
  clearRefreshCookie,
  hashToken,
  REFRESH_COOKIE_NAME,
  setRefreshCookie,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../utils/tokens.ts';

const router = Router();

const RegisterSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(160),
  password: z.string().min(8).max(128),
  city: z.string().trim().max(80).optional().default(''),
  bio: z.string().trim().max(400).optional().default(''),
  skills: z.array(z.string().trim().min(1).max(40)).max(20).optional().default([]),
  interests: z.array(z.string().trim().min(1).max(40)).max(20).optional().default([]),
});

const LoginSchema = z.object({
  email: z.string().trim().email().max(160),
  password: z.string().min(1).max(128),
});

const UpdateProfileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  city: z.string().trim().max(80).optional(),
  bio: z.string().trim().max(400).optional(),
  skills: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  interests: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
});

const AdminClaimSchema = z.object({
  passcode: z.string().trim().optional().default(''),
});

export function serializeUser(user: IUser) {
  return {
    _id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    city: user.city,
    bio: user.bio,
    skills: user.skills,
    interests: user.interests,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}

async function issueSessionTokens(user: IUser, req: Parameters<typeof setRefreshCookie>[0], res: Response) {
  const accessToken = signAccessToken(user._id.toString());
  const refresh = signRefreshToken(user._id.toString());
  const now = new Date();

  await User.updateOne(
    { _id: user._id },
    {
      $push: {
        refreshTokens: {
          $each: [{ tokenHash: refresh.tokenHash, expiresAt: refresh.expiresAt, createdAt: now }],
          $slice: -5,
        },
      },
    }
  );

  setRefreshCookie(req, res, refresh.token);
  return { accessToken };
}

router.post('/register', requireDb, async (req, res) => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid registration details', details: parsed.error.flatten().fieldErrors });
    return;
  }

  const { name, email, password, city, bio, skills, interests } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  const existing = await User.exists({ email: normalizedEmail });
  if (existing) {
    res.status(409).json({ error: 'An account with this email already exists' });
    return;
  }

  const rounds = getEnv().nodeEnv === 'test' ? 8 : 10;
  const passwordHash = await bcrypt.hash(password, rounds);

  // Never trust role from client body: always assign least-privilege USER on self-registration
  const user = await User.create({
    name,
    email: normalizedEmail,
    passwordHash,
    role: 'USER',
    city,
    bio,
    skills,
    interests,
    isActive: true,
  });

  const { accessToken } = await issueSessionTokens(user, req, res);
  res.status(201).json({
    accessToken,
    user: serializeUser(user),
  });
});

router.post('/login', requireDb, async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Valid email and password are required' });
    return;
  }

  const normalizedEmail = parsed.data.email.toLowerCase();
  const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash');

  if (!user) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const matches = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!matches) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  if (!user.isActive) {
    res.status(403).json({ error: 'Account has been suspended' });
    return;
  }

  const { accessToken } = await issueSessionTokens(user, req, res);
  res.json({
    accessToken,
    user: serializeUser(user),
  });
});

router.post('/refresh', requireDb, csrfOriginGuard, async (req, res) => {
  const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
  if (typeof rawToken !== 'string' || !rawToken) {
    res.status(401).json({ error: 'Refresh token missing' });
    return;
  }

  try {
    const payload = verifyRefreshToken(rawToken);
    if (!mongoose.isValidObjectId(payload.sub)) {
      res.status(401).json({ error: 'Invalid refresh token' });
      return;
    }

    const tokenHash = hashToken(rawToken);
    const user = await User.findById(payload.sub).select('+refreshTokens');
    if (!user || !user.isActive) {
      clearRefreshCookie(req, res);
      res.status(401).json({ error: 'Invalid or suspended session' });
      return;
    }

    const now = new Date();
    const validRecord = user.refreshTokens.find(
      (record) => record.tokenHash === tokenHash && record.expiresAt > now
    );

    if (!validRecord) {
      clearRefreshCookie(req, res);
      res.status(401).json({ error: 'Refresh token revoked or expired' });
      return;
    }

    // Rotate refresh token atomically: pull old hash, push new hash
    const nextRefresh = signRefreshToken(user._id.toString());
    const accessToken = signAccessToken(user._id.toString());

    await User.updateOne(
      { _id: user._id },
      {
        $pull: { refreshTokens: { tokenHash } },
      }
    );
    await User.updateOne(
      { _id: user._id },
      {
        $push: {
          refreshTokens: {
            $each: [{ tokenHash: nextRefresh.tokenHash, expiresAt: nextRefresh.expiresAt, createdAt: now }],
            $slice: -5,
          },
        },
      }
    );

    setRefreshCookie(req, res, nextRefresh.token);
    res.json({
      accessToken,
      user: serializeUser(user),
    });
  } catch {
    clearRefreshCookie(req, res);
    res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
});

router.post('/logout', csrfOriginGuard, async (req, res) => {
  const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
  if (typeof rawToken === 'string' && rawToken) {
    try {
      const payload = verifyRefreshToken(rawToken);
      if (mongoose.isValidObjectId(payload.sub)) {
        await User.updateOne(
          { _id: payload.sub },
          { $pull: { refreshTokens: { tokenHash: hashToken(rawToken) } } }
        );
      }
    } catch {
      // Ignore malformed token on logout; still clear cookie
    }
  }
  clearRefreshCookie(req, res);
  res.json({ ok: true });
});

router.get('/me', authenticate, (req: AuthenticatedRequest, res) => {
  res.json({ user: serializeUser(req.user!) });
});

router.patch('/me', authenticate, async (req: AuthenticatedRequest, res) => {
  const parsed = UpdateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid profile update payload', details: parsed.error.flatten().fieldErrors });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.city !== undefined) updates.city = parsed.data.city;
  if (parsed.data.bio !== undefined) updates.bio = parsed.data.bio;
  if (parsed.data.skills !== undefined) updates.skills = parsed.data.skills;
  if (parsed.data.interests !== undefined) updates.interests = parsed.data.interests;

  const updated = await User.findByIdAndUpdate(req.user!._id, { $set: updates }, { returnDocument: 'after' });
  if (!updated) {
    res.status(404).json({ error: 'Account not found' });
    return;
  }
  res.json({ user: serializeUser(updated) });
});

router.get('/admin-bootstrap/status', requireDb, async (_req, res) => {
  const config = await getSystemConfig();
  const superAdminExists = Boolean(await User.exists({ role: 'SUPER_ADMIN' }));
  const requiresPasscode = Boolean(getEnv().adminBootstrapPasscode);

  res.json({
    claimed: config.adminClaimed || superAdminExists,
    requiresPasscode,
  });
});

router.post('/admin-bootstrap/claim', authenticate, async (req: AuthenticatedRequest, res) => {
  const parsed = AdminClaimSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid claim request' });
    return;
  }

  const configuredPasscode = getEnv().adminBootstrapPasscode;
  if (configuredPasscode && parsed.data.passcode !== configuredPasscode) {
    res.status(403).json({ error: 'Invalid admin bootstrap passcode' });
    return;
  }

  const superAdminExists = Boolean(await User.exists({ role: 'SUPER_ADMIN' }));
  if (superAdminExists) {
    res.status(409).json({ error: 'Super Admin role has already been claimed' });
    return;
  }

  await getSystemConfig();
  const claimedConfig = await SystemConfig.findOneAndUpdate(
    { key: 'global', adminClaimed: false },
    { $set: { adminClaimed: true, claimedByUserId: req.user!._id } },
    { returnDocument: 'after' }
  );

  if (!claimedConfig) {
    res.status(409).json({ error: 'Super Admin bootstrap is already locked' });
    return;
  }

  const promoted = await User.findByIdAndUpdate(
    req.user!._id,
    { $set: { role: 'SUPER_ADMIN' } },
    { returnDocument: 'after' }
  );

  res.json({ user: serializeUser(promoted!) });
});

export default router;
