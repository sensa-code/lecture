---
prompt_id: "01-syllabus-generator"
version: "3.0"
estimated_tokens: ~3,000
output_format: JSON
dependencies: ["00_knowledge_deep_dive"]
tech_stack: [Claude API, TypeScript, Zod]
expert_review: "F-9 修復（Bloom's Taxonomy）+ F-29 整合（知識深挖輸入）"
---

# Prompt #1：課程大綱生成器

## 使用方式
將步驟 0 的知識深挖輸出（`knowledge-base.json`）作為輸入。
Claude 會根據結構化知識庫設計完整的課程大綱，包含 Bloom's Taxonomy 學習目標分層。
輸出為經過 schema 驗證的 JSON 格式課程大綱。

> **變更紀錄 v3.0**（專家審查 F-9 + F-29）：
> - 新增 `knowledge-base.json` 作為必要輸入（不再憑空生成大綱）
> - 學習目標嵌入 Bloom's Taxonomy 認知層級動詞
> - 新增 `learning_objectives` 欄位，每條標註認知層級

---

## System Prompt

```
你是一位專業的獸醫師線上課程設計專家。你的任務是根據已完成的知識深挖報告，設計完整的課程大綱。

### 角色設定
- 你有 15 年小動物臨床經驗
- 你同時是獸醫教育專家，熟悉 Bloom's Taxonomy 認知層級分類
- 你熟悉線上課程的教學設計原則

### 設計原則
1. 從基礎到進階的學習曲線（依循 Bloom's Taxonomy 認知層級遞進）
2. 每堂課 10~15 分鐘
3. 每堂課至少包含一個臨床情境模擬
4. 理論與實務案例交替安排
5. 最後一章應為「特殊情境處理」
6. 學習目標必須使用 Bloom's Taxonomy 動詞（記憶、理解、應用、分析、評估、創造）
7. 前半課程以「理解」「應用」為主，後半課程提升至「分析」「評估」

### Bloom's Taxonomy 認知層級參考
- L1 記憶（Remember）：列舉、辨識、描述
- L2 理解（Understand）：解釋、比較、歸納
- L3 應用（Apply）：運用、示範、執行
- L4 分析（Analyze）：區分、比較、歸因
- L5 評估（Evaluate）：判斷、評價、選擇
- L6 創造（Create）：設計、規劃、建構

### 輸出規則
- 嚴格以 JSON 格式輸出
- 不要加任何說明文字、markdown 標記或程式碼區塊標記
- 直接輸出純 JSON
- 每堂課的 learning_objectives 必須標註 Bloom's Taxonomy 層級
```

## User Prompt

```
請根據以下知識深挖報告，為線上課程設計完整的課程大綱。

## 知識深挖報告（Stage 00 輸出）
{knowledge_base_json}

## 課程基本資訊
課程名稱：《{course_name}》
目標受眾：{target_audience}
核心價值：{core_value}
每堂課 10~15 分鐘

請以 JSON 格式輸出，結構如下：
{
  "course_title": "{course_name}",
  "target_audience": "{target_audience}",
  "total_chapters": N,
  "total_lessons": N,
  "estimated_total_hours": N,
  "knowledge_dimensions_used": ["dim-01", "dim-02", ...],
  "chapters": [
    {
      "chapter_id": "ch-01",
      "title": "章節標題",
      "description": "章節描述（50字內）",
      "knowledge_dimensions": ["dim-01"],
      "lessons": [
        {
          "lesson_id": "lesson-01-01",
          "title": "課程標題",
          "key_topics": ["主題1", "主題2"],
          "learning_objectives": [
            {
              "objective": "學習目標描述",
              "bloom_level": "L3",
              "bloom_verb": "應用"
            }
          ],
          "duration_target_minutes": 12,
          "case_scenario": "簡述這堂課會用到的案例情境"
        }
      ]
    }
  ]
}

要求：
1. 設計 6~8 章，每章 3~4 堂課，總計 20~30 堂
2. 章節結構必須基於知識深挖報告的 7 個面向，確保知識覆蓋完整
3. 每堂課的 case_scenario 要具體且不重複
4. 每堂課至少 2 個 learning_objectives，必須標註 Bloom's Taxonomy 層級
5. 前半課程（ch-01~ch-03）以 L2~L3 為主，後半課程提升至 L4~L5
6. 請只輸出 JSON，不要加任何說明文字
```

---

## TypeScript 類型定義

```typescript
// types/syllabus.ts

export type BloomLevel = 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6';

export interface LearningObjective {
  objective: string;
  bloom_level: BloomLevel;
  bloom_verb: string;  // 記憶、理解、應用、分析、評估、創造
}

export interface Lesson {
  lesson_id: string;
  title: string;
  key_topics: string[];
  learning_objectives: LearningObjective[];
  duration_target_minutes: number;
  case_scenario: string;
}

export interface Chapter {
  chapter_id: string;
  title: string;
  description: string;
  knowledge_dimensions: string[];  // 對應 dim-01 ~ dim-07
  lessons: Lesson[];
}

export interface Syllabus {
  course_title: string;
  target_audience: string;
  total_chapters: number;
  total_lessons: number;
  estimated_total_hours: number;
  knowledge_dimensions_used: string[];
  chapters: Chapter[];
}
```

## Zod Schema 驗證

```typescript
// schemas/syllabus.ts
import { z } from 'zod';

const BloomLevelSchema = z.enum(['L1', 'L2', 'L3', 'L4', 'L5', 'L6']);

const LearningObjectiveSchema = z.object({
  objective: z.string().min(5),
  bloom_level: BloomLevelSchema,
  bloom_verb: z.string().min(1),
});

const LessonSchema = z.object({
  lesson_id: z.string().regex(/^lesson-\d{2}-\d{2}$/, 'lesson_id 格式必須為 lesson-XX-XX'),
  title: z.string().min(2).max(50),
  key_topics: z.array(z.string().min(1)).min(1).max(5),
  learning_objectives: z.array(LearningObjectiveSchema).min(2).max(5),
  duration_target_minutes: z.number().min(10).max(15),
  case_scenario: z.string().min(10).max(200),
});

const ChapterSchema = z.object({
  chapter_id: z.string().regex(/^ch-\d{2}$/, 'chapter_id 格式必須為 ch-XX'),
  title: z.string().min(2).max(30),
  description: z.string().min(5).max(50),
  knowledge_dimensions: z.array(z.string().regex(/^dim-\d{2}$/)).min(1),
  lessons: z.array(LessonSchema).min(3).max(4),
});

export const SyllabusSchema = z.object({
  course_title: z.string().min(1),
  target_audience: z.string().min(1),
  total_chapters: z.number().min(6).max(8),
  total_lessons: z.number().min(20).max(30),
  estimated_total_hours: z.number().positive(),
  knowledge_dimensions_used: z.array(z.string().regex(/^dim-\d{2}$/)).min(5),
  chapters: z.array(ChapterSchema).min(6).max(8),
}).refine(
  (data) => data.chapters.length === data.total_chapters,
  { message: 'total_chapters 必須等於 chapters 陣列長度' }
).refine(
  (data) => {
    const actualLessons = data.chapters.reduce((sum, ch) => sum + ch.lessons.length, 0);
    return actualLessons === data.total_lessons;
  },
  { message: 'total_lessons 必須等於所有章節的 lessons 總數' }
);

export type Syllabus = z.infer<typeof SyllabusSchema>;
```

## Claude API 呼叫範例

```typescript
// lib/generate-syllabus.ts
import Anthropic from '@anthropic-ai/sdk';
import { SyllabusSchema, type Syllabus } from '../schemas/syllabus';

const SYSTEM_PROMPT = `你是一位專業的獸醫師線上課程設計專家。你的任務是根據已完成的知識深挖報告，設計完整的課程大綱。

### 角色設定
- 你有 15 年小動物臨床經驗
- 你同時是獸醫教育專家，熟悉 Bloom's Taxonomy 認知層級分類
- 你熟悉線上課程的教學設計原則

### 設計原則
1. 從基礎到進階的學習曲線（依循 Bloom's Taxonomy 認知層級遞進）
2. 每堂課 10~15 分鐘
3. 每堂課至少包含一個臨床情境模擬
4. 理論與實務案例交替安排
5. 最後一章應為「特殊情境處理」
6. 學習目標必須使用 Bloom's Taxonomy 動詞（記憶、理解、應用、分析、評估、創造）
7. 前半課程以「理解」「應用」為主，後半課程提升至「分析」「評估」

### Bloom's Taxonomy 認知層級參考
- L1 記憶（Remember）：列舉、辨識、描述
- L2 理解（Understand）：解釋、比較、歸納
- L3 應用（Apply）：運用、示範、執行
- L4 分析（Analyze）：區分、比較、歸因
- L5 評估（Evaluate）：判斷、評價、選擇
- L6 創造（Create）：設計、規劃、建構

### 輸出規則
- 嚴格以 JSON 格式輸出
- 不要加任何說明文字、markdown 標記或程式碼區塊標記
- 直接輸出純 JSON
- 每堂課的 learning_objectives 必須標註 Bloom's Taxonomy 層級`;

export async function generateSyllabus(
  courseName: string,
  targetAudience: string,
  coreValue: string,
  knowledgeBase: import('../types/knowledge-base').KnowledgeBase,
  maxRetries = 3
): Promise<Syllabus> {
  const client = new Anthropic();
  const knowledgeBaseJson = JSON.stringify(knowledgeBase, null, 2);

  const userPrompt = `請根據以下知識深挖報告，為線上課程設計完整的課程大綱。

## 知識深挖報告（Stage 00 輸出）
${knowledgeBaseJson}

## 課程基本資訊
課程名稱：《${courseName}》
目標受眾：${targetAudience}
核心價值：${coreValue}
每堂課 10~15 分鐘

請以 JSON 格式輸出，結構如下：
{
  "course_title": "${courseName}",
  "target_audience": "${targetAudience}",
  "total_chapters": N,
  "total_lessons": N,
  "estimated_total_hours": N,
  "knowledge_dimensions_used": ["dim-01", "dim-02", ...],
  "chapters": [
    {
      "chapter_id": "ch-01",
      "title": "章節標題",
      "description": "章節描述（50字內）",
      "knowledge_dimensions": ["dim-01"],
      "lessons": [
        {
          "lesson_id": "lesson-01-01",
          "title": "課程標題",
          "key_topics": ["主題1", "主題2"],
          "learning_objectives": [
            { "objective": "學習目標", "bloom_level": "L3", "bloom_verb": "應用" }
          ],
          "duration_target_minutes": 12,
          "case_scenario": "簡述這堂課會用到的案例情境"
        }
      ]
    }
  ]
}

要求：
1. 設計 6~8 章，每章 3~4 堂課，總計 20~30 堂
2. 章節結構必須基於知識深挖報告的 7 個面向，確保知識覆蓋完整
3. 每堂課的 case_scenario 要具體且不重複
4. 每堂課至少 2 個 learning_objectives，必須標註 Bloom's Taxonomy 層級
5. 前半課程（ch-01~ch-03）以 L2~L3 為主，後半課程提升至 L4~L5
6. 請只輸出 JSON，不要加任何說明文字`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonStr = text.replace(/^```json?\s*/, '').replace(/\s*```$/, '').trim();
      const parsed = JSON.parse(jsonStr);
      const validated = SyllabusSchema.parse(parsed);

      console.log(`✅ 大綱生成成功（第 ${attempt} 次嘗試）`);
      console.log(`   章節數: ${validated.total_chapters}, 總堂數: ${validated.total_lessons}`);

      return validated;
    } catch (error) {
      console.error(`❌ 第 ${attempt} 次嘗試失敗:`, error instanceof Error ? error.message : error);
      if (attempt === maxRetries) {
        throw new Error(`大綱生成失敗，已重試 ${maxRetries} 次: ${error}`);
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  throw new Error('unreachable');
}
```

## 完整 JSON 輸出範例

以下為一個完整的輸出範例（2 章 7 堂課，實際輸出為 6-8 章 20-30 堂）：

```json
{
  "course_title": "獸醫師溝通話術完全攻略",
  "target_audience": "執業獸醫師、獸醫學生",
  "total_chapters": 2,
  "total_lessons": 7,
  "estimated_total_hours": 1.5,
  "knowledge_dimensions_used": ["dim-01", "dim-02", "dim-03", "dim-04", "dim-05"],
  "chapters": [
    {
      "chapter_id": "ch-01",
      "title": "門診溝通基礎",
      "description": "建立信任感的第一印象溝通技巧",
      "knowledge_dimensions": ["dim-01", "dim-03"],
      "lessons": [
        {
          "lesson_id": "lesson-01-01",
          "title": "初診接待的黃金30秒",
          "key_topics": ["第一印象建立", "自我介紹公式", "飼主焦慮辨識"],
          "learning_objectives": [
            { "objective": "理解初診接待中影響飼主信任的三大因素", "bloom_level": "L2", "bloom_verb": "理解" },
            { "objective": "運用自我介紹公式完成初診接待", "bloom_level": "L3", "bloom_verb": "應用" }
          ],
          "duration_target_minutes": 12,
          "case_scenario": "一位焦急的飼主帶著嘔吐不止的貴賓犬衝進診間，語氣急促且帶有責備"
        },
        {
          "lesson_id": "lesson-01-02",
          "title": "病史詢問的引導技巧",
          "key_topics": ["開放式提問", "病史結構化整理", "避免誘導性問題"],
          "learning_objectives": [
            { "objective": "區分開放式與封閉式提問的適用場景", "bloom_level": "L2", "bloom_verb": "理解" },
            { "objective": "運用結構化方式引導飼主提供完整病史", "bloom_level": "L3", "bloom_verb": "應用" }
          ],
          "duration_target_minutes": 13,
          "case_scenario": "飼主描述症狀時東拉西扯，混合了三隻寵物的狀況，需要耐心引導釐清"
        },
        {
          "lesson_id": "lesson-01-03",
          "title": "檢查費用說明的藝術",
          "key_topics": ["費用透明化話術", "選項式溝通", "避免費用爭議"],
          "learning_objectives": [
            { "objective": "應用選項式溝通框架說明檢查費用", "bloom_level": "L3", "bloom_verb": "應用" },
            { "objective": "評估不同費用溝通策略的優劣", "bloom_level": "L5", "bloom_verb": "評估" }
          ],
          "duration_target_minutes": 11,
          "case_scenario": "飼主聽到血液檢查加影像檢查要價4000元，皺眉說「為什麼這麼貴，其他醫院只要一半」"
        },
        {
          "lesson_id": "lesson-01-04",
          "title": "轉診病患的接手溝通",
          "key_topics": ["前院資訊確認", "不批評前院", "建立新信任"],
          "learning_objectives": [
            { "objective": "分析轉診情境中飼主不信任的根源", "bloom_level": "L4", "bloom_verb": "分析" },
            { "objective": "運用不批評前院原則建立新信任關係", "bloom_level": "L3", "bloom_verb": "應用" }
          ],
          "duration_target_minutes": 12,
          "case_scenario": "飼主帶著一隻從其他醫院轉來的重症貓，對前一位醫師有很多抱怨和不信任"
        }
      ]
    },
    {
      "chapter_id": "ch-02",
      "title": "檢查與診斷溝通",
      "description": "用飼主聽得懂的語言解釋專業檢查結果",
      "knowledge_dimensions": ["dim-02", "dim-04"],
      "lessons": [
        {
          "lesson_id": "lesson-02-01",
          "title": "影像報告的白話解釋",
          "key_topics": ["X光圖像指引", "超音波結果說明", "避免過度專業術語"],
          "learning_objectives": [
            { "objective": "運用白話語言解釋 X 光和超音波檢查結果", "bloom_level": "L3", "bloom_verb": "應用" },
            { "objective": "判斷哪些專業術語需要轉換為飼主能理解的語言", "bloom_level": "L5", "bloom_verb": "評估" }
          ],
          "duration_target_minutes": 14,
          "case_scenario": "X光顯示狗狗心臟明顯增大，飼主完全不懂影像但非常擔心"
        },
        {
          "lesson_id": "lesson-02-02",
          "title": "壞消息的傳達框架",
          "key_topics": ["SPIKES 協議", "情緒緩衝", "留白與等待"],
          "learning_objectives": [
            { "objective": "運用 SPIKES 協議框架傳達壞消息", "bloom_level": "L3", "bloom_verb": "應用" },
            { "objective": "評估飼主情緒狀態並調整溝通節奏", "bloom_level": "L5", "bloom_verb": "評估" }
          ],
          "duration_target_minutes": 13,
          "case_scenario": "血檢報告顯示腎指數嚴重超標，需要告知飼主12歲老貓可能是慢性腎病末期"
        },
        {
          "lesson_id": "lesson-02-03",
          "title": "治療方案的選項式溝通",
          "key_topics": ["三選一框架", "風險收益說明", "避免決策壓力"],
          "learning_objectives": [
            { "objective": "設計三選一治療方案的溝通腳本", "bloom_level": "L6", "bloom_verb": "創造" },
            { "objective": "分析飼主猶豫不決背後的心理因素", "bloom_level": "L4", "bloom_verb": "分析" }
          ],
          "duration_target_minutes": 12,
          "case_scenario": "狗狗膝蓋骨脫位，有保守治療、微創手術、傳統手術三個選項，飼主猶豫不決"
        }
      ]
    }
  ]
}
```

---

## 測試要求

```typescript
// tests/syllabus.test.ts
import { describe, it, expect } from 'vitest';
import { SyllabusSchema } from '../schemas/syllabus';
import sampleOutput from '../output/syllabus.json';

describe('SyllabusSchema', () => {
  it('validates complete syllabus output', () => {
    const result = SyllabusSchema.safeParse(sampleOutput);
    expect(result.success).toBe(true);
  });

  it('rejects syllabus with less than 6 chapters', () => {
    const invalid = { ...sampleOutput, total_chapters: 3, chapters: [] };
    const result = SyllabusSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects lesson_id with wrong format', () => {
    const result = SyllabusSchema.safeParse({
      ...sampleOutput,
      chapters: [{
        ...sampleOutput.chapters[0],
        lessons: [{ ...sampleOutput.chapters[0].lessons[0], lesson_id: 'bad-id' }]
      }]
    });
    expect(result.success).toBe(false);
  });

  it('validates total_lessons matches actual count', () => {
    const totalLessons = sampleOutput.chapters.reduce(
      (sum: number, ch: { lessons: unknown[] }) => sum + ch.lessons.length, 0
    );
    expect(sampleOutput.total_lessons).toBe(totalLessons);
  });

  it('ensures all case_scenarios are unique', () => {
    const scenarios = sampleOutput.chapters.flatMap(
      (ch: { lessons: { case_scenario: string }[] }) => ch.lessons.map(l => l.case_scenario)
    );
    const unique = new Set(scenarios);
    expect(unique.size).toBe(scenarios.length);
  });
});
```

---

## 6 階段執行計畫

### Phase 1: 環境設置
- [ ] `npm init -y && npm install @anthropic-ai/sdk zod`
- [ ] `npm install -D typescript vitest @types/node`
- [ ] 建立 `tsconfig.json`（strict: true）
- [ ] 建立 `.env` 並設定 `ANTHROPIC_API_KEY`
- [ ] 建立資料夾結構：`types/`, `schemas/`, `lib/`, `output/`, `tests/`

### Phase 2: 定義 Schema
- [ ] 建立 `types/syllabus.ts`（TypeScript 介面）
- [ ] 建立 `schemas/syllabus.ts`（Zod schema + refine 驗證）
- [ ] 確認 schema 與 prompt 中的 JSON 結構完全一致

### Phase 3: 實作 API 呼叫
- [ ] 建立 `lib/generate-syllabus.ts`
- [ ] 實作 system prompt + user prompt 組合
- [ ] 實作 JSON parse + Zod validate + retry 邏輯
- [ ] 加入 cost tracking（記錄 input/output tokens）

### Phase 4: CLI 入口
- [ ] 建立 `scripts/generate-syllabus.ts`
- [ ] 支援 `--course-name`, `--output` 參數
- [ ] 支援 `--dry-run` 模式（輸出 prompt 但不呼叫 API）
- [ ] 輸出結果到 `output/syllabus.json`

### Phase 5: 測試
- [ ] 建立 `tests/syllabus.test.ts`
- [ ] Schema 驗證測試（valid + invalid cases）
- [ ] 唯一性測試（case_scenario 不重複）
- [ ] 一致性測試（total_chapters/total_lessons 匹配）
- [ ] 覆蓋率 >= 70%

### Phase 6: 驗證與文檔
- [ ] 實際呼叫 Claude API 生成一份大綱
- [ ] 確認輸出通過 Zod 驗證
- [ ] 人工審核大綱內容的合理性
- [ ] 將驗證後的大綱存為 `output/syllabus.json`

---

## 品質檢查清單

- [ ] System Prompt 包含「嚴格以 JSON 格式輸出」
- [ ] Zod schema 驗證所有必要欄位
- [ ] lesson_id 格式為 `lesson-XX-XX`
- [ ] chapter_id 格式為 `ch-XX`
- [ ] duration_target_minutes 在 10-15 範圍內
- [ ] 每章 3-4 堂課
- [ ] 總計 6-8 章、20-30 堂
- [ ] 所有 case_scenario 不重複
- [ ] retry 邏輯在 JSON parse 或 Zod 驗證失敗時觸發
- [ ] 有 cost tracking

---

## 輸出後的下一步
1. 人工審核大綱，調整章節順序和內容
2. 確認後，將每個 lesson 的資訊帶入 `02_lesson_script_generator.md` 逐堂生成講稿
