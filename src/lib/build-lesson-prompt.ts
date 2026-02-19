// Lesson prompt builder (SSOT)
import type { LessonInfo } from '../types/lesson.js';

/**
 * Build the user prompt for lesson script generation.
 * SSOT: batch scripts must import this function.
 */
export function buildLessonUserPrompt(info: LessonInfo): string {
  return `Please write a complete single-lesson script for the following course information.

Course Information:
- course_id: "vet-comm-001"
- lesson_id: "${info.lesson_id}"
- Course Title: "${info.title}"
- Key Topics: ${JSON.stringify(info.key_topics)}
- Target Duration: ${info.duration_target_minutes} minutes
- Case Scenario: "${info.case_scenario}"

Please output in JSON format with the following structure:
- course_id, lesson_id, title, duration_target_minutes
- segments array (5-8 items, including opening/teaching/case/summary)
- quiz array (2-3 questions)
- metadata (topic, chapter: "${info.chapter_id}", difficulty, generated_at)

Each segment must include: segment_id (seg-01 format), type, speaker_mode, visual_type, script_zh, key_points, slide_content, visual_notes, duration_seconds

script_zh must be natural spoken language, as if a real person is lecturing. Estimate duration_seconds at 3-4 Chinese characters per second.

Output JSON only.`;
}

/**
 * Estimate speaking duration for Chinese text.
 * Average speaking rate: ~3.5 characters per second.
 */
export function estimateDuration(scriptZh: string): number {
  const charCount = scriptZh.replace(/\s/g, '').length;
  return Math.round(charCount / 3.5);
}
