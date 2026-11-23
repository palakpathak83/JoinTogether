import type { IMatchRequest, TravelDetails } from '../../models/MatchRequest.ts';
import type { CategoryMatchWeights } from '../../models/SystemConfig.ts';
import { clampScore, normalizeText, type CategoryScoreOutput } from './types.ts';

function daysBetween(dateA: string, dateB: string): number {
  const a = Date.parse(dateA);
  const b = Date.parse(dateB);
  if (Number.isNaN(a) || Number.isNaN(b)) return Infinity;
  return Math.abs(a - b) / (1000 * 60 * 60 * 24);
}

export function scoreTravelMatch(
  source: IMatchRequest,
  candidate: IMatchRequest,
  weights: CategoryMatchWeights
): CategoryScoreOutput {
  if (source.category !== 'travel' || candidate.category !== 'travel') {
    return { compatible: false, score: 0, reasons: [], breakdown: {} };
  }

  const s = source.details as TravelDetails;
  const c = candidate.details as TravelDetails;

  const sDest = normalizeText(s.destination);
  const cDest = normalizeText(c.destination);
  const sOrigin = normalizeText(s.origin || source.city);
  const cOrigin = normalizeText(c.origin || candidate.city);

  // Hard rules:
  // 1. Must share destination (exact or one contains the other, e.g. "Yosemite" / "Yosemite Valley")
  const destMatch = sDest !== '' && cDest !== '' && (sDest === cDest || sDest.includes(cDest) || cDest.includes(sDest));
  if (!destMatch) {
    return { compatible: false, score: 0, reasons: [], breakdown: {} };
  }

  // 2. Departure date must be within 3 days
  const diffDays = daysBetween(s.departureDate, c.departureDate);
  if (diffDays > 3) {
    return { compatible: false, score: 0, reasons: [], breakdown: {} };
  }

  // 3. Budget ceiling compatibility (lower max budget >= 60% of higher max budget)
  const sBudget = Math.max(0, Number(s.budgetMax) || 0);
  const cBudget = Math.max(0, Number(c.budgetMax) || 0);
  if (sBudget > 0 && cBudget > 0) {
    const ratio = Math.min(sBudget, cBudget) / Math.max(sBudget, cBudget);
    if (ratio < 0.6) {
      return { compatible: false, score: 0, reasons: [], breakdown: {} };
    }
  }

  const w = weights.travel;
  const reasons: string[] = [];

  const destPts = sDest === cDest ? w.destinationWeight : Math.round(w.destinationWeight * 0.8);
  reasons.push(`Matching destination: ${c.destination}`);

  const originMatch = sOrigin !== '' && (sOrigin === cOrigin || normalizeText(source.city) === normalizeText(candidate.city));
  const originPts = originMatch ? w.originWeight : Math.round(w.originWeight * 0.35);
  if (originMatch) {
    reasons.push(`Shared departure hub: ${c.origin || candidate.city}`);
  }

  let datePts = 0;
  if (diffDays <= 0.5) {
    datePts = w.dateWeight;
    reasons.push(`Same departure date (${c.departureDate})`);
  } else if (diffDays <= 1.5) {
    datePts = Math.round(w.dateWeight * 0.75);
    reasons.push(`Departure within 1 day (${c.departureDate})`);
  } else {
    datePts = Math.round(w.dateWeight * 0.45);
    reasons.push(`Departure within ${Math.round(diffDays)} days`);
  }

  let modePacePts = 0;
  if (s.transportMode === c.transportMode) {
    modePacePts += Math.round(w.modePaceWeight * 0.6);
    reasons.push(`Preferred mode: ${c.transportMode}`);
  }
  if (s.pace === c.pace) {
    modePacePts += Math.round(w.modePaceWeight * 0.4);
    reasons.push(`Compatible ${c.pace} itinerary pace`);
  }

  const totalWeight = w.destinationWeight + w.originWeight + w.dateWeight + w.modePaceWeight || 100;
  const rawScore = ((destPts + originPts + datePts + modePacePts) / totalWeight) * 100;

  return {
    compatible: true,
    score: clampScore(rawScore),
    reasons,
    breakdown: {
      destination: destPts,
      origin: originPts,
      dates: datePts,
      modeAndPace: modePacePts,
    },
  };
}
