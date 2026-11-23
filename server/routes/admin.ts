import { Router } from 'express';
import { z } from 'zod';
import { authenticate, isValidObjectIdParam, requireRole, type AuthenticatedRequest } from '../middleware/auth.ts';
import { Group } from '../models/Group.ts';
import { MatchRequest } from '../models/MatchRequest.ts';
import { Message } from '../models/Message.ts';
import { getSystemConfig, SystemConfig } from '../models/SystemConfig.ts';
import { User } from '../models/User.ts';
import { serializeUser } from './auth.ts';

const router = Router();

router.use(authenticate, requireRole('ADMIN', 'SUPER_ADMIN'));

const UpdateRoleSchema = z.object({
  role: z.enum(['USER', 'ADMIN', 'SUPER_ADMIN']),
});

const UpdateStatusSchema = z.object({
  isActive: z.boolean(),
});

const MatchWeightsSchema = z.object({
  shopping: z.object({
    storeWeight: z.number().min(0).max(100),
    zoneWeight: z.number().min(0).max(100),
    thresholdWeight: z.number().min(0).max(100),
    discountSplitWeight: z.number().min(0).max(100),
  }),
  travel: z.object({
    destinationWeight: z.number().min(0).max(100),
    originWeight: z.number().min(0).max(100),
    dateWeight: z.number().min(0).max(100),
    modePaceWeight: z.number().min(0).max(100),
  }),
  hackathon: z.object({
    eventWeight: z.number().min(0).max(100),
    roleFitWeight: z.number().min(0).max(100),
    stackWeight: z.number().min(0).max(100),
    formatLevelWeight: z.number().min(0).max(100),
  }),
  event: z.object({
    titleWeight: z.number().min(0).max(100),
    venueDateWeight: z.number().min(0).max(100),
    budgetTierWeight: z.number().min(0).max(100),
    vibeWeight: z.number().min(0).max(100),
  }),
});

router.get('/overview', async (_req, res) => {
  const now = new Date();
  const [totalUsers, activeUsers, activeRequests, openGroups, fullGroups, totalMessages, categoryBreakdown] =
    await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      MatchRequest.countDocuments({ status: 'active', expiresAt: { $gt: now } }),
      Group.countDocuments({ status: 'open' }),
      Group.countDocuments({ status: 'full' }),
      Message.countDocuments(),
      MatchRequest.aggregate([
        { $match: { status: 'active', expiresAt: { $gt: now } } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
      ]),
    ]);

  res.json({
    stats: {
      totalUsers,
      activeUsers,
      activeRequests,
      openGroups,
      fullGroups,
      totalMessages,
      categoryBreakdown: Object.fromEntries(categoryBreakdown.map((row) => [row._id, row.count])),
    },
  });
});

router.get('/users', async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const search = typeof req.query.q === 'string' ? req.query.q.trim() : '';

  const filter: Record<string, unknown> = {};
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [{ name: { $regex: escaped, $options: 'i' } }, { email: { $regex: escaped, $options: 'i' } }];
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(filter),
  ]);

  res.json({
    users: users.map(serializeUser),
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
});

router.patch('/users/:id/role', requireRole('SUPER_ADMIN'), async (req: AuthenticatedRequest, res) => {
  if (!isValidObjectIdParam(req.params.id)) {
    res.status(400).json({ error: 'Invalid user ID' });
    return;
  }

  const parsed = UpdateRoleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid role value' });
    return;
  }

  const targetUser = await User.findById(req.params.id);
  if (!targetUser) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  if (targetUser._id.equals(req.user!._id) && parsed.data.role !== 'SUPER_ADMIN') {
    const superAdminCount = await User.countDocuments({ role: 'SUPER_ADMIN' });
    if (superAdminCount <= 1) {
      res.status(400).json({ error: 'Cannot demote the last Super Admin' });
      return;
    }
  }

  targetUser.role = parsed.data.role;
  await targetUser.save();
  res.json({ user: serializeUser(targetUser) });
});

router.patch('/users/:id/status', async (req: AuthenticatedRequest, res) => {
  if (!isValidObjectIdParam(req.params.id)) {
    res.status(400).json({ error: 'Invalid user ID' });
    return;
  }

  const parsed = UpdateStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid status payload' });
    return;
  }

  const targetUser = await User.findById(req.params.id);
  if (!targetUser) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  if (targetUser.role === 'SUPER_ADMIN' && req.user!.role !== 'SUPER_ADMIN') {
    res.status(403).json({ error: 'Only a Super Admin can modify another Super Admin' });
    return;
  }

  if (targetUser._id.equals(req.user!._id) && !parsed.data.isActive) {
    res.status(400).json({ error: 'Cannot suspend your own active account' });
    return;
  }

  targetUser.isActive = parsed.data.isActive;
  await targetUser.save();
  res.json({ user: serializeUser(targetUser) });
});

router.get('/matching-config', async (_req, res) => {
  const config = await getSystemConfig();
  res.json({ matchWeights: config.matchWeights });
});

router.put('/matching-config', async (req, res) => {
  const parsed = MatchWeightsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid matching weights configuration', details: parsed.error.flatten() });
    return;
  }

  const updated = await SystemConfig.findOneAndUpdate(
    { key: 'global' },
    { $set: { matchWeights: parsed.data } },
    { returnDocument: 'after', upsert: true }
  );

  res.json({ matchWeights: updated.matchWeights });
});

export default router;
