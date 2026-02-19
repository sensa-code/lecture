// Stage 04: Quality Checker (SSOT)
// ⚠️ QUALITY_CHECK_SYSTEM_PROMPT is SSOT — 07 batch MUST import from here

import Anthropic from '@anthropic-ai/sdk';
import { QualityReportSchema } from '../schemas/quality.js';
import { safeParseJSON } from './safe-json.js';
import type { LessonScript } from '../types/lesson.js';
import type { QualityReport } from '../types/quality.js';

// ⚠️ SSOT: This System Prompt is the ONLY version.
// 07 batch script MUST import this constant (F-4).
const QUALITY_CHECK_SYSTEM_PROMPT = `你是一位嚴格的課程品質審核專家，同時具備獸醫臨床背景。
你的任務是審查 AI 生成的課程講稿，找出問題並給出具體修改建議。

### 審查態度
- 你非常嚴格，不會輕易給高分
- 你特別注意口語自然度（很多 AI 生成的講稿聽起來像在唸稿）
- 你會檢查醫療資訊的正確性
- 你會確認教學結構是否合理

### 審查標準（各項 1~10 分）
1. 口語自然度：是否像真人在說話，有沒有書面語
2. 專業正確性：醫療資訊是否正確、有無誤導
3. 教學結構：課程結構是否合理、學習曲線是否順暢
4. 案例實用性：情境模擬是否寫實、是否能直接應用
5. 字數節奏：每個 segment 的時長是否合理
6. 視覺指示：visual_notes 是否足夠清楚讓影片製作執行
7. 測驗品質：題目是否有鑑別度、是否對應課程內容

### 輸出規則
- 嚴格以 JSON 格式輸出
- issues 陣列中每個問題都要有 revised_text（修正版本）
- verdict 判斷必須嚴格遵循評分標準
- 不要加任何說明文字`;

export { QUALITY_CHECK_SYSTEM_PROMPT };

/**
 * Call Claude API to quality-check a lesson script.
 * Returns a validated QualityReport.
 */
export async function checkQuality(
  lesson: LessonScript,
  maxRetries = 3
): Promise<QualityReport> {
  const client = new Anthropic();
  const lessonJson = JSON.stringify(lesson, null, 2);

  const userPrompt = `請審查以下講稿並給出評分與修改建議。

講稿內容：
${lessonJson}

請以 JSON 格式輸出：
{
  "lesson_id": "${lesson.lesson_id}",
  "overall_score": 0-100,
  "scores": {
    "口語自然度": 1-10,
    "專業正確性": 1-10,
    "教學結構": 1-10,
    "案例實用性": 1-10,
    "字數節奏": 1-10,
    "視覺指示": 1-10,
    "測驗品質": 1-10
  },
  "issues": [
    {
      "severity": "high|medium|low",
      "segment_id": "seg-XX",
      "issue": "問題描述",
      "original_text": "有問題的原文",
      "suggestion": "修改建議",
      "revised_text": "修改後的版本"
    }
  ],
  "general_feedback": "整體回饋（100字內）",
  "verdict": "approved|revision_needed|rejected"
}

verdict 判斷標準：
- "approved"：overall_score >= 80 且無 high severity issue
- "revision_needed"：overall_score >= 60 或有 high severity issue
- "rejected"：overall_score < 60

請只輸出 JSON。`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 4096,
        system: QUALITY_CHECK_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const parsed = safeParseJSON<QualityReport>(text);
      if (!parsed) {
        throw new Error('Failed to parse JSON response');
      }
      const validated = QualityReportSchema.parse(parsed);

      console.log(`✅ ${lesson.lesson_id} quality check done — score: ${validated.overall_score}, verdict: ${validated.verdict}`);
      return validated;
    } catch (error) {
      console.error(`❌ ${lesson.lesson_id} quality check attempt ${attempt} failed:`, error instanceof Error ? error.message : error);
      if (attempt === maxRetries) {
        throw new Error(`Quality check failed after ${maxRetries} attempts: ${error}`);
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  throw new Error('unreachable');
}
