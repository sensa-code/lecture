// Stage 01: Syllabus Generator (SSOT)
import Anthropic from '@anthropic-ai/sdk';
import { SyllabusSchema } from '../schemas/syllabus.js';
import { safeParseJSON } from './safe-json.js';
import type { Syllabus } from '../types/syllabus.js';
import type { KnowledgeBase } from '../types/knowledge.js';

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

export { SYSTEM_PROMPT as SYLLABUS_SYSTEM_PROMPT };

export async function generateSyllabus(
  courseName: string,
  targetAudience: string,
  coreValue: string,
  knowledgeBase: KnowledgeBase,
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

請以 JSON 格式輸出，結構包含：
- course_title, target_audience, total_chapters, total_lessons, estimated_total_hours
- knowledge_dimensions_used
- chapters 陣列（6~8 章，每章 3~4 堂課）

每堂課需包含：lesson_id (lesson-XX-XX), title, key_topics, learning_objectives (含 bloom_level + bloom_verb), duration_target_minutes, case_scenario

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
      const parsed = safeParseJSON<Syllabus>(text);
      if (!parsed) {
        throw new Error('JSON 解析失敗');
      }
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
