import { Router } from 'express';
import { authenticate, isValidObjectIdParam, type AuthenticatedRequest } from '../middleware/auth.ts';
import { Notification } from '../models/Notification.ts';

const router = Router();

router.use(authenticate);

router.get('/', async (req: AuthenticatedRequest, res) => {
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 25));
  const [notifications, unreadCount] = await Promise.all([
    Notification.find({ userId: req.user!._id }).sort({ createdAt: -1 }).limit(limit),
    Notification.countDocuments({ userId: req.user!._id, isRead: false }),
  ]);

  res.json({ notifications, unreadCount });
});

router.patch('/:id/read', async (req: AuthenticatedRequest, res) => {
  if (!isValidObjectIdParam(req.params.id)) {
    res.status(400).json({ error: 'Invalid notification ID' });
    return;
  }

  const updated = await Notification.findOneAndUpdate(
    { _id: req.params.id, userId: req.user!._id },
    { $set: { isRead: true } },
    { returnDocument: 'after' }
  );

  if (!updated) {
    res.status(404).json({ error: 'Notification not found' });
    return;
  }

  res.json({ notification: updated });
});

router.post('/read-all', async (req: AuthenticatedRequest, res) => {
  await Notification.updateMany({ userId: req.user!._id, isRead: false }, { $set: { isRead: true } });
  res.json({ ok: true });
});

export default router;
