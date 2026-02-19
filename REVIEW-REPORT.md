# 專案指導報告：獸醫課程 AI 生成系統 (vet-course-generator v3.0)

> **審查日期**：2026-02-19
> **審查角色**：產品經理 + QA 工程師
> **審查方法**：實際終端操作 + 瀏覽器競品對比 + 程式碼深度分析
> **競品參考**：simonw/llm (11.2k★), vercel/ai (21.9k★), BuilderIO/micro-agent (4.3k★)

---

## 一、總體評估

| 維度 | 評分 | 說明 |
|------|------|------|
| 新用戶入門體驗 | ⭐⭐ (2/5) | 無 README.md、無 Quick Start、環境設定卡住 |
| CLI 互動品質 | ⭐⭐⭐ (3/5) | --help 完整，但缺少 --version、錯誤訊息不友善 |
| 錯誤處理健壯性 | ⭐⭐ (2/5) | 有 2 個安全性 P0 Bug、多處 raw stack trace |
| 程式碼品質 | ⭐⭐⭐⭐ (4/5) | SSOT 架構優秀、型別安全高、133 測試全過 |
| 可觀測性與韌性 | ⭐⭐ (2/5) | 無進度持久化、無 graceful shutdown、無結構化日誌 |
| 文件組織 | ⭐⭐ (2/5) | 8 個 spec 和程式碼混在一起、CLAUDE.md 太長 |

**整體評分：2.5 / 5 —— 核心架構紮實，但使用者體驗和生產就緒度有明顯差距**

---

## 二、P0 必修缺陷（上線前必須修復）

### P0-1：幽靈 npm scripts 導致使用者崩潰

- **位置**：`package.json` 第 11-12 行
- **問題**：`generate:knowledge` 和 `generate:syllabus` 指向不存在的檔案
  ```json
  "generate:knowledge": "tsx scripts/generate-knowledge.ts",  // 檔案不存在
  "generate:syllabus": "tsx scripts/generate-syllabus.ts",    // 檔案不存在
  ```
- **重現**：`npm run generate:knowledge` → `ERR_MODULE_NOT_FOUND` 崩潰
- **影響**：新用戶按 `npm run` 列表嘗試指令 → 立即失去信任
- **競品做法**：simonw/llm 的每個 CLI 子命令都有對應實作，且 CI 會驗證
- **修復**：移除幽靈 scripts 或建立對應檔案

### P0-2：非數字預算繞過安全機制

- **位置**：`scripts/batch-generate-scripts.ts` 第 69 行、`scripts/batch-quality-check.ts` 第 56 行
- **問題**：`--budget abc` → `parseFloat('abc')` = `NaN` → `CostTracker(NaN)`
  - `isOverBudget` = `this.spent >= NaN` → 永遠 `false`
  - **預算安全機制完全失效**，可無限呼叫 API
- **重現**：
  ```bash
  npx tsx scripts/batch-generate-scripts.ts --syllabus output/syllabus.json --budget abc
  # 輸出顯示 Cost: $0.0000 / $NaN — 無預算上限
  ```
- **影響**：意外輸入可能導致大量 API 費用
- **競品做法**：Commander.js 支援 `.option('--budget <usd>', '...', parseFloat)` 的 coerce 函數，加上驗證
- **修復**：
  ```typescript
  const budgetNum = parseFloat(opts.budget);
  if (isNaN(budgetNum) || budgetNum < 0) {
    console.error('Error: --budget must be a non-negative number');
    process.exit(1);
  }
  ```

---

## 三、P1 關鍵缺陷（上線前應修復）

### P1-1：缺少根目錄 README.md

- **問題**：專案沒有 `README.md`（只有 `00_README.md`）
- **影響**：GitHub/npm 不會自動渲染，新用戶看到空白首頁
- **競品做法**：
  - `simonw/llm`：一句話描述 → 功能列表 → Quick Start（3 步驟）→ 文件連結
  - `vercel/ai`：標題 + badges → 安裝指令 → 程式碼範例
  - `micro-agent`：GIF 演示 → 安裝 → 使用範例
- **修復**：建立 README.md，包含 30 秒快速開始

### P1-2：.env.example 缺少必填/選填標示與取得方式

- **問題**：6 個變數沒有標示哪些必填、哪些可跳過、到哪裡取得
- **影響**：新用戶卡在環境設定（實測 > 5 分鐘仍無法完成）
- **競品做法**：
  - Django：`.env.example` 分 `# REQUIRED` / `# OPTIONAL` 區塊
  - Stripe SDK：每個 key 附上 Dashboard 連結
  - Next.js：`NEXT_PUBLIC_` 前綴區分前端/後端
- **修復**：重寫 .env.example，加入 REQUIRED/OPTIONAL 分區和取得連結

### P1-3：`--version` 在所有 CLI 腳本都不可用

- **問題**：4 個腳本都未呼叫 Commander.js 的 `.version()`
- **重現**：`npx tsx scripts/batch-generate-scripts.ts --version` → 報「缺少必要參數」
- **影響**：使用者無法確認工具版本（debug 時的基本需求）
- **競品做法**：所有成熟 CLI 工具（`git --version`, `node --version`, `llm --version`）都支援
- **修復**：每個 script 加 `.version(require('../package.json').version)`

### P1-4：遺失檔案時顯示 raw ENOENT stack trace

- **位置**：`scripts/batch-generate-scripts.ts` 第 38 行
- **問題**：`readFile(nonexistent.json)` 直接拋出 Node.js 完整堆疊
  ```
  Error: ENOENT: no such file or directory, open '...\nonexistent.json'
      at async open (node:internal/fs/promises:634:25)
      at async Object.readFile (node:internal/fs/promises:1221:14)
      ...（8 行堆疊）
  ```
- **影響**：嚇跑非技術使用者
- **競品做法**：`simonw/llm` 用 `click.BadParameter('File not found: ...')`，一行簡潔訊息
- **修復**：wrap readFile 加 try/catch，輸出友善錯誤

### P1-5：負數預算被靜默接受

- **問題**：`--budget -1` 被接受，在真實模式下 `isOverBudget` 立即觸發（0 >= -1），導致零工作量
- **影響**：用戶困惑為什麼沒有任何產出
- **修復**：參數驗證 `budget > 0`

### P1-6：batch-generate-videos 的 `--concurrency 0` 或 `-1` 被接受

- **問題**：無效併發值可能導致未定義行為（無界平行或死循環）
- **修復**：驗證 concurrency >= 1

### P1-7：lesson_versions 表缺少 RLS

- **位置**：`supabase/migrations/040_course_management_system.sql`
- **問題**：5 個表中只有 4 個啟用了 RLS，`lesson_versions` 漏掉了
- **影響**：版本歷史表可能被未授權存取
- **修復**：加入 `ALTER TABLE lesson_versions ENABLE ROW LEVEL SECURITY` + POLICY

### P1-8：HeyGen/ElevenLabs API 回應缺少型別驗證

- **位置**：`src/lib/video-pipeline/heygen.ts:36`, `tts.ts:34`
- **問題**：使用 `as` 強制型別轉換，無執行時驗證
  ```typescript
  const data = await response.json() as { data: { video_id: string } };
  // 若 API 回傳結構改變 → undefined 存取 → 靜默失敗
  ```
- **競品做法**：vercel/ai SDK 對所有 provider 回應做 Zod schema 驗證
- **修復**：加入 Zod 驗證或至少 required field 檢查

---

## 四、P2 改善建議（上線後應處理）

### 4.1 文件組織

| # | 問題 | 現況 | 業界做法 | 建議 |
|---|------|------|---------|------|
| P2-1 | Spec 文件和程式碼混在根目錄 | 根目錄 8 個 `0X_*.md` | React/Next.js 用 `docs/` 目錄 | 搬到 `docs/stages/` |
| P2-2 | CLAUDE.md 太長（148行）混雜層級 | 架構原則 + 使用指南 + 30 項 F 缺陷 | 拆分 README / DEVELOPER.md / ARCHITECTURE.md | 將 F 缺陷清單搬到 DEVELOPER.md |
| P2-3 | output/ 目錄沒有說明 | 空目錄，無 README | Python 專案用 `.gitkeep` + README | 加入 output/README.md 說明用途 |
| P2-4 | package.json description 用中文 | `"AI 獸醫課程生成系統..."` | npm 生態慣例為英文 | 改英文 description |

### 4.2 錯誤處理與使用者體驗

| # | 問題 | 現況 | 業界做法 | 建議 |
|---|------|------|---------|------|
| P2-5 | 錯誤訊息顯示 raw stack trace | `main().catch(console.error)` | `simonw/llm` 用 click 的格式化錯誤 | 頂層 catch 只顯示 `Error: xxx`，加 `--verbose` 顯示 stack |
| P2-6 | 語言混合（中英文混用） | schema 驗證中文，CLI 英文 | 一致性原則 | 統一為中文（目標用戶是中文獸醫） |
| P2-7 | 預算無上限警告 | `--budget 99999` 靜默接受 | AWS CLI 對高風險操作要求 `--force` | 加 soft cap（如 $100），超過需 `--force` |
| P2-8 | `--start-from` 找不到 ID 時無建議 | "Lesson X not found" | `git checkout` 會建議最相似分支 | 列出可用 lesson IDs 供選擇 |
| P2-9 | batch-generate-videos 無 `--budget` | `CostTracker(Infinity)` | 所有付費 API 呼叫都該有預算限制 | 加 `--budget` 選項 |
| P2-10 | 無 `npm start` 入口 | Missing script error | CLI 專案用 start 指向 help | 加 `"start": "npm run status"` 或 help 指令 |

### 4.3 程式碼品質

| # | 問題 | 位置 | 建議 |
|---|------|------|------|
| P2-11 | Rate limit 硬編碼 2000ms | 6 處 `setTimeout(r, 2000)` | 建立 `RateLimiter` 類別，支援指數退避 |
| P2-12 | Magic numbers 散落各處 | `0.00003`(TTS 單價), `3.5`(字數/秒), `8192`(max_tokens) | 集中到 `src/config/defaults.ts` |
| P2-13 | Claude model 硬編碼 | 所有 generate-*.ts 用 `claude-sonnet-4-5-20250929` | 環境變數 `CLAUDE_MODEL` 或配置檔 |
| P2-14 | Dry-run 只是 console.log | 不驗證 prompt 建構或 schema | dry-run 應執行除 API 呼叫外的所有邏輯 |

### 4.4 韌性與可觀測性

| # | 問題 | 影響 | 業界做法 | 建議 |
|---|------|------|---------|------|
| P2-15 | 無進度持久化 | 25 堂課生成到第 20 堂崩潰 → 全部重來 | GitHub Actions 用 artifact cache | 每完成 1 項寫進 `.progress.json` |
| P2-16 | 無 Graceful Shutdown | Ctrl+C 後進度丟失 | Docker 用 SIGTERM handler | 加 `process.on('SIGINT', saveProgress)` |
| P2-17 | 無結構化日誌 | 所有 console.log 是自由文本 | 12-factor app 用 JSON 日誌 | 可選 `--json-log` 模式 |
| P2-18 | Circuit breaker 無自動恢復 | 一旦觸發永遠停止 | Netflix Hystrix 有 half-open 狀態 | 加 cooldown 機制（等 30 秒重試 1 次） |
| P2-19 | 缺少 `--verbose` / `--quiet` | 無法調整輸出等級 | 幾乎所有 CLI 工具都支援 | 加 `-v` / `-q` flag |
| P2-20 | ESLint 未設定 | 無靜態分析保護 | 所有 TS 專案標配 | 加 `eslint.config.mjs` |
| P2-21 | 覆蓋率工具未安裝 | 無法量測 | CI 標配 | `npm install -D @vitest/coverage-v8` |

---

## 五、競品對比分析

### 5.1 CLI 入門體驗對比

| 指標 | 本專案 | simonw/llm (11.2k★) | micro-agent (4.3k★) | vercel/ai (21.9k★) |
|------|--------|---------------------|----------------------|---------------------|
| README.md 存在 | ❌ | ✅ 精簡清晰 | ✅ 附 GIF 演示 | ✅ 附 badge + 範例 |
| Quick Start 步驟數 | N/A（無） | 3 步 | 2 步 | 4 步 |
| 30 秒理解做什麼 | ❌ 需找 00_README.md | ✅ 第一句話就明白 | ✅ GIF 秒懂 | ✅ 副標題清楚 |
| `--help` 完整度 | ✅ 完整 | ✅ 分子命令 | ✅ 簡潔 | N/A（SDK） |
| `--version` 支援 | ❌ | ✅ | ✅ | N/A |
| 錯誤訊息品質 | ❌ raw stack trace | ✅ 格式化 | ✅ 格式化 | ✅ typed errors |
| 環境變數文件 | ⚠️ 無標示必填 | ✅ 清楚說明 | ✅ 互動式設定 | ✅ .env.example |

### 5.2 批量處理能力對比

| 指標 | 本專案 | 業界最佳實踐 |
|------|--------|-------------|
| 進度持久化 | ❌ 記憶體變數 | ✅ 持久化到檔案/DB（GitHub Actions artifacts, Airflow） |
| 斷點續傳 | ⚠️ 只有 `--start-from`（需知道 ID） | ✅ 自動從上次中斷處續傳（Webpack cache, Terraform state） |
| Graceful shutdown | ❌ | ✅ SIGINT/SIGTERM handler（Docker, PM2） |
| 預算安全 | ⚠️ 可被 NaN 繞過 | ✅ 強制驗證 + 確認提示（AWS CLI 的 `--confirm`） |
| 並行控制 | ✅ `--concurrency` | ✅ 但需驗證範圍（GNU parallel） |
| 結構化日誌 | ❌ 自由文本 | ✅ JSON 日誌（Winston, Pino, structlog） |

### 5.3 目錄結構對比

```
# 本專案（當前）                    # 業界最佳實踐
E:\LECTURE\                         project/
├── 00_README.md          ←×        ├── README.md              ← 根目錄必有
├── 00_knowledge_deep_dive.md ←×    ├── docs/                  ← 文件獨立目錄
├── 01_syllabus_generator.md  ←×    │   ├── getting-started.md
├── ... (8 個 spec 檔案)   ←×       │   ├── stages/
├── CLAUDE.md              ←×       │   │   ├── 00-knowledge.md
├── package.json                    │   │   └── ...
├── src/                            │   └── developer.md
├── scripts/                        ├── src/
├── tests/                          ├── scripts/
├── output/                ←？      ├── tests/
└── supabase/                       ├── output/
                                    │   └── README.md          ← 說明用途
                                    └── supabase/
```

---

## 六、修復路線圖

### Phase 1 — 立即修復（1 小時，阻擋上線）

| 項目 | 預估時間 | 描述 |
|------|---------|------|
| P0-1 | 5 分鐘 | 移除幽靈 npm scripts 或建立對應檔案 |
| P0-2 | 10 分鐘 | 修復 budget NaN 繞過：所有 3 個 batch scripts 加 parseFloat 驗證 |
| P1-4 | 15 分鐘 | 替 readFile 加 try/catch，友善錯誤訊息 |
| P1-5 | 5 分鐘 | 驗證 budget > 0 |
| P1-6 | 5 分鐘 | 驗證 concurrency >= 1 |
| P1-3 | 10 分鐘 | 所有 4 個腳本加 `.version()` |

### Phase 2 — 本週完成（3 小時，使用者體驗）

| 項目 | 預估時間 | 描述 |
|------|---------|------|
| P1-1 | 30 分鐘 | 建立根目錄 README.md（Quick Start + API Keys 表格） |
| P1-2 | 20 分鐘 | 重寫 .env.example（REQUIRED/OPTIONAL + 取得連結） |
| P2-1 | 20 分鐘 | 搬 spec 檔案到 docs/stages/ |
| P2-5 | 30 分鐘 | 頂層 error handler 只顯示 message，加 --verbose flag |
| P2-10 | 5 分鐘 | 加 npm start script |
| P1-7 | 10 分鐘 | lesson_versions 加 RLS |
| P2-20 | 30 分鐘 | 設定 ESLint flat config |

### Phase 3 — 本月完成（8 小時，生產就緒）

| 項目 | 預估時間 | 描述 |
|------|---------|------|
| P2-15 | 2 小時 | 進度持久化系統（.progress.json） |
| P2-16 | 1 小時 | Graceful shutdown handler |
| P2-11 | 1 小時 | 建立可配置 RateLimiter 類別 |
| P2-12 | 30 分鐘 | 建立 src/config/defaults.ts |
| P1-8 | 1 小時 | HeyGen/ElevenLabs 回應 Zod 驗證 |
| P2-18 | 1 小時 | Circuit breaker half-open 恢復機制 |
| P2-19 | 30 分鐘 | --verbose / --quiet flag |
| P2-9 | 30 分鐘 | batch-generate-videos 加 --budget |

---

## 七、品質亮點（值得保留的設計）

在嚴格審查中，以下設計值得肯定：

1. **SSOT 架構**：types/ 和 schemas/ 完全分離，所有 batch scripts 只 import 不重定義
2. **F-18 安全**：`applyFixes()` 操作 segment 物件而非 JSON 字串替換，有文件註解說明禁止事項
3. **F-3 Sampling**：每 5 堂課強制 1 堂人工審查，對抗「AI 審 AI」盲點
4. **Circuit Breaker**：連續 3 次失敗暫停，避免浪費 API 費用
5. **Zod Schema 驗證**：所有 AI 輸出都經過嚴格的 Zod 驗證 + safe parse
6. **133 個測試全通過**：涵蓋 schema、utility、邊界情況
7. **SQL DECIMAL 精度**：所有除法使用 `DECIMAL(5,2)`，避免 PostgreSQL 整數截斷

---

## 八、一句話總結

> **核心架構紮實（SSOT + Zod + 133 tests），但「最後一哩路」的使用者體驗嚴重不足——沒有 README.md、2 個安全性 P0 Bug、錯誤訊息是 raw stack trace、進度無法持久化。修完 Phase 1（1 小時）+ Phase 2（3 小時）即可達到可上線標準。**
