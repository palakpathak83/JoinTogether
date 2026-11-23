import http from 'node:http';
import { io as ioClient, type Socket } from 'socket.io-client';
import request from 'supertest';
import { createExpressApp } from '../../server/app.ts';
import { Group } from '../../server/models/Group.ts';
import { Message } from '../../server/models/Message.ts';
import { Notification } from '../../server/models/Notification.ts';
import { initSocketServer } from '../../server/socket/index.ts';
import { clearTestMongo, startTestMongo, stopTestMongo } from '../helpers/mongoTestEnv.ts';

const app = createExpressApp();
let httpServer: http.Server;
let serverUrl: string;

async function registerUser(name: string, email: string) {
  const res = await request(app).post('/api/auth/register').send({
    name,
    email,
    password: 'Password123!',
    city: 'Seattle',
  });
  return { token: res.body.accessToken as string, user: res.body.user };
}

describe('Groups Atomic Capacity & Authenticated Socket.IO Realtime', () => {
  beforeAll(async () => {
    await startTestMongo();
    httpServer = http.createServer(app);
    initSocketServer(httpServer);
    await new Promise<void>((resolve) => {
      httpServer.listen(0, '127.0.0.1', () => {
        const addr = httpServer.address();
        if (addr && typeof addr === 'object') {
          serverUrl = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });
  });

  afterEach(async () => {
    await clearTestMongo();
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    await stopTestMongo();
  });

  it('enforces group capacity atomically under concurrent instant joins', async () => {
    const owner = await registerUser('Owner', 'owner@test.com');
    const joiners = await Promise.all([
      registerUser('J1', 'j1@test.com'),
      registerUser('J2', 'j2@test.com'),
      registerUser('J3', 'j3@test.com'),
      registerUser('J4', 'j4@test.com'),
      registerUser('J5', 'j5@test.com'),
    ]);

    const grpRes = await request(app)
      .post('/api/groups')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        name: 'Atomic Capacity Squad',
        category: 'travel',
        description: 'Strictly 3 seats total (owner + 2)',
        city: 'Seattle',
        maxCapacity: 3,
        joinMode: 'instant',
      });
    expect(grpRes.status).toBe(201);
    const groupId = grpRes.body.group._id;

    // 5 users attempt to join simultaneously for 2 available seats
    const results = await Promise.all(
      joiners.map((j) =>
        request(app)
          .post(`/api/groups/${groupId}/join-instant`)
          .set('Authorization', `Bearer ${j.token}`)
      )
    );

    const successes = results.filter((r) => r.status === 200);
    const conflicts = results.filter((r) => r.status === 409);

    expect(successes).toHaveLength(2);
    expect(conflicts).toHaveLength(3);

    const dbGroup = await Group.findById(groupId);
    expect(dbGroup!.members).toHaveLength(3);
    expect(dbGroup!.status).toBe('full');
  });

  it('handles join request approval, atomic cap on accept, leave reopen, and persistent notifications', async () => {
    const owner = await registerUser('Owner', 'own2@test.com');
    const u1 = await registerUser('Applicant 1', 'app1@test.com');
    const u2 = await registerUser('Applicant 2', 'app2@test.com');

    const grpRes = await request(app)
      .post('/api/groups')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        name: 'Approval Pair',
        category: 'shopping',
        description: 'Max 2 members',
        city: 'Seattle',
        maxCapacity: 2,
        joinMode: 'approval',
      });
    const groupId = grpRes.body.group._id;

    const jr1 = await request(app)
      .post(`/api/groups/${groupId}/join-requests`)
      .set('Authorization', `Bearer ${u1.token}`)
      .send({ message: 'Count me in' });
    const jr2 = await request(app)
      .post(`/api/groups/${groupId}/join-requests`)
      .set('Authorization', `Bearer ${u2.token}`)
      .send({ message: 'Also interested' });

    expect(jr1.status).toBe(201);
    expect(jr2.status).toBe(201);

    // Concurrent accepts for the last remaining seat -> strictly 1 succeeds, 1 conflicts
    const [acc1, acc2] = await Promise.all([
      request(app)
        .post(`/api/groups/${groupId}/join-requests/${jr1.body.joinRequest._id}/accept`)
        .set('Authorization', `Bearer ${owner.token}`),
      request(app)
        .post(`/api/groups/${groupId}/join-requests/${jr2.body.joinRequest._id}/accept`)
        .set('Authorization', `Bearer ${owner.token}`),
    ]);

    const okCount = [acc1, acc2].filter((r) => r.status === 200).length;
    const conflictCount = [acc1, acc2].filter((r) => r.status === 409).length;
    expect(okCount).toBe(1);
    expect(conflictCount).toBe(1);

    const acceptedUser = acc1.status === 200 ? u1 : u2;
    const notifCount = await Notification.countDocuments({ userId: acceptedUser.user._id, type: 'request_accepted' });
    expect(notifCount).toBe(1);

    // Accepted member leaves -> group reopens from full to open
    const leaveRes = await request(app)
      .post(`/api/groups/${groupId}/leave`)
      .set('Authorization', `Bearer ${acceptedUser.token}`);
    expect(leaveRes.status).toBe(200);
    expect(leaveRes.body.group.status).toBe('open');
    expect(leaveRes.body.group.members).toHaveLength(1);
  });

  it('rejects unauthenticated & non-member Socket.IO access, and delivers persistent messages + read receipts to members', async () => {
    const owner = await registerUser('Chat Owner', 'cown@test.com');
    const member = await registerUser('Chat Member', 'cmem@test.com');
    const outsider = await registerUser('Outsider', 'out@test.com');

    const grpRes = await request(app)
      .post('/api/groups')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        name: 'Private Room',
        category: 'hackathon',
        description: 'Members only chat',
        city: 'Seattle',
        maxCapacity: 4,
        joinMode: 'instant',
      });
    const groupId = grpRes.body.group._id;

    await request(app)
      .post(`/api/groups/${groupId}/join-instant`)
      .set('Authorization', `Bearer ${member.token}`);

    // Outsider HTTP messages access must fail 403
    const outsiderHttp = await request(app)
      .get(`/api/groups/${groupId}/messages`)
      .set('Authorization', `Bearer ${outsider.token}`);
    expect(outsiderHttp.status).toBe(403);

    // 1. Unauthenticated Socket.IO connection must fail
    await expect(
      new Promise<void>((resolve, reject) => {
        const badSocket = ioClient(serverUrl, { transports: ['websocket'] });
        badSocket.on('connect', () => {
          badSocket.disconnect();
          reject(new Error('Should not have connected without token'));
        });
        badSocket.on('connect_error', (err) => {
          badSocket.disconnect();
          expect(err.message).toMatch(/Authentication required/i);
          resolve();
        });
      })
    ).resolves.toBeUndefined();

    // 2. Authenticated outsider cannot join or send messages to private group room
    const outsiderSocket: Socket = ioClient(serverUrl, {
      auth: { token: outsider.token },
      transports: ['websocket'],
    });
    await new Promise<void>((resolve) => outsiderSocket.on('connect', () => resolve()));

    const joinDenied = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
      outsiderSocket.emit('group:join', groupId, (res: { ok: boolean; error?: string }) => resolve(res));
    });
    expect(joinDenied.ok).toBe(false);
    expect(joinDenied.error).toMatch(/Forbidden/i);

    const sendDenied = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
      outsiderSocket.emit('message:send', { groupId, content: 'Sneak in' }, (res: { ok: boolean; error?: string }) =>
        resolve(res)
      );
    });
    expect(sendDenied.ok).toBe(false);
    outsiderSocket.disconnect();

    // 3. Authenticated members join, exchange persistent message, and update read receipt
    const ownerSocket: Socket = ioClient(serverUrl, {
      auth: { token: owner.token },
      transports: ['websocket'],
    });
    const memberSocket: Socket = ioClient(serverUrl, {
      auth: { token: member.token },
      transports: ['websocket'],
    });

    await Promise.all([
      new Promise<void>((resolve) => ownerSocket.on('connect', () => resolve())),
      new Promise<void>((resolve) => memberSocket.on('connect', () => resolve())),
    ]);

    const [j1, j2] = await Promise.all([
      new Promise<{ ok: boolean }>((resolve) => ownerSocket.emit('group:join', groupId, resolve)),
      new Promise<{ ok: boolean }>((resolve) => memberSocket.emit('group:join', groupId, resolve)),
    ]);
    expect(j1.ok).toBe(true);
    expect(j2.ok).toBe(true);

    const receivedMsgPromise = new Promise<{ content: string; senderName: string }>((resolve) => {
      memberSocket.once('message:new', resolve);
    });

    const sendAck = await new Promise<{ ok: boolean }>((resolve) => {
      ownerSocket.emit('message:send', { groupId, content: 'Hello squad!' }, resolve);
    });
    expect(sendAck.ok).toBe(true);

    const receivedMsg = await receivedMsgPromise;
    expect(receivedMsg.content).toBe('Hello squad!');
    expect(receivedMsg.senderName).toBe('Chat Owner');

    // Member marks read -> owner receives messages:read and MongoDB readBy updates
    const readReceiptPromise = new Promise<{ userId: string }>((resolve) => {
      ownerSocket.once('messages:read', resolve);
    });
    memberSocket.emit('message:read', { groupId });
    const receipt = await readReceiptPromise;
    expect(receipt.userId).toBe(member.user._id);

    const dbMessages = await Message.find({ groupId });
    expect(dbMessages).toHaveLength(1);
    expect(dbMessages[0].readBy.map((r) => r.userId.toString())).toContain(member.user._id);

    ownerSocket.disconnect();
    memberSocket.disconnect();
  });
});
