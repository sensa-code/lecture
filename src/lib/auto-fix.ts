// Auto-fix module (SSOT -- F-18)
// This is the ONLY auto-fix implementation. Batch scripts MUST import this.
// Fixes operate at segment object level, NEVER on serialized JSON strings.

import type { LessonScript } from '../types/lesson.js';
import type { QualityReport } from '../types/quality.js';

/**
 * Apply low/medium severity fixes from a quality report to a lesson script.
 * High severity issues are skipped (left for human review).
 *
 * SSOT (F-18): This function operates on segment objects directly.
 * NEVER use JSON.stringify -> String.replace -> JSON.parse approach.
 */
export function applyFixes(
  lesson: LessonScript,
  report: QualityReport
): { fixed: LessonScript; appliedCount: number; remainingHighIssues: number } {
  let appliedCount = 0;
  const fixedLesson = structuredClone(lesson);

  for (const issue of report.issues) {
    // Skip high severity -- those require human review
    if (issue.severity === 'high') continue;

    // Find the target segment by ID
    const segment = fixedLesson.segments.find(s => s.segment_id === issue.segment_id);
    if (segment && segment.script_zh.includes(issue.original_text)) {
      // Replace at segment object level (NOT serialized JSON string)
      segment.script_zh = segment.script_zh.replace(issue.original_text, issue.revised_text);
      appliedCount++;
    }
  }

  const remainingHighIssues = report.issues.filter(i => i.severity === 'high').length;

  return { fixed: fixedLesson, appliedCount, remainingHighIssues };
}

/**
 * Quality check + auto-fix loop.
 * Max 2 rounds of auto-fix, then hands off to human review.
 */
export async function qualityCheckLoop(
  lesson: LessonScript,
  checkFn: (lesson: LessonScript) => Promise<QualityReport>,
  maxRounds = 2
): Promise<{ finalLesson: LessonScript; finalReport: QualityReport; rounds: number }> {
  let currentLesson = lesson;
  let report: QualityReport;
  let round = 0;

  do {
    round++;
    console.log(`  Quality check round ${round}...`);
    report = await checkFn(currentLesson);

    console.log(`   Score: ${report.overall_score}, verdict: ${report.verdict}`);
    console.log(`   Issues: ${report.issues.length} (high: ${report.issues.filter(i => i.severity === 'high').length})`);

    if (report.verdict === 'approved') {
      console.log(`  Passed quality check`);
      break;
    }

    if (report.verdict === 'rejected') {
      console.log(`  Quality too low, needs full regeneration`);
      break;
    }

    // revision_needed -> try auto-fix
    const { fixed, appliedCount, remainingHighIssues } = applyFixes(currentLesson, report);
    console.log(`   Auto-fixed ${appliedCount} issues, ${remainingHighIssues} high severity remaining for human review`);

    if (appliedCount === 0) {
      console.log(`  No auto-fixable issues, needs human intervention`);
      break;
    }

    currentLesson = fixed;
  } while (round < maxRounds);

  return { finalLesson: currentLesson, finalReport: report!, rounds: round };
}

/**
 * Sampling mechanism: Force manual review every N lessons (F-3).
 * Prevents AI-reviewing-AI systematic blind spots.
 *
 * @param lessonIndex - Current lesson index in the batch (0-based)
 * @param sampleRate - Review every N lessons (default 5)
 * @returns Whether this lesson should be forced into manual_review
 */
export function shouldForceManualReview(
  lessonIndex: number,
  sampleRate = 5
): boolean {
  return lessonIndex % sampleRate === 0;
}

/**
 * Quality check wrapper with sampling mechanism.
 * Even if AI approves, sampling may force manual_review.
 */
export async function qualityCheckWithSampling(
  lesson: LessonScript,
  lessonIndex: number,
  checkFn: (lesson: LessonScript) => Promise<QualityReport>,
  options: { maxRounds?: number; sampleRate?: number } = {}
): Promise<{
  finalLesson: LessonScript;
  finalReport: QualityReport;
  rounds: number;
  forcedManualReview: boolean;
}> {
  const { maxRounds = 2, sampleRate = 5 } = options;
  const result = await qualityCheckLoop(lesson, checkFn, maxRounds);
  const forcedManualReview = shouldForceManualReview(lessonIndex, sampleRate);

  if (forcedManualReview && result.finalReport.verdict === 'approved') {
    console.log(`  Sampling triggered: ${lesson.lesson_id} forced into manual_review`);
    result.finalReport = {
      ...result.finalReport,
      verdict: 'revision_needed' as const,
      general_feedback: `[SAMPLING] ${result.finalReport.general_feedback} (This lesson was selected by sampling mechanism and requires human review confirmation)`,
    };
  }

  return { ...result, forcedManualReview };
}
