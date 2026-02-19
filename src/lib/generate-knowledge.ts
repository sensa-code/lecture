// Stage 00: Knowledge Deep Dive (SSOT)
import Anthropic from '@anthropic-ai/sdk';
import { KnowledgeBaseSchema } from '../schemas/knowledge.js';
import { safeParseJSON } from './safe-json.js';
import type { KnowledgeBase } from '../types/knowledge.js';

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

export { SYSTEM_PROMPT as KNOWLEDGE_SYSTEM_PROMPT };

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
      const parsed = safeParseJSON<KnowledgeBase>(text);
      if (!parsed) {
        throw new Error('Failed to parse JSON response');
      }
      const validated = KnowledgeBaseSchema.parse(parsed);

      console.log(`✅ Knowledge deep dive complete (attempt ${attempt})`);
      console.log(`   Dimensions: ${validated.dimensions.length}, References: ${validated.references.length}`);

      return validated;
    } catch (error) {
      console.error(`❌ Attempt ${attempt} failed:`, error instanceof Error ? error.message : error);
      if (attempt === maxRetries) {
        throw new Error(`Knowledge deep dive failed after ${maxRetries} attempts: ${error}`);
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  throw new Error('unreachable');
}
