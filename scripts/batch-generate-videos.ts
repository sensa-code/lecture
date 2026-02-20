#!/usr/bin/env npx tsx
// Batch video generation
import { Command } from 'commander';
import { readFile, readdir, mkdir } from 'fs/promises';
import { join } from 'path';
import dotenv from 'dotenv';
import { processLesson, estimateCost } from '../src/lib/video-pipeline/index.js';
import { safeParseJSON } from '../src/lib/safe-json.js';
import { validateEnv, CostTracker, CircuitBreaker, progressBar, sleep, parseNumericOption, handleError, setupGracefulShutdown } from './utils.js';
import type { LessonScript } from '../src/types/lesson.js';

dotenv.config();

const program = new Command()
  .name('batch-generate-videos')
  .version('3.0.0')
  .description('Batch generate videos from approved lesson scripts')
  .requiredOption('--course <id>', 'Course ID')
  .option('--concurrency <n>', 'Max concurrent video jobs', '2')
  .option('--budget <usd>', 'Budget cap in USD (HeyGen + ElevenLabs)', '50')
  .option('--lessons-dir <dir>', 'Lessons directory', 'output/lessons')
  .option('--videos-dir <dir>', 'Video output directory', 'output/videos')
  .option('--start-from <lessonId>', 'Resume from specific lesson file')
  .option('--dry-run', 'Simulate without API calls')
  .option('--verbose', 'Show detailed error stacks')
  .parse();

const opts = program.opts();

async function main() {
  if (!opts.dryRun) {
    validateEnv(['HEYGEN_API_KEY', 'ELEVENLABS_API_KEY']);
  }

  const concurrencyNum = parseNumericOption(opts.concurrency, 'concurrency', { min: 1, integer: true });
  const budgetNum = parseNumericOption(opts.budget, 'budget', { min: 0.01, max: 500 });

  console.log('🎬 Batch Video Generator');
  console.log(`   Course: ${opts.course}`);
  console.log(`   Concurrency: ${concurrencyNum}`);
  console.log(`   Budget: $${budgetNum}`);
  console.log(`   Dry run: ${opts.dryRun || false}`);

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

  // Resume support
  if (opts.startFrom) {
    const startIdx = files.findIndex(f => f.includes(opts.startFrom));
    if (startIdx === -1) {
      const available = files.slice(0, 10).map(f => f.replace('.json', '')).join(', ');
      throw new Error(`Lesson "${opts.startFrom}" not found. Available: ${available}`);
    }
    files = files.slice(startIdx);
    console.log(`   Resuming from ${opts.startFrom} (${files.length} remaining)`);
  }

  const costTracker = new CostTracker(budgetNum);
  const circuitBreaker = new CircuitBreaker(3);

  let completed = 0;
  let failed = 0;

  setupGracefulShutdown(() =>
    `   Completed: ${completed}/${files.length}, Failed: ${failed}, Cost: ${costTracker}`
  );

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    console.log(`\n${progressBar(i + 1, files.length, file)}`);

    if (costTracker.isOverBudget) {
      console.log(`⚠️ Budget cap reached: ${costTracker}`);
      break;
    }

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
      costTracker.add(cost.totalEstimatedCost);
      console.log(`  [DRY RUN] Would generate video for ${lesson.lesson_id}`);
      console.log(`    HeyGen segments: ${cost.heygenSegments}, ElevenLabs chars: ${cost.elevenLabsCharacters}`);
      console.log(`    Estimated cost: $${cost.totalEstimatedCost.toFixed(4)}`);
      completed++;
      continue;
    }

    try {
      const result = await processLesson(lessonInput, videosDir);
      costTracker.add(result.cost_usd);
      circuitBreaker.recordSuccess();
      completed++;
      console.log(`  ✅ Video complete (cost: $${result.cost_usd.toFixed(4)}, running: ${costTracker})`);

      // Rate limit between API calls
      await sleep(2000);
    } catch (error) {
      console.error(`  ❌ Video generation failed: ${error instanceof Error ? error.message : error}`);
      circuitBreaker.recordFailure();
      failed++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Completed: ${completed}/${files.length}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Cost: ${costTracker}`);
}

main().catch(handleError);
