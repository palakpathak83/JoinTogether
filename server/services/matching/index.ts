import mongoose from 'mongoose';
import { Group } from '../../models/Group.ts';
import { MatchRequest, type IMatchRequest, type MatchCategory } from '../../models/MatchRequest.ts';
import { getSystemConfig, type CategoryMatchWeights } from '../../models/SystemConfig.ts';
import { scoreEventMatch } from './eventMatcher.ts';
import { scoreHackathonMatch } from './hackathonMatcher.ts';
import { scoreShoppingMatch } from './shoppingMatcher.ts';
import { scoreTravelMatch } from './travelMatcher.ts';
import type { CategoryMatcherFn, PaginatedMatchResult, ScoredMatchItem } from './types.ts';

const CATEGORY_MATCHERS: Record<MatchCategory, CategoryMatcherFn> = {
  shopping: scoreShoppingMatch,
  travel: scoreTravelMatch,
  hackathon: scoreHackathonMatch,
  event: scoreEventMatch,
};

export interface FindMatchesOptions {
  requestId: string;
  requesterUserId: string;
  page?: number;
  limit?: number;
  minScore?: number;
  weightsOverride?: CategoryMatchWeights;
}

export async function findMatchesForRequest(options: FindMatchesOptions): Promise<PaginatedMatchResult> {
  const { requestId, requesterUserId, minScore = 0 } = options;
  const page = Math.max(1, Math.floor(options.page ?? 1));
  const limit = Math.min(50, Math.max(1, Math.floor(options.limit ?? 10)));

  if (!mongoose.isValidObjectId(requestId)) {
    throw new Error('INVALID_REQUEST_ID');
  }

  const source = await MatchRequest.findById(requestId);
  if (!source) {
    throw new Error('REQUEST_NOT_FOUND');
  }

  const now = new Date();
  if (source.status !== 'active' || source.expiresAt <= now) {
    return {
      sourceRequestId: source._id.toString(),
      category: source.category,
      page,
      limit,
      total: 0,
      totalPages: 0,
      hasNextPage: false,
      matches: [],
    };
  }

  const config = options.weightsOverride ? null : await getSystemConfig();
  const weights = options.weightsOverride ?? config!.matchWeights;
  const matcher = CATEGORY_MATCHERS[source.category];

  // Find groups user is already a member of so we don't duplicate existing connections
  const userGroups = await Group.find({
    members: new mongoose.Types.ObjectId(requesterUserId),
    status: { $in: ['open', 'full'] },
  }).select('_id linkedRequestIds');

  const alreadyJoinedGroupIds = new Set(userGroups.map((g) => g._id.toString()));
  const alreadyLinkedReqIds = new Set(
    userGroups.flatMap((g) => (g.linkedRequestIds || []).map((id) => id.toString()))
  );

  // Query real active, non-expired requests in the same category excluding self
  const candidates = await MatchRequest.find({
    _id: { $ne: source._id },
    creatorId: { $ne: new mongoose.Types.ObjectId(requesterUserId) },
    category: source.category,
    status: 'active',
    expiresAt: { $gt: now },
  })
    .populate('creatorId', 'name city bio skills interests isActive')
    .sort({ createdAt: -1 })
    .limit(200);

  const scored: ScoredMatchItem[] = [];
  const seenRequestIds = new Set<string>();
  const seenCreators = new Set<string>();

  for (const candidate of candidates) {
    const candidateId = candidate._id.toString();
    if (seenRequestIds.has(candidateId) || alreadyLinkedReqIds.has(candidateId)) {
      continue;
    }

    if (candidate.matchedGroupId && alreadyJoinedGroupIds.has(candidate.matchedGroupId.toString())) {
      continue;
    }

    const creatorDoc = candidate.creatorId as unknown as {
      _id: mongoose.Types.ObjectId;
      name: string;
      city: string;
      bio: string;
      skills: string[];
      interests: string[];
      isActive?: boolean;
    } | null;

    if (!creatorDoc || creatorDoc.isActive === false) {
      continue;
    }

    const creatorIdStr = creatorDoc._id.toString();
    // Prevent duplicate matches from the same peer within the same request result set
    if (seenCreators.has(creatorIdStr)) {
      continue;
    }

    const result = matcher(source, candidate, weights);
    if (!result.compatible || result.score < minScore) {
      continue;
    }

    seenRequestIds.add(candidateId);
    seenCreators.add(creatorIdStr);

    scored.push({
      requestId: candidateId,
      category: candidate.category,
      title: candidate.title,
      description: candidate.description,
      city: candidate.city,
      maxGroupSize: candidate.maxGroupSize,
      expiresAt: candidate.expiresAt.toISOString(),
      matchedGroupId: candidate.matchedGroupId ? candidate.matchedGroupId.toString() : null,
      details: candidate.details,
      creator: {
        _id: creatorIdStr,
        name: creatorDoc.name,
        city: creatorDoc.city || '',
        bio: creatorDoc.bio || '',
        skills: creatorDoc.skills || [],
        interests: creatorDoc.interests || [],
      },
      score: result.score,
      reasons: result.reasons,
      breakdown: result.breakdown,
    });
  }

  scored.sort((a, b) => b.score - a.score);

  const total = scored.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  const start = (page - 1) * limit;
  const paged = scored.slice(start, start + limit);

  return {
    sourceRequestId: source._id.toString(),
    category: source.category,
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    matches: paged,
  };
}
