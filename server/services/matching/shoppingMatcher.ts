import type { IMatchRequest, ShoppingDetails } from '../../models/MatchRequest.ts';
import type { CategoryMatchWeights } from '../../models/SystemConfig.ts';
import { clampScore, normalizeText, type CategoryScoreOutput } from './types.ts';

export function scoreShoppingMatch(
  source: IMatchRequest,
  candidate: IMatchRequest,
  weights: CategoryMatchWeights
): CategoryScoreOutput {
  if (source.category !== 'shopping' || candidate.category !== 'shopping') {
    return { compatible: false, score: 0, reasons: [], breakdown: {} };
  }

  const s = source.details as ShoppingDetails;
  const c = candidate.details as ShoppingDetails;

  const sStore = normalizeText(s.storeName);
  const cStore = normalizeText(c.storeName);
  const sProd = normalizeText(s.productCategory);
  const cProd = normalizeText(c.productCategory);
  const sZone = normalizeText(s.deliveryZone || source.city);
  const cZone = normalizeText(c.deliveryZone || candidate.city);
  const sCity = normalizeText(source.city);
  const cCity = normalizeText(candidate.city);

  // Hard rules:
  // 1. Must share delivery zone or city so group split fulfillment is physically possible
  const sameZone = sZone !== '' && sZone === cZone;
  const sameCity = sCity !== '' && sCity === cCity;
  if (!sameZone && !sameCity) {
    return { compatible: false, score: 0, reasons: [], breakdown: {} };
  }

  // 2. Must share either storeName or productCategory
  const exactStore = sStore !== '' && sStore === cStore;
  const sameProductCat = sProd !== '' && sProd === cProd;
  if (!exactStore && !sameProductCat) {
    return { compatible: false, score: 0, reasons: [], breakdown: {} };
  }

  // 3. Combined spend must meaningfully contribute toward order minimum (>= 50% of minOrderAmount)
  const targetMinOrder = Math.max(Number(s.minOrderAmount) || 0, Number(c.minOrderAmount) || 0, 1);
  const combinedSpend = (Number(s.userSpendAmount) || 0) + (Number(c.userSpendAmount) || 0);
  if (combinedSpend < targetMinOrder * 0.4) {
    return { compatible: false, score: 0, reasons: [], breakdown: {} };
  }

  const w = weights.shopping;
  const reasons: string[] = [];

  const storePts = exactStore ? w.storeWeight : Math.round(w.storeWeight * 0.55);
  if (exactStore) {
    reasons.push(`Exact store match: ${c.storeName}`);
  } else {
    reasons.push(`Matching product category: ${c.productCategory}`);
  }

  const zonePts = sameZone ? w.zoneWeight : Math.round(w.zoneWeight * 0.7);
  reasons.push(sameZone ? `Same delivery zone: ${c.deliveryZone || candidate.city}` : `Same city: ${candidate.city}`);

  const progressRatio = Math.min(1, combinedSpend / targetMinOrder);
  const thresholdPts = Math.round(w.thresholdWeight * progressRatio);
  if (combinedSpend >= targetMinOrder) {
    reasons.push(`Combined spend ($${combinedSpend}) meets $${targetMinOrder} threshold`);
  } else {
    reasons.push(`Combined spend reaches ${Math.round(progressRatio * 100)}% of $${targetMinOrder} minimum`);
  }

  let discountSplitPts = 0;
  if (s.splitType === c.splitType) {
    discountSplitPts += Math.round(w.discountSplitWeight * 0.6);
    reasons.push(`Aligned ${c.splitType} cost split`);
  }
  const discountDiff = Math.abs((Number(s.targetDiscountPct) || 0) - (Number(c.targetDiscountPct) || 0));
  if (discountDiff <= 10) {
    discountSplitPts += Math.round(w.discountSplitWeight * 0.4);
  }

  const totalWeight = w.storeWeight + w.zoneWeight + w.thresholdWeight + w.discountSplitWeight || 100;
  const rawScore = ((storePts + zonePts + thresholdPts + discountSplitPts) / totalWeight) * 100;

  return {
    compatible: true,
    score: clampScore(rawScore),
    reasons,
    breakdown: {
      store: storePts,
      zone: zonePts,
      threshold: thresholdPts,
      splitAndDiscount: discountSplitPts,
    },
  };
}
