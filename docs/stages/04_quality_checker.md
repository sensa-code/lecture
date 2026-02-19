---
prompt_id: "04-quality-checker"
version: "3.0"
estimated_tokens: ~2,500
output_format: JSON
dependencies: ["02_lesson_script_generator"]
tech_stack: [Claude API, TypeScript, Zod]
expert_review: "F-3 修復（sampling 機制）+ F-18 修復（applyFixes 為 SSOT）"
---

# Prompt #4：講稿品質檢查器

## 使用方式
將步驟 2 生成的講稿 JSON 作為輸入。
Claude 會以嚴格審核者角色評分並輸出具體修改建議。
支援自動修正低嚴重度問題並重新檢查的迴圈。

> **變更紀錄 v3.0**（專家審查 F-3 + F-18）：
> - 新增 sampling 機制：每 N 堂強制 1 堂進入 `manual_review` 狀態（防止 AI 審 AI 盲點）
> - `applyFixes()` 為唯一的自動修正實作（SSOT），07 批量腳本必須 import 此函數
> - 禁止在序列化 JSON 字串上做全域替換，必須在 segment 物件層級操作

---

## System Prompt

```
你是一位嚴格的課程品質審核專家，同時具備獸醫臨床背景。
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
- 不要加任何說明文字
```

## User Prompt Builder

```
請審查以下講稿並給出評分與修改建議。

講稿內容：
{lesson_json}

請以 JSON 格式輸出：
{
  "lesson_id": "被審查的 lesson_id",
  "overall_score": 85,
  "scores": {
    "口語自然度": 8,
    "專業正確性": 9,
    "教學結構": 8,
    "案例實用性": 7,
    "字數節奏": 8,
    "視覺指示": 6,
    "測驗品質": 7
  },
  "issues": [
    {
      "severity": "high",
      "segment_id": "seg-03",
      "issue": "問題描述",
      "original_text": "有問題的原文（節錄）",
      "suggestion": "具體修改建議",
      "revised_text": "修改後的版本"
    }
  ],
  "general_feedback": "整體回饋（100字內）",
  "verdict": "approved"
}

verdict 判斷標準：
- "approved"：overall_score >= 80 且無 high severity issue
- "revision_needed"：overall_score >= 60 或有 high severity issue
- "rejected"：overall_score < 60

請只輸出 JSON。
```

---

## TypeScript 類型定義

```typescript
// types/quality.ts

export type Severity = 'high' | 'medium' | 'low';
export type Verdict = 'approved' | 'revision_needed' | 'rejected';

export interface ScoreBreakdown {
  口語自然度: number;
  專業正確性: number;
  教學結構: number;
  案例實用性: number;
  字數節奏: number;
  視覺指示: number;
  測驗品質: number;
}

export interface QualityIssue {
  severity: Severity;
  segment_id: string;
  issue: string;
  original_text: string;
  suggestion: string;
  revised_text: string;
}

export interface QualityReport {
  lesson_id: string;
  overall_score: number;
  scores: ScoreBreakdown;
  issues: QualityIssue[];
  general_feedback: string;
  verdict: Verdict;
}
```

## Zod Schema 驗證

```typescript
// schemas/quality.ts
import { z } from 'zod';

const ScoreSchema = z.number().min(1).max(10).int();

const IssueSchema = z.object({
  severity: z.enum(['high', 'medium', 'low']),
  segment_id: z.string().regex(/^seg-\d{2}$/),
  issue: z.string().min(5),
  original_text: z.string().min(5),
  suggestion: z.string().min(5),
  revised_text: z.string().min(5),
});

export const QualityReportSchema = z.object({
  lesson_id: z.string().regex(/^lesson-\d{2}-\d{2}$/),
  overall_score: z.number().min(0).max(100),
  scores: z.object({
    口語自然度: ScoreSchema,
    專業正確性: ScoreSchema,
    教學結構: ScoreSchema,
    案例實用性: ScoreSchema,
    字數節奏: ScoreSchema,
    視覺指示: ScoreSchema,
    測驗品質: ScoreSchema,
  }),
  issues: z.array(IssueSchema),
  general_feedback: z.string().max(150),
  verdict: z.enum(['approved', 'revision_needed', 'rejected']),
}).refine(
  (data) => {
    const hasHighIssue = data.issues.some(i => i.severity === 'high');
    if (data.verdict === 'approved') {
      return data.overall_score >= 80 && !hasHighIssue;
    }
    return true;
  },
  { message: 'approved 必須 overall_score >= 80 且無 high severity issue' }
).refine(
  (data) => {
    if (data.verdict === 'rejected') {
      return data.overall_score < 60;
    }
    return true;
  },
  { message: 'rejected 必須 overall_score < 60' }
);

export type QualityReport = z.infer<typeof QualityReportSchema>;
```

## 評分與 Verdict 計算邏輯

```typescript
// lib/quality-utils.ts
import type { ScoreBreakdown, Verdict, QualityIssue } from '../types/quality';

/** 從七項分數計算 overall_score（加權平均） */
export function calculateOverallScore(scores: ScoreBreakdown): number {
  const weights = {
    口語自然度: 20,
    專業正確性: 20,
    教學結構: 15,
    案例實用性: 15,
    字數節奏: 10,
    視覺指示: 10,
    測驗品質: 10,
  };

  let weightedSum = 0;
  let totalWeight = 0;

  for (const [key, weight] of Object.entries(weights)) {
    const score = scores[key as keyof ScoreBreakdown];
    weightedSum += score * weight;
    totalWeight += weight;
  }

  return Math.round((weightedSum / totalWeight) * 10);
}

/** 根據分數和問題嚴重度判斷 verdict */
export function determineVerdict(
  overallScore: number,
  issues: QualityIssue[]
): Verdict {
  const hasHighIssue = issues.some(i => i.severity === 'high');

  if (overallScore < 60) return 'rejected';
  if (overallScore >= 80 && !hasHighIssue) return 'approved';
  return 'revision_needed';
}
```

## 自動修正迴圈

```typescript
// lib/auto-fix.ts
import type { LessonScript } from '../types/lesson';
import type { QualityReport } from '../types/quality';

/**
 * 自動修正 low/medium severity 問題
 * 將 revised_text 替換回原始講稿中對應的 segment
 *
 * ⚠️ SSOT（F-18 修復）：此函數為唯一的自動修正實作。
 * 07 batch script 必須 import 此函數，禁止在序列化 JSON 字串上做全域替換。
 * 正確做法：在 segment 物件層級操作 script_zh 屬性。
 * 錯誤做法：JSON.stringify → String.replace → JSON.parse（會因中文引號破壞 JSON 結構）
 */
export function applyFixes(
  lesson: LessonScript,
  report: QualityReport
): { fixed: LessonScript; appliedCount: number; remainingHighIssues: number } {
  let appliedCount = 0;
  const fixedLesson = structuredClone(lesson);

  for (const issue of report.issues) {
    if (issue.severity === 'high') continue; // high severity 留給人工

    const segment = fixedLesson.segments.find(s => s.segment_id === issue.segment_id);
    if (segment && segment.script_zh.includes(issue.original_text)) {
      segment.script_zh = segment.script_zh.replace(issue.original_text, issue.revised_text);
      appliedCount++;
    }
  }

  const remainingHighIssues = report.issues.filter(i => i.severity === 'high').length;

  return { fixed: fixedLesson, appliedCount, remainingHighIssues };
}

/**
 * 完整的品質檢查 + 自動修正迴圈
 * 最多修正 2 輪，之後交給人工
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
    console.log(`🔍 品質檢查第 ${round} 輪...`);
    report = await checkFn(currentLesson);

    console.log(`   分數: ${report.overall_score}, verdict: ${report.verdict}`);
    console.log(`   issues: ${report.issues.length} (high: ${report.issues.filter(i => i.severity === 'high').length})`);

    if (report.verdict === 'approved') {
      console.log(`✅ 通過品質檢查`);
      break;
    }

    if (report.verdict === 'rejected') {
      console.log(`❌ 品質太差，需要重新生成`);
      break;
    }

    // revision_needed → 嘗試自動修正
    const { fixed, appliedCount, remainingHighIssues } = applyFixes(currentLesson, report);
    console.log(`   自動修正了 ${appliedCount} 個問題，剩餘 ${remainingHighIssues} 個 high severity 待人工處理`);

    if (appliedCount === 0) {
      console.log(`⚠️ 無法自動修正，需要人工介入`);
      break;
    }

    currentLesson = fixed;
  } while (round < maxRounds);

  return { finalLesson: currentLesson, finalReport: report, rounds: round };
}

/**
 * Sampling 機制：防止 AI 審 AI 的系統性盲點（F-3 修復）
 *
 * 每 N 堂課強制 1 堂進入 manual_review 狀態，即使 AI 品質檢查通過。
 * 這確保了人工審核者可以定期校準 AI 的品質標準。
 *
 * @param lessonIndex - 當前課程在批次中的索引（從 0 開始）
 * @param sampleRate - 每幾堂抽樣 1 堂（預設 5）
 * @returns 是否應強制進入 manual_review
 */
export function shouldForceManualReview(
  lessonIndex: number,
  sampleRate = 5
): boolean {
  // 每 sampleRate 堂課強制抽樣 1 堂
  // 例如 sampleRate=5 時，index 0,5,10,15... 會被抽中
  return lessonIndex % sampleRate === 0;
}

/**
 * 帶 sampling 機制的品質檢查包裝函數
 * 即使 AI 判定 approved，若命中 sampling 則強制改為 manual_review
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
    console.log(`🔎 Sampling 機制觸發：${lesson.lesson_id} 強制進入 manual_review`);
    result.finalReport = {
      ...result.finalReport,
      verdict: 'revision_needed' as const,
      general_feedback: `[SAMPLING] ${result.finalReport.general_feedback} （本堂課被 sampling 機制抽中，需人工審核確認品質）`,
    };
  }

  return { ...result, forcedManualReview };
}
```

## 完整品質報告 JSON 範例

```json
{
  "lesson_id": "lesson-01-03",
  "overall_score": 76,
  "scores": {
    "口語自然度": 7,
    "專業正確性": 9,
    "教學結構": 8,
    "案例實用性": 8,
    "字數節奏": 7,
    "視覺指示": 6,
    "測驗品質": 7
  },
  "issues": [
    {
      "severity": "high",
      "segment_id": "seg-02",
      "issue": "使用了過多書面語，如「透過」「進行」「實施」，不像真人口語",
      "original_text": "透過選項式溝通的方式，我們可以有效地進行費用說明的實施",
      "suggestion": "改為口語化表達，用「用」「做」「來」等日常用詞",
      "revised_text": "用選項式溝通這個方法，我們可以更自然地跟飼主談費用"
    },
    {
      "severity": "medium",
      "segment_id": "seg-05",
      "issue": "slide_content 的 bullets 太冗長，不適合簡報顯示",
      "original_text": "步驟 1：在進行任何檢查之前，主動且明確地告知飼主預計的費用範圍",
      "suggestion": "簡報重點每條控制在 15 字以內",
      "revised_text": "步驟 1：檢查前主動告知費用範圍"
    },
    {
      "severity": "low",
      "segment_id": "seg-04",
      "issue": "duration_seconds 偏低，以文字量來看應該更長",
      "original_text": "duration_seconds: 45",
      "suggestion": "依文字量重新計算（約 230 字 / 3.5 = 66 秒）",
      "revised_text": "duration_seconds: 66"
    }
  ],
  "general_feedback": "整體教學結構清晰，案例寫實度高。主要問題在口語自然度——多處仍帶有書面語感，需逐段修改為更自然的說話風格。視覺指示也需加強，目前的 visual_notes 不夠具體。",
  "verdict": "revision_needed"
}
```

---

## 測試要求

```typescript
// tests/quality.test.ts
import { describe, it, expect } from 'vitest';
import { QualityReportSchema } from '../schemas/quality';
import { calculateOverallScore, determineVerdict } from '../lib/quality-utils';
import { applyFixes } from '../lib/auto-fix';

describe('calculateOverallScore', () => {
  it('calculates weighted average correctly', () => {
    const scores = {
      口語自然度: 8, 專業正確性: 9, 教學結構: 8,
      案例實用性: 7, 字數節奏: 8, 視覺指示: 6, 測驗品質: 7,
    };
    const result = calculateOverallScore(scores);
    expect(result).toBeGreaterThan(70);
    expect(result).toBeLessThan(85);
  });

  it('returns 100 for all perfect scores', () => {
    const scores = {
      口語自然度: 10, 專業正確性: 10, 教學結構: 10,
      案例實用性: 10, 字數節奏: 10, 視覺指示: 10, 測驗品質: 10,
    };
    expect(calculateOverallScore(scores)).toBe(100);
  });
});

describe('determineVerdict', () => {
  it('returns approved when score >= 80 and no high issues', () => {
    expect(determineVerdict(85, [])).toBe('approved');
  });

  it('returns revision_needed when score >= 80 but has high issue', () => {
    const issues = [{ severity: 'high' as const, segment_id: 'seg-01', issue: '', original_text: '', suggestion: '', revised_text: '' }];
    expect(determineVerdict(85, issues)).toBe('revision_needed');
  });

  it('returns rejected when score < 60', () => {
    expect(determineVerdict(55, [])).toBe('rejected');
  });
});

describe('applyFixes', () => {
  it('applies low/medium fixes but skips high severity', () => {
    // 驗證只修正低嚴重度問題
  });

  it('returns 0 appliedCount when no matching text found', () => {
    // 驗證找不到原文時不會錯誤修改
  });

  it('operates on segment objects, not serialized JSON strings', () => {
    // F-18 驗證：確認修正是在 segment.script_zh 層級操作
    // 而非 JSON.stringify → replace → JSON.parse
  });
});

describe('shouldForceManualReview (F-3 sampling)', () => {
  it('returns true for index 0 with sampleRate 5', () => {
    expect(shouldForceManualReview(0, 5)).toBe(true);
  });

  it('returns false for index 1-4 with sampleRate 5', () => {
    expect(shouldForceManualReview(1, 5)).toBe(false);
    expect(shouldForceManualReview(4, 5)).toBe(false);
  });

  it('returns true for index 5 with sampleRate 5', () => {
    expect(shouldForceManualReview(5, 5)).toBe(true);
  });
});
```

---

## 6 階段執行計畫

### Phase 1: Schema 定義
- [ ] 建立 `types/quality.ts`
- [ ] 建立 `schemas/quality.ts`（含 verdict 一致性驗證）

### Phase 2: 評分邏輯
- [ ] 建立 `lib/quality-utils.ts`
- [ ] 實作 `calculateOverallScore()`（加權平均）
- [ ] 實作 `determineVerdict()`

### Phase 3: 自動修正
- [ ] 建立 `lib/auto-fix.ts`
- [ ] 實作 `applyFixes()`（替換 revised_text）
- [ ] 實作 `qualityCheckLoop()`（最多 2 輪自動修正）

### Phase 4: API 呼叫
- [ ] 建立 `lib/check-quality.ts`
- [ ] 將講稿 JSON 嵌入 user prompt
- [ ] 含 retry + Zod 驗證

### Phase 5: 測試
- [ ] 評分計算測試
- [ ] Verdict 判斷測試
- [ ] 自動修正測試
- [ ] Schema 驗證測試
- [ ] 覆蓋率 >= 70%

### Phase 6: 驗證
- [ ] 用步驟 2 的範例輸出做一次品質檢查
- [ ] 確認修正迴圈正常運作
- [ ] 確認 verdict 判斷邏輯正確

---

## 品質檢查清單

- [ ] 7 項分數各 1-10 分
- [ ] overall_score 為加權平均 × 10
- [ ] verdict 與 score + severity 一致
- [ ] 每個 issue 都有 revised_text
- [ ] high severity issue 不被自動修正
- [ ] 修正迴圈最多 2 輪
- [ ] rejected 的講稿應重新生成（不是修正）

---

## 輸出後的下一步
- verdict = "approved" → 講稿進入影片生成階段（步驟 6）
- verdict = "revision_needed" → 自動修正後重新檢查，或交人工審核
- verdict = "rejected" → 用步驟 2 重新生成該堂講稿
