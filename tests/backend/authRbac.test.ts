import request from 'supertest';
import { createExpressApp } from '../../server/app.ts';
import { User } from '../../server/models/User.ts';
import { clearTestMongo, startTestMongo, stopTestMongo } from '../helpers/mongoTestEnv.ts';

const app = createExpressApp();

describe('Authentication, JWT Rotation, RBAC & Ownership', () => {
  beforeAll(async () => {
    await startTestMongo();
  });

  afterEach(async () => {
    await clearTestMongo();
  });

  afterAll(async () => {
    await stopTestMongo();
  });

  it('registers a user securely with bcrypt hash and ignores client-supplied role escalation', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Alice Builder',
      email: 'alice@example.com',
      password: 'Password123!',
      role: 'SUPER_ADMIN',
      city: 'Seattle',
    });

    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.user.role).toBe('USER');
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.headers['set-cookie']).toBeDefined();

    const dbUser = await User.findOne({ email: 'alice@example.com' }).select('+passwordHash');
    expect(dbUser).not.toBeNull();
    expect(dbUser!.role).toBe('USER');
    expect(dbUser!.passwordHash).not.toBe('Password123!');
  });

  it('logs in, rotates HttpOnly refresh cookie, and revokes token on logout', async () => {
    const agent = request.agent(app);

    await agent.post('/api/auth/register').send({
      name: 'Bob Runner',
      email: 'bob@example.com',
      password: 'Password123!',
    });

    const loginRes = await agent.post('/api/auth/login').send({
      email: 'bob@example.com',
      password: 'Password123!',
    });
    expect(loginRes.status).toBe(200);
    const firstAccess = loginRes.body.accessToken;

    const refreshRes = await agent.post('/api/auth/refresh');
    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.accessToken).toBeTruthy();
    expect(refreshRes.body.user.email).toBe('bob@example.com');

    const meRes = await agent
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${firstAccess}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe('bob@example.com');

    const logoutRes = await agent.post('/api/auth/logout');
    expect(logoutRes.status).toBe(200);

    const postLogoutRefresh = await agent.post('/api/auth/refresh');
    expect(postLogoutRefresh.status).toBe(401);
  });

  it('rejects unauthenticated access and enforces USER, ADMIN, SUPER_ADMIN RBAC strictly from DB', async () => {
    const unauth = await request(app).get('/api/auth/me');
    expect(unauth.status).toBe(401);

    const u1 = await request(app).post('/api/auth/register').send({
      name: 'Standard User',
      email: 'user@example.com',
      password: 'Password123!',
    });
    const u2 = await request(app).post('/api/auth/register').send({
      name: 'Admin Candidate',
      email: 'admin@example.com',
      password: 'Password123!',
    });

    // Standard user blocked from admin routes
    const userAdminTry = await request(app)
      .get('/api/admin/overview')
      .set('Authorization', `Bearer ${u1.body.accessToken}`);
    expect(userAdminTry.status).toBe(403);

    // Promote u2 to ADMIN in DB directly to verify ADMIN vs SUPER_ADMIN permissions
    await User.updateOne({ _id: u2.body.user._id }, { $set: { role: 'ADMIN' } });

    const adminOverview = await request(app)
      .get('/api/admin/overview')
      .set('Authorization', `Bearer ${u2.body.accessToken}`);
    expect(adminOverview.status).toBe(200);

    // ADMIN cannot promote users to ADMIN or SUPER_ADMIN
    const adminPromoteTry = await request(app)
      .patch(`/api/admin/users/${u1.body.user._id}/role`)
      .set('Authorization', `Bearer ${u2.body.accessToken}`)
      .send({ role: 'ADMIN' });
    expect(adminPromoteTry.status).toBe(403);

    // First-run SUPER_ADMIN claim succeeds once and locks afterwards
    const claimRes = await request(app)
      .post('/api/auth/admin-bootstrap/claim')
      .set('Authorization', `Bearer ${u2.body.accessToken}`)
      .send({});
    expect(claimRes.status).toBe(200);
    expect(claimRes.body.user.role).toBe('SUPER_ADMIN');

    const secondClaim = await request(app)
      .post('/api/auth/admin-bootstrap/claim')
      .set('Authorization', `Bearer ${u1.body.accessToken}`)
      .send({});
    expect(secondClaim.status).toBe(409);

    // SUPER_ADMIN can now promote u1 to ADMIN
    const superPromote = await request(app)
      .patch(`/api/admin/users/${u1.body.user._id}/role`)
      .set('Authorization', `Bearer ${u2.body.accessToken}`)
      .send({ role: 'ADMIN' });
    expect(superPromote.status).toBe(200);
    expect(superPromote.body.user.role).toBe('ADMIN');
  });

  it('enforces resource ownership on MatchRequest mutations', async () => {
    const owner = await request(app).post('/api/auth/register').send({
      name: 'Owner',
      email: 'owner@example.com',
      password: 'Password123!',
    });
    const intruder = await request(app).post('/api/auth/register').send({
      name: 'Intruder',
      email: 'intruder@example.com',
      password: 'Password123!',
    });

    const created = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${owner.body.accessToken}`)
      .send({
        category: 'event',
        title: 'Design Conf Pass Split',
        description: 'Splitting 4-pack conference pass in SF',
        city: 'San Francisco',
        maxGroupSize: 4,
        details: {
          eventTitle: 'Design Systems Conf',
          venue: 'Moscone',
          eventDate: '2026-12-12',
          ticketTier: 'group-pass',
          maxBudget: 150,
          vibe: 'networking',
        },
      });

    expect(created.status).toBe(201);

    const hijack = await request(app)
      .patch(`/api/requests/${created.body.request._id}`)
      .set('Authorization', `Bearer ${intruder.body.accessToken}`)
      .send({ status: 'cancelled' });

    expect(hijack.status).toBe(403);
  });
});
