import request from 'supertest';
import { createExpressApp } from '../../server/app.ts';
import { Group } from '../../server/models/Group.ts';
import { MatchRequest } from '../../server/models/MatchRequest.ts';
import { DEFAULT_MATCH_WEIGHTS } from '../../server/models/SystemConfig.ts';
import { User } from '../../server/models/User.ts';
import { scoreEventMatch } from '../../server/services/matching/eventMatcher.ts';
import { scoreHackathonMatch } from '../../server/services/matching/hackathonMatcher.ts';
import { scoreShoppingMatch } from '../../server/services/matching/shoppingMatcher.ts';
import { scoreTravelMatch } from '../../server/services/matching/travelMatcher.ts';
import { clearTestMongo, startTestMongo, stopTestMongo } from '../helpers/mongoTestEnv.ts';

const app = createExpressApp();

describe('Category-Specific Matching Engine (Unit & MongoDB Integration)', () => {
  beforeAll(async () => {
    await startTestMongo();
  });

  afterEach(async () => {
    await clearTestMongo();
  });

  afterAll(async () => {
    await stopTestMongo();
  });

  it('scores compatible shopping requests and rejects mismatched delivery zones', () => {
    const source = new MatchRequest({
      category: 'shopping',
      title: 'Costco Pantry Split',
      description: 'Splitting minimum order',
      city: 'Seattle',
      maxGroupSize: 4,
      expiresAt: new Date(Date.now() + 86400000),
      details: {
        storeName: 'Costco',
        productCategory: 'Groceries',
        targetDiscountPct: 15,
        minOrderAmount: 150,
        userSpendAmount: 80,
        deliveryZone: 'Capitol Hill',
        splitType: 'proportional',
      },
    });

    const goodCandidate = new MatchRequest({
      category: 'shopping',
      title: 'Costco Bulk Order',
      description: 'Same neighborhood',
      city: 'Seattle',
      maxGroupSize: 3,
      expiresAt: new Date(Date.now() + 86400000),
      details: {
        storeName: 'Costco',
        productCategory: 'Groceries',
        targetDiscountPct: 15,
        minOrderAmount: 150,
        userSpendAmount: 75,
        deliveryZone: 'Capitol Hill',
        splitType: 'proportional',
      },
    });

    const wrongCity = new MatchRequest({
      category: 'shopping',
      title: 'Costco Austin',
      description: 'Different city',
      city: 'Austin',
      maxGroupSize: 3,
      expiresAt: new Date(Date.now() + 86400000),
      details: {
        storeName: 'Costco',
        productCategory: 'Groceries',
        targetDiscountPct: 15,
        minOrderAmount: 150,
        userSpendAmount: 90,
        deliveryZone: 'Downtown Austin',
        splitType: 'proportional',
      },
    });

    const goodScore = scoreShoppingMatch(source, goodCandidate, DEFAULT_MATCH_WEIGHTS);
    expect(goodScore.compatible).toBe(true);
    expect(goodScore.score).toBeGreaterThanOrEqual(90);
    expect(goodScore.reasons.some((r) => r.includes('Costco'))).toBe(true);

    const badScore = scoreShoppingMatch(source, wrongCity, DEFAULT_MATCH_WEIGHTS);
    expect(badScore.compatible).toBe(false);
  });

  it('enforces travel destination, date proximity, and budget ratio rules', () => {
    const base = new MatchRequest({
      category: 'travel',
      title: 'Tahoe Weekend Carpool',
      description: 'Leaving Friday',
      city: 'San Francisco',
      maxGroupSize: 4,
      expiresAt: new Date(Date.now() + 86400000),
      details: {
        origin: 'San Francisco',
        destination: 'Lake Tahoe',
        departureDate: '2026-12-10',
        budgetMax: 250,
        transportMode: 'carpool',
        pace: 'moderate',
      },
    });

    const aligned = new MatchRequest({
      category: 'travel',
      title: 'Tahoe Ride',
      description: 'Leaving Saturday',
      city: 'San Francisco',
      maxGroupSize: 4,
      expiresAt: new Date(Date.now() + 86400000),
      details: {
        origin: 'San Francisco',
        destination: 'Lake Tahoe',
        departureDate: '2026-12-11',
        budgetMax: 240,
        transportMode: 'carpool',
        pace: 'moderate',
      },
    });

    const farDate = new MatchRequest({
      category: 'travel',
      title: 'Tahoe Next Month',
      description: 'Different week',
      city: 'San Francisco',
      maxGroupSize: 4,
      expiresAt: new Date(Date.now() + 86400000),
      details: {
        origin: 'San Francisco',
        destination: 'Lake Tahoe',
        departureDate: '2026-12-25',
        budgetMax: 240,
        transportMode: 'carpool',
        pace: 'moderate',
      },
    });

    const resAligned = scoreTravelMatch(base, aligned, DEFAULT_MATCH_WEIGHTS);
    expect(resAligned.compatible).toBe(true);
    expect(resAligned.score).toBeGreaterThanOrEqual(80);

    const resFar = scoreTravelMatch(base, farDate, DEFAULT_MATCH_WEIGHTS);
    expect(resFar.compatible).toBe(false);
  });

  it('enforces hackathon mutual role complementarity and event hard rules', () => {
    const backendDev = new MatchRequest({
      category: 'hackathon',
      title: 'Backend dev for AI Hack',
      description: 'Need designer',
      city: 'New York',
      maxGroupSize: 4,
      expiresAt: new Date(Date.now() + 86400000),
      details: {
        eventName: 'Climate Hack 2026',
        hackathonFormat: 'hybrid',
        offeredRole: 'Backend',
        neededRoles: ['Designer', 'Frontend'],
        techStack: ['TypeScript', 'MongoDB'],
        experienceLevel: 'intermediate',
      },
    });

    const designer = new MatchRequest({
      category: 'hackathon',
      title: 'Product Designer for Climate Hack',
      description: 'Need backend',
      city: 'New York',
      maxGroupSize: 4,
      expiresAt: new Date(Date.now() + 86400000),
      details: {
        eventName: 'Climate Hack 2026',
        hackathonFormat: 'hybrid',
        offeredRole: 'Designer',
        neededRoles: ['Backend'],
        techStack: ['Figma', 'TypeScript'],
        experienceLevel: 'intermediate',
      },
    });

    const wrongEvent = new MatchRequest({
      category: 'hackathon',
      title: 'Designer for Other Hack',
      description: 'Different event',
      city: 'New York',
      maxGroupSize: 4,
      expiresAt: new Date(Date.now() + 86400000),
      details: {
        eventName: 'Fintech Jam',
        hackathonFormat: 'hybrid',
        offeredRole: 'Designer',
        neededRoles: ['Backend'],
        techStack: ['Figma'],
        experienceLevel: 'intermediate',
      },
    });

    const mutual = scoreHackathonMatch(backendDev, designer, DEFAULT_MATCH_WEIGHTS);
    expect(mutual.compatible).toBe(true);
    expect(mutual.score).toBeGreaterThanOrEqual(80);
    expect(mutual.reasons.some((r) => r.includes('Mutual role fit'))).toBe(true);

    expect(scoreHackathonMatch(backendDev, wrongEvent, DEFAULT_MATCH_WEIGHTS).compatible).toBe(false);
  });

  it('scores compatible event attendees and rejects mismatched cities', () => {
    const s = new MatchRequest({
      category: 'event',
      title: 'Conf group',
      description: 'Networking',
      city: 'Chicago',
      maxGroupSize: 5,
      expiresAt: new Date(Date.now() + 86400000),
      details: {
        eventTitle: 'React Summit',
        venue: 'Navy Pier',
        eventDate: '2026-11-30',
        ticketTier: 'group-pass',
        maxBudget: 200,
        vibe: 'networking',
      },
    });
    const c = new MatchRequest({
      category: 'event',
      title: 'Conf buddy',
      description: 'Same pass',
      city: 'Chicago',
      maxGroupSize: 4,
      expiresAt: new Date(Date.now() + 86400000),
      details: {
        eventTitle: 'React Summit',
        venue: 'Navy Pier',
        eventDate: '2026-11-30',
        ticketTier: 'standard',
        maxBudget: 180,
        vibe: 'networking',
      },
    });
    const out = scoreEventMatch(s, c, DEFAULT_MATCH_WEIGHTS);
    expect(out.compatible).toBe(true);
    expect(out.score).toBeGreaterThanOrEqual(85);
  });

  it('reads MongoDB requests via protected REST API, excludes expired & duplicates, and paginates', async () => {
    const u1 = await request(app).post('/api/auth/register').send({
      name: 'User One',
      email: 'u1@example.com',
      password: 'Password123!',
      city: 'Seattle',
    });
    const u2 = await request(app).post('/api/auth/register').send({
      name: 'User Two',
      email: 'u2@example.com',
      password: 'Password123!',
      city: 'Seattle',
    });
    const u3 = await request(app).post('/api/auth/register').send({
      name: 'User Three',
      email: 'u3@example.com',
      password: 'Password123!',
      city: 'Seattle',
    });

    const srcRes = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${u1.body.accessToken}`)
      .send({
        category: 'hackathon',
        title: 'Backend for Climate Hack',
        description: 'Building carbon tracker',
        city: 'Seattle',
        maxGroupSize: 4,
        details: {
          eventName: 'Climate Hack',
          hackathonFormat: 'hybrid',
          offeredRole: 'Backend',
          neededRoles: ['Designer', 'Frontend'],
          techStack: ['TypeScript', 'MongoDB'],
          experienceLevel: 'intermediate',
        },
      });

    // Active compatible request from u2
    await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${u2.body.accessToken}`)
      .send({
        category: 'hackathon',
        title: 'Designer for Climate Hack',
        description: 'UI/UX lead',
        city: 'Seattle',
        maxGroupSize: 4,
        details: {
          eventName: 'Climate Hack',
          hackathonFormat: 'hybrid',
          offeredRole: 'Designer',
          neededRoles: ['Backend'],
          techStack: ['Figma', 'TypeScript'],
          experienceLevel: 'intermediate',
        },
      });

    // Second request from u2 (should be deduplicated per creator!)
    await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${u2.body.accessToken}`)
      .send({
        category: 'hackathon',
        title: 'Frontend backup for Climate Hack',
        description: 'Also do React',
        city: 'Seattle',
        maxGroupSize: 4,
        details: {
          eventName: 'Climate Hack',
          hackathonFormat: 'hybrid',
          offeredRole: 'Frontend',
          neededRoles: ['Backend'],
          techStack: ['React'],
          experienceLevel: 'intermediate',
        },
      });

    // Expired request from u3 (must be excluded!)
    const u3Doc = await User.findOne({ email: 'u3@example.com' });
    await MatchRequest.create({
      creatorId: u3Doc!._id,
      category: 'hackathon',
      title: 'Expired Request',
      description: 'Should not show up',
      city: 'Seattle',
      maxGroupSize: 4,
      status: 'active',
      expiresAt: new Date(Date.now() - 10000),
      details: {
        eventName: 'Climate Hack',
        hackathonFormat: 'hybrid',
        offeredRole: 'Frontend',
        neededRoles: ['Backend'],
        techStack: ['TypeScript'],
        experienceLevel: 'intermediate',
      },
    });

    // Active request from u3 (so we have 2 unique creators matching)
    await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${u3.body.accessToken}`)
      .send({
        category: 'hackathon',
        title: 'Frontend React Dev',
        description: 'Ready to ship',
        city: 'Seattle',
        maxGroupSize: 4,
        details: {
          eventName: 'Climate Hack',
          hackathonFormat: 'hybrid',
          offeredRole: 'Frontend',
          neededRoles: ['Backend'],
          techStack: ['TypeScript'],
          experienceLevel: 'beginner',
        },
      });

    const page1 = await request(app)
      .get(`/api/matches/for-request/${srcRes.body.request._id}?page=1&limit=1`)
      .set('Authorization', `Bearer ${u1.body.accessToken}`);

    expect(page1.status).toBe(200);
    expect(page1.body.total).toBe(2);
    expect(page1.body.totalPages).toBe(2);
    expect(page1.body.hasNextPage).toBe(true);
    expect(page1.body.matches).toHaveLength(1);
    expect(page1.body.matches[0].creator.name).toBe('User Two');

    const page2 = await request(app)
      .get(`/api/matches/for-request/${srcRes.body.request._id}?page=2&limit=1`)
      .set('Authorization', `Bearer ${u1.body.accessToken}`);

    expect(page2.status).toBe(200);
    expect(page2.body.hasNextPage).toBe(false);
    expect(page2.body.matches).toHaveLength(1);
    expect(page2.body.matches[0].creator.name).toBe('User Three');

    // If u1 already joined a group linked to u3's request, u3 should no longer appear
    const linkedReq = await MatchRequest.findById(page2.body.matches[0].requestId);
    await Group.create({
      name: 'Existing Squad',
      category: 'hackathon',
      description: 'Already teamed up',
      city: 'Seattle',
      ownerId: u1.body.user._id,
      members: [u1.body.user._id, u3Doc!._id],
      maxCapacity: 4,
      linkedRequestIds: [linkedReq!._id],
    });

    const afterGroup = await request(app)
      .get(`/api/matches/for-request/${srcRes.body.request._id}`)
      .set('Authorization', `Bearer ${u1.body.accessToken}`);
    expect(afterGroup.body.total).toBe(1);
  });
});
