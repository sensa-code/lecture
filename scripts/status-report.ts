#!/usr/bin/env npx tsx
// Course generation status report
import { Command } from 'commander';
import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import dotenv from 'dotenv';
import { safeParseJSON } from '../src/lib/safe-json.js';
import { handleError } from './utils.js';

dotenv.config();

interface QualityReport {
  overall_score: number;
  verdict: string;
  forcedManualReview?: boolean;
}

const program = new Command()
  .name('status-report')
  .version('3.0.0')
  .description('Show course generation progress and status')
  .requiredOption('--course <id>', 'Course ID')
  .option('--lessons-dir <dir>', 'Lessons directory', 'output/lessons')
  .option('--reports-dir <dir>', 'Reports directory', 'output/reports')
  .option('--videos-dir <dir>', 'Videos directory', 'output/videos')
  .option('--detailed', 'Show detailed per-lesson status')
  .option('--dry-run', 'Simulate mode')
  .parse();

const opts = program.opts();

async function dirFiles(dir: string): Promise<string[]> {
  try {
    return (await readdir(dir)).sort();
  } catch {
    return [];
  }
}

async function main() {
  console.log(`📊 Status Report — Course: ${opts.course}`);
  console.log('─'.repeat(50));

  // Count lessons
  const lessonFiles = (await dirFiles(opts.lessonsDir)).filter(f => f.endsWith('.json'));
  console.log(`\n📝 Lessons: ${lessonFiles.length}`);

  // Count reports and analyze verdicts
  const reportFiles = (await dirFiles(opts.reportsDir)).filter(f => f.endsWith('.json'));
  let approved = 0;
  let revisionNeeded = 0;
  let rejected = 0;
  let manualReview = 0;
  let totalScore = 0;

  for (const file of reportFiles) {
    try {
      const raw = await readFile(join(opts.reportsDir, file), 'utf-8');
      const report = safeParseJSON<QualityReport>(raw);
      if (report) {
        totalScore += report.overall_score;
        if (report.forcedManualReview) {
          manualReview++;
        } else if (report.verdict === 'approved') {
          approved++;
        } else if (report.verdict === 'revision_needed') {
          revisionNeeded++;
        } else {
          rejected++;
        }
      }
    } catch { /* skip */ }
  }

  console.log(`\n🔍 Quality Reports: ${reportFiles.length}`);
  if (reportFiles.length > 0) {
    console.log(`   ✅ Approved: ${approved}`);
    console.log(`   🔧 Revision needed: ${revisionNeeded}`);
    console.log(`   ❌ Rejected: ${rejected}`);
    console.log(`   🔎 Manual review: ${manualReview}`);
    console.log(`   📈 Average score: ${(totalScore / reportFiles.length).toFixed(1)}`);
  }

  // Count videos
  const videoFiles = (await dirFiles(opts.videosDir)).filter(f => f.endsWith('.mp4'));
  console.log(`\n🎬 Videos: ${videoFiles.length}`);

  // Summary
  console.log('\n' + '─'.repeat(50));
  console.log('📋 Pipeline Status:');
  console.log(`   Lessons generated: ${lessonFiles.length}`);
  console.log(`   Quality checked: ${reportFiles.length}`);
  console.log(`   Videos produced: ${videoFiles.length}`);

  const pendingQC = lessonFiles.length - reportFiles.length;
  const pendingVideo = approved - videoFiles.length;
  if (pendingQC > 0) console.log(`   ⏳ Pending quality check: ${pendingQC}`);
  if (pendingVideo > 0) console.log(`   ⏳ Pending video generation: ${pendingVideo}`);

  if (opts.detailed && lessonFiles.length > 0) {
    console.log('\n📋 Detailed Lesson Status:');
    for (const file of lessonFiles) {
      const lessonId = file.replace('.json', '');
      const hasReport = reportFiles.some(f => f.includes(lessonId));
      const hasVideo = videoFiles.some(f => f.includes(lessonId));
      const status = hasVideo ? '🎬' : hasReport ? '✅' : '📝';
      console.log(`   ${status} ${lessonId}`);
    }
  }
}

main().catch(handleError);
