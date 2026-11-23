import type { IMatchRequest, MatchCategory } from '../../models/MatchRequest.ts';
import type { CategoryMatchWeights } from '../../models/SystemConfig.ts';

export interface CreatorSummary {
  _id: string;
  name: string;
  city: string;
  bio: string;
  skills: string[];
  interests: string[];
}

export interface ScoredMatchItem {
  requestId: string;
  category: MatchCategory;
  title: string;
  description: string;
  city: string;
  maxGroupSize: number;
  expiresAt: string;
  matchedGroupId: string | null;
  details: IMatchRequest['details'];
  creator: CreatorSummary;
  score: number;
  reasons: string[];
  breakdown: Record<string, number>;
}

export interface PaginatedMatchResult {
  sourceRequestId: string;
  category: MatchCategory;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  matches: ScoredMatchItem[];
}

export interface CategoryScoreOutput {
  compatible: boolean;
  score: number;
  reasons: string[];
  breakdown: Record<string, number>;
}

export type CategoryMatcherFn = (
  source: IMatchRequest,
  candidate: IMatchRequest,
  weights: CategoryMatchWeights
) => CategoryScoreOutput;

export function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function tokenOverlapRatio(a: string[], b: string[]): number {
  const setA = new Set(a.map(normalizeText).filter(Boolean));
  const setB = new Set(b.map(normalizeText).filter(Boolean));
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}
