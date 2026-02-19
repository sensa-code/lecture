#!/usr/bin/env npx tsx
// Batch video generation
import { Command } from 'commander';
import { readFile, readdir, mkdir } from 'fs/promises';
import { join } from 'path';
import dotenv from 'dotenv';
import { processLesson, estimateCost } from '../src/lib/video-pipeline/index.js';
import { safeParseJSON } from '../src/lib/safe-json.js';
import { validateEnv, CostTracker, CircuitBreaker, progressBar, sleep } from './utils.js';
import type { LessonScript } from '../src/types/lesson.js';

dotenv.config();

const program = new Command()
  .name('batch-generate-videos')
  .description('Batch generate videos from approved lesson scripts')
  .requiredOption('--course <id>', 'Course ID')
  .option('--concurrency <n>', 'Max concurrent video jobs', '2')
  .option('--lessons-dir <dir>', 'Lessons directory', 'output/lessons')
  .option('--videos-dir <dir>', 'Video output directory', 'output/videos')
  .option('--dry-run', 'Simulate without API calls')
  .parse();

const opts = program.opts();

/** Process lessons with concurrency control */
async function withConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<void>
): Promise<void> {
  const executing: Promise<void>[] = [];

  for (let i = 0; i < items.length; i++) {
    const p = fn(items[i], i).then(() => {
      executing.splice(executing.indexOf(p), 1);
    });
    executing.push(p);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
}

async function main() {
  if (!opts.dryRun) {
    validateEnv(['HEYGEN_API_KEY', 'ELEVENLABS_API_KEY']);
  }

  console.log('🎬 Batch Video Generator');
  console.log(`   Course: ${opts.course}`);
  console.log(`   Concurrency: ${opts.concurrency}`);

  const lessonsDir = opts.lessonsDir;
  const videosDir = opts.videosDir;
  await mkdir(videosDir, { recursive: true });

  let files: string[];
  try {
    files = (await readdir(lessonsDir)).filter(f => f.endsWith('.json')).sort();
  } catch {
    files = [];
  }

  if (files.length === 0) {
    console.log('No lessons found. Run batch-generate-scripts first.');
    return;
  }

  const costTracker = new CostTracker(Infinity); // Videos use credits, not API cost
  const circuitBreaker = new CircuitBreaker(3);
  const concurrency = parseInt(opts.concurrency);

  let completed = 0;
  let failed = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    console.log(`\n${progressBar(i + 1, files.length, file)}`);

    if (circuitBreaker.isOpen) {
      console.log(`🔴 Circuit breaker open. Stopping.`);
      break;
    }

    const lessonRaw = await readFile(join(lessonsDir, file), 'utf-8');
    const lesson = safeParseJSON<LessonScript>(lessonRaw);
    if (!lesson) {
      console.error(`  ❌ Failed to parse ${file}`);
      failed++;
      continue;
    }

    // Convert LessonScript to LessonInput format
    const lessonInput = {
      course_id: lesson.course_id,
      lesson_id: lesson.lesson_id,
      title: lesson.title,
      segments: lesson.segments.map(s => ({
        segment_id: s.segment_id,
        type: s.type,
        speaker_mode: s.speaker_mode,
        visual_type: s.visual_type,
        script_zh: s.script_zh,
        slide_content: s.slide_content,
        visual_notes: s.visual_notes,
        duration_seconds: s.duration_seconds,
      })),
    };

    if (opts.dryRun) {
      const cost = estimateCost(lessonInput);
      console.log(`  [DRY RUN] Would generate video for ${lesson.lesson_id}`);
      console.log(`    HeyGen segments: ${cost.heygenSegments}, ElevenLabs chars: ${cost.elevenLabsCharacters}`);
      completed++;
      continue;
    }

    try {
      await processLesson(lessonInput, videosDir);
      circuitBreaker.recordSuccess();
      completed++;
    } catch (error) {
      console.error(`  ❌ Video generation failed: ${error instanceof Error ? error.message : error}`);
      circuitBreaker.recordFailure();
      failed++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Completed: ${completed}/${files.length}`);
  console.log(`   Failed: ${failed}`);
}

main().catch(console.error);
