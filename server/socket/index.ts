import type { Server as HttpServer } from 'node:http';
import mongoose from 'mongoose';
import { Server as SocketIOServer, type Socket } from 'socket.io';
import { isDatabaseConnected } from '../config/db.ts';
import { Group } from '../models/Group.ts';
import { Message } from '../models/Message.ts';
import { Notification } from '../models/Notification.ts';
import { User } from '../models/User.ts';
import { corsOptionsDelegate } from '../utils/cors.ts';
import { verifyAccessToken } from '../utils/tokens.ts';

interface SocketUser {
  _id: string;
  name: string;
  role: string;
}

let ioInstance: SocketIOServer | null = null;

export function getSocketIO(): SocketIOServer | null {
  return ioInstance;
}

export function emitToGroup(groupId: string, event: string, payload: unknown): void {
  if (ioInstance) {
    ioInstance.to(`group:${groupId}`).emit(event, payload);
  }
}

export function emitToUser(userId: string, event: string, payload: unknown): void {
  if (ioInstance) {
    ioInstance.to(`user:${userId}`).emit(event, payload);
  }
}

export function initSocketServer(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: corsOptionsDelegate,
  });

  // Authenticate every socket handshake against JWT + MongoDB active user
  io.use(async (socket, next) => {
    try {
      if (!isDatabaseConnected()) {
        return next(new Error('Database unavailable'));
      }

      const authToken =
        typeof socket.handshake.auth?.token === 'string'
          ? socket.handshake.auth.token
          : typeof socket.handshake.headers.authorization === 'string' &&
              socket.handshake.headers.authorization.startsWith('Bearer ')
            ? socket.handshake.headers.authorization.slice('Bearer '.length)
            : '';

      if (!authToken) {
        return next(new Error('Authentication required'));
      }

      const payload = verifyAccessToken(authToken.trim());
      if (!mongoose.isValidObjectId(payload.sub)) {
        return next(new Error('Invalid authentication token'));
      }

      const user = await User.findById(payload.sub).select('name role isActive');
      if (!user || !user.isActive) {
        return next(new Error('Account unauthorized or suspended'));
      }

      socket.data.user = {
        _id: user._id.toString(),
        name: user.name,
        role: user.role,
      } satisfies SocketUser;

      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user as SocketUser;
    socket.join(`user:${user._id}`);

    socket.on('group:join', async (groupId: unknown, ack?: (res: { ok: boolean; error?: string }) => void) => {
      if (typeof groupId !== 'string' || !mongoose.isValidObjectId(groupId)) {
        ack?.({ ok: false, error: 'Invalid group ID' });
        return;
      }

      const isMember = await Group.exists({
        _id: new mongoose.Types.ObjectId(groupId),
        members: new mongoose.Types.ObjectId(user._id),
      });

      if (!isMember) {
        socket.emit('error:unauthorized', { groupId, error: 'Forbidden: not a member of this group' });
        ack?.({ ok: false, error: 'Forbidden: not a member of this group' });
        return;
      }

      await socket.join(`group:${groupId}`);
      ack?.({ ok: true });
    });

    socket.on('group:leave', async (groupId: unknown) => {
      if (typeof groupId === 'string') {
        await socket.leave(`group:${groupId}`);
      }
    });

    socket.on(
      'message:send',
      async (
        payload: { groupId?: unknown; content?: unknown },
        ack?: (res: { ok: boolean; error?: string; message?: unknown }) => void
      ) => {
        const groupId = typeof payload?.groupId === 'string' ? payload.groupId : '';
        const content = typeof payload?.content === 'string' ? payload.content.trim() : '';

        if (!mongoose.isValidObjectId(groupId) || !content || content.length > 2000) {
          ack?.({ ok: false, error: 'Invalid message payload' });
          return;
        }

        const group = await Group.findOne({
          _id: new mongoose.Types.ObjectId(groupId),
          members: new mongoose.Types.ObjectId(user._id),
        }).select('name members status');

        if (!group) {
          socket.emit('error:unauthorized', { groupId, error: 'Forbidden: not a member of this group' });
          ack?.({ ok: false, error: 'Forbidden: not a member of this group' });
          return;
        }

        if (group.status === 'closed') {
          ack?.({ ok: false, error: 'Group is closed' });
          return;
        }

        const message = await Message.create({
          groupId: group._id,
          senderId: new mongoose.Types.ObjectId(user._id),
          senderName: user.name,
          content,
          readBy: [{ userId: new mongoose.Types.ObjectId(user._id), readAt: new Date() }],
        });

        io.to(`group:${groupId}`).emit('message:new', message);

        for (const memberId of group.members) {
          if (memberId.toString() !== user._id) {
            const notification = await Notification.create({
              userId: memberId,
              type: 'group_message',
              title: `${user.name} in ${group.name}`,
              body: content.slice(0, 140),
              relatedGroupId: group._id,
            });
            io.to(`user:${memberId.toString()}`).emit('notification:new', notification);
          }
        }

        ack?.({ ok: true, message });
      }
    );

    socket.on(
      'message:read',
      async (
        payload: { groupId?: unknown },
        ack?: (res: { ok: boolean; error?: string }) => void
      ) => {
        const groupId = typeof payload?.groupId === 'string' ? payload.groupId : '';
        if (!mongoose.isValidObjectId(groupId)) {
          ack?.({ ok: false, error: 'Invalid group ID' });
          return;
        }

        const isMember = await Group.exists({
          _id: new mongoose.Types.ObjectId(groupId),
          members: new mongoose.Types.ObjectId(user._id),
        });

        if (!isMember) {
          ack?.({ ok: false, error: 'Forbidden: not a member of this group' });
          return;
        }

        const readAt = new Date();
        await Message.updateMany(
          {
            groupId: new mongoose.Types.ObjectId(groupId),
            'readBy.userId': { $ne: new mongoose.Types.ObjectId(user._id) },
          },
          {
            $push: { readBy: { userId: new mongoose.Types.ObjectId(user._id), readAt } },
          }
        );

        io.to(`group:${groupId}`).emit('messages:read', {
          groupId,
          userId: user._id,
          userName: user.name,
          readAt: readAt.toISOString(),
        });

        ack?.({ ok: true });
      }
    );

    socket.on('typing:start', (groupId: unknown) => {
      if (typeof groupId === 'string' && socket.rooms.has(`group:${groupId}`)) {
        socket.to(`group:${groupId}`).emit('typing:update', { groupId, userId: user._id, userName: user.name, isTyping: true });
      }
    });

    socket.on('typing:stop', (groupId: unknown) => {
      if (typeof groupId === 'string' && socket.rooms.has(`group:${groupId}`)) {
        socket.to(`group:${groupId}`).emit('typing:update', { groupId, userId: user._id, userName: user.name, isTyping: false });
      }
    });
  });

  ioInstance = io;
  return io;
}
