// Quality scoring utilities (SSOT)
import type { ScoreBreakdown, Verdict, QualityIssue } from '../types/quality.js';

/** Weight configuration for quality scoring dimensions */
const SCORE_WEIGHTS: Record<keyof ScoreBreakdown, number> = {
  口語自然度: 20,
  專業正確性: 20,
  教學結構: 15,
  案例實用性: 15,
  字數節奏: 10,
  視覺指示: 10,
  測驗品質: 10,
};

/**
 * Calculate overall_score from 7 dimension scores using weighted average.
 * Result is 0-100 scale (each dimension is 1-10, multiplied by 10).
 */
export function calculateOverallScore(scores: ScoreBreakdown): number {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const [key, weight] of Object.entries(SCORE_WEIGHTS)) {
    const score = scores[key as keyof ScoreBreakdown];
    weightedSum += score * weight;
    totalWeight += weight;
  }

  return Math.round((weightedSum / totalWeight) * 10);
}

/**
 * Determine verdict based on overall score and issue severity.
 *
 * Rules:
 * - rejected: overall_score < 60
 * - approved: overall_score >= 80 AND no high severity issues
 * - revision_needed: everything else
 */
export function determineVerdict(
  overallScore: number,
  issues: QualityIssue[]
): Verdict {
  const hasHighIssue = issues.some(i => i.severity === 'high');

  if (overallScore < 60) return 'rejected';
  if (overallScore >= 80 && !hasHighIssue) return 'approved';
  return 'revision_needed';
}
