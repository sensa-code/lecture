---
prompt_id: "02-lesson-script-generator"
version: "3.0"
estimated_tokens: ~3,000
output_format: JSON
dependencies: ["01_syllabus_generator"]
tech_stack: [Claude API, TypeScript, Zod]
expert_review: "F-2 修復（schema SSOT）+ F-4 修復（完整 System Prompt 為唯一來源）"
---

# Prompt #2：單堂課講稿生成器

## 使用方式
將步驟 1 的大綱中，每堂課的資訊作為參數輸入。
Claude 會生成包含 5-8 個 segment 的完整講稿 JSON，每個 segment 都是可直接唸出來的自然口語。

> **變更紀錄 v3.0**（專家審查 F-2 + F-4）：
> - 所有型別和 Zod schema 統一為 SSOT（Single Source of Truth），07 批量腳本直接 import 本檔的定義
> - System Prompt 為唯一版本，07 不得自行定義精簡版
> - 新增 `LessonInfo` 中的 `learning_objectives` 欄位（對接 01 的 Bloom's Taxonomy）

---

## System Prompt

```
你是一位專業的獸醫師線上課程撰稿專家。你的任務是將專業知識轉化為結構化的課程講稿。

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
8. duration_seconds 依 script 字數估算（中文約每秒 3~4 個字）
```

## User Prompt Builder

以下為動態組合的 User Prompt，placeholder 由程式自動替換：

```
請為以下課程資訊撰寫完整的單堂課講稿。

課程資訊：
- course_id: "vet-comm-001"
- lesson_id: "{lesson_id}"
- 課程標題: "{title}"
- 重點主題: {key_topics}
- 目標時長: {duration_target_minutes} 分鐘
- 案例情境: "{case_scenario}"

請以以下 JSON 格式輸出：
{
  "course_id": "vet-comm-001",
  "lesson_id": "{lesson_id}",
  "title": "{title}",
  "duration_target_minutes": {duration_target_minutes},
  "segments": [
    {
      "segment_id": "seg-01",
      "type": "opening",
      "speaker_mode": "avatar",
      "visual_type": "talking_head",
      "script_zh": "各位獸醫師大家好，今天我們要談...",
      "key_points": [],
      "slide_content": null,
      "visual_notes": "顯示講師數位人半身，背景為診間",
      "duration_seconds": 45
    }
  ],
  "quiz": [
    {
      "question": "題目",
      "options": ["A. ...", "B. ...", "C. ..."],
      "answer": "B",
      "explanation": "解釋"
    }
  ],
  "metadata": {
    "topic": "veterinary_communication",
    "chapter": "{chapter_id}",
    "difficulty": "intermediate",
    "generated_at": "ISO時間"
  }
}

segment type 說明：
- opening: 開場白，用 talking_head
- teaching: 教學內容，可用 talking_head 或 slides
- case: 案例模擬，用 talking_head
- summary: 總結，用 talking_head

visual_type 說明：
- talking_head: 數位人說話畫面
- slides: 簡報動畫畫面（此時需提供 slide_content）

slide_content 格式（僅 visual_type 為 slides 時提供）：
{
  "title": "簡報標題",
  "bullets": ["重點1", "重點2", "重點3"],
  "animation": "fade_in_sequence"
}

請只輸出 JSON，不要加任何說明文字。
```

---

## TypeScript 類型定義

```typescript
// types/lesson.ts

export interface SlideContent {
  title: string;
  bullets: string[];
  animation: 'fade_in_sequence' | 'slide_in_left' | 'none';
}

export interface Segment {
  segment_id: string;
  type: 'opening' | 'teaching' | 'case' | 'summary';
  speaker_mode: 'avatar' | 'voiceover';
  visual_type: 'talking_head' | 'slides';
  script_zh: string;
  key_points: string[];
  slide_content: SlideContent | null;
  visual_notes: string;
  duration_seconds: number;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  answer: string;
  explanation: string;
}

export interface LessonMetadata {
  topic: string;
  chapter: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  generated_at: string;
}

export interface LessonScript {
  course_id: string;
  lesson_id: string;
  title: string;
  duration_target_minutes: number;
  segments: Segment[];
  quiz: QuizQuestion[];
  metadata: LessonMetadata;
}

// 從 01 大綱中提取的單堂課資訊（作為本 prompt 的輸入）
// ⚠️ 此型別為 SSOT，07 batch script 必須 import 此定義
export interface LessonInfo {
  lesson_id: string;
  title: string;
  key_topics: string[];
  learning_objectives: import('../types/syllabus').LearningObjective[];
  duration_target_minutes: number;
  case_scenario: string;
  chapter_id: string;
}
```

## Zod Schema 驗證

```typescript
// schemas/lesson.ts
import { z } from 'zod';

const SlideContentSchema = z.object({
  title: z.string().min(1),
  bullets: z.array(z.string().min(1)).min(2).max(5),
  animation: z.enum(['fade_in_sequence', 'slide_in_left', 'none']),
});

const SegmentSchema = z.object({
  segment_id: z.string().regex(/^seg-\d{2}$/),
  type: z.enum(['opening', 'teaching', 'case', 'summary']),
  speaker_mode: z.enum(['avatar', 'voiceover']),
  visual_type: z.enum(['talking_head', 'slides']),
  script_zh: z.string().min(30, '講稿至少 30 字'),
  key_points: z.array(z.string()),
  slide_content: SlideContentSchema.nullable(),
  visual_notes: z.string().min(5),
  duration_seconds: z.number().min(15).max(300),
});

const QuizSchema = z.object({
  question: z.string().min(5),
  options: z.array(z.string()).min(3).max(4),
  answer: z.string().min(1).max(1),
  explanation: z.string().min(10),
});

export const LessonScriptSchema = z.object({
  course_id: z.string(),
  lesson_id: z.string().regex(/^lesson-\d{2}-\d{2}$/),
  title: z.string().min(2),
  duration_target_minutes: z.number().min(10).max(15),
  segments: z.array(SegmentSchema).min(5).max(8),
  quiz: z.array(QuizSchema).min(2).max(3),
  metadata: z.object({
    topic: z.string(),
    chapter: z.string().regex(/^ch-\d{2}$/),
    difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
    generated_at: z.string(),
  }),
}).refine(
  (data) => data.segments.filter(s => s.type === 'opening').length === 1,
  { message: '必須恰好有 1 個 opening segment' }
).refine(
  (data) => data.segments.filter(s => s.type === 'summary').length === 1,
  { message: '必須恰好有 1 個 summary segment' }
).refine(
  (data) => data.segments.filter(s => s.type === 'case').length >= 1,
  { message: '必須至少有 1 個 case segment' }
).refine(
  (data) => data.segments.every(s =>
    s.visual_type !== 'slides' || s.slide_content !== null
  ),
  { message: 'visual_type 為 slides 時，slide_content 不可為 null' }
);

export type LessonScript = z.infer<typeof LessonScriptSchema>;
```

## Prompt Builder 函數

```typescript
// lib/build-lesson-prompt.ts
import type { LessonInfo } from '../types/lesson';

export function buildLessonUserPrompt(info: LessonInfo): string {
  return `請為以下課程資訊撰寫完整的單堂課講稿。

課程資訊：
- course_id: "vet-comm-001"
- lesson_id: "${info.lesson_id}"
- 課程標題: "${info.title}"
- 重點主題: ${JSON.stringify(info.key_topics)}
- 目標時長: ${info.duration_target_minutes} 分鐘
- 案例情境: "${info.case_scenario}"

請以 JSON 格式輸出，結構包含：
- course_id, lesson_id, title, duration_target_minutes
- segments 陣列（5~8 個，含 opening/teaching/case/summary）
- quiz 陣列（2~3 題）
- metadata（topic, chapter: "${info.chapter_id}", difficulty, generated_at）

每個 segment 需包含：segment_id (seg-01 格式), type, speaker_mode, visual_type, script_zh, key_points, slide_content, visual_notes, duration_seconds

script_zh 必須是自然口語，像真人在講課。duration_seconds 按每秒 3~4 個中文字估算。

請只輸出 JSON。`;
}

/** 估算中文文字的朗讀秒數（每秒 3.5 字） */
export function estimateDuration(scriptZh: string): number {
  const charCount = scriptZh.replace(/\s/g, '').length;
  return Math.round(charCount / 3.5);
}
```

## 完整 JSON 輸出範例

```json
{
  "course_id": "vet-comm-001",
  "lesson_id": "lesson-01-03",
  "title": "檢查費用說明的藝術",
  "duration_target_minutes": 11,
  "segments": [
    {
      "segment_id": "seg-01",
      "type": "opening",
      "speaker_mode": "avatar",
      "visual_type": "talking_head",
      "script_zh": "各位獸醫師大家好，我是林醫師。今天我們要來聊一個每天在診間都會遇到，但很多人覺得很尷尬的話題——就是怎麼跟飼主解釋檢查費用。你有沒有遇過那種，飼主一聽到費用就皺眉頭，然後說『為什麼這麼貴』的情況？今天我就來教大家一個很好用的溝通框架。",
      "key_points": ["費用溝通的重要性", "常見的飼主反應"],
      "slide_content": null,
      "visual_notes": "講師數位人半身，背景為明亮的診間環境，表情親切自然",
      "duration_seconds": 42
    },
    {
      "segment_id": "seg-02",
      "type": "teaching",
      "speaker_mode": "avatar",
      "visual_type": "slides",
      "script_zh": "首先我們來看一個概念，叫做「選項式溝通」。很多醫師在報價的時候，會直接說『血檢加影像檢查，總共四千塊』。這樣講其實就是把飼主推到一個只能說好或不好的死角。比較好的做法是，你給飼主兩到三個選項。比如說，你可以這樣講：『王先生，根據毛毛目前的狀況，我建議我們做幾項檢查。第一個方案是比較完整的，包含血液檢查和超音波，大概四千元。第二個方案是先做基礎血檢，兩千元，如果有需要我們再加做。您覺得哪個方案比較適合？』",
      "key_points": ["選項式溝通 vs 單一報價", "給飼主選擇的空間"],
      "slide_content": {
        "title": "選項式溝通框架",
        "bullets": [
          "方案 A：完整檢查（血檢 + 影像）",
          "方案 B：基礎檢查（先血檢，有需要再加）",
          "讓飼主主動選擇，降低抗拒感"
        ],
        "animation": "fade_in_sequence"
      },
      "visual_notes": "簡報畫面，左側顯示方案 A 和方案 B 的比較表格，右上角有金額標示",
      "duration_seconds": 58
    },
    {
      "segment_id": "seg-03",
      "type": "teaching",
      "speaker_mode": "avatar",
      "visual_type": "talking_head",
      "script_zh": "第二個技巧叫做「先說價值，再說價格」。很多時候飼主覺得貴，不是因為真的太貴，而是他不理解為什麼要做這些檢查。所以你在報價之前，先花三十秒解釋這個檢查可以幫他的寵物發現什麼問題。比如說：『超音波可以讓我們直接看到肝臟和腎臟的結構，有些問題光靠血檢是看不出來的，提早發現才能提早處理。』當飼主理解了價值，他對價格的接受度就會高很多。",
      "key_points": ["價值優先於價格", "30 秒價值說明公式"],
      "slide_content": null,
      "visual_notes": "講師說到「價值」時，語氣加重，配合手勢強調",
      "duration_seconds": 52
    },
    {
      "segment_id": "seg-04",
      "type": "case",
      "speaker_mode": "avatar",
      "visual_type": "talking_head",
      "script_zh": "好，我們現在來模擬一個情境。今天有一位陳太太帶著她的貴賓犬來看診，檢查後你建議做血檢加影像。陳太太聽完皺了眉頭，說：『醫生，我上次在別家醫院做差不多的檢查，才兩千塊，你們怎麼要四千？』這時候你會怎麼回應？很多人第一反應可能是解釋自己的收費標準，或者是說別家醫院的檢查項目不一樣。但其實更好的做法是先認同她的感受：『陳太太，我完全理解您的擔心，費用確實是很重要的考量。讓我跟您說明一下我們這邊的檢查具體包含哪些項目，這樣您可以比較看看。』你看，這樣回應的重點是：第一，不批評其他醫院；第二，先同理再說明；第三，讓飼主自己做比較和判斷。",
      "key_points": ["不批評同業", "先同理再說明", "讓飼主自主判斷"],
      "slide_content": null,
      "visual_notes": "情境模擬，講師表情從嚴肅轉為溫和，示範溝通語調的轉變",
      "duration_seconds": 65
    },
    {
      "segment_id": "seg-05",
      "type": "teaching",
      "speaker_mode": "avatar",
      "visual_type": "slides",
      "script_zh": "最後我教大家一個很實用的技巧，叫做「費用預告制」。就是在做任何檢查之前，一定要先告知費用。不要讓飼主在結帳的時候才嚇到。你可以在診間裡放一張常見檢查的費用參考表，這樣飼主在等待的時候就可以先有心理準備。另外，如果檢查過程中發現需要追加項目，一定要先打電話跟飼主確認，拿到口頭同意才做。這個不只是溝通技巧，也是法律上保護自己的重要步驟。",
      "key_points": ["費用預告制", "常見檢查費用表", "追加項目需口頭同意"],
      "slide_content": {
        "title": "費用預告制三步驟",
        "bullets": [
          "步驟 1：檢查前主動告知費用範圍",
          "步驟 2：診間張貼常見檢查費用參考表",
          "步驟 3：追加項目一定要先取得口頭同意"
        ],
        "animation": "fade_in_sequence"
      },
      "visual_notes": "簡報畫面顯示三步驟流程圖，每步搭配小圖示",
      "duration_seconds": 50
    },
    {
      "segment_id": "seg-06",
      "type": "summary",
      "speaker_mode": "avatar",
      "visual_type": "talking_head",
      "script_zh": "好的，我們來做一個簡單的總結。今天我們學了三個費用溝通的技巧：第一，用選項式溝通取代單一報價，給飼主選擇的空間；第二，先說價值再說價格，讓飼主理解檢查的必要性；第三，實施費用預告制，避免結帳時的不愉快。記住，費用溝通不是在跟飼主推銷，而是在幫助他做出最適合的決定。我們下堂課見！",
      "key_points": ["三個核心技巧回顧", "溝通的本質是幫助決策"],
      "slide_content": null,
      "visual_notes": "講師微笑收尾，配合手勢做總結動作",
      "duration_seconds": 38
    }
  ],
  "quiz": [
    {
      "question": "當飼主說「別家醫院比較便宜」時，最佳的第一反應是什麼？",
      "options": [
        "A. 解釋自己的收費標準和成本",
        "B. 先同理飼主的擔心，再說明檢查內容讓飼主自行比較",
        "C. 告訴飼主別家醫院的檢查項目可能不同"
      ],
      "answer": "B",
      "explanation": "先同理再說明是最有效的溝通策略。直接解釋收費或批評同業容易引起防禦心理，讓飼主感到被理解後再提供資訊，接受度會更高。"
    },
    {
      "question": "「選項式溝通」的核心概念是什麼？",
      "options": [
        "A. 給飼主最便宜的選項",
        "B. 提供 2-3 個方案讓飼主主動選擇",
        "C. 列出所有可能的檢查項目由飼主勾選"
      ],
      "answer": "B",
      "explanation": "選項式溝通的核心是提供有限但合理的選項（通常 2-3 個），讓飼主有選擇的主導感，避免被推到只能說好或不好的死角。"
    },
    {
      "question": "費用預告制中，如果檢查過程中需要追加項目，應該怎麼做？",
      "options": [
        "A. 先做完再跟飼主說明",
        "B. 先打電話取得飼主口頭同意再做",
        "C. 只追加費用在 500 元以下的項目"
      ],
      "answer": "B",
      "explanation": "追加項目一定要先取得飼主口頭同意。這不只是溝通技巧，更是法律上保護自己的重要步驟，避免事後的費用爭議。"
    }
  ],
  "metadata": {
    "topic": "veterinary_communication",
    "chapter": "ch-01",
    "difficulty": "intermediate",
    "generated_at": "2026-02-19T10:00:00Z"
  }
}
```

---

## 從大綱批次呼叫

```typescript
// lib/generate-lesson.ts
import Anthropic from '@anthropic-ai/sdk';
import { LessonScriptSchema, type LessonScript } from '../schemas/lesson';
import { buildLessonUserPrompt, estimateDuration } from './build-lesson-prompt';
import type { LessonInfo } from '../types/lesson';
import type { Syllabus } from '../types/syllabus';

// ⚠️ SSOT：此 System Prompt 為唯一版本
// 07 batch script 必須 import 此常數，不得自行定義精簡版（F-4 修復）
const SYSTEM_PROMPT = `你是一位專業的獸醫師線上課程撰稿專家...`; // 見上方 System Prompt 完整內容

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
      const jsonStr = text.replace(/^```json?\s*/, '').replace(/\s*```$/, '').trim();
      const parsed = JSON.parse(jsonStr);
      const validated = LessonScriptSchema.parse(parsed);

      // 驗證 duration 合理性
      const totalDuration = validated.segments.reduce((sum, s) => sum + s.duration_seconds, 0);
      const targetSeconds = info.duration_target_minutes * 60;
      if (Math.abs(totalDuration - targetSeconds) > targetSeconds * 0.3) {
        console.warn(`⚠️ ${info.lesson_id} 時長偏差超過 30%: ${totalDuration}s vs 目標 ${targetSeconds}s`);
      }

      console.log(`✅ ${info.lesson_id} 講稿生成成功（${validated.segments.length} segments, ${totalDuration}s）`);
      return validated;
    } catch (error) {
      console.error(`❌ ${info.lesson_id} 第 ${attempt} 次失敗:`, error instanceof Error ? error.message : error);
      if (attempt === maxRetries) throw error;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error('unreachable');
}

/** 從大綱中提取所有 lesson 資訊
 * ⚠️ SSOT：07 batch script 必須 import 此函數（F-2 修復）
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
```

---

## 測試要求

```typescript
// tests/lesson.test.ts
import { describe, it, expect } from 'vitest';
import { LessonScriptSchema } from '../schemas/lesson';
import { buildLessonUserPrompt, estimateDuration } from '../lib/build-lesson-prompt';

describe('LessonScriptSchema', () => {
  it('validates segment type distribution (1 opening, 1 summary, >=1 case)', () => {
    // 使用上方的完整 JSON 範例作為測試資料
  });

  it('rejects slides segment without slide_content', () => {
    // slide_content 為 null 但 visual_type 為 slides 應失敗
  });

  it('validates quiz has 2-3 questions', () => {
    // quiz 陣列長度檢查
  });
});

describe('estimateDuration', () => {
  it('estimates 100 chars as ~29 seconds', () => {
    const script = '這是一段一百個字的測試文字'.repeat(8); // ~96 chars
    const duration = estimateDuration(script);
    expect(duration).toBeGreaterThan(25);
    expect(duration).toBeLessThan(35);
  });
});

describe('buildLessonUserPrompt', () => {
  it('includes all lesson info in the prompt', () => {
    const prompt = buildLessonUserPrompt({
      lesson_id: 'lesson-01-03',
      title: '手術前風險告知',
      key_topics: ['風險告知', '同意書'],
      duration_target_minutes: 12,
      case_scenario: '8歲米克斯需要脾臟切除',
      chapter_id: 'ch-01',
    });
    expect(prompt).toContain('lesson-01-03');
    expect(prompt).toContain('手術前風險告知');
    expect(prompt).toContain('8歲米克斯');
    expect(prompt).toContain('ch-01');
  });
});
```

---

## 6 階段執行計畫

### Phase 1: 環境設置
- [ ] 確認步驟 1 的 `output/syllabus.json` 存在且通過驗證
- [ ] 建立 `types/lesson.ts` 和 `schemas/lesson.ts`

### Phase 2: Prompt Builder
- [ ] 建立 `lib/build-lesson-prompt.ts`
- [ ] 實作 `buildLessonUserPrompt()` 函數
- [ ] 實作 `estimateDuration()` 函數

### Phase 3: API 呼叫
- [ ] 建立 `lib/generate-lesson.ts`
- [ ] 實作 `generateLessonScript()` 含 retry + Zod 驗證
- [ ] 實作 `extractLessonsFromSyllabus()` 從大綱提取 lesson 資訊

### Phase 4: CLI 入口
- [ ] 建立 `scripts/generate-lesson.ts`
- [ ] 支援 `--syllabus` + `--lesson-id`（單堂）或 `--all`（全部）
- [ ] 支援 `--dry-run`
- [ ] 輸出到 `output/lessons/lesson-XX-XX.json`

### Phase 5: 測試
- [ ] Schema 驗證測試
- [ ] Prompt builder 測試
- [ ] Duration 估算測試
- [ ] 覆蓋率 >= 70%

### Phase 6: 驗證
- [ ] 實際生成一堂課的講稿
- [ ] 確認 script_zh 為自然口語（非書面語）
- [ ] 確認 duration_seconds 合理
- [ ] 人工審核內容的專業正確性

---

## 品質檢查清單

- [ ] 每堂課 5-8 個 segments
- [ ] 恰好 1 個 opening + 1 個 summary + ≥1 個 case
- [ ] script_zh 是自然口語，不是條列式唸稿
- [ ] slides segment 一定有 slide_content
- [ ] quiz 有 2-3 題且答案正確
- [ ] duration_seconds 與文字量匹配（±20%）
- [ ] 總時長接近目標時長（±30%）
- [ ] metadata.chapter 與輸入一致

---

## 輸出後的下一步
1. 將輸出的 JSON 存檔到 `output/lessons/`
2. 可選：帶入 `03_case_dialogue_generator.md` 為 case segment 生成更詳細的對話
3. 帶入 `04_quality_checker.md` 進行品質檢查
