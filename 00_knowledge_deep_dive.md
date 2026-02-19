---
prompt_id: "00-knowledge-deep-dive"
version: "1.0"
estimated_tokens: ~4,000
output_format: JSON
dependencies: []
tech_stack: [Claude API, TypeScript, Zod]
source: "Obsidian 教學內容模板製作.md Prompt A"
---

# Prompt #0：知識深挖（Knowledge Deep Dive）

## 使用方式
在生成課程大綱（01）之前，先針對課程主題進行系統性的知識深挖。
輸出結構化的 `knowledge-base.json`，作為後續大綱生成和講稿撰寫的知識基礎。

> **設計依據**：團隊 Obsidian 教學內容模板已驗證，拆分「知識深挖」和「結構化」為兩步驟，
> 比一步到位的品質顯著更高。讓 LLM 先「思考」再「組織」。

---

## System Prompt

```
你是一位擁有豐富臨床經驗的獸醫專科教育者，同時熟悉人醫相關領域的最新知識。
你的任務是針對指定主題，進行系統性的深度知識整理，產出可直接用於教學的結構化知識庫。

### 角色設定
- 你有 15 年以上的小動物臨床經驗
- 你熟悉獸醫繼續教育和線上教學設計
- 你善於將複雜的醫學概念轉化為可教學的結構
- 你了解人醫領域的最新進展，能做跨物種的知識轉譯

### 輸出規則
- 嚴格以 JSON 格式輸出
- 每個面向都要有足夠深度供製作 10-15 分鐘的教學內容
- 重要的表格資料保持表格形式（用 JSON array of objects 表示）
- 藥物劑量標註完整（藥名、劑量、給藥途徑、頻率）
- 關鍵概念標註英文術語
- 標註引用的重要文獻（作者、年份、期刊、關鍵發現）
- 不要加任何說明文字、markdown 標記或程式碼區塊標記
- 直接輸出純 JSON
```

## User Prompt Template

```
請針對以下主題，進行系統性的深度知識整理：

【課程名稱】{{course_name}}
【目標受眾】{{target_audience}}
【核心價值】{{core_value}}

請依照以下七個面向逐一展開，輸出為 JSON 格式：

{
  "course_name": "{{course_name}}",
  "target_audience": "{{target_audience}}",
  "core_value": "{{core_value}}",
  "knowledge_generated_at": "ISO時間",
  "dimensions": [
    {
      "dimension_id": "dim-01",
      "name": "核心概念與理論基礎",
      "name_en": "Core Concepts & Theoretical Foundation",
      "description": "本課程涉及的核心概念、理論框架、關鍵定義",
      "content": {
        "key_concepts": [
          {
            "term_zh": "中文術語",
            "term_en": "English Term",
            "definition": "定義說明",
            "clinical_relevance": "臨床相關性",
            "teaching_points": ["教學重點1", "教學重點2"]
          }
        ],
        "theoretical_frameworks": ["框架描述"],
        "clinical_pearls": ["臨床珠璣1", "臨床珠璣2"]
      }
    },
    {
      "dimension_id": "dim-02",
      "name": "臨床實務應用",
      "name_en": "Clinical Practice Application",
      "description": "實際臨床場景中的應用方式、操作步驟、決策流程",
      "content": {
        "clinical_scenarios": [
          {
            "scenario": "情境描述",
            "challenge": "面臨的挑戰",
            "approach": "建議做法",
            "pitfalls": ["常見錯誤1", "常見錯誤2"]
          }
        ],
        "decision_frameworks": ["決策框架描述"],
        "clinical_pearls": []
      }
    },
    {
      "dimension_id": "dim-03",
      "name": "工具與技術",
      "name_en": "Tools & Techniques",
      "description": "相關的工具、技術、評估量表、溝通框架",
      "content": {
        "tools": [
          {
            "name": "工具名稱",
            "name_en": "English Name",
            "purpose": "用途",
            "usage_steps": ["步驟1", "步驟2"],
            "evidence_level": "證據等級（RCT/回顧性/專家意見）"
          }
        ],
        "clinical_pearls": []
      }
    },
    {
      "dimension_id": "dim-04",
      "name": "常見問題與困難情境",
      "name_en": "Common Challenges & Difficult Situations",
      "description": "實務中最常遇到的問題、困難情境、以及應對策略",
      "content": {
        "common_problems": [
          {
            "problem": "問題描述",
            "frequency": "常見程度（高/中/低）",
            "impact": "影響程度",
            "solutions": ["解決方案1", "解決方案2"],
            "case_example": "具體案例"
          }
        ],
        "clinical_pearls": []
      }
    },
    {
      "dimension_id": "dim-05",
      "name": "法律與倫理考量",
      "name_en": "Legal & Ethical Considerations",
      "description": "相關的法規要求、倫理考量、自保策略",
      "content": {
        "legal_points": [
          {
            "topic": "法律議題",
            "regulation": "相關法規",
            "practical_advice": "實務建議",
            "risk_level": "風險等級（高/中/低）"
          }
        ],
        "ethical_dilemmas": ["倫理困境描述"],
        "clinical_pearls": []
      }
    },
    {
      "dimension_id": "dim-06",
      "name": "人醫借鑑與跨領域知識",
      "name_en": "Translational Insights from Human Medicine",
      "description": "人醫在相同或類似領域的成熟工具、指引、評估系統，可轉譯到獸醫的部分",
      "content": {
        "translational_tools": [
          {
            "human_tool": "人醫工具名稱",
            "description": "工具描述與使用方式",
            "veterinary_adaptation": "獸醫轉譯方式",
            "applicability": "適用性評估",
            "species_differences": "物種差異注意事項"
          }
        ],
        "clinical_pearls": []
      }
    },
    {
      "dimension_id": "dim-07",
      "name": "爭議與知識前沿",
      "name_en": "Controversies & Knowledge Frontiers",
      "description": "目前尚無共識的議題、新興研究方向、未來趨勢",
      "content": {
        "controversies": [
          {
            "topic": "爭議主題",
            "positions": ["立場A", "立場B"],
            "current_evidence": "目前證據摘要",
            "practical_recommendation": "實務建議"
          }
        ],
        "emerging_trends": ["趨勢描述"],
        "knowledge_gaps": ["知識空缺"],
        "clinical_pearls": []
      }
    }
  ],
  "references": [
    {
      "id": "ref-01",
      "authors": "作者",
      "year": 2024,
      "title": "文獻標題",
      "journal": "期刊名",
      "key_finding": "關鍵發現"
    }
  ]
}

要求：
1. 每個面向都要有至少 3 個具體條目
2. clinical_pearls 每個面向至少 2 條
3. 所有工具和框架要有英文名稱
4. 引用至少 5 篇重要文獻
5. 請只輸出 JSON，不要加任何說明文字
```

---

## TypeScript 類型定義

```typescript
// types/knowledge.ts

export interface KeyConcept {
  term_zh: string;
  term_en: string;
  definition: string;
  clinical_relevance: string;
  teaching_points: string[];
}

export interface ClinicalScenario {
  scenario: string;
  challenge: string;
  approach: string;
  pitfalls: string[];
}

export interface Tool {
  name: string;
  name_en: string;
  purpose: string;
  usage_steps: string[];
  evidence_level: string;
}

export interface CommonProblem {
  problem: string;
  frequency: '高' | '中' | '低';
  impact: string;
  solutions: string[];
  case_example: string;
}

export interface LegalPoint {
  topic: string;
  regulation: string;
  practical_advice: string;
  risk_level: '高' | '中' | '低';
}

export interface TranslationalTool {
  human_tool: string;
  description: string;
  veterinary_adaptation: string;
  applicability: string;
  species_differences: string;
}

export interface Controversy {
  topic: string;
  positions: string[];
  current_evidence: string;
  practical_recommendation: string;
}

export interface KnowledgeDimension {
  dimension_id: string;
  name: string;
  name_en: string;
  description: string;
  content: Record<string, unknown>;
}

export interface Reference {
  id: string;
  authors: string;
  year: number;
  title: string;
  journal: string;
  key_finding: string;
}

export interface KnowledgeBase {
  course_name: string;
  target_audience: string;
  core_value: string;
  knowledge_generated_at: string;
  dimensions: KnowledgeDimension[];
  references: Reference[];
}
```

## Zod Schema 驗證

```typescript
// schemas/knowledge.ts
import { z } from 'zod';

const KeyConceptSchema = z.object({
  term_zh: z.string().min(1),
  term_en: z.string().min(1),
  definition: z.string().min(10),
  clinical_relevance: z.string().min(5),
  teaching_points: z.array(z.string().min(1)).min(1),
});

const ClinicalScenarioSchema = z.object({
  scenario: z.string().min(10),
  challenge: z.string().min(5),
  approach: z.string().min(10),
  pitfalls: z.array(z.string()).min(1),
});

const ToolSchema = z.object({
  name: z.string().min(1),
  name_en: z.string().min(1),
  purpose: z.string().min(5),
  usage_steps: z.array(z.string()).min(1),
  evidence_level: z.string().min(1),
});

const CommonProblemSchema = z.object({
  problem: z.string().min(5),
  frequency: z.enum(['高', '中', '低']),
  impact: z.string().min(5),
  solutions: z.array(z.string()).min(1),
  case_example: z.string().min(10),
});

const LegalPointSchema = z.object({
  topic: z.string().min(1),
  regulation: z.string().min(1),
  practical_advice: z.string().min(5),
  risk_level: z.enum(['高', '中', '低']),
});

const TranslationalToolSchema = z.object({
  human_tool: z.string().min(1),
  description: z.string().min(10),
  veterinary_adaptation: z.string().min(5),
  applicability: z.string().min(5),
  species_differences: z.string().min(5),
});

const ControversySchema = z.object({
  topic: z.string().min(1),
  positions: z.array(z.string()).min(2),
  current_evidence: z.string().min(10),
  practical_recommendation: z.string().min(5),
});

const DimensionSchema = z.object({
  dimension_id: z.string().regex(/^dim-\d{2}$/),
  name: z.string().min(2),
  name_en: z.string().min(2),
  description: z.string().min(10),
  content: z.record(z.unknown()),
});

const ReferenceSchema = z.object({
  id: z.string().regex(/^ref-\d{2}$/),
  authors: z.string().min(1),
  year: z.number().min(1990).max(2030),
  title: z.string().min(5),
  journal: z.string().min(1),
  key_finding: z.string().min(5),
});

export const KnowledgeBaseSchema = z.object({
  course_name: z.string().min(1),
  target_audience: z.string().min(1),
  core_value: z.string().min(1),
  knowledge_generated_at: z.string(),
  dimensions: z.array(DimensionSchema).length(7),
  references: z.array(ReferenceSchema).min(5),
}).refine(
  (data) => {
    // 確認 7 個面向的 dimension_id 依序為 dim-01 到 dim-07
    return data.dimensions.every((d, i) =>
      d.dimension_id === `dim-${String(i + 1).padStart(2, '0')}`
    );
  },
  { message: 'dimensions 必須依序為 dim-01 到 dim-07' }
);

export type KnowledgeBase = z.infer<typeof KnowledgeBaseSchema>;
```

## Claude API 呼叫範例

```typescript
// lib/generate-knowledge.ts
import Anthropic from '@anthropic-ai/sdk';
import { KnowledgeBaseSchema, type KnowledgeBase } from '../schemas/knowledge';

const SYSTEM_PROMPT = `你是一位擁有豐富臨床經驗的獸醫專科教育者，同時熟悉人醫相關領域的最新知識。
你的任務是針對指定主題，進行系統性的深度知識整理，產出可直接用於教學的結構化知識庫。

### 角色設定
- 你有 15 年以上的小動物臨床經驗
- 你熟悉獸醫繼續教育和線上教學設計
- 你善於將複雜的醫學概念轉化為可教學的結構
- 你了解人醫領域的最新進展，能做跨物種的知識轉譯

### 輸出規則
- 嚴格以 JSON 格式輸出
- 每個面向都要有足夠深度供製作 10-15 分鐘的教學內容
- 重要的表格資料保持表格形式（用 JSON array of objects 表示）
- 藥物劑量標註完整（藥名、劑量、給藥途徑、頻率）
- 關鍵概念標註英文術語
- 標註引用的重要文獻（作者、年份、期刊、關鍵發現）
- 不要加任何說明文字、markdown 標記或程式碼區塊標記
- 直接輸出純 JSON`;

export async function generateKnowledgeBase(
  courseName: string,
  targetAudience: string,
  coreValue: string,
  maxRetries = 3
): Promise<KnowledgeBase> {
  const client = new Anthropic();

  const userPrompt = `請針對以下主題，進行系統性的深度知識整理：

【課程名稱】${courseName}
【目標受眾】${targetAudience}
【核心價值】${coreValue}

請依照七個面向逐一展開（核心概念與理論基礎、臨床實務應用、工具與技術、常見問題與困難情境、法律與倫理考量、人醫借鑑與跨領域知識、爭議與知識前沿），輸出為指定的 JSON 格式。

要求：
1. 每個面向都要有至少 3 個具體條目
2. clinical_pearls 每個面向至少 2 條
3. 所有工具和框架要有英文名稱
4. 引用至少 5 篇重要文獻
5. 請只輸出 JSON，不要加任何說明文字`;

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
      const validated = KnowledgeBaseSchema.parse(parsed);

      console.log(`✅ 知識深挖完成（第 ${attempt} 次嘗試）`);
      console.log(`   面向數: ${validated.dimensions.length}, 參考文獻: ${validated.references.length}`);

      return validated;
    } catch (error) {
      console.error(`❌ 第 ${attempt} 次嘗試失敗:`, error instanceof Error ? error.message : error);
      if (attempt === maxRetries) {
        throw new Error(`知識深挖失敗，已重試 ${maxRetries} 次: ${error}`);
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  throw new Error('unreachable');
}
```

---

## 測試要求

```typescript
// tests/knowledge.test.ts
import { describe, it, expect } from 'vitest';
import { KnowledgeBaseSchema } from '../schemas/knowledge';

describe('KnowledgeBaseSchema', () => {
  it('validates a complete knowledge base', () => {
    // 使用完整的 JSON 範例作為測試資料
  });

  it('requires exactly 7 dimensions', () => {
    const invalid = {
      course_name: 'test',
      target_audience: 'test',
      core_value: 'test',
      knowledge_generated_at: new Date().toISOString(),
      dimensions: [], // 空的
      references: [],
    };
    const result = KnowledgeBaseSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('requires at least 5 references', () => {
    // 驗證參考文獻最低數量
  });

  it('validates dimension_id sequence (dim-01 to dim-07)', () => {
    // 驗證面向 ID 依序
  });
});
```

---

## 6 階段執行計畫

### Phase 1: 環境設置
- [ ] 確認 `ANTHROPIC_API_KEY` 已設定
- [ ] 建立 `types/knowledge.ts` 和 `schemas/knowledge.ts`
- [ ] 建立資料夾 `output/`

### Phase 2: Schema 定義
- [ ] 實作所有 7 個面向的子 schema
- [ ] 實作 `KnowledgeBaseSchema` 主 schema
- [ ] 確認 dimension_id 序列驗證

### Phase 3: API 呼叫
- [ ] 建立 `lib/generate-knowledge.ts`
- [ ] 實作 System Prompt + User Prompt
- [ ] 實作 JSON parse + Zod validate + retry

### Phase 4: CLI 入口
- [ ] 建立 `scripts/generate-knowledge.ts`
- [ ] 支援 `--course-name`, `--target-audience`, `--core-value`
- [ ] 支援 `--dry-run`
- [ ] 輸出到 `output/knowledge-base.json`

### Phase 5: 測試
- [ ] Schema 驗證測試
- [ ] 7 面向完整性測試
- [ ] 參考文獻最低數量測試
- [ ] 覆蓋率 >= 70%

### Phase 6: 驗證
- [ ] 實際呼叫 Claude API 生成一份知識庫
- [ ] 人工審核知識深度和正確性
- [ ] 確認輸出可作為 01 大綱生成的輸入

---

## 品質檢查清單

- [ ] 7 個面向都有內容，無空面向
- [ ] 每個面向至少 3 個具體條目
- [ ] 每個面向至少 2 條 clinical_pearls
- [ ] 所有工具有英文名稱
- [ ] 至少 5 篇參考文獻
- [ ] 藥物劑量格式完整（如涉及）
- [ ] JSON 通過 Zod 驗證
- [ ] dimension_id 依序 dim-01 到 dim-07

---

## 輸出後的下一步
1. 人工審核知識庫內容，補充缺漏的臨床知識
2. 將 `knowledge-base.json` 作為輸入，帶入 `01_syllabus_generator.md` 生成課程大綱
3. 知識庫中的臨床情境可直接用於 03 案例對話生成
