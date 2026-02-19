---
system_name: "AI 獸醫課程生成系統"
version: "3.0"
total_prompts: 8
estimated_total_cost: "$160-310 USD per course (25 lessons)"
last_updated: "2026-02-19"
expert_review: "10 人專家委員會審查，30 項缺陷修復（F-1 ~ F-30）"
---

# AI 課程生成系統 — 完整執行指南

## 系統概述

本系統將獸醫專業知識通過 AI 自動化流水線轉換為可銷售的線上課程影片。
每個 Prompt 檔案都是**自包含的完整規格書**，可直接丟給 Claude Code 一鍵執行。

> **v3.0 變更**（專家審查後修訂）：
> - 新增 Stage 00 知識深挖（整合 Obsidian 教學內容模板 Prompt A 的 7 面向）
> - 所有 schema 統一為 SSOT（Single Source of Truth），禁止各步驟重複定義
> - 品質檢查加入 sampling 機制（每 5 堂強制 1 堂人工審核）
> - 批量腳本加入 budget cap、circuit breaker、git checkpoint
> - Slides segment 改用 Remotion 渲染（取代黑底靜態影片）
> - SRT 字幕改用 ElevenLabs alignment API 精確化（取代估算）
> - DB 加入 `batch_jobs` 表、owner-based RLS、`::DECIMAL` 精度修正
> - 成本估算修正為實際費率（含 HeyGen credit 體系）

## Pipeline 依賴圖

```
┌─────────────────┐
│ 00 知識深挖      │ ← 輸入：課程主題、臨床領域
│   knowledge.json │      7 面向深挖（病理、治療、爭議...）
└───────┬─────────┘
        │ knowledge-base.json
        ▼
┌─────────────────┐
│ 01 課程大綱生成  │ ← 輸入：knowledge-base + 目標受眾
│   syllabus.json  │      含 Bloom's Taxonomy 學習目標
└───────┬─────────┘
        │ syllabus.json
        ▼
┌─────────────────┐     ┌─────────────────┐
│ 02 單堂講稿生成  │────▶│ 03 案例對話生成  │ (可選，豐富 case segment)
│   lesson.json    │     │   dialogue.json  │
└───────┬─────────┘     └───────┬─────────┘
        │                       │
        ▼                       │
┌─────────────────┐◀────────────┘
│ 04 品質檢查      │
│   report.json    │──┐
└───────┬─────────┘  │ revision_needed → applyFixes() → 重新檢查
        │ approved    │ sampling → 每 5 堂強制 1 堂人工審核
        ▼             │
┌─────────────────┐◀──┘
│ 05 審核系統 DB   │ ← 一次性建置（Supabase migration + API routes + auth）
│   Supabase 表    │    batch_jobs 表 + owner-based RLS
└───────┬─────────┘
        │ approved lessons
        ▼
┌─────────────────┐
│ 06 影片生成管線  │ ← HeyGen + ElevenLabs + Remotion + FFmpeg
│   MP4 + SRT      │    slides 用 Remotion 渲染 / SRT 用 alignment API
└───────┬─────────┘
        │
        ▼
┌─────────────────┐
│ 07 批量自動化    │ ← 串接 00→04 + 06，一鍵全自動
│   全課程影片      │    budget cap + circuit breaker + git checkpoint
└─────────────────┘
```

## 檔案清單與執行順序

| 順序 | 檔案 | 用途 | 預估 Token | API 費用/堂 |
|------|------|------|-----------|------------|
| 0 | `00_knowledge_deep_dive.md` | 知識深挖（7 面向） | ~3,000 | $0.08 |
| 1 | `01_syllabus_generator.md` | 生成課程大綱（含 Bloom's Taxonomy） | ~2,500 | $0.05 |
| 2 | `02_lesson_script_generator.md` | 單堂課講稿生成 | ~3,000 | $0.08 |
| 3 | `03_case_dialogue_generator.md` | 案例情境對話生成 | ~2,500 | $0.06 |
| 4 | `04_quality_checker.md` | 講稿品質檢查（含 sampling） | ~2,500 | $0.06 |
| 5 | `05_review_system_setup.md` | 審核系統資料庫建置 | ~3,500 | 一次性 |
| 6 | `06_video_pipeline_setup.md` | 影片生成流水線建置 | ~3,500 | 一次性 |
| 7 | `07_batch_automation.md` | 批量自動化腳本 | ~3,000 | 一次性 |

**整門課程預估費用**（25 堂課）：

| 項目 | 計算方式 | 費用 |
|------|---------|------|
| Claude API — 知識深挖 | 1 次 × $0.08 | $0.08 |
| Claude API — 大綱生成 | 1 次 × $0.05 | $0.05 |
| Claude API — 講稿生成 | 25 堂 × $0.08 | $2.00 |
| Claude API — 品質檢查（含 retry） | 25 堂 × $0.08 | $2.00 |
| ElevenLabs TTS | 25 堂 × 約 2,000 字 | $1.50 |
| HeyGen 數位人影片 | 25 堂 × 10 分鐘（credit-based） | $150-250 |
| Remotion slides 渲染 | 本地運算，無 API 費用 | $0.00 |
| **總計** | | **$156-256 / 門課** |

> ⚠️ HeyGen 為 credit-based 計費（非按秒），實際費用取決於方案和 avatar。
> 建議使用 `--budget <usd>` 參數設定預算上限。

## 前置條件

### 必要環境
- Node.js >= 20 LTS
- TypeScript >= 5.3
- FFmpeg（影片合成用，步驟 6 需要）
- Supabase 帳號（步驟 5 需要）

### 必要 npm 套件
```bash
npm install @anthropic-ai/sdk zod commander @supabase/supabase-js
npm install @remotion/cli @remotion/renderer @remotion/bundler react react-dom
npm install -D typescript vitest @types/node @types/react
```

### 環境變數
```bash
# .env
ANTHROPIC_API_KEY=sk-ant-xxx          # Claude API（步驟 0-4, 7）
SUPABASE_URL=https://xxx.supabase.co  # Supabase（步驟 5, 7）
SUPABASE_KEY=eyJxxx                   # Supabase anon key（步驟 5, 7）
SUPABASE_SERVICE_ROLE_KEY=eyJxxx      # Supabase service role（步驟 5, 7）
HEYGEN_API_KEY=xxx                    # HeyGen（步驟 6）
ELEVENLABS_API_KEY=xxx                # ElevenLabs（步驟 6）
```

## 使用方式

### 方式一：逐步執行（推薦初次使用）
```bash
# 0. 知識深挖（新增！）
claude "請根據 00_knowledge_deep_dive.md 對『獸醫師溝通話術完全攻略』進行知識深挖"

# 1. 生成大綱（接收知識深挖結果）
claude "請根據 01_syllabus_generator.md，使用 output/knowledge-base.json 生成課程大綱"

# 2. 審核大綱後，逐堂生成講稿
claude "請根據 02_lesson_script_generator.md，使用 output/syllabus.json 中的 lesson-01-01 生成講稿"

# 3. 品質檢查
claude "請根據 04_quality_checker.md 檢查 output/lesson-01-01.json"

# 4. 確認流程可行後，建置自動化（步驟 5→6→7）
claude "請根據 05_review_system_setup.md 建立資料庫"
claude "請根據 06_video_pipeline_setup.md 建立影片管線"
claude "請根據 07_batch_automation.md 建立批量腳本"
```

### 方式二：一步到位（熟悉後使用）
```bash
# 先建置基礎設施
claude "請依序執行 05 → 06 → 07 建立完整系統"

# 再批量生成（含預算上限）
node scripts/batch-generate-scripts.ts --syllabus output/syllabus.json --budget 5
node scripts/batch-quality-check.ts --course vet-comm-001 --budget 3
node scripts/batch-generate-videos.ts --course vet-comm-001 --concurrency 2
node scripts/status-report.ts --course vet-comm-001
```

## SSOT 架構（v3.0 新增）

所有步驟共用的型別和 schema 定義在唯一來源，禁止在各步驟中重新定義：

```
src/
├── types/           # SSOT：TypeScript 介面定義
│   ├── syllabus.ts  # Syllabus, Chapter, Lesson, BloomLevel
│   ├── lesson.ts    # LessonScript, Segment, Quiz
│   ├── quality.ts   # QualityReport, QualityIssue
│   └── video.ts     # VideoJob, VideoSegment
├── schemas/         # SSOT：Zod 驗證 schema
│   ├── syllabus.ts  # SyllabusSchema
│   ├── lesson.ts    # LessonScriptSchema
│   └── quality.ts   # QualityReportSchema
└── lib/
    ├── auto-fix.ts          # applyFixes()（唯一的自動修正邏輯）
    ├── check-quality.ts     # QUALITY_CHECK_SYSTEM_PROMPT
    ├── generate-lesson.ts   # SYSTEM_PROMPT, extractLessonsFromSyllabus()
    ├── safe-json.ts         # safeParseJSON()
    ├── cost-tracker.ts      # CostTracker（Claude + HeyGen + ElevenLabs）
    ├── circuit-breaker.ts   # CircuitBreaker
    └── video-pipeline/      # 影片生成模組
```

## 重要提醒

1. **每個 Prompt 檔案都是自包含的**——不需要讀其他檔案就能單獨執行
2. **建議先跑一次完整流程**（00→01→02→03→04），確認可行後再建置自動化（05→06→07）
3. **所有程式碼範例都可直接複製執行**，無需額外修改
4. **所有批量腳本都支援 `--dry-run`**，可先模擬不實際呼叫 API
5. **使用 `--budget` 設定預算上限**，避免費用失控
6. **Auto-fix 必須使用 `applyFixes()` 函數**，禁止 JSON 字串替換（F-18）
7. **所有 DB 除法必須加 `::DECIMAL`**，避免 PostgreSQL 整數截斷（團隊踩坑記錄）
