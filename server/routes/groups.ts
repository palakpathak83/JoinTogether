import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { authenticate, isValidObjectIdParam, type AuthenticatedRequest } from '../middleware/auth.ts';
import { Group } from '../models/Group.ts';
import { Message } from '../models/Message.ts';
import { Notification } from '../models/Notification.ts';
import { emitToGroup, emitToUser } from '../socket/index.ts';

const router = Router();

router.use(authenticate);

const CreateGroupSchema = z.object({
  name: z.string().trim().min(3).max(120),
  category: z.enum(['shopping', 'travel', 'hackathon', 'event']),
  description: z.string().trim().min(5).max(1000),
  city: z.string().trim().min(2).max(80),
  maxCapacity: z.coerce.number().int().min(2).max(50).default(4),
  joinMode: z.enum(['approval', 'instant']).default('approval'),
});

const JoinRequestBodySchema = z.object({
  message: z.string().trim().max(400).optional().default(''),
});

const SendMessageSchema = z.object({
  content: z.string().trim().min(1).max(2000),
});

router.post('/', async (req: AuthenticatedRequest, res) => {
  const parsed = CreateGroupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid group payload', details: parsed.error.flatten() });
    return;
  }

  const group = await Group.create({
    ...parsed.data,
    ownerId: req.user!._id,
    members: [req.user!._id],
    status: 'open',
  });

  res.status(201).json({ group });
});

router.get('/', async (req: AuthenticatedRequest, res) => {
  const mine = req.query.mine === 'true';
  const category = typeof req.query.category === 'string' ? req.query.category : '';
  const city = typeof req.query.city === 'string' ? req.query.city.trim() : '';
  const search = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));

  const filter: Record<string, unknown> = {};
  if (mine) {
    filter.members = req.user!._id;
  } else {
    filter.status = { $in: ['open', 'full'] };
  }

  if (['shopping', 'travel', 'hackathon', 'event'].includes(category)) {
    filter.category = category;
  }
  if (city) {
    const escaped = city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.city = { $regex: escaped, $options: 'i' };
  }
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [{ name: { $regex: escaped, $options: 'i' } }, { description: { $regex: escaped, $options: 'i' } }];
  }

  const [groups, total] = await Promise.all([
    Group.find(filter)
      .select('-joinRequests')
      .populate('ownerId', 'name city')
      .populate('members', 'name city')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Group.countDocuments(filter),
  ]);

  res.json({
    groups,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
});

router.get('/:id', async (req: AuthenticatedRequest, res) => {
  if (!isValidObjectIdParam(req.params.id)) {
    res.status(400).json({ error: 'Invalid group ID' });
    return;
  }

  const group = await Group.findById(req.params.id)
    .populate('ownerId', 'name city bio')
    .populate('members', 'name city skills')
    .populate('joinRequests.userId', 'name city bio skills');

  if (!group) {
    res.status(404).json({ error: 'Group not found' });
    return;
  }

  const isOwner = group.ownerId._id.equals(req.user!._id);
  const isAdmin = req.user!.role === 'ADMIN' || req.user!.role === 'SUPER_ADMIN';
  const obj = group.toObject();

  if (!isOwner && !isAdmin) {
    // Only return the requester's own join request status to non-owners
    obj.joinRequests = obj.joinRequests.filter((jr) => {
      const uid = (jr.userId as unknown as { _id: mongoose.Types.ObjectId })._id ?? jr.userId;
      return uid.toString() === req.user!._id.toString();
    });
  }

  res.json({ group: obj });
});

router.post('/:id/join-requests', async (req: AuthenticatedRequest, res) => {
  if (!isValidObjectIdParam(req.params.id)) {
    res.status(400).json({ error: 'Invalid group ID' });
    return;
  }

  const parsed = JoinRequestBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid join request payload' });
    return;
  }

  const group = await Group.findById(req.params.id);
  if (!group) {
    res.status(404).json({ error: 'Group not found' });
    return;
  }

  if (group.status !== 'open' || group.members.length >= group.maxCapacity) {
    res.status(409).json({ error: 'Group is not accepting new members' });
    return;
  }

  if (group.members.some((m) => m.equals(req.user!._id))) {
    res.status(409).json({ error: 'You are already a member of this group' });
    return;
  }

  const existingPending = group.joinRequests.some(
    (jr) => jr.userId.equals(req.user!._id) && jr.status === 'pending'
  );
  if (existingPending) {
    res.status(409).json({ error: 'You already have a pending join request' });
    return;
  }

  group.joinRequests.push({
    userId: req.user!._id,
    message: parsed.data.message,
    status: 'pending',
    requestedAt: new Date(),
  } as never);

  await group.save();

  const notification = await Notification.create({
    userId: group.ownerId,
    type: 'join_request',
    title: `New join request for ${group.name}`,
    body: `${req.user!.name} asked to join your group.`,
    relatedGroupId: group._id,
  });

  emitToUser(group.ownerId.toString(), 'notification:new', notification);

  const createdRequest = group.joinRequests[group.joinRequests.length - 1];
  res.status(201).json({ joinRequest: createdRequest });
});

// Atomic instant-join endpoint enforcing group maxCapacity under concurrent requests
router.post('/:id/join-instant', async (req: AuthenticatedRequest, res) => {
  if (!isValidObjectIdParam(req.params.id)) {
    res.status(400).json({ error: 'Invalid group ID' });
    return;
  }

  const existing = await Group.findById(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Group not found' });
    return;
  }
  if (existing.joinMode !== 'instant') {
    res.status(400).json({ error: 'This group requires owner approval to join' });
    return;
  }
  if (existing.members.some((m) => m.equals(req.user!._id))) {
    res.status(409).json({ error: 'You are already a member of this group' });
    return;
  }

  const updated = await Group.findOneAndUpdate(
    {
      _id: req.params.id,
      status: 'open',
      joinMode: 'instant',
      members: { $ne: req.user!._id },
      $expr: { $lt: [{ $size: '$members' }, '$maxCapacity'] },
    },
    {
      $addToSet: { members: req.user!._id },
    },
    { returnDocument: 'after' }
  );

  if (!updated) {
    res.status(409).json({ error: 'Group is at full capacity or closed' });
    return;
  }

  if (updated.members.length >= updated.maxCapacity && updated.status === 'open') {
    await Group.updateOne(
      { _id: updated._id, $expr: { $gte: [{ $size: '$members' }, '$maxCapacity'] } },
      { $set: { status: 'full' } }
    );
    updated.status = 'full';
  }

  const notification = await Notification.create({
    userId: updated.ownerId,
    type: 'request_accepted',
    title: `${req.user!.name} joined ${updated.name}`,
    body: `Group capacity is now ${updated.members.length}/${updated.maxCapacity}.`,
    relatedGroupId: updated._id,
  });
  emitToUser(updated.ownerId.toString(), 'notification:new', notification);

  res.json({ group: updated });
});

router.post('/:id/join-requests/:reqId/accept', async (req: AuthenticatedRequest, res) => {
  if (!isValidObjectIdParam(req.params.id) || !isValidObjectIdParam(req.params.reqId)) {
    res.status(400).json({ error: 'Invalid group or request ID' });
    return;
  }

  const groupDoc = await Group.findById(req.params.id);
  if (!groupDoc) {
    res.status(404).json({ error: 'Group not found' });
    return;
  }

  const isOwner = groupDoc.ownerId.equals(req.user!._id);
  const isAdmin = req.user!.role === 'ADMIN' || req.user!.role === 'SUPER_ADMIN';
  if (!isOwner && !isAdmin) {
    res.status(403).json({ error: 'Only the group owner can accept join requests' });
    return;
  }

  const joinReq = groupDoc.joinRequests.find((jr) => jr._id.toString() === req.params.reqId);
  if (!joinReq) {
    res.status(404).json({ error: 'Join request not found' });
    return;
  }
  if (joinReq.status !== 'pending') {
    res.status(409).json({ error: 'Join request has already been processed' });
    return;
  }

  // Atomic capacity-enforced update
  const updated = await Group.findOneAndUpdate(
    {
      _id: req.params.id,
      status: 'open',
      members: { $ne: joinReq.userId },
      joinRequests: {
        $elemMatch: {
          _id: new mongoose.Types.ObjectId(req.params.reqId),
          status: 'pending',
        },
      },
      $expr: { $lt: [{ $size: '$members' }, '$maxCapacity'] },
    },
    {
      $addToSet: { members: joinReq.userId },
      $set: {
        'joinRequests.$.status': 'accepted',
        'joinRequests.$.reviewedAt': new Date(),
        'joinRequests.$.reviewedBy': req.user!._id,
      },
    },
    { returnDocument: 'after' }
  );

  if (!updated) {
    res.status(409).json({ error: 'Group is at full capacity or request was already handled' });
    return;
  }

  if (updated.members.length >= updated.maxCapacity && updated.status === 'open') {
    await Group.updateOne(
      { _id: updated._id, $expr: { $gte: [{ $size: '$members' }, '$maxCapacity'] } },
      { $set: { status: 'full' } }
    );
    updated.status = 'full';
  }

  const notification = await Notification.create({
    userId: joinReq.userId,
    type: 'request_accepted',
    title: `Accepted into ${updated.name}`,
    body: `Your request to join ${updated.name} was approved. Open group chat to coordinate.`,
    relatedGroupId: updated._id,
  });
  emitToUser(joinReq.userId.toString(), 'notification:new', notification);

  res.json({ group: updated });
});

router.post('/:id/join-requests/:reqId/reject', async (req: AuthenticatedRequest, res) => {
  if (!isValidObjectIdParam(req.params.id) || !isValidObjectIdParam(req.params.reqId)) {
    res.status(400).json({ error: 'Invalid group or request ID' });
    return;
  }

  const groupDoc = await Group.findById(req.params.id);
  if (!groupDoc) {
    res.status(404).json({ error: 'Group not found' });
    return;
  }

  const isOwner = groupDoc.ownerId.equals(req.user!._id);
  const isAdmin = req.user!.role === 'ADMIN' || req.user!.role === 'SUPER_ADMIN';
  if (!isOwner && !isAdmin) {
    res.status(403).json({ error: 'Only the group owner can reject join requests' });
    return;
  }

  const joinReq = groupDoc.joinRequests.find((jr) => jr._id.toString() === req.params.reqId);
  if (!joinReq) {
    res.status(404).json({ error: 'Join request not found' });
    return;
  }
  if (joinReq.status !== 'pending') {
    res.status(409).json({ error: 'Join request has already been processed' });
    return;
  }

  joinReq.status = 'rejected';
  joinReq.reviewedAt = new Date();
  joinReq.reviewedBy = req.user!._id;
  await groupDoc.save();

  const notification = await Notification.create({
    userId: joinReq.userId,
    type: 'request_rejected',
    title: `Update on ${groupDoc.name}`,
    body: `Your request to join ${groupDoc.name} was declined.`,
    relatedGroupId: groupDoc._id,
  });
  emitToUser(joinReq.userId.toString(), 'notification:new', notification);

  res.json({ group: groupDoc });
});

router.post('/:id/leave', async (req: AuthenticatedRequest, res) => {
  if (!isValidObjectIdParam(req.params.id)) {
    res.status(400).json({ error: 'Invalid group ID' });
    return;
  }

  const group = await Group.findById(req.params.id);
  if (!group) {
    res.status(404).json({ error: 'Group not found' });
    return;
  }

  if (group.ownerId.equals(req.user!._id)) {
    res.status(400).json({ error: 'Group owner cannot leave; cancel/close the group instead' });
    return;
  }

  if (!group.members.some((m) => m.equals(req.user!._id))) {
    res.status(400).json({ error: 'You are not a member of this group' });
    return;
  }

  const updated = await Group.findOneAndUpdate(
    { _id: group._id },
    { $pull: { members: req.user!._id } },
    { returnDocument: 'after' }
  );

  if (updated && updated.status === 'full' && updated.members.length < updated.maxCapacity) {
    updated.status = 'open';
    await updated.save();
  }

  const notification = await Notification.create({
    userId: group.ownerId,
    type: 'member_left',
    title: `Member left ${group.name}`,
    body: `${req.user!.name} left the group.`,
    relatedGroupId: group._id,
  });
  emitToUser(group.ownerId.toString(), 'notification:new', notification);

  res.json({ group: updated });
});

router.post('/:id/cancel', async (req: AuthenticatedRequest, res) => {
  if (!isValidObjectIdParam(req.params.id)) {
    res.status(400).json({ error: 'Invalid group ID' });
    return;
  }

  const group = await Group.findById(req.params.id);
  if (!group) {
    res.status(404).json({ error: 'Group not found' });
    return;
  }

  const isOwner = group.ownerId.equals(req.user!._id);
  const isAdmin = req.user!.role === 'ADMIN' || req.user!.role === 'SUPER_ADMIN';
  if (!isOwner && !isAdmin) {
    res.status(403).json({ error: 'Only the group owner or admin can close this group' });
    return;
  }

  group.status = 'closed';
  await group.save();

  for (const memberId of group.members) {
    if (!memberId.equals(req.user!._id)) {
      const notification = await Notification.create({
        userId: memberId,
        type: 'group_closed',
        title: `${group.name} was closed`,
        body: `The group owner closed ${group.name}.`,
        relatedGroupId: group._id,
      });
      emitToUser(memberId.toString(), 'notification:new', notification);
    }
  }

  res.json({ group });
});

router.get('/:id/messages', async (req: AuthenticatedRequest, res) => {
  if (!isValidObjectIdParam(req.params.id)) {
    res.status(400).json({ error: 'Invalid group ID' });
    return;
  }

  const group = await Group.findById(req.params.id).select('members');
  if (!group) {
    res.status(404).json({ error: 'Group not found' });
    return;
  }

  const isMember = group.members.some((m) => m.equals(req.user!._id));
  if (!isMember) {
    res.status(403).json({ error: 'Forbidden: group membership required to view messages' });
    return;
  }

  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const messages = await Message.find({ groupId: group._id })
    .sort({ createdAt: 1 })
    .limit(limit);

  res.json({ messages });
});

router.post('/:id/messages', async (req: AuthenticatedRequest, res) => {
  if (!isValidObjectIdParam(req.params.id)) {
    res.status(400).json({ error: 'Invalid group ID' });
    return;
  }

  const parsed = SendMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Message content cannot be empty' });
    return;
  }

  const group = await Group.findById(req.params.id).select('name members status');
  if (!group) {
    res.status(404).json({ error: 'Group not found' });
    return;
  }

  const isMember = group.members.some((m) => m.equals(req.user!._id));
  if (!isMember) {
    res.status(403).json({ error: 'Forbidden: group membership required to send messages' });
    return;
  }

  if (group.status === 'closed') {
    res.status(400).json({ error: 'Cannot send messages to a closed group' });
    return;
  }

  const message = await Message.create({
    groupId: group._id,
    senderId: req.user!._id,
    senderName: req.user!.name,
    content: parsed.data.content,
    readBy: [{ userId: req.user!._id, readAt: new Date() }],
  });

  emitToGroup(group._id.toString(), 'message:new', message);

  // Persist unread notifications for other group members
  const otherMembers = group.members.filter((m) => !m.equals(req.user!._id));
  for (const memberId of otherMembers) {
    const notification = await Notification.create({
      userId: memberId,
      type: 'group_message',
      title: `${req.user!.name} in ${group.name}`,
      body: parsed.data.content.slice(0, 140),
      relatedGroupId: group._id,
    });
    emitToUser(memberId.toString(), 'notification:new', notification);
  }

  res.status(201).json({ message });
});

router.post('/:id/messages/read', async (req: AuthenticatedRequest, res) => {
  if (!isValidObjectIdParam(req.params.id)) {
    res.status(400).json({ error: 'Invalid group ID' });
    return;
  }

  const group = await Group.findById(req.params.id).select('members');
  if (!group) {
    res.status(404).json({ error: 'Group not found' });
    return;
  }

  const isMember = group.members.some((m) => m.equals(req.user!._id));
  if (!isMember) {
    res.status(403).json({ error: 'Forbidden: group membership required' });
    return;
  }

  const readAt = new Date();
  await Message.updateMany(
    {
      groupId: group._id,
      'readBy.userId': { $ne: req.user!._id },
    },
    {
      $push: { readBy: { userId: req.user!._id, readAt } },
    }
  );

  emitToGroup(group._id.toString(), 'messages:read', {
    groupId: group._id.toString(),
    userId: req.user!._id.toString(),
    userName: req.user!.name,
    readAt: readAt.toISOString(),
  });

  res.json({ ok: true, readAt });
});

export default router;
