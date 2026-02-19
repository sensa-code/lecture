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
        throw new Error('Failed to parse JSON response');
      }
      const validated = CaseDialogueSchema.parse(parsed);

      console.log(`✅ Dialogue generated (attempt ${attempt})`);
      console.log(`   Turns: ${validated.dialogue.length}, Scenario: ${validated.scenario.setting.substring(0, 30)}...`);

      return validated;
    } catch (error) {
      console.error(`❌ Attempt ${attempt} failed:`, error instanceof Error ? error.message : error);
      if (attempt === maxRetries) {
        throw new Error(`Dialogue generation failed after ${maxRetries} attempts: ${error}`);
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  throw new Error('unreachable');
}
