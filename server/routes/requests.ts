import { Router } from 'express';
import { z } from 'zod';
import { authenticate, isValidObjectIdParam, type AuthenticatedRequest } from '../middleware/auth.ts';
import { MatchRequest } from '../models/MatchRequest.ts';

const router = Router();

const ShoppingDetailsSchema = z.object({
  storeName: z.string().trim().min(1).max(100),
  productCategory: z.string().trim().min(1).max(80),
  targetDiscountPct: z.coerce.number().min(0).max(95),
  minOrderAmount: z.coerce.number().min(1).max(100000),
  userSpendAmount: z.coerce.number().min(1).max(100000),
  deliveryZone: z.string().trim().min(1).max(80),
  splitType: z.enum(['equal', 'proportional']).default('proportional'),
});

const TravelDetailsSchema = z.object({
  origin: z.string().trim().min(1).max(80),
  destination: z.string().trim().min(1).max(80),
  departureDate: z.string().trim().min(4).max(40),
  returnDate: z.string().trim().max(40).optional(),
  budgetMax: z.coerce.number().min(1).max(100000),
  transportMode: z.enum(['carpool', 'train', 'flight', 'van']),
  pace: z.enum(['relaxed', 'moderate', 'packed']),
});

const HackathonDetailsSchema = z.object({
  eventName: z.string().trim().min(2).max(120),
  hackathonFormat: z.enum(['online', 'in-person', 'hybrid']),
  neededRoles: z.array(z.string().trim().min(1).max(50)).min(1).max(10),
  offeredRole: z.string().trim().min(1).max(50),
  techStack: z.array(z.string().trim().min(1).max(40)).min(1).max(15),
  experienceLevel: z.enum(['beginner', 'intermediate', 'advanced']),
});

const EventDetailsSchema = z.object({
  eventTitle: z.string().trim().min(2).max(120),
  venue: z.string().trim().min(1).max(120),
  eventDate: z.string().trim().min(4).max(40),
  ticketTier: z.enum(['standard', 'vip', 'group-pass']),
  maxBudget: z.coerce.number().min(0).max(100000),
  vibe: z.enum(['networking', 'casual', 'focused']),
});

const BaseCreateSchema = z.object({
  title: z.string().trim().min(3).max(140),
  description: z.string().trim().min(5).max(1000),
  city: z.string().trim().min(2).max(80),
  maxGroupSize: z.coerce.number().int().min(2).max(20).default(4),
  expiresAt: z.string().datetime().optional(),
});

const CreateRequestSchema = z.discriminatedUnion('category', [
  BaseCreateSchema.extend({ category: z.literal('shopping'), details: ShoppingDetailsSchema }),
  BaseCreateSchema.extend({ category: z.literal('travel'), details: TravelDetailsSchema }),
  BaseCreateSchema.extend({ category: z.literal('hackathon'), details: HackathonDetailsSchema }),
  BaseCreateSchema.extend({ category: z.literal('event'), details: EventDetailsSchema }),
]);

const UpdateRequestSchema = z.object({
  title: z.string().trim().min(3).max(140).optional(),
  description: z.string().trim().min(5).max(1000).optional(),
  status: z.enum(['active', 'cancelled']).optional(),
  maxGroupSize: z.coerce.number().int().min(2).max(20).optional(),
});

router.use(authenticate);

router.post('/', async (req: AuthenticatedRequest, res) => {
  const parsed = CreateRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid match request payload', details: parsed.error.flatten() });
    return;
  }

  const defaultExpiry = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  const expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : defaultExpiry;

  if (expiresAt <= new Date()) {
    res.status(400).json({ error: 'Expiration timestamp must be in the future' });
    return;
  }

  const created = await MatchRequest.create({
    creatorId: req.user!._id,
    category: parsed.data.category,
    title: parsed.data.title,
    description: parsed.data.description,
    city: parsed.data.city,
    maxGroupSize: parsed.data.maxGroupSize,
    expiresAt,
    status: 'active',
    details: parsed.data.details,
  });

  res.status(201).json({ request: created });
});

router.get('/', async (req: AuthenticatedRequest, res) => {
  const mine = req.query.mine === 'true';
  const category = typeof req.query.category === 'string' ? req.query.category : '';
  const includeExpired = req.query.includeExpired === 'true';
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));

  const filter: Record<string, unknown> = {};
  if (mine) {
    filter.creatorId = req.user!._id;
  } else {
    filter.status = 'active';
    filter.expiresAt = { $gt: new Date() };
  }

  if (mine && !includeExpired) {
    // Still return user's requests including their states, optionally filtering
  }

  if (['shopping', 'travel', 'hackathon', 'event'].includes(category)) {
    filter.category = category;
  }

  const [requests, total] = await Promise.all([
    MatchRequest.find(filter)
      .populate('creatorId', 'name city')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    MatchRequest.countDocuments(filter),
  ]);

  res.json({
    requests,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
});

router.get('/:id', async (req: AuthenticatedRequest, res) => {
  if (!isValidObjectIdParam(req.params.id)) {
    res.status(400).json({ error: 'Invalid request ID' });
    return;
  }

  const doc = await MatchRequest.findById(req.params.id).populate('creatorId', 'name city bio skills interests');
  if (!doc) {
    res.status(404).json({ error: 'Match request not found' });
    return;
  }

  res.json({ request: doc });
});

router.patch('/:id', async (req: AuthenticatedRequest, res) => {
  if (!isValidObjectIdParam(req.params.id)) {
    res.status(400).json({ error: 'Invalid request ID' });
    return;
  }

  const parsed = UpdateRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid update payload', details: parsed.error.flatten() });
    return;
  }

  const doc = await MatchRequest.findById(req.params.id);
  if (!doc) {
    res.status(404).json({ error: 'Match request not found' });
    return;
  }

  const isOwner = doc.creatorId.equals(req.user!._id);
  const isAdmin = req.user!.role === 'ADMIN' || req.user!.role === 'SUPER_ADMIN';
  if (!isOwner && !isAdmin) {
    res.status(403).json({ error: 'Not authorized to modify this request' });
    return;
  }

  if (parsed.data.title !== undefined) doc.title = parsed.data.title;
  if (parsed.data.description !== undefined) doc.description = parsed.data.description;
  if (parsed.data.status !== undefined) doc.status = parsed.data.status;
  if (parsed.data.maxGroupSize !== undefined) doc.maxGroupSize = parsed.data.maxGroupSize;

  await doc.save();
  res.json({ request: doc });
});

router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  if (!isValidObjectIdParam(req.params.id)) {
    res.status(400).json({ error: 'Invalid request ID' });
    return;
  }

  const doc = await MatchRequest.findById(req.params.id);
  if (!doc) {
    res.status(404).json({ error: 'Match request not found' });
    return;
  }

  const isOwner = doc.creatorId.equals(req.user!._id);
  const isAdmin = req.user!.role === 'ADMIN' || req.user!.role === 'SUPER_ADMIN';
  if (!isOwner && !isAdmin) {
    res.status(403).json({ error: 'Not authorized to delete this request' });
    return;
  }

  await doc.deleteOne();
  res.json({ ok: true });
});

export default router;
