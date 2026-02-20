// Video pipeline orchestrator (F-10: Remotion slides, F-12: alignment SRT)
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { promisify } from 'util';
import { execFile } from 'child_process';
import { generateSpeech } from './tts.js';
import { createAvatarVideo } from './heygen.js';
import { assembleLesson } from './assembler.js';
import type { SegmentFile } from './assembler.js';
import type { SegmentInput, LessonInput, PipelineResult, CostEstimate } from './types.js';

const execFileAsync = promisify(execFile);

/**
 * Estimate cost before processing (for budget cap).
 */
export function estimateCost(lesson: LessonInput): CostEstimate {
  const talkingHeadSegments = lesson.segments.filter(s => s.visual_type === 'talking_head');
  const slideSegments = lesson.segments.filter(s => s.visual_type === 'slides');
  const totalChars = slideSegments.reduce((sum, s) => sum + s.script_zh.length, 0);

  return {
    heygenSegments: talkingHeadSegments.length,
    heygenCost: 0, // Credit-based (F-27), tracked separately
    elevenLabsCharacters: totalChars,
    elevenLabsCost: totalChars * 0.00003,
    totalEstimatedCost: totalChars * 0.00003, // HeyGen excluded from API cost
  };
}

/**
 * Process a complete lesson through the video pipeline.
 * Returns a PipelineResult matching the SSOT type from src/types/video.ts.
 */
export async function processLesson(
  lesson: LessonInput,
  outputDir: string,
  options: { dryRun?: boolean } = {}
): Promise<PipelineResult> {
  const lessonDir = join(outputDir, lesson.lesson_id);
  await mkdir(lessonDir, { recursive: true });

  console.log(`\nProcessing ${lesson.lesson_id}: ${lesson.title}`);
  console.log(`   ${lesson.segments.length} segments`);

  if (options.dryRun) {
    const cost = estimateCost(lesson);
    console.log(`   [DRY RUN] Estimated cost: $${cost.totalEstimatedCost.toFixed(4)}`);
    return {
      lesson_id: lesson.lesson_id,
      final_video_path: join(lessonDir, `${lesson.lesson_id}.mp4`),
      final_srt_path: join(lessonDir, `${lesson.lesson_id}.srt`),
      total_duration_seconds: lesson.segments.reduce((sum, s) => sum + s.duration_seconds, 0),
      segments_processed: lesson.segments.length,
      cost_usd: cost.totalEstimatedCost,
      errors: [],
    };
  }

  const segmentFiles: SegmentFile[] = [];
  let totalCost = 0;
  let currentTime = 0;
  const errors: string[] = [];

  for (const segment of lesson.segments) {
    console.log(`\n  Segment ${segment.segment_id} (${segment.visual_type})`);

    let videoPath: string;
    let srtContent: string | null = null;
    let duration: number;
    let cost = 0;

    try {
      if (segment.visual_type === 'talking_head') {
        // HeyGen avatar video
        const result = await createAvatarVideo(segment.script_zh);
        videoPath = join(lessonDir, `${segment.segment_id}_avatar.mp4`);
        await writeFile(videoPath, result.videoBuffer);
        duration = result.videoDuration;
        cost = result.cost;
      } else {
        // Slides: Remotion render + ElevenLabs TTS (F-10)
        const ttsResult = await generateSpeech(segment.script_zh);
        const audioPath = join(lessonDir, `${segment.segment_id}_audio.mp3`);
        await writeFile(audioPath, ttsResult.audioBuffer);

        videoPath = join(lessonDir, `${segment.segment_id}_slides.mp4`);
        // Attempt Remotion render, fallback to static
        try {
          await renderSlideVideo(segment, audioPath, videoPath);
        } catch (renderError) {
          const msg = renderError instanceof Error ? renderError.message : String(renderError);
          console.warn(`  Remotion render failed, using static fallback: ${msg}`);
          await createStaticVideo(segment, audioPath, videoPath);
        }

        srtContent = ttsResult.srtContent;
        duration = ttsResult.audioDuration;
        cost = ttsResult.cost;
      }

      segmentFiles.push({
        segmentId: segment.segment_id,
        videoPath,
        srtContent,
        startTime: currentTime,
        duration,
      });

      totalCost += cost;
      currentTime += duration;
    } catch (segError) {
      const msg = segError instanceof Error ? segError.message : String(segError);
      errors.push(`Segment ${segment.segment_id}: ${msg}`);
      console.error(`  Segment ${segment.segment_id} failed: ${msg}`);
    }
  }

  // Assemble final lesson video (only if we have segments)
  let finalVideoPath = join(lessonDir, `${lesson.lesson_id}.mp4`);
  let finalSrtPath = join(lessonDir, `${lesson.lesson_id}.srt`);

  if (segmentFiles.length > 0) {
    const assembled = await assembleLesson(segmentFiles, lessonDir, lesson.lesson_id);
    finalVideoPath = assembled.videoPath;
    finalSrtPath = assembled.srtPath;
  }

  const result: PipelineResult = {
    lesson_id: lesson.lesson_id,
    final_video_path: finalVideoPath,
    final_srt_path: finalSrtPath,
    total_duration_seconds: currentTime,
    segments_processed: segmentFiles.length,
    cost_usd: totalCost,
    errors,
  };

  console.log(`\n${lesson.lesson_id} complete: ${currentTime}s, $${totalCost.toFixed(4)}`);
  return result;
}

/**
 * Render slide video using Remotion (F-10).
 * Requires @remotion/renderer to be installed.
 */
async function renderSlideVideo(
  _segment: SegmentInput,
  _audioPath: string,
  _outputPath: string
): Promise<void> {
  // TODO: Implement actual Remotion rendering when @remotion/renderer is configured.
  // For now, fall through to static fallback.
  throw new Error('Remotion rendering not yet configured — use static fallback');
}

/**
 * Fallback: create static video with slide content overlay + audio.
 * Uses FFmpeg to combine a static image with audio.
 */
async function createStaticVideo(
  segment: SegmentInput,
  audioPath: string,
  outputPath: string
): Promise<void> {
  const duration = segment.duration_seconds;

  // Create a simple video from audio with black background.
  // In production, this would be replaced by Remotion render.
  await execFileAsync('ffmpeg', [
    '-y',
    '-f', 'lavfi', '-i', `color=c=black:s=1920x1080:d=${duration}`,
    '-i', audioPath,
    '-c:v', 'libx264', '-c:a', 'aac',
    '-shortest',
    outputPath,
  ]);

  console.log(`  Static slide video created: ${outputPath}`);
}

// Re-export for convenience
export { estimateCost as estimateVideoCost };
export type { CostEstimate } from './types.js';
