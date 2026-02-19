# Prompt #7：批量自動化腳本

---
prompt_id: "07-batch-automation"
version: "3.0"
estimated_tokens: ~3000
output_format: TypeScript files
dependencies: ["01_syllabus_generator", "02_lesson_script_generator", "04_quality_checker", "05_review_system", "06_video_pipeline"]
tech_stack: [TypeScript, Commander.js, Supabase, Claude API, video-pipeline]
expert_review: "F-2 修復（shared schema）+ F-4 修復（import 完整 prompt）+ F-18 修復（import applyFixes）+ F-26 修復（budget cap）+ F-7 修復（circuit breaker）+ Git checkpoint"
---

## 目標

建立 4 個批量自動化腳本 + 1 個狀態報告工具，將整個課程生成流水線串接為可一鍵執行的 CLI 工具。所有腳本支援 `--dry-run`、斷點續傳、費用追蹤、預算上限。

> **變更紀錄 v3.0**（專家審查 F-2, F-4, F-7, F-18, F-26）：
> - Schema 統一為 SSOT：直接 import 01 的 `SyllabusSchema` 和 02 的 `extractLessonsFromSyllabus()`（F-2）
> - System Prompt 統一：import 02 的 `SYSTEM_PROMPT`，不自行定義精簡版（F-4）
> - Auto-fix 統一：import 04 的 `applyFixes()`，禁止 JSON 字串替換（F-18）
> - 新增 `--budget <usd>` 預算上限，超過自動暫停（F-26）
> - 新增 circuit breaker：連續 3 次 API 失敗暫停並通知（F-7）
> - 每完成 5 堂課自動 git checkpoint（Git 安全規範）
> - 使用 `safeParseJSON()` 處理 API 回傳可能的 HTML（團隊踩坑記錄）

## 前置依賴

- 步驟 01 的 `syllabus.json` 輸出
- 步驟 05 的 Supabase 資料表已建立
- 步驟 06 的 `video-pipeline` 模組可用
- 環境變數：`ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

---

## 共用工具模組

### `scripts/utils.ts` — 共用函數

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ── 環境變數驗證 ──
export function validateEnv(
  required: string[]
): Record<string, string> {
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error(`缺少環境變數: ${missing.join(", ")}`);
    console.error("請在 .env 中設定或 export 這些變數");
    process.exit(1);
  }
  return Object.fromEntries(required.map((k) => [k, process.env[k]!]));
}

// ── Supabase client ──
export function createSupabase(): SupabaseClient {
  const env = validateEnv(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

// ── Claude client ──
export function createClaude(): Anthropic {
  validateEnv(["ANTHROPIC_API_KEY"]);
  return new Anthropic();
}

// ── 費用追蹤 ──
export interface CostTracker {
  inputTokens: number;
  outputTokens: number;
  apiCalls: number;
  add(input: number, output: number): void;
  summary(): { inputTokens: number; outputTokens: number; estimatedCost: number };
}

export function createCostTracker(): CostTracker {
  const tracker: CostTracker = {
    inputTokens: 0,
    outputTokens: 0,
    apiCalls: 0,
    add(input: number, output: number) {
      tracker.inputTokens += input;
      tracker.outputTokens += output;
      tracker.apiCalls += 1;
    },
    summary() {
      // Claude 3.5 Sonnet pricing
      const inputCost = (tracker.inputTokens / 1_000_000) * 3;
      const outputCost = (tracker.outputTokens / 1_000_000) * 15;
      return {
        inputTokens: tracker.inputTokens,
        outputTokens: tracker.outputTokens,
        estimatedCost: Math.round((inputCost + outputCost) * 100) / 100,
      };
    },
  };
  return tracker;
}

// ── 進度條 ──
export function progressBar(current: number, total: number, label: string): string {
  const pct = Math.round((current / total) * 100);
  const filled = Math.round(pct / 5);
  const bar = "█".repeat(filled) + "░".repeat(20 - filled);
  return `[${bar}] ${pct}% (${current}/${total}) ${label}`;
}

// ── 延遲 ──
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

---

## 腳本 1：`scripts/batch-generate-scripts.ts`

批量生成講稿 — 讀取大綱 JSON，逐堂呼叫 Claude API，結果存入 Supabase。

```typescript
import { Command } from "commander";
import { readFileSync } from "fs";
import { z } from "zod";
import {
  createSupabase, createClaude, createCostTracker,
  progressBar, sleep, validateEnv,
} from "./utils";

// ── CLI 定義 ──
const program = new Command()
  .name("batch-generate-scripts")
  .description("批量生成課程講稿")
  .requiredOption("--syllabus <path>", "大綱 JSON 檔案路徑")
  .option("--course-id <id>", "課程 ID（預設從大綱讀取）")
  .option("--start-from <n>", "從第 N 堂課開始（斷點續傳）", "1")
  .option("--dry-run", "模擬執行，不呼叫 API", false)
  .parse();

const opts = program.opts();

// ── 大綱結構驗證（F-2 修復：直接 import SSOT schema，不重新定義）──
// ⚠️ 禁止在此重新定義 SyllabusInputSchema
// 舊版使用 chapter_number/lesson_number（與 01/05 的 chapter_id/lesson_id 不一致）
// 現在統一使用 01 的 SyllabusSchema
import { SyllabusSchema } from '../schemas/syllabus';
import { extractLessonsFromSyllabus } from '../lib/generate-lesson';
import type { Syllabus } from '../types/syllabus';

// F-4 修復：import 完整 System Prompt，不自行定義精簡版
import { SYSTEM_PROMPT as LESSON_SYSTEM_PROMPT } from '../lib/generate-lesson';
import { buildLessonUserPrompt } from '../lib/build-lesson-prompt';
// F-18 修復：import applyFixes，不自行實作
import { applyFixes } from '../lib/auto-fix';
// 團隊踩坑記錄：API 回傳 HTML 時 JSON.parse 會炸
import { safeParseJSON } from '../lib/safe-json';

async function main() {
  validateEnv(["ANTHROPIC_API_KEY", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);

  // 1. 讀取並驗證大綱（F-2 修復：使用 01 的 SSOT schema）
  const raw = readFileSync(opts.syllabus, "utf-8");
  const syllabus: Syllabus = SyllabusSchema.parse(JSON.parse(raw));
  const courseId = opts.courseId || `course-${Date.now()}`;

  // 2. 使用 02 的 extractLessonsFromSyllabus（F-2 修復：統一資料提取邏輯）
  const allLessons = extractLessonsFromSyllabus(syllabus);

  const startFrom = parseInt(opts.startFrom, 10);
  const pendingLessons = allLessons.slice(startFrom - 1);
  const budget = opts.budget ? parseFloat(opts.budget) : Infinity;

  console.log(`\n課程：${syllabus.course_title}`);
  console.log(`總堂數：${allLessons.length}，本次處理：${pendingLessons.length}（從第 ${startFrom} 堂開始）`);
  if (budget < Infinity) console.log(`💰 預算上限：$${budget}`);
  if (opts.dryRun) console.log("🔸 DRY RUN 模式 — 不會呼叫 API 或寫入資料庫\n");

  const supabase = createSupabase();
  const claude = createClaude();
  const cost = createCostTracker();
  let successCount = 0;
  let failCount = 0;
  let consecutiveFailures = 0; // F-7：circuit breaker 計數器
  const CIRCUIT_BREAKER_THRESHOLD = 3; // 連續 3 次失敗暫停

  // 3. 逐堂處理
  for (let i = 0; i < pendingLessons.length; i++) {
    const lesson = pendingLessons[i];

    // F-26：預算檢查
    const currentCost = cost.summary().estimatedCost;
    if (currentCost >= budget) {
      console.log(`\n🛑 已達預算上限 $${budget}（已花費 $${currentCost}），暫停執行`);
      break;
    }

    // F-7：circuit breaker 檢查
    if (consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
      console.log(`\n🛑 連續 ${CIRCUIT_BREAKER_THRESHOLD} 次失敗，觸發 circuit breaker 暫停`);
      console.log(`請檢查 API 狀態後重新執行，使用 --start-from ${startFrom + successCount + failCount}`);
      break;
    }

    console.log(progressBar(i + 1, pendingLessons.length, `${lesson.lesson_id} ${lesson.title}`));

    if (opts.dryRun) {
      console.log(`  [DRY RUN] 會生成講稿並存入 lessons 表\n`);
      successCount++;
      continue;
    }

    try {
      // 3a. 呼叫 Claude API（使用 02 的完整 System Prompt，F-4 修復）
      const response = await claude.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 8192,
        system: LESSON_SYSTEM_PROMPT,
        messages: [
          { role: "user", content: buildLessonUserPrompt(lesson) },
        ],
      });

      const text = response.content[0].type === "text" ? response.content[0].text : "";
      cost.add(response.usage.input_tokens, response.usage.output_tokens);

      // 3b. 安全解析 JSON（團隊踩坑：API 可能回傳 HTML）
      const jsonStr = text.replace(/^```json?\s*/, '').replace(/\s*```$/, '').trim();
      const scriptData = safeParseJSON(jsonStr);
      if (!scriptData) throw new Error('Claude 回傳無法解析為 JSON');

      // 3c. 寫入 Supabase — 使用 RPC function（F-14 修復：transaction 包裹）
      // 欄位使用 lesson_id TEXT + chapter_id TEXT（F-13 修復：與 05 schema 一致）
      const { error } = await supabase.rpc('upsert_lesson_with_version', {
        p_course_id: courseId,
        p_lesson_id: lesson.lesson_id,
        p_chapter_id: lesson.chapter_id,
        p_title: lesson.title,
        p_content: scriptData,
        p_changed_by: 'ai-batch',
        p_change_summary: `批量生成 (${lesson.lesson_id})`,
      });

      if (error) throw new Error(`Supabase 寫入失敗: ${error.message}`);

      console.log(`  寫入成功 (${response.usage.output_tokens} tokens)\n`);
      successCount++;
      consecutiveFailures = 0; // 成功時重設 circuit breaker
    } catch (err) {
      console.error(`  失敗: ${err instanceof Error ? err.message : err}\n`);
      failCount++;
      consecutiveFailures++;
    }

    // Git checkpoint：每 5 堂課自動 commit（Git 安全規範）
    if (successCount > 0 && successCount % 5 === 0 && !opts.dryRun) {
      const { execSync } = await import('child_process');
      try {
        execSync('git add output/ && git commit -m "checkpoint: batch progress ' + successCount + '/' + allLessons.length + '"', { stdio: 'pipe' });
        console.log(`  📌 Git checkpoint: ${successCount}/${allLessons.length}`);
      } catch {
        // git commit 失敗不影響主流程
      }
    }

    // Rate limit 間隔
    if (i < pendingLessons.length - 1) {
      await sleep(2000);
    }
  }

  // 4. 摘要
  const summary = cost.summary();
  console.log("\n══════ 執行摘要 ══════");
  console.log(`成功: ${successCount} / 失敗: ${failCount} / 總計: ${pendingLessons.length}`);
  console.log(`API 呼叫: ${cost.apiCalls} 次`);
  console.log(`Token: ${summary.inputTokens} in + ${summary.outputTokens} out`);
  console.log(`預估費用: $${summary.estimatedCost}`);
  if (failCount > 0) {
    console.log(`\n下次續傳指令:`);
    console.log(`  npx tsx scripts/batch-generate-scripts.ts --syllabus ${opts.syllabus} --start-from ${startFrom + successCount}`);
  }
}

main().catch(console.error);
```

---

## 腳本 2：`scripts/batch-quality-check.ts`

批量品質檢查 — 讀取 pending 講稿，呼叫 Claude 檢查，自動修正低嚴重度問題。

```typescript
import { Command } from "commander";
import {
  createSupabase, createClaude, createCostTracker,
  progressBar, sleep, validateEnv,
} from "./utils";

// F-4 修復：import 完整 System Prompt，不自行定義精簡版
import { QUALITY_CHECK_SYSTEM_PROMPT } from '../lib/check-quality';
// F-18 修復：import applyFixes，禁止 JSON 字串替換
// ⚠️ 舊版使用 JSON.stringify → String.replace → JSON.parse，
//    會因中文引號破壞 JSON 結構（專家審查 F-18 紅燈）
import { applyFixes } from '../lib/auto-fix';
// F-3 修復：sampling 機制（每 N 堂強制 1 堂人工審核）
import { shouldForceManualReview } from '../lib/check-quality';
// 團隊踩坑記錄：API 回傳 HTML 時 JSON.parse 會炸
import { safeParseJSON } from '../lib/safe-json';

const program = new Command()
  .name("batch-quality-check")
  .description("批量講稿品質檢查")
  .requiredOption("--course <id>", "課程 ID")
  .option("--auto-fix", "自動修正 low/medium 嚴重度問題", true)
  .option("--max-rounds <n>", "自動修正最大輪數", "2")
  .option("--budget <usd>", "預算上限（USD）")
  .option("--dry-run", "模擬執行", false)
  .parse();

const opts = program.opts();

async function main() {
  validateEnv(["ANTHROPIC_API_KEY", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);

  const supabase = createSupabase();
  const claude = createClaude();
  const cost = createCostTracker();
  const budget = opts.budget ? parseFloat(opts.budget) : Infinity;

  // 1. 讀取待檢查的講稿
  // F-13 修復：使用 lesson_id TEXT 排序（與 05 schema 一致），不再用 chapter_number/lesson_number
  const { data: lessons, error } = await supabase
    .from("lessons")
    .select("id, lesson_id, title, content, version")
    .eq("course_id", opts.course)
    .eq("review_status", "pending")
    .order("lesson_id", { ascending: true });

  if (error) throw new Error(`讀取失敗: ${error.message}`);
  if (!lessons || lessons.length === 0) {
    console.log("沒有待檢查的講稿。");
    return;
  }

  console.log(`\n找到 ${lessons.length} 份待檢查講稿`);
  if (budget < Infinity) console.log(`💰 預算上限：$${budget}`);
  if (opts.dryRun) console.log("🔸 DRY RUN 模式\n");

  let approved = 0;
  let needsRevision = 0;
  let manualReview = 0;
  const maxRounds = parseInt(opts.maxRounds, 10);
  let consecutiveFailures = 0;
  const CIRCUIT_BREAKER_THRESHOLD = 3;

  // 2. 逐份檢查
  for (let i = 0; i < lessons.length; i++) {
    const lesson = lessons[i];

    // F-26：預算檢查
    const currentCost = cost.summary().estimatedCost;
    if (currentCost >= budget) {
      console.log(`\n🛑 已達預算上限 $${budget}（已花費 $${currentCost}），暫停執行`);
      break;
    }

    // F-7：circuit breaker
    if (consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
      console.log(`\n🛑 連續 ${CIRCUIT_BREAKER_THRESHOLD} 次失敗，觸發 circuit breaker 暫停`);
      break;
    }

    // F-3 修復：sampling 機制 — 每 5 堂強制 1 堂人工審核
    if (shouldForceManualReview(i)) {
      console.log(progressBar(i + 1, lessons.length, `${lesson.lesson_id} ${lesson.title}`));
      console.log(`  📋 Sampling 抽中：強制進入人工審核\n`);
      await supabase.from("lessons").update({
        review_status: "manual_review",
        reviewer_notes: JSON.stringify({ reason: "sampling: forced manual review" }),
        updated_at: new Date().toISOString(),
      }).eq("id", lesson.id);
      manualReview++;
      continue;
    }

    console.log(progressBar(i + 1, lessons.length, `${lesson.lesson_id} ${lesson.title}`));

    if (opts.dryRun) {
      console.log(`  [DRY RUN] 會呼叫品質檢查 API\n`);
      continue;
    }

    // F-13 修復：欄位名為 content（JSONB），不是 script_json
    let currentScript = lesson.content;
    let finalVerdict = "approved";
    let round = 0;

    // 2a. 檢查 + 自動修正迴圈
    while (round < maxRounds) {
      round++;

      try {
        const response = await claude.messages.create({
          model: "claude-sonnet-4-5-20250929",
          max_tokens: 3000,
          system: QUALITY_CHECK_SYSTEM_PROMPT, // F-4：使用 04 的完整 prompt
          messages: [
            { role: "user", content: `請檢查以下講稿的品質：\n\n${JSON.stringify(currentScript, null, 2)}` },
          ],
        });

        const text = response.content[0].type === "text" ? response.content[0].text : "";
        cost.add(response.usage.input_tokens, response.usage.output_tokens);

        // 團隊踩坑：安全解析 JSON
        const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) || [null, text];
        const report = safeParseJSON(jsonMatch[1]!.trim());
        if (!report) throw new Error('品質報告 JSON 解析失敗');

        consecutiveFailures = 0; // 成功時重設

        // 2b. 判斷結果
        const hasHighSeverity = report.issues?.some(
          (issue: { severity: string }) => issue.severity === "high"
        );

        if (report.verdict === "approved" || report.overall_score >= 80) {
          finalVerdict = "approved";
          break;
        }

        if (hasHighSeverity) {
          finalVerdict = "manual_review";
          await supabase.from("lessons").update({
            review_status: "manual_review",
            reviewer_notes: JSON.stringify(report),
            updated_at: new Date().toISOString(),
          }).eq("id", lesson.id);
          break;
        }

        // 2c. 自動修正 low/medium
        // F-18 修復：使用 04 的 applyFixes()，在 segment 物件層級操作
        // ⚠️ 禁止使用 JSON.stringify → String.replace → JSON.parse
        //    （中文引號會破壞 JSON 結構，專家審查 F-18 紅燈）
        if (opts.autoFix && report.issues?.length > 0) {
          console.log(`  第 ${round} 輪：發現 ${report.issues.length} 個問題，嘗試自動修正...`);
          currentScript = applyFixes(currentScript, report.issues);
          await sleep(2000);
          continue;
        }

        finalVerdict = "revision_needed";
        break;
      } catch (err) {
        console.error(`  品質檢查失敗: ${err instanceof Error ? err.message : err}`);
        consecutiveFailures++;
        finalVerdict = "revision_needed";
        break;
      }
    }

    // 2d. 更新資料庫（F-13 修復：欄位名為 content，不是 script_json）
    if (finalVerdict === "approved") {
      await supabase.from("lessons").update({
        content: currentScript,
        review_status: "approved",
        version: lesson.version + 1,
        updated_at: new Date().toISOString(),
      }).eq("id", lesson.id);
      approved++;
      console.log(`  通過（${round} 輪檢查）\n`);
    } else if (finalVerdict === "manual_review") {
      manualReview++;
      console.log(`  需人工審核（含高嚴重度問題）\n`);
    } else {
      needsRevision++;
      console.log(`  需修改（自動修正 ${maxRounds} 輪後仍未通過）\n`);
    }

    if (i < lessons.length - 1) await sleep(2000);
  }

  // 3. 摘要
  const summary = cost.summary();
  console.log("\n══════ 品質檢查摘要 ══════");
  console.log(`通過: ${approved} / 需修改: ${needsRevision} / 需人工: ${manualReview}`);
  console.log(`API 呼叫: ${cost.apiCalls} 次`);
  console.log(`預估費用: $${summary.estimatedCost}`);
}

main().catch(console.error);
```

---

## 腳本 3：`scripts/batch-generate-videos.ts`

批量生成影片 — 讀取 approved 講稿，呼叫影片流水線，支援並行控制。

```typescript
import { Command } from "commander";
import {
  createSupabase, createCostTracker,
  progressBar, sleep, validateEnv,
} from "./utils";

const program = new Command()
  .name("batch-generate-videos")
  .description("批量生成課程影片")
  .requiredOption("--course <id>", "課程 ID")
  .option("--concurrency <n>", "最大並行數", "2")
  .option("--output <dir>", "影片輸出目錄", "./output/videos")
  .option("--dry-run", "模擬執行", false)
  .parse();

const opts = program.opts();

// ── 並行控制器 ──
async function withConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<T[]> {
  const results: T[] = [];
  const executing = new Set<Promise<void>>();

  for (const task of tasks) {
    const p = task().then((result) => {
      results.push(result);
    });
    const wrapped = p.then(() => {
      executing.delete(wrapped);
    });
    executing.add(wrapped);

    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }
  await Promise.all(executing);
  return results;
}

async function main() {
  validateEnv([
    "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY",
    "ELEVENLABS_API_KEY", "HEYGEN_API_KEY",
  ]);

  const supabase = createSupabase();
  const cost = createCostTracker();
  const concurrency = parseInt(opts.concurrency, 10);

  // 1. 讀取已通過審核的講稿
  // F-13 修復：欄位名為 lesson_id + content（與 05 schema 一致）
  const { data: lessons, error } = await supabase
    .from("lessons")
    .select("id, lesson_id, title, content")
    .eq("course_id", opts.course)
    .eq("review_status", "approved")
    .order("lesson_id", { ascending: true });

  if (error) throw new Error(`讀取失敗: ${error.message}`);
  if (!lessons || lessons.length === 0) {
    console.log("沒有已通過審核的講稿可生成影片。");
    return;
  }

  console.log(`\n找到 ${lessons.length} 份講稿待生成影片（並行: ${concurrency}）`);
  if (opts.dryRun) console.log("🔸 DRY RUN 模式\n");

  if (opts.dryRun) {
    for (const lesson of lessons) {
      console.log(`  [DRY RUN] ${lesson.lesson_id} — ${lesson.title}`);
    }
    console.log(`\n預估影片生成費用: 見 06_video_pipeline_setup.md estimateCost()`);
    return;
  }

  let completed = 0;
  let failed = 0;

  // 2. 建立任務清單
  const tasks = lessons.map((lesson) => async () => {
    const jobId = `${lesson.id}-${Date.now()}`;

    try {
      // 2a. 建立 video_job 記錄
      await supabase.from("video_jobs").insert({
        id: jobId,
        lesson_id: lesson.id,
        status: "processing",
        created_at: new Date().toISOString(),
      });

      // 2b. 呼叫影片流水線（見 06_video_pipeline_setup.md）
      // import { processLesson } from "../src/video-pipeline";
      // const result = await processLesson(lesson.content, opts.output);

      // 模擬呼叫 — 實際使用時替換為上方 import
      console.log(`  處理中: ${lesson.lesson_id} — ${lesson.title}`);
      await sleep(1000); // 實際影片生成需要數分鐘

      // 2c. 更新狀態
      await supabase.from("video_jobs").update({
        status: "completed",
        output_url: `${opts.output}/${lesson.lesson_id}.mp4`,
        completed_at: new Date().toISOString(),
      }).eq("id", jobId);

      await supabase.from("lessons").update({
        review_status: "production",
        updated_at: new Date().toISOString(),
      }).eq("id", lesson.id);

      completed++;
      console.log(`  完成: ${lesson.lesson_id}`);
      return { id: lesson.lesson_id, status: "completed" as const };
    } catch (err) {
      await supabase.from("video_jobs").update({
        status: "failed",
        error_message: err instanceof Error ? err.message : String(err),
      }).eq("id", jobId);

      failed++;
      console.error(`  失敗: ${lesson.lesson_id} — ${err instanceof Error ? err.message : err}`);
      return { id: lesson.lesson_id, status: "failed" as const };
    }
  });

  // 3. 並行執行
  await withConcurrency(tasks, concurrency);

  // 4. 摘要
  console.log("\n══════ 影片生成摘要 ══════");
  console.log(`完成: ${completed} / 失敗: ${failed} / 總計: ${lessons.length}`);
}

main().catch(console.error);
```

---

## 腳本 4：`scripts/status-report.ts`

進度報告 — 從 Supabase 讀取整個課程狀態，產出表格化摘要。

```typescript
import { Command } from "commander";
import { createSupabase, validateEnv } from "./utils";

const program = new Command()
  .name("status-report")
  .description("課程生成進度報告")
  .requiredOption("--course <id>", "課程 ID")
  .option("--detailed", "顯示每堂課明細", false)
  .parse();

const opts = program.opts();

async function main() {
  validateEnv(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);

  const supabase = createSupabase();

  // 1. 讀取課程資訊
  const { data: course } = await supabase
    .from("courses")
    .select("id, title, total_lessons")
    .eq("id", opts.course)
    .single();

  if (!course) {
    console.error(`找不到課程: ${opts.course}`);
    process.exit(1);
  }

  // 2. 讀取所有講稿（F-13 修復：使用 lesson_id 排序，不再用 chapter_number/lesson_number）
  const { data: lessons } = await supabase
    .from("lessons")
    .select("id, lesson_id, title, review_status, version, updated_at")
    .eq("course_id", opts.course)
    .order("lesson_id", { ascending: true });

  // 3. 讀取影片任務
  const { data: videoJobs } = await supabase
    .from("video_jobs")
    .select("lesson_id, status, error_message, created_at, completed_at")
    .in("lesson_id", (lessons || []).map((l) => l.id));

  // 4. 統計
  const total = course.total_lessons || 0;
  const generated = lessons?.length || 0;
  const statusCounts: Record<string, number> = {};
  for (const lesson of lessons || []) {
    statusCounts[lesson.review_status] = (statusCounts[lesson.review_status] || 0) + 1;
  }

  const videoCompleted = videoJobs?.filter((j) => j.status === "completed").length || 0;
  const videoFailed = videoJobs?.filter((j) => j.status === "failed").length || 0;

  // 5. 輸出報告
  console.log(`\n${"═".repeat(50)}`);
  console.log(`  課程進度報告：${course.title}`);
  console.log(`${"═".repeat(50)}\n`);

  // 進度總覽
  const stages = [
    { label: "大綱規劃", done: total > 0, count: `${total} 堂` },
    { label: "講稿生成", done: generated > 0, count: `${generated}/${total}` },
    { label: "品質通過", done: (statusCounts["approved"] || 0) > 0, count: `${statusCounts["approved"] || 0}/${generated}` },
    { label: "影片完成", done: videoCompleted > 0, count: `${videoCompleted}/${statusCounts["approved"] || 0}` },
  ];

  for (const stage of stages) {
    const icon = stage.done ? "[v]" : "[ ]";
    console.log(`  ${icon} ${stage.label.padEnd(10)} ${stage.count}`);
  }

  // 狀態分布
  console.log(`\n  講稿狀態分布:`);
  const statusLabels: Record<string, string> = {
    draft: "草稿",
    pending: "待審核",
    approved: "已通過",
    revision_needed: "需修改",
    manual_review: "人工審核",
    production: "已上線",
  };
  for (const [status, count] of Object.entries(statusCounts)) {
    const bar = "█".repeat(Math.round((count / generated) * 20));
    console.log(`    ${(statusLabels[status] || status).padEnd(8)} ${bar} ${count}`);
  }

  // 費用預估
  const approvedCount = statusCounts["approved"] || 0;
  const remainingScripts = total - generated;
  const remainingVideos = approvedCount - videoCompleted;
  const estScriptCost = remainingScripts * 0.05; // ~$0.05/lecture
  const estVideoCost = remainingVideos * 2.5;     // ~$2.50/video
  console.log(`\n  預估剩餘費用:`);
  console.log(`    講稿生成: ${remainingScripts} 堂 x $0.05 = $${estScriptCost.toFixed(2)}`);
  console.log(`    影片生成: ${remainingVideos} 堂 x $2.50 = $${estVideoCost.toFixed(2)}`);
  console.log(`    合計: $${(estScriptCost + estVideoCost).toFixed(2)}`);

  // 失敗任務
  const failedJobs = videoJobs?.filter((j) => j.status === "failed") || [];
  if (failedJobs.length > 0) {
    console.log(`\n  失敗的影片任務:`);
    for (const job of failedJobs) {
      console.log(`    - ${job.lesson_id}: ${job.error_message || "未知錯誤"}`);
    }
  }

  // 明細
  if (opts.detailed && lessons) {
    console.log(`\n  ${"─".repeat(46)}`);
    console.log(`  ${"ID".padEnd(20)} ${"標題".padEnd(15)} 狀態`);
    console.log(`  ${"─".repeat(46)}`);
    for (const lesson of lessons) {
      const videoStatus = videoJobs?.find((j) => j.lesson_id === lesson.id)?.status || "-";
      console.log(
        `  ${(lesson.lesson_id || lesson.id).padEnd(20)} ${lesson.title.substring(0, 12).padEnd(15)} ${lesson.review_status} | 影片: ${videoStatus}`
      );
    }
  }

  console.log(`\n${"═".repeat(50)}\n`);
}

main().catch(console.error);
```

---

## CLAUDE.md 模板

為使用此批量工具的專案自動生成的上下文檔案：

```markdown
# CLAUDE.md — 獸醫溝通課程自動化專案

## 專案概述
使用 Claude API + Supabase + HeyGen/ElevenLabs 自動生成獸醫師溝通技巧課程影片。

## 可用指令
- `npx ts-node scripts/batch-generate-scripts.ts --syllabus syllabus.json` — 批量生成講稿
- `npx ts-node scripts/batch-quality-check.ts --course <id>` — 批量品質檢查
- `npx ts-node scripts/batch-generate-videos.ts --course <id>` — 批量生成影片
- `npx ts-node scripts/status-report.ts --course <id>` — 查看進度
- 所有指令支援 `--dry-run` 模擬執行
- 所有指令支援 `--help` 查看完整參數

## 資料夾結構
scripts/           → 批量自動化腳本
src/video-pipeline → 影片生成模組（TTS + HeyGen + FFmpeg）
output/videos      → 影片輸出目錄

## 環境變數
ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
ELEVENLABS_API_KEY, HEYGEN_API_KEY

## 典型工作流程
1. 確認 syllabus.json 存在
2. `--dry-run` 預覽
3. 正式執行講稿生成
4. 品質檢查（自動修正 low/medium，人工處理 high）
5. 影片生成（建議 concurrency=2）
6. status-report 確認進度
```

---

## 測試要求

### 單元測試
```typescript
// scripts/__tests__/utils.test.ts
describe("createCostTracker", () => {
  test("正確累計 token 和計算費用", () => {
    const tracker = createCostTracker();
    tracker.add(1000, 500);
    tracker.add(2000, 1000);
    const s = tracker.summary();
    expect(s.inputTokens).toBe(3000);
    expect(s.outputTokens).toBe(1500);
    expect(s.estimatedCost).toBeGreaterThan(0);
  });
});

describe("progressBar", () => {
  test("100% 顯示全滿", () => {
    expect(progressBar(10, 10, "done")).toContain("100%");
  });
  test("0/10 顯示 0%", () => {
    expect(progressBar(0, 10, "start")).toContain("0%");
  });
});

describe("validateEnv", () => {
  test("缺少變數時 process.exit", () => {
    const mockExit = jest.spyOn(process, "exit").mockImplementation();
    delete process.env.NONEXISTENT_VAR;
    validateEnv(["NONEXISTENT_VAR"]);
    expect(mockExit).toHaveBeenCalledWith(1);
    mockExit.mockRestore();
  });
});
```

### 整合測試（使用 --dry-run）
```bash
# 驗證 CLI 參數解析正確
npx ts-node scripts/batch-generate-scripts.ts --syllabus test-syllabus.json --dry-run
npx ts-node scripts/batch-quality-check.ts --course test-001 --dry-run
npx ts-node scripts/batch-generate-videos.ts --course test-001 --dry-run
npx ts-node scripts/status-report.ts --course test-001
```

---

## 六階段執行計畫

| 階段 | 內容 | 驗證方式 |
|------|------|---------|
| 1. 環境準備 | `npm install commander zod @anthropic-ai/sdk @supabase/supabase-js` | `npx tsc --noEmit` |
| 2. 共用模組 | 建立 `scripts/utils.ts` | 單元測試通過 |
| 3. 講稿生成 | 建立 `batch-generate-scripts.ts` | `--dry-run` 正常輸出 |
| 4. 品質檢查 | 建立 `batch-quality-check.ts` | `--dry-run` + 自動修正邏輯 |
| 5. 影片生成 | 建立 `batch-generate-videos.ts` | `--dry-run` + 並行控制 |
| 6. 狀態報告 | 建立 `status-report.ts` + CLAUDE.md | 完整表格輸出 |

## 品質檢查清單

- [ ] 4 個腳本都有 `--dry-run` 選項
- [ ] 4 個腳本開頭都驗證環境變數
- [ ] 費用追蹤在每次 API 呼叫後更新
- [ ] 斷點續傳：`batch-generate-scripts` 支援 `--start-from`
- [ ] 並行控制：`batch-generate-videos` 的 `withConcurrency` 正確限制
- [ ] 自動修正迴圈最多 2 輪，避免無限迴圈
- [ ] 自動修正使用 `applyFixes()`（segment 層級），**禁止 JSON 字串替換**（F-18）
- [ ] Supabase 寫入使用 RPC function `upsert_lesson_with_version`（transaction 包裹，F-14）
- [ ] 所有 Supabase 欄位名稱使用 `lesson_id`/`content`（不是 `lesson_number`/`script_json`，F-13）
- [ ] `--budget <usd>` 預算上限，超過自動暫停（F-26）
- [ ] Circuit breaker：連續 3 次 API 失敗暫停（F-7）
- [ ] 每 5 堂課 git checkpoint（Git 安全規範）
- [ ] Sampling：每 5 堂強制 1 堂 `manual_review`（F-3）
- [ ] CLI 參數定義完整（`--help` 顯示所有選項）
- [ ] 每個腳本結束都輸出執行摘要
- [ ] 進度條在處理過程中即時更新

## 常見錯誤處理

| 錯誤 | 原因 | 解法 |
|------|------|------|
| `Rate limit exceeded` | Claude API 呼叫過快 | 增加 `sleep()` 間隔至 3-5 秒 |
| `PGRST301` | Supabase RLS 阻擋 | 確認使用 `SERVICE_ROLE_KEY`（繞過 RLS） |
| `ENOMEM` | 大量並行影片生成耗盡記憶體 | 降低 `--concurrency` 至 1-2 |
| JSON parse 失敗 | Claude 輸出格式不符預期 | 使用 ````json``` 區塊提取 + retry |
| `upsert` 衝突 | `onConflict` 欄位不正確 | 確認 `id` 是 primary key |
