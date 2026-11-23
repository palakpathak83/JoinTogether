import { Router } from 'express';
import { z } from 'zod';
import { authenticate, isValidObjectIdParam, type AuthenticatedRequest } from '../middleware/auth.ts';
import { Group } from '../models/Group.ts';
import { MatchRequest } from '../models/MatchRequest.ts';
import { Notification } from '../models/Notification.ts';
import { findMatchesForRequest } from '../services/matching/index.ts';
import { emitToUser } from '../socket/index.ts';

const router = Router();

router.use(authenticate);

const ConnectSchema = z.object({
  sourceRequestId: z.string().trim(),
  targetRequestId: z.string().trim(),
  groupName: z.string().trim().min(3).max(120).optional(),
  message: z.string().trim().max(400).optional().default('Interested in teaming up based on our match!'),
});

router.get('/for-request/:requestId', async (req: AuthenticatedRequest, res) => {
  if (!isValidObjectIdParam(req.params.requestId)) {
    res.status(400).json({ error: 'Invalid request ID' });
    return;
  }

  const source = await MatchRequest.findById(req.params.requestId);
  if (!source) {
    res.status(404).json({ error: 'Match request not found' });
    return;
  }

  const isOwner = source.creatorId.equals(req.user!._id);
  const isAdmin = req.user!.role === 'ADMIN' || req.user!.role === 'SUPER_ADMIN';
  if (!isOwner && !isAdmin) {
    res.status(403).json({ error: 'Not authorized to view matches for this request' });
    return;
  }

  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const minScore = Number(req.query.minScore) || 0;

  const result = await findMatchesForRequest({
    requestId: req.params.requestId,
    requesterUserId: source.creatorId.toString(),
    page,
    limit,
    minScore,
  });

  res.json(result);
});

router.post('/connect', async (req: AuthenticatedRequest, res) => {
  const parsed = ConnectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid connect payload', details: parsed.error.flatten() });
    return;
  }

  const { sourceRequestId, targetRequestId, groupName, message } = parsed.data;
  if (!isValidObjectIdParam(sourceRequestId) || !isValidObjectIdParam(targetRequestId)) {
    res.status(400).json({ error: 'Invalid request IDs' });
    return;
  }

  const [source, target] = await Promise.all([
    MatchRequest.findById(sourceRequestId),
    MatchRequest.findById(targetRequestId),
  ]);

  if (!source || !target) {
    res.status(404).json({ error: 'Source or target request not found' });
    return;
  }

  if (!source.creatorId.equals(req.user!._id)) {
    res.status(403).json({ error: 'Only the source request creator can initiate a match connection' });
    return;
  }

  if (target.creatorId.equals(req.user!._id)) {
    res.status(400).json({ error: 'Cannot match with your own request' });
    return;
  }

  const now = new Date();
  if (source.status !== 'active' || target.status !== 'active' || source.expiresAt <= now || target.expiresAt <= now) {
    res.status(400).json({ error: 'Both requests must be active and not expired' });
    return;
  }

  // If target already has an open group, submit a join request to that group
  if (target.matchedGroupId) {
    const existingGroup = await Group.findById(target.matchedGroupId);
    if (existingGroup && existingGroup.status === 'open') {
      const alreadyMember = existingGroup.members.some((m) => m.equals(req.user!._id));
      if (alreadyMember) {
        res.status(409).json({ error: 'You are already a member of this group' });
        return;
      }

      const alreadyPending = existingGroup.joinRequests.some(
        (jr) => jr.userId.equals(req.user!._id) && jr.status === 'pending'
      );
      if (alreadyPending) {
        res.status(409).json({ error: 'Join request already pending for this group' });
        return;
      }

      existingGroup.joinRequests.push({
        userId: req.user!._id,
        message,
        status: 'pending',
        requestedAt: now,
      } as never);
      await existingGroup.save();

      const notification = await Notification.create({
        userId: existingGroup.ownerId,
        type: 'join_request',
        title: `New match join request for ${existingGroup.name}`,
        body: `${req.user!.name} requested to join based on your ${existingGroup.category} match.`,
        relatedGroupId: existingGroup._id,
        relatedRequestId: target._id,
      });

      emitToUser(existingGroup.ownerId.toString(), 'notification:new', notification);

      res.status(201).json({ action: 'join_requested', group: existingGroup });
      return;
    }
  }

  // Otherwise create a new group owned by the current user and notify the matched peer
  const maxCapacity = Math.min(20, Math.max(2, Math.min(source.maxGroupSize, target.maxGroupSize)));
  const group = await Group.create({
    name: groupName || `${source.title} Squad`,
    category: source.category,
    description: source.description,
    city: source.city,
    ownerId: req.user!._id,
    members: [req.user!._id],
    maxCapacity,
    joinMode: 'approval',
    status: 'open',
    linkedRequestIds: [source._id, target._id],
  });

  await MatchRequest.updateOne({ _id: source._id }, { $set: { matchedGroupId: group._id } });

  const notification = await Notification.create({
    userId: target.creatorId,
    type: 'match_found',
    title: `Match invite: ${group.name}`,
    body: `${req.user!.name} created a ${source.category} group from your active request.`,
    relatedGroupId: group._id,
    relatedRequestId: target._id,
  });

  emitToUser(target.creatorId.toString(), 'notification:new', notification);

  res.status(201).json({ action: 'group_created', group });
});

export default router;
