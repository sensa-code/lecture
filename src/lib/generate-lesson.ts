// Stage 02: Lesson Script Generator (SSOT)
// ⚠️ SYSTEM_PROMPT and extractLessonsFromSyllabus are SSOT — 07 batch MUST import from here

import Anthropic from '@anthropic-ai/sdk';
import { LessonScriptSchema } from '../schemas/lesson.js';
import { buildLessonUserPrompt } from './build-lesson-prompt.js';
import { safeParseJSON } from './safe-json.js';
import type { LessonScript, LessonInfo } from '../types/lesson.js';
import type { Syllabus } from '../types/syllabus.js';

// ⚠️ SSOT: This System Prompt is the ONLY version.
// 07 batch script MUST import this constant, NEVER define a simplified version (F-4).
const SYSTEM_PROMPT = `你是一位專業的獸醫師線上課程撰稿專家。你的任務是將專業知識轉化為結構化的課程講稿。

### 角色設定
- 你是一位有 15 年經驗的小動物臨床獸醫師
- 你同時是獸醫教育專家，擅長將複雜概念用淺白的方式談
- 說話風格：溫暖、專業、像在跟同事聊天但保持專業深度

### 輸出規則
1. 每堂課包含 5~8 個 segment
2. 必須包含：opening(1個) + teaching(2~3個) + case(1~2個) + summary(1個)
3. 每個 segment 的 script 必須是可以直接唸出來的自然口語
4. 絕對不可用書面語、不可用條列式唸法
5. 必須包含至少一個臨床案例情境模擬
6. 每堂課附 2~3 題測驗題
7. 嚴格以指定的 JSON 格式輸出，不要加任何說明文字
8. duration_seconds 依 script 字數估算（中文約每秒 3~4 個字）`;

export { SYSTEM_PROMPT as LESSON_SYSTEM_PROMPT };

export async function generateLessonScript(
  info: LessonInfo,
  maxRetries = 3
): Promise<LessonScript> {
  const client = new Anthropic();
  const userPrompt = buildLessonUserPrompt(info);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 8192,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const parsed = safeParseJSON<LessonScript>(text);
      if (!parsed) {
        throw new Error('Failed to parse JSON response');
      }
      const validated = LessonScriptSchema.parse(parsed);

      // Duration sanity check
      const totalDuration = validated.segments.reduce((sum, s) => sum + s.duration_seconds, 0);
      const targetSeconds = info.duration_target_minutes * 60;
      if (Math.abs(totalDuration - targetSeconds) > targetSeconds * 0.3) {
        console.warn(`⚠️ ${info.lesson_id} duration deviation >30%: ${totalDuration}s vs target ${targetSeconds}s`);
      }

      console.log(`✅ ${info.lesson_id} script generated (${validated.segments.length} segments, ${totalDuration}s)`);
      return validated;
    } catch (error) {
      console.error(`❌ ${info.lesson_id} attempt ${attempt} failed:`, error instanceof Error ? error.message : error);
      if (attempt === maxRetries) throw error;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error('unreachable');
}

/**
 * Extract all lesson info from a syllabus for batch processing.
 * ⚠️ SSOT: 07 batch script MUST import this function (F-2).
 */
export function extractLessonsFromSyllabus(syllabus: Syllabus): LessonInfo[] {
  return syllabus.chapters.flatMap((ch) =>
    ch.lessons.map((lesson) => ({
      lesson_id: lesson.lesson_id,
      title: lesson.title,
      key_topics: lesson.key_topics,
      learning_objectives: lesson.learning_objectives,
      duration_target_minutes: lesson.duration_target_minutes,
      case_scenario: lesson.case_scenario,
      chapter_id: ch.chapter_id,
    }))
  );
}
