// Stage 03: Case Dialogue Generator (SSOT)
import Anthropic from '@anthropic-ai/sdk';
import { CaseDialogueSchema } from '../schemas/dialogue.js';
import { buildDialoguePrompt } from './build-dialogue-prompt.js';
import { safeParseJSON } from './safe-json.js';
import type { CaseDialogue } from '../types/dialogue.js';

export async function generateDialogue(
  topic: string,
  maxRetries = 3
): Promise<CaseDialogue> {
  const client = new Anthropic();
  const { system, user } = buildDialoguePrompt(topic);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 4096,
        system,
        messages: [{ role: 'user', content: user }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const parsed = safeParseJSON<CaseDialogue>(text);
      if (!parsed) {
        throw new Error('JSON 解析失敗');
      }
      const validated = CaseDialogueSchema.parse(parsed);

      console.log(`✅ 對話生成成功（第 ${attempt} 次嘗試）`);
      console.log(`   對話輪數: ${validated.dialogue.length}, 場景: ${validated.scenario.setting.substring(0, 30)}...`);

      return validated;
    } catch (error) {
      console.error(`❌ 第 ${attempt} 次嘗試失敗:`, error instanceof Error ? error.message : error);
      if (attempt === maxRetries) {
        throw new Error(`對話生成失敗，已重試 ${maxRetries} 次: ${error}`);
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  throw new Error('unreachable');
}
