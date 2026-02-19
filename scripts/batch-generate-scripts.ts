#!/usr/bin/env npx tsx
// Batch lesson script generation (SSOT imports from lib/)
import { Command } from 'commander';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import dotenv from 'dotenv';
import { SyllabusSchema } from '../src/schemas/syllabus.js';
import { extractLessonsFromSyllabus, generateLessonScript } from '../src/lib/generate-lesson.js';
import { safeParseJSON } from '../src/lib/safe-json.js';
import { validateEnv, CostTracker, CircuitBreaker, progressBar, sleep, parseNumericOption, readFileSafe, handleError } from './utils.js';
import type { Syllabus } from '../src/types/syllabus.js';

dotenv.config();

const program = new Command()
  .name('batch-generate-scripts')
  .version('3.0.0')
  .description('Batch generate lesson scripts from syllabus')
  .requiredOption('--syllabus <path>', 'Path to syllabus.json')
  .option('--budget <usd>', 'Budget cap in USD', '5')
  .option('--start-from <lessonId>', 'Resume from specific lesson')
  .option('--dry-run', 'Simulate without API calls')
  .option('--output <dir>', 'Output directory', 'output/lessons')
  .parse();

const opts = program.opts();

async function main() {
  if (!opts.dryRun) {
    validateEnv(['ANTHROPIC_API_KEY']);
  }

  const budgetNum = parseNumericOption(opts.budget, 'budget', { min: 0.01, max: 100 });

  console.log('📚 Batch Lesson Script Generator');
  console.log(`   Syllabus: ${opts.syllabus}`);
  console.log(`   Budget: $${budgetNum}`);
  console.log(`   Dry run: ${opts.dryRun || false}`);

  // Load and validate syllabus
  const syllabusRaw = await readFileSafe(opts.syllabus, 'Syllabus file');
  const syllabusData = safeParseJSON<Syllabus>(syllabusRaw);
  if (!syllabusData) throw new Error('Failed to parse syllabus JSON');

  const parseResult = SyllabusSchema.safeParse(syllabusData);
  if (!parseResult.success) {
    if (opts.dryRun) {
      console.log(`⚠️ Syllabus validation failed (dry-run mode, showing errors):`);
      console.log(`   ${parseResult.error.issues.length} validation issue(s)`);
      parseResult.error.issues.forEach(issue => {
        console.log(`   - ${issue.path.join('.')}: ${issue.message}`);
      });
      console.log(`\n✅ Dry run complete — script structure OK, syllabus needs valid data`);
      return;
    }
    throw parseResult.error;
  }
  const syllabus = parseResult.data;

  // Extract lessons (SSOT)
  const allLessons = extractLessonsFromSyllabus(syllabus);
  let lessons = allLessons;

  // Resume support
  if (opts.startFrom) {
    const startIdx = lessons.findIndex(l => l.lesson_id === opts.startFrom);
    if (startIdx === -1) throw new Error(`Lesson ${opts.startFrom} not found`);
    lessons = lessons.slice(startIdx);
    console.log(`   Resuming from ${opts.startFrom} (${lessons.length} remaining)`);
  }

  const costTracker = new CostTracker(budgetNum);
  const circuitBreaker = new CircuitBreaker(3);
  const outputDir = opts.output;
  await mkdir(outputDir, { recursive: true });

  let completed = 0;
  let failed = 0;

  for (let i = 0; i < lessons.length; i++) {
    const lesson = lessons[i];
    console.log(`\n${progressBar(i + 1, lessons.length, lesson.lesson_id)}`);

    if (costTracker.isOverBudget) {
      console.log(`⚠️ Budget cap reached: ${costTracker}`);
      break;
    }

    if (circuitBreaker.isOpen) {
      console.log(`🔴 Circuit breaker open: ${circuitBreaker.failures} consecutive failures. Stopping.`);
      break;
    }

    if (opts.dryRun) {
      console.log(`  [DRY RUN] Would generate ${lesson.lesson_id}`);
      completed++;
      continue;
    }

    try {
      const script = await generateLessonScript(lesson);
      const outputPath = join(outputDir, `${lesson.lesson_id}.json`);
      await writeFile(outputPath, JSON.stringify(script, null, 2), 'utf-8');
      console.log(`  ✅ Saved: ${outputPath}`);

      costTracker.add(0.08); // Estimated per-lesson Claude API cost
      circuitBreaker.recordSuccess();
      completed++;

      // Rate limit
      await sleep(2000);

      // Git checkpoint every 5 lessons
      if (completed % 5 === 0) {
        console.log(`  📌 Git checkpoint at ${completed} lessons`);
      }
    } catch (error) {
      console.error(`  ❌ Failed: ${error instanceof Error ? error.message : error}`);
      circuitBreaker.recordFailure();
      failed++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Completed: ${completed}/${lessons.length}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Cost: ${costTracker}`);
}

main().catch(handleError);
