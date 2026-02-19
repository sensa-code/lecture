#!/usr/bin/env npx tsx
// Batch quality check with sampling (SSOT imports from lib/)
import { Command } from 'commander';
import { readFile, writeFile, readdir, mkdir } from 'fs/promises';
import { join } from 'path';
import dotenv from 'dotenv';
import { checkQuality } from '../src/lib/check-quality.js';
import { qualityCheckWithSampling } from '../src/lib/auto-fix.js';
import { safeParseJSON } from '../src/lib/safe-json.js';
import { validateEnv, CostTracker, CircuitBreaker, progressBar, sleep, parseNumericOption, handleError } from './utils.js';
import type { LessonScript } from '../src/types/lesson.js';

dotenv.config();

const program = new Command()
  .name('batch-quality-check')
  .version('3.0.0')
  .description('Batch quality check with sampling and auto-fix')
  .requiredOption('--course <id>', 'Course ID')
  .option('--budget <usd>', 'Budget cap in USD', '3')
  .option('--sample-rate <n>', 'Force manual review every N lessons', '5')
  .option('--lessons-dir <dir>', 'Lessons directory', 'output/lessons')
  .option('--reports-dir <dir>', 'Reports output directory', 'output/reports')
  .option('--dry-run', 'Simulate without API calls')
  .option('--verbose', 'Show detailed error stacks')
  .parse();

const opts = program.opts();

async function main() {
  if (!opts.dryRun) {
    validateEnv(['ANTHROPIC_API_KEY']);
  }

  const budgetNum = parseNumericOption(opts.budget, 'budget', { min: 0.01, max: 100 });
  const sampleRateNum = parseNumericOption(opts.sampleRate, 'sample-rate', { min: 1, integer: true });

  console.log('🔍 Batch Quality Checker');
  console.log(`   Course: ${opts.course}`);
  console.log(`   Budget: $${budgetNum}`);
  console.log(`   Sample rate: every ${sampleRateNum} lessons`);

  const lessonsDir = opts.lessonsDir;
  const reportsDir = opts.reportsDir;
  await mkdir(reportsDir, { recursive: true });

  // Find all lesson JSON files
  let files: string[];
  try {
    files = (await readdir(lessonsDir)).filter(f => f.endsWith('.json')).sort();
  } catch {
    console.log(`⚠️ No lessons found in ${lessonsDir}`);
    files = [];
  }

  if (files.length === 0) {
    console.log('No lessons to check. Run batch-generate-scripts first.');
    return;
  }

  const costTracker = new CostTracker(budgetNum);
  const circuitBreaker = new CircuitBreaker(3);

  let approved = 0;
  let revisionNeeded = 0;
  let rejected = 0;
  let manualReview = 0;

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
      continue;
    }

    if (opts.dryRun) {
      const willSample = i % sampleRateNum === 0;
      console.log(`  [DRY RUN] Would check ${lesson.lesson_id}${willSample ? ' (SAMPLING)' : ''}`);
      approved++;
      continue;
    }

    try {
      const result = await qualityCheckWithSampling(
        lesson, i, checkQuality, { sampleRate: sampleRateNum }
      );

      const reportPath = join(reportsDir, `${lesson.lesson_id}-report.json`);
      await writeFile(reportPath, JSON.stringify({
        ...result.finalReport,
        forcedManualReview: result.forcedManualReview,
        rounds: result.rounds,
      }, null, 2), 'utf-8');

      const verdict = result.finalReport.verdict;
      if (result.forcedManualReview) {
        manualReview++;
        console.log(`  🔎 SAMPLING: ${lesson.lesson_id} forced to manual review`);
      } else if (verdict === 'approved') {
        approved++;
      } else if (verdict === 'revision_needed') {
        revisionNeeded++;
      } else {
        rejected++;
      }

      costTracker.add(0.08);
      circuitBreaker.recordSuccess();
      await sleep(2000);
    } catch (error) {
      console.error(`  ❌ Check failed: ${error instanceof Error ? error.message : error}`);
      circuitBreaker.recordFailure();
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Approved: ${approved}`);
  console.log(`   Revision needed: ${revisionNeeded}`);
  console.log(`   Rejected: ${rejected}`);
  console.log(`   Manual review (sampling): ${manualReview}`);
  console.log(`   Cost: ${costTracker}`);
}

main().catch(handleError);
