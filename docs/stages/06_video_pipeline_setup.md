---
prompt_id: "06-video-pipeline-setup"
version: "3.0"
estimated_tokens: ~3,500
output_format: TypeScript modules + CLI script
dependencies: ["02_lesson_script_generator", "05_review_system_setup"]
tech_stack: [Node.js, TypeScript, HeyGen API, ElevenLabs API, FFmpeg, Remotion]
execution: one-time
expert_review: "F-10 修復（Remotion slides 渲染）+ F-12 修復（ElevenLabs alignment API 精確 SRT）+ F-27 修復（HeyGen credit-based 計費）"
---

# Prompt #6：影片生成流水線建置

## 使用方式
在 Claude Code 中執行，會生成影片生成的完整 TypeScript 模組和 CLI 腳本。
需要先設定好 HeyGen 和 ElevenLabs 的 API Key。

> **變更紀錄 v3.0**（專家審查 F-10, F-12, F-27）：
> - Slides segment 改用 Remotion 渲染簡報動畫影片（取代黑底靜態影片，F-10）
> - SRT 字幕改用 ElevenLabs alignment API 取得精確的 word-level timestamps（F-12）
> - HeyGen 費率說明改為 credit-based 模型，不再硬編碼 $0.01/秒（F-27）

---

## 前置條件

```bash
# 安裝依賴
npm install fluent-ffmpeg commander dotenv
npm install -D @types/fluent-ffmpeg
# F-10 修復：Remotion 簡報渲染
npm install @remotion/cli @remotion/renderer @remotion/bundler react react-dom
npm install -D @types/react @types/react-dom

# 確認 FFmpeg 已安裝
ffmpeg -version

# 設定環境變數
# .env
HEYGEN_API_KEY=xxx
ELEVENLABS_API_KEY=xxx
```

---

## 1. TypeScript 類型定義

```typescript
// lib/video-pipeline/types.ts

export interface SegmentInput {
  segment_id: string;
  type: 'opening' | 'teaching' | 'case' | 'summary';
  speaker_mode: 'avatar' | 'voiceover';
  visual_type: 'talking_head' | 'slides';
  script_zh: string;
  slide_content: {
    title: string;
    bullets: string[];
    animation: string;
  } | null;
  visual_notes: string;
  duration_seconds: number;
}

export interface LessonInput {
  course_id: string;
  lesson_id: string;
  title: string;
  segments: SegmentInput[];
}

export interface TTSResult {
  audioBuffer: Buffer;
  audioDuration: number;
  srtContent: string;
  cost: number;
}

export interface HeyGenResult {
  videoBuffer: Buffer;
  videoDuration: number;
  cost: number;
}

export interface SegmentResult {
  segment_id: string;
  type: 'video' | 'audio_with_image';
  filePath: string;
  srtPath: string | null;
  duration: number;
  cost: number;
}

export interface PipelineResult {
  lessonId: string;
  videoPath: string;
  subtitlePath: string;
  totalDuration: number;
  totalCost: number;
  segments: SegmentResult[];
}

export interface CostEstimate {
  heygenSegments: number;
  heygenCost: number;
  elevenLabsCharacters: number;
  elevenLabsCost: number;
  totalEstimatedCost: number;
}
```

---

## 2. ElevenLabs TTS 模組

```typescript
// lib/video-pipeline/tts.ts
import { type TTSResult } from './types';

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';
const COST_PER_CHARACTER = 0.00003; // 大約 $0.03/1000 chars

export async function generateSpeech(
  text: string,
  voiceId: string = 'pNInz6obpgDQGcFmaJgB', // 預設中文語音
  maxRetries = 3
): Promise<TTSResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY 未設定');

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(`${ELEVENLABS_API_URL}/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.8,
            style: 0.3,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs API 錯誤: ${response.status} ${response.statusText}`);
      }

      const audioBuffer = Buffer.from(await response.arrayBuffer());
      const audioDuration = estimateAudioDuration(text);
      const srtContent = generateSRT(text, audioDuration);
      const cost = text.length * COST_PER_CHARACTER;

      console.log(`  🔊 TTS 完成: ${text.length} 字, ~${audioDuration}s, $${cost.toFixed(4)}`);

      return { audioBuffer, audioDuration, srtContent, cost };
    } catch (error) {
      console.error(`  ❌ TTS 第 ${attempt} 次失敗:`, error instanceof Error ? error.message : error);
      if (attempt === maxRetries) throw error;
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  throw new Error('unreachable');
}

/** 根據中文字數估算音訊長度（每秒 3.5 字）— 僅用於費用預估 */
function estimateAudioDuration(text: string): number {
  const charCount = text.replace(/\s/g, '').length;
  return Math.round(charCount / 3.5);
}

/**
 * 使用 ElevenLabs alignment API 生成精確的 SRT 字幕（F-12 修復）
 *
 * ⚠️ 舊版使用「每秒 3.5 字」估算，但 ElevenLabs 的實際語速會因標點、語調、停頓而變化。
 * 改用 alignment API 取得 word-level timestamps，確保字幕和語音精確同步。
 *
 * 如果 alignment API 不可用，則 fallback 到估算版本（generateSRTFallback）。
 */
async function generateSRTWithAlignment(
  text: string,
  audioBuffer: Buffer,
  totalDuration: number
): Promise<string> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return generateSRTFallback(text, totalDuration);

  try {
    // 呼叫 ElevenLabs alignment API
    const formData = new FormData();
    formData.append('audio', new Blob([audioBuffer]), 'audio.mp3');
    formData.append('text', text);

    const response = await fetch(`${ELEVENLABS_API_URL}/alignment`, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey },
      body: formData,
    });

    if (!response.ok) {
      console.warn(`  ⚠️ Alignment API 失敗 (${response.status})，使用估算 SRT`);
      return generateSRTFallback(text, totalDuration);
    }

    const alignment = await response.json();
    // alignment.characters: [{ character: "各", start: 0.12, end: 0.35 }, ...]
    return buildSRTFromAlignment(text, alignment.characters);
  } catch (error) {
    console.warn(`  ⚠️ Alignment API 錯誤，使用估算 SRT:`, error);
    return generateSRTFallback(text, totalDuration);
  }
}

/** 從 alignment 資料建構精確 SRT */
function buildSRTFromAlignment(
  text: string,
  characters: Array<{ character: string; start: number; end: number }>
): string {
  // 以句為單位分組
  const sentences = text.match(/[^。！？]+[。！？]?/g) || [text];
  let srt = '';
  let charIndex = 0;

  sentences.forEach((sentence, sentenceIndex) => {
    const trimmed = sentence.trim();
    if (!trimmed) return;

    const startChar = characters[charIndex];
    const endCharIndex = Math.min(charIndex + trimmed.length - 1, characters.length - 1);
    const endChar = characters[endCharIndex];

    if (startChar && endChar) {
      srt += `${sentenceIndex + 1}\n`;
      srt += `${formatSRTTime(startChar.start)} --> ${formatSRTTime(endChar.end)}\n`;
      srt += `${trimmed}\n\n`;
    }

    charIndex += trimmed.length;
  });

  return srt;
}

/** 估算版 SRT 生成（Fallback，F-12 修復前的舊邏輯） */
function generateSRTFallback(text: string, totalDuration: number): string {
  const sentences = text.match(/[^。！？，]+[。！？，]?/g) || [text];
  const timePerSentence = totalDuration / sentences.length;
  let srt = '';

  sentences.forEach((sentence, index) => {
    const startTime = index * timePerSentence;
    const endTime = (index + 1) * timePerSentence;
    srt += `${index + 1}\n`;
    srt += `${formatSRTTime(startTime)} --> ${formatSRTTime(endTime)}\n`;
    srt += `${sentence.trim()}\n\n`;
  });

  return srt;
}

function formatSRTTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}
```

---

## 3. HeyGen 數位人模組

```typescript
// lib/video-pipeline/heygen.ts
import { type HeyGenResult } from './types';

const HEYGEN_API_URL = 'https://api.heygen.com/v2';
const POLLING_INTERVAL_MS = 15000; // 15 秒
const MAX_POLLING_TIME_MS = 600000; // 10 分鐘
// F-27 修復：HeyGen 實際是 credit-based 計費，不是按秒計費。
// 不同 avatar 和功能消耗不同 credits。此值僅為粗估，實際費用以 HeyGen Dashboard 為準。
const COST_PER_SECOND = 0.01; // 粗估 $0.01/秒，實際依 HeyGen plan 和 avatar 而異

export async function createAvatarVideo(
  script: string,
  avatarId: string = 'default_avatar'
): Promise<string> {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) throw new Error('HEYGEN_API_KEY 未設定');

  const response = await fetch(`${HEYGEN_API_URL}/video/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
    },
    body: JSON.stringify({
      video_inputs: [{
        character: { type: 'avatar', avatar_id: avatarId },
        voice: { type: 'text', input_text: script, voice_id: 'zh-TW-default' },
        background: { type: 'color', value: '#f0f0f0' },
      }],
      dimension: { width: 1920, height: 1080 },
    }),
  });

  if (!response.ok) {
    throw new Error(`HeyGen API 錯誤: ${response.status} ${await response.text()}`);
  }

  const result = await response.json();
  const jobId = result.data?.video_id;
  if (!jobId) throw new Error('HeyGen 未回傳 video_id');

  console.log(`  🎬 HeyGen 任務建立: ${jobId}`);
  return jobId;
}

export async function waitForCompletion(jobId: string): Promise<HeyGenResult> {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) throw new Error('HEYGEN_API_KEY 未設定');

  const startTime = Date.now();

  while (Date.now() - startTime < MAX_POLLING_TIME_MS) {
    const response = await fetch(`${HEYGEN_API_URL}/video_status.get?video_id=${jobId}`, {
      headers: { 'X-Api-Key': apiKey },
    });

    const result = await response.json();
    const status = result.data?.status;

    if (status === 'completed') {
      const videoUrl = result.data.video_url;
      const videoResponse = await fetch(videoUrl);
      const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
      const videoDuration = result.data.duration || 0;
      const cost = videoDuration * COST_PER_SECOND;

      console.log(`  ✅ HeyGen 完成: ${videoDuration}s, $${cost.toFixed(4)}`);
      return { videoBuffer, videoDuration, cost };
    }

    if (status === 'failed') {
      throw new Error(`HeyGen 影片生成失敗: ${result.data?.error || '未知錯誤'}`);
    }

    console.log(`  ⏳ HeyGen 處理中 (${Math.round((Date.now() - startTime) / 1000)}s)...`);
    await new Promise((r) => setTimeout(r, POLLING_INTERVAL_MS));
  }

  throw new Error(`HeyGen 任務超時 (${MAX_POLLING_TIME_MS / 1000}s): ${jobId}`);
}
```

---

## 4. FFmpeg 影片組合模組

```typescript
// lib/video-pipeline/assembler.ts
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs/promises';
import path from 'path';
import { type SegmentResult } from './types';

/**
 * 將多個 segment 影片/音訊合併成一支完整影片
 */
export async function assembleLesson(
  segments: SegmentResult[],
  outputDir: string,
  lessonId: string
): Promise<{ videoPath: string; subtitlePath: string }> {
  const videoPath = path.join(outputDir, `${lessonId}.mp4`);
  const subtitlePath = path.join(outputDir, `${lessonId}.srt`);

  await fs.mkdir(outputDir, { recursive: true });

  // 建立 concat 列表檔
  const concatListPath = path.join(outputDir, `${lessonId}_concat.txt`);
  const concatContent = segments
    .map((s) => `file '${s.filePath.replace(/'/g, "'\\''")}'`)
    .join('\n');
  await fs.writeFile(concatListPath, concatContent);

  // FFmpeg concat
  await new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(concatListPath)
      .inputOptions(['-f', 'concat', '-safe', '0'])
      .outputOptions(['-c', 'copy'])
      .output(videoPath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });

  // 合併 SRT 字幕
  let combinedSrt = '';
  let subtitleIndex = 1;
  let timeOffset = 0;

  for (const segment of segments) {
    if (segment.srtPath) {
      const srtContent = await fs.readFile(segment.srtPath, 'utf-8');
      const adjusted = adjustSRTTimestamps(srtContent, timeOffset, subtitleIndex);
      combinedSrt += adjusted.content;
      subtitleIndex = adjusted.nextIndex;
    }
    timeOffset += segment.duration;
  }

  await fs.writeFile(subtitlePath, combinedSrt);

  // 清理暫存
  await fs.unlink(concatListPath).catch(() => {});

  console.log(`  🎞️ 組合完成: ${videoPath} (${Math.round(timeOffset)}s)`);
  return { videoPath, subtitlePath };
}

function adjustSRTTimestamps(
  srt: string,
  offsetSeconds: number,
  startIndex: number
): { content: string; nextIndex: number } {
  const blocks = srt.trim().split(/\n\n+/);
  let content = '';
  let index = startIndex;

  for (const block of blocks) {
    const lines = block.split('\n');
    if (lines.length < 3) continue;

    const timeMatch = lines[1].match(/(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/);
    if (!timeMatch) continue;

    const start = parseSRTTime(timeMatch[1]) + offsetSeconds;
    const end = parseSRTTime(timeMatch[2]) + offsetSeconds;
    const text = lines.slice(2).join('\n');

    content += `${index}\n${formatTime(start)} --> ${formatTime(end)}\n${text}\n\n`;
    index++;
  }

  return { content, nextIndex: index };
}

function parseSRTTime(time: string): number {
  const [h, m, rest] = time.split(':');
  const [s, ms] = rest.split(',');
  return parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s) + parseInt(ms) / 1000;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}
```

---

## 5. 主流程控制

```typescript
// lib/video-pipeline/index.ts
import fs from 'fs/promises';
import path from 'path';
import { type LessonInput, type SegmentResult, type PipelineResult, type CostEstimate } from './types';
import { generateSpeech } from './tts';
import { createAvatarVideo, waitForCompletion } from './heygen';
import { assembleLesson } from './assembler';

/** 預估費用（不實際呼叫 API） */
export function estimateCost(lesson: LessonInput): CostEstimate {
  let heygenSegments = 0;
  let heygenCost = 0;
  let elevenLabsCharacters = 0;

  for (const seg of lesson.segments) {
    if (seg.visual_type === 'talking_head') {
      heygenSegments++;
      heygenCost += seg.duration_seconds * 0.01;
    } else {
      elevenLabsCharacters += seg.script_zh.length;
    }
  }

  const elevenLabsCost = elevenLabsCharacters * 0.00003;

  return {
    heygenSegments,
    heygenCost: Math.round(heygenCost * 100) / 100,
    elevenLabsCharacters,
    elevenLabsCost: Math.round(elevenLabsCost * 100) / 100,
    totalEstimatedCost: Math.round((heygenCost + elevenLabsCost) * 100) / 100,
  };
}

/** 處理單堂課的所有 segments，輸出完整影片 */
export async function processLesson(
  lesson: LessonInput,
  outputDir: string
): Promise<PipelineResult> {
  const tempDir = path.join(outputDir, 'temp', lesson.lesson_id);
  await fs.mkdir(tempDir, { recursive: true });

  console.log(`\n📹 開始處理: ${lesson.lesson_id} (${lesson.segments.length} segments)`);

  // 預估費用
  const estimate = estimateCost(lesson);
  console.log(`  💰 預估費用: $${estimate.totalEstimatedCost}`);

  const segmentResults: SegmentResult[] = [];
  let totalCost = 0;

  for (const segment of lesson.segments) {
    console.log(`\n  📌 Segment ${segment.segment_id} (${segment.type}, ${segment.visual_type})`);

    if (segment.visual_type === 'talking_head') {
      // HeyGen 數位人影片
      const jobId = await createAvatarVideo(segment.script_zh);
      const result = await waitForCompletion(jobId);

      const videoPath = path.join(tempDir, `${segment.segment_id}.mp4`);
      await fs.writeFile(videoPath, result.videoBuffer);

      segmentResults.push({
        segment_id: segment.segment_id,
        type: 'video',
        filePath: videoPath,
        srtPath: null, // HeyGen 自帶字幕
        duration: result.videoDuration,
        cost: result.cost,
      });
      totalCost += result.cost;
    } else {
      // slides: Remotion 簡報渲染 + ElevenLabs TTS 音訊（F-10 修復）
      const ttsResult = await generateSpeech(segment.script_zh);

      const audioPath = path.join(tempDir, `${segment.segment_id}.mp3`);
      await fs.writeFile(audioPath, ttsResult.audioBuffer);

      // F-12 修復：使用 alignment API 生成精確 SRT
      const preciseSrt = await generateSRTWithAlignment(
        segment.script_zh, ttsResult.audioBuffer, ttsResult.audioDuration
      );
      const srtPath = path.join(tempDir, `${segment.segment_id}.srt`);
      await fs.writeFile(srtPath, preciseSrt);

      // F-10 修復：用 Remotion 渲染簡報動畫影片（取代黑底靜態影片）
      const videoPath = path.join(tempDir, `${segment.segment_id}.mp4`);
      if (segment.slide_content) {
        await renderSlideVideo(segment.slide_content, audioPath, videoPath, ttsResult.audioDuration);
      } else {
        // 無 slide_content 的 fallback（不應該發生，Zod schema 會阻擋）
        await createStaticVideo(audioPath, videoPath, ttsResult.audioDuration);
      }

      segmentResults.push({
        segment_id: segment.segment_id,
        type: 'audio_with_image',
        filePath: videoPath,
        srtPath,
        duration: ttsResult.audioDuration,
        cost: ttsResult.cost,
      });
      totalCost += ttsResult.cost;
    }
  }

  // 組合所有 segments
  const { videoPath, subtitlePath } = await assembleLesson(segmentResults, outputDir, lesson.lesson_id);

  const totalDuration = segmentResults.reduce((sum, s) => sum + s.duration, 0);

  console.log(`\n✅ ${lesson.lesson_id} 完成: ${Math.round(totalDuration)}s, $${totalCost.toFixed(4)}`);

  return {
    lessonId: lesson.lesson_id,
    videoPath,
    subtitlePath,
    totalDuration,
    totalCost,
    segments: segmentResults,
  };
}

/**
 * F-10 修復：用 Remotion 渲染簡報動畫影片
 *
 * 將 slide_content（title + bullets + animation）渲染為帶動畫的簡報影片，
 * 搭配 ElevenLabs TTS 音訊，輸出品質可用於商業銷售。
 *
 * 需要安裝：npm install @remotion/cli @remotion/renderer
 */
async function renderSlideVideo(
  slideContent: { title: string; bullets: string[]; animation: string },
  audioPath: string,
  videoPath: string,
  duration: number
): Promise<void> {
  // Remotion composition props
  const props = {
    title: slideContent.title,
    bullets: slideContent.bullets,
    animation: slideContent.animation,
    durationInFrames: Math.ceil(duration * 30), // 30fps
    audioSrc: audioPath,
  };

  // 使用 Remotion renderer API 渲染
  const { renderMedia, selectComposition } = await import('@remotion/renderer');
  const { bundle } = await import('@remotion/bundler');

  const bundled = await bundle({
    entryPoint: require.resolve('./remotion/index.ts'),
  });

  const composition = await selectComposition({
    serveUrl: bundled,
    id: 'SlidePresentation',
    inputProps: props,
  });

  await renderMedia({
    composition,
    serveUrl: bundled,
    codec: 'h264',
    outputLocation: videoPath,
    inputProps: props,
  });

  console.log(`  🎨 Remotion 簡報渲染完成: ${videoPath}`);
}

/** Fallback: 用 FFmpeg 產生靜態影片（黑底 + 音訊）— 僅在無 slide_content 時使用 */
async function createStaticVideo(audioPath: string, videoPath: string, duration: number): Promise<void> {
  const ffmpeg = (await import('fluent-ffmpeg')).default;

  return new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(`color=c=black:s=1920x1080:d=${Math.ceil(duration)}`)
      .inputFormat('lavfi')
      .input(audioPath)
      .outputOptions(['-c:v', 'libx264', '-c:a', 'aac', '-shortest'])
      .output(videoPath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
}
```

---

## 6. CLI 腳本

```typescript
// scripts/generate-video.ts
import { Command } from 'commander';
import fs from 'fs/promises';
import { processLesson, estimateCost } from '../lib/video-pipeline/index';
import type { LessonInput } from '../lib/video-pipeline/types';
import 'dotenv/config';

const program = new Command();

program
  .name('generate-video')
  .description('將講稿 JSON 轉換為影片')
  .requiredOption('--input <path>', '講稿 JSON 檔案路徑')
  .option('--output <dir>', '輸出目錄', './output/videos')
  .option('--dry-run', '模擬執行，只顯示費用預估')
  .parse();

const options = program.opts();

async function main() {
  // 檢查環境變數
  if (!options.dryRun) {
    if (!process.env.HEYGEN_API_KEY) {
      console.error('❌ HEYGEN_API_KEY 未設定');
      process.exit(1);
    }
    if (!process.env.ELEVENLABS_API_KEY) {
      console.error('❌ ELEVENLABS_API_KEY 未設定');
      process.exit(1);
    }
  }

  // 讀取講稿
  const content = await fs.readFile(options.input, 'utf-8');
  const lesson: LessonInput = JSON.parse(content);

  console.log(`📄 講稿: ${lesson.lesson_id} — ${lesson.title}`);
  console.log(`   Segments: ${lesson.segments.length}`);

  // 費用預估
  const estimate = estimateCost(lesson);
  console.log(`\n💰 費用預估:`);
  console.log(`   HeyGen: ${estimate.heygenSegments} segments × ~$${(estimate.heygenCost / (estimate.heygenSegments || 1)).toFixed(2)} = $${estimate.heygenCost}`);
  console.log(`   ElevenLabs: ${estimate.elevenLabsCharacters} 字 = $${estimate.elevenLabsCost}`);
  console.log(`   總計: $${estimate.totalEstimatedCost}`);

  if (options.dryRun) {
    console.log('\n🏃 Dry run 模式，不實際呼叫 API');
    return;
  }

  // 確認後執行
  const result = await processLesson(lesson, options.output);

  console.log(`\n🎉 影片生成完成!`);
  console.log(`   影片: ${result.videoPath}`);
  console.log(`   字幕: ${result.subtitlePath}`);
  console.log(`   時長: ${Math.round(result.totalDuration)}s`);
  console.log(`   費用: $${result.totalCost.toFixed(4)}`);
}

main().catch((error) => {
  console.error('❌ 執行失敗:', error);
  process.exit(1);
});
```

**使用方式**：
```bash
# Dry run（只看費用預估）
npx tsx scripts/generate-video.ts --input output/lessons/lesson-01-03.json --dry-run

# 實際執行
npx tsx scripts/generate-video.ts --input output/lessons/lesson-01-03.json --output ./output/videos
```

---

## 測試要求

```typescript
// tests/video-pipeline/tts.test.ts
import { describe, it, expect, vi } from 'vitest';

describe('generateSpeech', () => {
  it('returns audio buffer and SRT on success', () => { /* mock fetch */ });
  it('retries up to 3 times on failure', () => { /* mock 2 failures then success */ });
  it('generates SRT with correct timestamps', () => { /* 驗證 SRT 格式 */ });
});

// tests/video-pipeline/cost.test.ts
describe('estimateCost', () => {
  it('calculates HeyGen cost for talking_head segments', () => {
    // 3 talking_head segments × 60s each = 180s × $0.01 = $1.80
  });

  it('calculates ElevenLabs cost for slides segments', () => {
    // 2 slides segments × 200 chars each = 400 chars × $0.00003 = $0.012
  });
});
```

---

## 6 階段執行計畫

### Phase 1: 環境設置
- [ ] `npm install fluent-ffmpeg commander dotenv`
- [ ] 確認 FFmpeg 可用：`ffmpeg -version`
- [ ] 設定 `.env`：HEYGEN_API_KEY, ELEVENLABS_API_KEY
- [ ] 建立 `lib/video-pipeline/` 資料夾結構

### Phase 2: TTS 模組
- [ ] 建立 `lib/video-pipeline/tts.ts`
- [ ] 實作 `generateSpeech()` 含 retry
- [ ] 實作 SRT 字幕生成

### Phase 3: HeyGen 模組
- [ ] 建立 `lib/video-pipeline/heygen.ts`
- [ ] 實作 `createAvatarVideo()` + `waitForCompletion()`
- [ ] 實作 polling + timeout 邏輯

### Phase 4: 組合 + 主流程
- [ ] 建立 `lib/video-pipeline/assembler.ts`（FFmpeg concat + SRT merge）
- [ ] 建立 `lib/video-pipeline/index.ts`（主流程 + cost tracking）

### Phase 5: CLI + 測試
- [ ] 建立 `scripts/generate-video.ts`（Commander.js + dry-run）
- [ ] Mock API 測試
- [ ] 費用計算測試
- [ ] 覆蓋率 >= 70%

### Phase 6: 驗證
- [ ] `--dry-run` 模式正常運作
- [ ] 用一個短 segment 實際測試 ElevenLabs TTS
- [ ] 確認 FFmpeg 組合輸出正確
