// HeyGen avatar video module (F-27: credit-based pricing)
import { z } from 'zod';
import type { HeyGenWorkResult } from './types.js';
import { estimateDuration } from '../build-lesson-prompt.js';

const HEYGEN_API_URL = 'https://api.heygen.com/v2';

/** Zod schema for HeyGen create video response (P1-8: runtime validation) */
const HeyGenCreateResponseSchema = z.object({
  data: z.object({
    video_id: z.string().min(1),
  }),
});

/** Zod schema for HeyGen video status response (P1-8: runtime validation) */
const HeyGenStatusResponseSchema = z.object({
  data: z.object({
    status: z.string(),
    video_url: z.string().url().optional(),
    error: z.string().optional(),
  }),
});

export async function createAvatarVideo(
  scriptZh: string,
  avatarId = 'default',
  maxRetries = 3
): Promise<HeyGenWorkResult> {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) throw new Error('HEYGEN_API_KEY not set');

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Create video task
      const createResponse = await fetch(`${HEYGEN_API_URL}/video/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': apiKey,
        },
        body: JSON.stringify({
          video_inputs: [{
            character: { type: 'avatar', avatar_id: avatarId },
            voice: { type: 'text', input_text: scriptZh },
          }],
          dimension: { width: 1920, height: 1080 },
        }),
      });

      if (!createResponse.ok) {
        throw new Error(`HeyGen create error: ${createResponse.status}`);
      }

      const rawJson: unknown = await createResponse.json();
      const createData = HeyGenCreateResponseSchema.parse(rawJson);
      const videoId = createData.data.video_id;

      console.log(`  HeyGen video created: ${videoId}`);

      // Poll for completion
      const videoBuffer = await waitForCompletion(videoId, apiKey);
      const videoDuration = estimateDuration(scriptZh);
      // HeyGen credit-based pricing (F-27) — cost varies by plan
      const cost = 0; // Credit-based, tracked separately

      return { videoBuffer, videoDuration, cost };
    } catch (error) {
      console.error(`  HeyGen attempt ${attempt} failed:`, error instanceof Error ? error.message : error);
      if (attempt === maxRetries) throw error;
      await new Promise((r) => setTimeout(r, 5000 * attempt));
    }
  }
  throw new Error('unreachable');
}

async function waitForCompletion(
  videoId: string,
  apiKey: string,
  timeoutMs = 600000,
  pollIntervalMs = 10000
): Promise<Buffer> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const statusResponse = await fetch(`${HEYGEN_API_URL}/video_status.get?video_id=${videoId}`, {
      headers: { 'X-Api-Key': apiKey },
    });

    if (!statusResponse.ok) {
      throw new Error(`HeyGen status error: ${statusResponse.status}`);
    }

    const rawJson: unknown = await statusResponse.json();
    const statusData = HeyGenStatusResponseSchema.parse(rawJson);

    if (statusData.data.status === 'completed' && statusData.data.video_url) {
      const videoResponse = await fetch(statusData.data.video_url);
      return Buffer.from(await videoResponse.arrayBuffer());
    }

    if (statusData.data.status === 'failed') {
      throw new Error(`HeyGen video failed: ${statusData.data.error || 'unknown'}`);
    }

    console.log(`  HeyGen polling... status: ${statusData.data.status}`);
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  throw new Error(`HeyGen video timeout after ${timeoutMs / 1000}s`);
}

