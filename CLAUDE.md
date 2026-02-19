# 獸醫課程 AI 生成系統

## 專案概述
將獸醫專業知識通過 AI 自動化流水線轉換為可銷售的線上課程影片。
8 階段流程：知識深挖(Claude) → 大綱生成(Claude) → 講稿撰寫(Claude) → 案例對話(Claude) → 品質檢查(Claude) → DB 審核(Supabase) → 影片生成(HeyGen+ElevenLabs+Remotion) → 批量自動化

> v3.0 — 經 10 人專家委員會審查，修復 30 項缺陷（F-1 ~ F-30）

## 技術棧
- Runtime: Node.js 20 LTS + TypeScript 5.3+
- LLM: Claude API (@anthropic-ai/sdk)
- Validation: Zod
- DB: Supabase (PostgreSQL)
- Frontend: Next.js (已有 shangxian-platform)
- Video: HeyGen API, ElevenLabs API, Remotion, FFmpeg
- CLI: Commander.js
- Testing: Vitest
- Deploy: Vercel

## 資料流

```
課程主題 + 臨床領域
      │
      ▼
[00 知識深挖] → knowledge-base.json（7 面向）
      │
      ▼
[01 大綱生成] → syllabus.json（含 Bloom's Taxonomy）
      │
      ▼ (per lesson)
[02 講稿生成] → lesson.json (5-8 segments)
      │
      ├──▶ [03 案例對話] → dialogue.json (optional)
      │
      ▼
[04 品質檢查] → quality-report.json
      │
      ├── approved → Supabase lessons table
      ├── revision_needed → applyFixes() → 重新檢查（max 2 輪）
      ├── sampling（每 5 堂 1 堂）→ manual_review
      └── rejected → 重新生成（circuit breaker: 連續 3 次暫停）
      │
      ▼ (approved only)
[06 影片管線]
      ├── talking_head → HeyGen API → MP4
      ├── slides → Remotion 渲染 + ElevenLabs TTS → MP4
      ▼
[FFmpeg 組合] → MP4 + 精確 SRT（alignment API）
      │
      ▼
課程平台上架
```

## SSOT 架構原則

所有步驟共用的型別和 schema 必須定義在唯一來源，禁止在各步驟中重新定義：

| 定義來源 | 提供什麼 | 誰使用 |
|---------|---------|--------|
| `src/types/*.ts` | TypeScript 介面 | 全部步驟 |
| `src/schemas/*.ts` | Zod schema | 01, 02, 04, 07 |
| `02: SYSTEM_PROMPT` | 講稿生成 prompt | 02, 07 batch-generate |
| `04: QUALITY_CHECK_SYSTEM_PROMPT` | 品質檢查 prompt | 04, 07 batch-quality |
| `04: applyFixes()` | 自動修正邏輯 | 04, 07 batch-quality |
| `02: extractLessonsFromSyllabus()` | 大綱→課程列表 | 02, 07 batch-generate |

## 核心資料格式

講稿以 JSON 儲存在 Supabase `lessons.content` (JSONB)：
- 每堂課 5~8 個 segments
- 每個 segment: `{ segment_id, type, speaker_mode, visual_type, script_zh, duration_seconds }`
- type: opening | teaching | case | summary
- visual_type: talking_head | slides
- quiz: 2-3 題測驗（含 Bloom's level 標註）

## 環境變數

| 變數名 | 用途 | 取得方式 |
|--------|------|---------|
| `ANTHROPIC_API_KEY` | Claude API 呼叫 | console.anthropic.com |
| `SUPABASE_URL` | Supabase 連線 | Supabase Dashboard → Settings → API |
| `SUPABASE_KEY` | Supabase anon key | 同上 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin | 同上（注意：不可暴露到前端） |
| `HEYGEN_API_KEY` | HeyGen 數位人影片 | heygen.com → Settings → API |
| `ELEVENLABS_API_KEY` | ElevenLabs TTS | elevenlabs.io → Profile → API Keys |

## 可用指令

```bash
# 批量生成講稿（含預算上限）
npx tsx scripts/batch-generate-scripts.ts --syllabus output/syllabus.json --budget 5 [--dry-run]

# 批量品質檢查（含 sampling + applyFixes）
npx tsx scripts/batch-quality-check.ts --course vet-comm-001 --budget 3 [--dry-run]

# 批量生成影片
npx tsx scripts/batch-generate-videos.ts --course vet-comm-001 --concurrency 2 [--dry-run]

# 查看進度
npx tsx scripts/status-report.ts --course vet-comm-001 [--detailed]
```

## 常見錯誤排查

| 錯誤 | 原因 | 解法 |
|------|------|------|
| Claude API 回傳非 JSON | prompt 不夠明確 | 使用 `safeParseJSON()` 安全解析 |
| Zod validation 失敗 | AI 輸出缺少必要欄位 | 檢查 schema 是否與 prompt 中的結構一致，retry |
| HeyGen 任務 timeout | 影片生成超過 10 分鐘 | 檢查文字長度，拆分過長 segment |
| Supabase RLS 權限拒絕 | 未用 service_role_key | 批量腳本需用 service role，不是 anon key |
| FFmpeg 找不到 | 未安裝或未加入 PATH | `brew install ffmpeg` 或 `choco install ffmpeg` |
| Auto-fix JSON 解析失敗 | 禁止 JSON 字串替換（F-18） | 必須使用 `applyFixes()` 在 segment 層級操作 |
| DB 除法結果不正確 | PostgreSQL 整數除法截斷 | 所有除法加 `::DECIMAL`（團隊踩坑 F-28） |
| API 回傳 HTML 而非 JSON | Next.js 500 回傳 HTML 頁面 | 使用 `safeParseJSON()` + try/catch |
| Circuit breaker 觸發 | 連續 3 次 API 失敗 | 檢查 API 狀態，用 `--start-from` 續傳 |

## 開發 vs 生產

| 項目 | 開發 | 生產 |
|------|------|------|
| Claude API | 直接呼叫 | 加 rate limit (2s/call) + budget cap |
| 影片生成 | `--dry-run` 模擬 | 實際呼叫 HeyGen/ElevenLabs |
| Slides | Remotion 本地渲染 | 同上（無雲端費用） |
| DB | 本地 Supabase 或 dev 環境 | Production Supabase |
| 費用追蹤 | console.log | CostTracker（Claude + HeyGen + ElevenLabs） |
| RLS | owner-based（`created_by = auth.uid()`） | 同上 |

## 專家審查重點（v3.0）

以下是必須遵守的 30 項缺陷修復要點，違反將導致系統無法運行或品質退化：

| 類別 | 規則 | 對應缺陷 |
|------|------|---------|
| Schema | 所有步驟使用 `lesson_id`/`chapter_id` TEXT 格式，禁止 `chapter_number`/`lesson_number` INT | F-2, F-13 |
| Schema | DB 欄位名為 `content`（JSONB），禁止 `script_json` | F-13 |
| Auto-fix | 必須使用 `applyFixes()` 在 segment 物件層級操作，禁止 JSON 字串替換 | F-18 |
| Prompt | 07 batch 必須 import 02/04 的完整 System Prompt，禁止自定義精簡版 | F-4 |
| DB 寫入 | 使用 RPC function `upsert_lesson_with_version` 確保 transaction | F-14 |
| RLS | 使用 owner-based（`created_by = auth.uid()`），禁止 role-based | F-15 |
| 精度 | 所有 SQL 除法加 `::DECIMAL`，品質分數用 `DECIMAL(5,2)` | F-28, F-30 |
| 費用 | `--budget <usd>` 預算上限，HeyGen 為 credit-based 計費 | F-26, F-27 |
| 穩定性 | Circuit breaker：連續 3 次 API 失敗暫停 | F-7 |
| 品質 | Sampling：每 5 堂強制 1 堂 `manual_review`（對抗 AI 審 AI 盲點） | F-3 |
| 影片 | Slides segment 用 Remotion 渲染，禁止黑底靜態影片 | F-10 |
| 字幕 | SRT 使用 ElevenLabs alignment API，禁止每秒 3.5 字估算 | F-12 |
| Git | 每完成 5 堂課自動 git checkpoint | Git 安全規範 |
| 安全 | API route 必須有 auth middleware，`.env` 必須在 `.gitignore` | F-19, F-21 |
