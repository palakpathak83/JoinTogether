import type { EventDetails, IMatchRequest } from '../../models/MatchRequest.ts';
import type { CategoryMatchWeights } from '../../models/SystemConfig.ts';
import { clampScore, normalizeText, type CategoryScoreOutput } from './types.ts';

function hoursBetween(dateA: string, dateB: string): number {
  const a = Date.parse(dateA);
  const b = Date.parse(dateB);
  if (Number.isNaN(a) || Number.isNaN(b)) return Infinity;
  return Math.abs(a - b) / (1000 * 60 * 60);
}

export function scoreEventMatch(
  source: IMatchRequest,
  candidate: IMatchRequest,
  weights: CategoryMatchWeights
): CategoryScoreOutput {
  if (source.category !== 'event' || candidate.category !== 'event') {
    return { compatible: false, score: 0, reasons: [], breakdown: {} };
  }

  const s = source.details as EventDetails;
  const c = candidate.details as EventDetails;

  // Hard rules:
  // 1. Must be in same city
  if (normalizeText(source.city) !== normalizeText(candidate.city)) {
    return { compatible: false, score: 0, reasons: [], breakdown: {} };
  }

  // 2. Event title must match or overlap meaningfully
  const sTitle = normalizeText(s.eventTitle);
  const cTitle = normalizeText(c.eventTitle);
  const titleMatch = sTitle !== '' && cTitle !== '' && (sTitle === cTitle || sTitle.includes(cTitle) || cTitle.includes(sTitle));
  if (!titleMatch) {
    return { compatible: false, score: 0, reasons: [], breakdown: {} };
  }

  // 3. Event date must be within 24 hours
  const diffHours = hoursBetween(s.eventDate, c.eventDate);
  if (diffHours > 24) {
    return { compatible: false, score: 0, reasons: [], breakdown: {} };
  }

  // 4. Budget ceiling within 50% ratio
  const sBudget = Math.max(0, Number(s.maxBudget) || 0);
  const cBudget = Math.max(0, Number(c.maxBudget) || 0);
  if (sBudget > 0 && cBudget > 0) {
    const ratio = Math.min(sBudget, cBudget) / Math.max(sBudget, cBudget);
    if (ratio < 0.5) {
      return { compatible: false, score: 0, reasons: [], breakdown: {} };
    }
  }

  const w = weights.event;
  const reasons: string[] = [];

  const titlePts = sTitle === cTitle ? w.titleWeight : Math.round(w.titleWeight * 0.8);
  reasons.push(`Same event: ${c.eventTitle}`);

  const sameVenue = normalizeText(s.venue) !== '' && normalizeText(s.venue) === normalizeText(c.venue);
  const venueDatePts = sameVenue ? w.venueDateWeight : Math.round(w.venueDateWeight * 0.6);
  if (sameVenue) {
    reasons.push(`Same venue (${c.venue}) on ${c.eventDate}`);
  } else {
    reasons.push(`Same city & date (${c.eventDate})`);
  }

  let budgetTierPts = 0;
  if (s.ticketTier === c.ticketTier || s.ticketTier === 'group-pass' || c.ticketTier === 'group-pass') {
    budgetTierPts += Math.round(w.budgetTierWeight * 0.6);
    reasons.push(`Compatible ticket tier: ${c.ticketTier}`);
  }
  budgetTierPts += Math.round(w.budgetTierWeight * 0.4);

  const vibePts = s.vibe === c.vibe ? w.vibeWeight : Math.round(w.vibeWeight * 0.35);
  if (s.vibe === c.vibe) {
    reasons.push(`Shared ${c.vibe} attendance style`);
  }

  const totalWeight = w.titleWeight + w.venueDateWeight + w.budgetTierWeight + w.vibeWeight || 100;
  const rawScore = ((titlePts + venueDatePts + budgetTierPts + vibePts) / totalWeight) * 100;

  return {
    compatible: true,
    score: clampScore(rawScore),
    reasons,
    breakdown: {
      eventTitle: titlePts,
      venueAndDate: venueDatePts,
      budgetAndTier: budgetTierPts,
      vibe: vibePts,
    },
  };
}
