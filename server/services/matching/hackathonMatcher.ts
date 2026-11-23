import type { HackathonDetails, IMatchRequest } from '../../models/MatchRequest.ts';
import type { CategoryMatchWeights } from '../../models/SystemConfig.ts';
import { clampScore, normalizeText, tokenOverlapRatio, type CategoryScoreOutput } from './types.ts';

export function scoreHackathonMatch(
  source: IMatchRequest,
  candidate: IMatchRequest,
  weights: CategoryMatchWeights
): CategoryScoreOutput {
  if (source.category !== 'hackathon' || candidate.category !== 'hackathon') {
    return { compatible: false, score: 0, reasons: [], breakdown: {} };
  }

  const s = source.details as HackathonDetails;
  const c = candidate.details as HackathonDetails;

  const sEvent = normalizeText(s.eventName);
  const cEvent = normalizeText(c.eventName);

  // Hard rules:
  // 1. Same hackathon event
  const sameEvent = sEvent !== '' && cEvent !== '' && (sEvent === cEvent || sEvent.includes(cEvent) || cEvent.includes(sEvent));
  if (!sameEvent) {
    return { compatible: false, score: 0, reasons: [], breakdown: {} };
  }

  // 2. Format compatibility: online cannot match strictly in-person; in-person requires same city
  if (
    (s.hackathonFormat === 'online' && c.hackathonFormat === 'in-person') ||
    (s.hackathonFormat === 'in-person' && c.hackathonFormat === 'online')
  ) {
    return { compatible: false, score: 0, reasons: [], breakdown: {} };
  }
  if (
    s.hackathonFormat === 'in-person' &&
    c.hackathonFormat === 'in-person' &&
    normalizeText(source.city) !== normalizeText(candidate.city)
  ) {
    return { compatible: false, score: 0, reasons: [], breakdown: {} };
  }

  // 3. Role complementarity: at least one side offers a role the other needs
  const sOffered = normalizeText(s.offeredRole);
  const cOffered = normalizeText(c.offeredRole);
  const sNeeded = (s.neededRoles || []).map(normalizeText);
  const cNeeded = (c.neededRoles || []).map(normalizeText);

  const sourceFillsCandidate = cNeeded.includes(sOffered);
  const candidateFillsSource = sNeeded.includes(cOffered);
  if (!sourceFillsCandidate && !candidateFillsSource) {
    return { compatible: false, score: 0, reasons: [], breakdown: {} };
  }

  const w = weights.hackathon;
  const reasons: string[] = [];

  const eventPts = sEvent === cEvent ? w.eventWeight : Math.round(w.eventWeight * 0.8);
  reasons.push(`Same hackathon: ${c.eventName}`);

  let roleFitPts = 0;
  if (sourceFillsCandidate && candidateFillsSource) {
    roleFitPts = w.roleFitWeight;
    reasons.push(`Mutual role fit: ${c.offeredRole} pairs with ${s.offeredRole}`);
  } else if (candidateFillsSource) {
    roleFitPts = Math.round(w.roleFitWeight * 0.68);
    reasons.push(`Fills your needed role: ${c.offeredRole}`);
  } else {
    roleFitPts = Math.round(w.roleFitWeight * 0.6);
    reasons.push(`Needs your role: ${s.offeredRole}`);
  }

  const stackOverlap = tokenOverlapRatio(s.techStack || [], c.techStack || []);
  const stackPts = Math.round(w.stackWeight * Math.max(0.25, stackOverlap));
  const sharedStack = (s.techStack || []).filter((item) =>
    (c.techStack || []).map(normalizeText).includes(normalizeText(item))
  );
  if (sharedStack.length > 0) {
    reasons.push(`Shared tech stack: ${sharedStack.join(', ')}`);
  }

  let formatLevelPts = 0;
  if (s.hackathonFormat === c.hackathonFormat) {
    formatLevelPts += Math.round(w.formatLevelWeight * 0.6);
  } else {
    formatLevelPts += Math.round(w.formatLevelWeight * 0.35);
  }
  if (s.experienceLevel === c.experienceLevel) {
    formatLevelPts += Math.round(w.formatLevelWeight * 0.4);
    reasons.push(`Matching ${c.experienceLevel} experience level`);
  }

  const totalWeight = w.eventWeight + w.roleFitWeight + w.stackWeight + w.formatLevelWeight || 100;
  const rawScore = ((eventPts + roleFitPts + stackPts + formatLevelPts) / totalWeight) * 100;

  return {
    compatible: true,
    score: clampScore(rawScore),
    reasons,
    breakdown: {
      event: eventPts,
      roleFit: roleFitPts,
      techStack: stackPts,
      formatAndLevel: formatLevelPts,
    },
  };
}
