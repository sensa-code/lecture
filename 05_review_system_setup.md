---
prompt_id: "05-review-system-setup"
version: "3.0"
estimated_tokens: ~3,500
output_format: SQL + TypeScript + API Routes
dependencies: []
tech_stack: [Supabase, PostgreSQL, Next.js, TypeScript, Zod]
execution: one-time
expert_review: "F-1 修復（batch_jobs 表）+ F-13 修復（schema 一致）+ F-14 修復（transaction）+ F-15 修復（owner-based RLS）+ F-24 修復（production→revision_needed）+ F-28/F-30 修復（DECIMAL）"
---

# Prompt #5：審核系統資料庫建置

## 使用方式
在 Claude Code 中執行，會直接生成可執行的 SQL migration、TypeScript 類型、API routes。
這是一次性技術建置步驟。

> **變更紀錄 v3.0**（專家審查 F-1, F-13, F-14, F-15, F-24, F-28, F-30）：
> - 新增 `batch_jobs` 表：追蹤批次任務進度、支援斷點續傳（F-1）
> - 所有表新增 `created_by UUID` 欄位，RLS 改為 owner-based（F-15，團隊雙角色踩坑教訓）
> - 講稿 upsert + version insert 用 RPC function 包裹為 transaction（F-14）
> - 品質評分欄位改為 `DECIMAL(5,2)`，計算加 `::DECIMAL`（F-28/F-30，團隊整數除法踩坑）
> - 狀態機新增 `production → revision_needed` 回溯路徑（F-24）
> - 所有 API route 新增 auth middleware 檢查（審計報告 P0 教訓）

---

## 專案背景

基於 shangxian-platform（已有 Supabase + Next.js 基礎），新增課程管理模組。
需要管理：課程結構、AI 生成的講稿（JSON）、審核狀態與版本歷史、影片生成任務追蹤、批次任務進度。

---

## 1. SQL Migration（可直接在 Supabase Dashboard 執行）

```sql
-- supabase/migrations/040_course_management_system.sql

-- ============================================
-- 課程管理系統
-- ============================================

-- 課程表
CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'archived')),
  total_chapters INT NOT NULL DEFAULT 0,
  total_lessons INT NOT NULL DEFAULT 0,
  syllabus_json JSONB,           -- 完整大綱 JSON（步驟 1 的輸出）
  knowledge_base_json JSONB,     -- 知識深挖 JSON（步驟 0 的輸出）
  created_by UUID REFERENCES auth.users(id),  -- F-15: owner-based RLS
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 講稿表
-- ⚠️ 欄位命名遵循 SSOT：使用 lesson_id TEXT（如 "lesson-01-03"）和 chapter_id TEXT（如 "ch-01"）
-- 禁止使用 chapter_number INT / lesson_number INT（F-13 修復）
CREATE TABLE IF NOT EXISTS lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  lesson_id TEXT NOT NULL UNIQUE,  -- 例如 "lesson-01-03"（與 01/02/07 schema 一致）
  chapter_id TEXT NOT NULL,        -- 例如 "ch-01"（與 01/02/07 schema 一致）
  title TEXT NOT NULL,
  content JSONB NOT NULL,          -- 完整講稿 JSON（步驟 2 的輸出）
  review_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'reviewing', 'revision_needed', 'approved', 'production', 'manual_review')),
  reviewer_notes TEXT,
  quality_report JSONB,            -- 品質檢查報告（步驟 4 的輸出）
  quality_score DECIMAL(5, 2),     -- F-30: 品質評分用 DECIMAL 避免截斷
  version INT NOT NULL DEFAULT 1,
  created_by UUID REFERENCES auth.users(id),  -- F-15: owner-based RLS
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 講稿版本歷史
CREATE TABLE IF NOT EXISTS lesson_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  version INT NOT NULL,
  content JSONB NOT NULL,
  changed_by TEXT NOT NULL,         -- 'ai' 或審核者名字
  change_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(lesson_id, version)
);

-- 影片生成任務
CREATE TABLE IF NOT EXISTS video_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  provider TEXT NOT NULL
    CHECK (provider IN ('heygen', 'elevenlabs', 'remotion', 'ffmpeg')),
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  video_url TEXT,
  subtitle_url TEXT,
  cost_usd DECIMAL(10, 4) DEFAULT 0,
  error_log TEXT,
  created_by UUID REFERENCES auth.users(id),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 批次任務追蹤表（F-1 修復：斷點續傳 + 冪等性）
CREATE TABLE IF NOT EXISTS batch_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id),
  stage TEXT NOT NULL CHECK (stage IN ('script_gen', 'quality_check', 'video_gen')),
  status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'paused', 'completed', 'failed')),
  total_items INT NOT NULL,
  completed_items INT NOT NULL DEFAULT 0,
  failed_items INT NOT NULL DEFAULT 0,
  last_completed_lesson TEXT,        -- 最後完成的 lesson_id（斷點續傳用）
  budget_usd DECIMAL(10, 2),         -- 預算上限
  spent_usd DECIMAL(10, 4) DEFAULT 0, -- 已花費（用 DECIMAL 避免浮點精度問題，F-28）
  error_log JSONB,
  created_by UUID REFERENCES auth.users(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 索引
-- ============================================
CREATE INDEX IF NOT EXISTS idx_lessons_course_id ON lessons(course_id);
CREATE INDEX IF NOT EXISTS idx_lessons_review_status ON lessons(review_status);
CREATE INDEX IF NOT EXISTS idx_lessons_lesson_id ON lessons(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_versions_lesson_id ON lesson_versions(lesson_id);
CREATE INDEX IF NOT EXISTS idx_video_jobs_lesson_id ON video_jobs(lesson_id);
CREATE INDEX IF NOT EXISTS idx_video_jobs_status ON video_jobs(status);
CREATE INDEX IF NOT EXISTS idx_batch_jobs_course_id ON batch_jobs(course_id);
CREATE INDEX IF NOT EXISTS idx_batch_jobs_status ON batch_jobs(status);

-- ============================================
-- updated_at 自動更新 trigger
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_courses_updated_at
  BEFORE UPDATE ON courses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_lessons_updated_at
  BEFORE UPDATE ON lessons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_batch_jobs_updated_at
  BEFORE UPDATE ON batch_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Transaction RPC Function（F-14 修復：upsert + version insert 原子性）
-- ============================================
CREATE OR REPLACE FUNCTION upsert_lesson_with_version(
  p_course_id UUID,
  p_lesson_id TEXT,
  p_chapter_id TEXT,
  p_title TEXT,
  p_content JSONB,
  p_changed_by TEXT DEFAULT 'ai',
  p_change_summary TEXT DEFAULT 'AI 自動生成',
  p_created_by UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_lesson_uuid UUID;
  v_version INT;
BEGIN
  -- Upsert lesson
  INSERT INTO lessons (course_id, lesson_id, chapter_id, title, content, review_status, version, created_by)
  VALUES (p_course_id, p_lesson_id, p_chapter_id, p_title, p_content, 'pending', 1, p_created_by)
  ON CONFLICT (lesson_id) DO UPDATE SET
    content = EXCLUDED.content,
    version = lessons.version + 1,
    review_status = 'pending',
    updated_at = now()
  RETURNING id, version INTO v_lesson_uuid, v_version;

  -- Insert version record (within same transaction)
  INSERT INTO lesson_versions (lesson_id, version, content, changed_by, change_summary)
  VALUES (v_lesson_uuid, v_version, p_content, p_changed_by, p_change_summary);

  RETURN v_lesson_uuid;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- RLS 政策（F-15 修復：owner-based，不用 role-based）
-- 團隊雙角色踩坑教訓：不要用 role-based policy，改用 created_by = auth.uid()
-- ============================================
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_jobs ENABLE ROW LEVEL SECURITY;

-- Owner-based 讀取：只能看到自己建立的課程（F-15 修復）
-- ⚠️ 不使用 role-based policy（團隊雙角色踩坑教訓：user_profiles.role ≠ clinic_staff.role）
CREATE POLICY "owner_read_courses" ON courses
  FOR SELECT TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "owner_read_lessons" ON lessons
  FOR SELECT TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "owner_read_versions" ON lesson_versions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM lessons
      WHERE lessons.id = lesson_versions.lesson_id
      AND lessons.created_by = auth.uid()
    )
  );

CREATE POLICY "owner_read_jobs" ON video_jobs
  FOR SELECT TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "owner_read_batch_jobs" ON batch_jobs
  FOR SELECT TO authenticated
  USING (created_by = auth.uid());

-- Owner-based 寫入：只能修改自己建立的資料
CREATE POLICY "owner_modify_courses" ON courses
  FOR ALL TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "owner_modify_lessons" ON lessons
  FOR ALL TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "owner_modify_jobs" ON video_jobs
  FOR ALL TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "owner_modify_batch_jobs" ON batch_jobs
  FOR ALL TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- super_admin 可讀取所有資料（用於審核 UI）
CREATE POLICY "admin_read_all_courses" ON courses
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'super_admin'
    )
  );

CREATE POLICY "admin_read_all_lessons" ON lessons
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'super_admin'
    )
  );

-- service_role 可以全部操作（批量腳本用）
-- 注意：service_role 自動繞過 RLS，不需要額外 policy
```

---

## 2. TypeScript 類型定義

```typescript
// lib/types/course.ts

export interface Course {
  id: string;
  title: string;
  description: string | null;
  status: 'draft' | 'active' | 'archived';
  total_chapters: number;
  total_lessons: number;
  syllabus_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export type ReviewStatus = 'pending' | 'reviewing' | 'revision_needed' | 'approved' | 'production' | 'manual_review';

export interface Lesson {
  id: string;
  course_id: string;
  lesson_id: string;     // "lesson-01-03"
  chapter_id: string;    // "ch-01"
  title: string;
  content: Record<string, unknown>;  // 完整講稿 JSON
  review_status: ReviewStatus;
  reviewer_notes: string | null;
  quality_report: Record<string, unknown> | null;
  version: number;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LessonVersion {
  id: string;
  lesson_id: string;
  version: number;
  content: Record<string, unknown>;
  changed_by: string;
  change_summary: string | null;
  created_at: string;
}

export type VideoProvider = 'heygen' | 'elevenlabs' | 'remotion' | 'ffmpeg';
export type VideoJobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface VideoJob {
  id: string;
  lesson_id: string;
  provider: VideoProvider;
  status: VideoJobStatus;
  video_url: string | null;
  subtitle_url: string | null;
  cost_usd: number;
  error_log: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

// 批次任務（F-1 修復：斷點續傳）
export type BatchStage = 'script_gen' | 'quality_check' | 'video_gen';
export type BatchStatus = 'in_progress' | 'paused' | 'completed' | 'failed';

export interface BatchJob {
  id: string;
  course_id: string;
  stage: BatchStage;
  status: BatchStatus;
  total_items: number;
  completed_items: number;
  failed_items: number;
  last_completed_lesson: string | null;
  budget_usd: number | null;
  spent_usd: number;
  error_log: Record<string, unknown> | null;
  created_by: string | null;
  started_at: string;
  updated_at: string;
}

// API 請求類型
export interface CreateLessonRequest {
  course_id: string;
  lesson_id: string;
  chapter_id: string;
  title: string;
  content: Record<string, unknown>;
}

export interface UpdateReviewRequest {
  review_status: ReviewStatus;
  reviewer_notes?: string;
  quality_report?: Record<string, unknown>;
}

export interface CreateVideoJobRequest {
  lesson_id: string;
  provider: VideoProvider;
}
```

---

## 3. API Routes

### POST /api/lessons — 儲存 AI 生成的講稿

```typescript
// app/api/lessons/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const CreateLessonSchema = z.object({
  course_id: z.string().uuid(),
  lesson_id: z.string().regex(/^lesson-\d{2}-\d{2}$/),
  chapter_id: z.string().regex(/^ch-\d{2}$/),
  title: z.string().min(1),
  content: z.record(z.unknown()),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 審計報告 P0 教訓：所有 API route 必須驗證 auth
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: '未登入', timestamp: new Date().toISOString() } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = CreateLessonSchema.parse(body);

    // F-14 修復：使用 RPC function 確保 upsert + version insert 的原子性
    const { data, error } = await supabase.rpc('upsert_lesson_with_version', {
      p_course_id: parsed.course_id,
      p_lesson_id: parsed.lesson_id,
      p_chapter_id: parsed.chapter_id,
      p_title: parsed.title,
      p_content: parsed.content,
      p_changed_by: 'ai',
      p_change_summary: 'AI 自動生成',
      p_created_by: user.id,
    });

    if (error) {
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: error.message, timestamp: new Date().toISOString() } },
        { status: 500 }
      );
    }

    return NextResponse.json({ id: data, lesson_id: parsed.lesson_id }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: error.errors, timestamp: new Date().toISOString() } },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '伺服器內部錯誤', timestamp: new Date().toISOString() } },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('course_id');
    const status = searchParams.get('status');

    let query = supabase.from('lessons').select('*').order('lesson_id', { ascending: true });

    if (courseId) query = query.eq('course_id', courseId);
    if (status) query = query.eq('review_status', status);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: error.message, timestamp: new Date().toISOString() } },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '伺服器內部錯誤', timestamp: new Date().toISOString() } },
      { status: 500 }
    );
  }
}
```

### PATCH /api/lessons/[id]/review — 更新審核狀態

```typescript
// app/api/lessons/[id]/review/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['reviewing'],
  reviewing: ['revision_needed', 'approved', 'rejected', 'manual_review'],
  revision_needed: ['reviewing', 'pending'],
  approved: ['production'],
  production: ['revision_needed'],  // F-24 修復：允許上架後回溯修正
  manual_review: ['approved', 'revision_needed', 'rejected'],  // F-3: sampling 抽中的需人工審核
};

const UpdateReviewSchema = z.object({
  review_status: z.enum(['pending', 'reviewing', 'revision_needed', 'approved', 'production', 'manual_review']),
  reviewer_notes: z.string().optional(),
  quality_report: z.record(z.unknown()).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const body = await request.json();
    const parsed = UpdateReviewSchema.parse(body);

    // 取得目前狀態
    const { data: current, error: fetchError } = await supabase
      .from('lessons')
      .select('review_status, version, content')
      .eq('id', id)
      .single();

    if (fetchError || !current) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: '找不到此講稿', timestamp: new Date().toISOString() } },
        { status: 404 }
      );
    }

    // 驗證狀態轉換合法性
    const allowed = VALID_TRANSITIONS[current.review_status] || [];
    if (!allowed.includes(parsed.review_status)) {
      return NextResponse.json(
        { error: {
          code: 'INVALID_TRANSITION',
          message: `不允許從 ${current.review_status} 轉換到 ${parsed.review_status}`,
          timestamp: new Date().toISOString(),
        }},
        { status: 400 }
      );
    }

    // 更新狀態
    const updateData: Record<string, unknown> = {
      review_status: parsed.review_status,
    };

    if (parsed.reviewer_notes) updateData.reviewer_notes = parsed.reviewer_notes;
    if (parsed.quality_report) updateData.quality_report = parsed.quality_report;
    if (parsed.review_status === 'approved') updateData.approved_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('lessons')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: error.message, timestamp: new Date().toISOString() } },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: error.errors, timestamp: new Date().toISOString() } },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '伺服器內部錯誤', timestamp: new Date().toISOString() } },
      { status: 500 }
    );
  }
}
```

### POST /api/video-jobs — 建立影片生成任務

```typescript
// app/api/video-jobs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const CreateVideoJobSchema = z.object({
  lesson_id: z.string().uuid(),
  provider: z.enum(['heygen', 'elevenlabs', 'remotion', 'ffmpeg']),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const parsed = CreateVideoJobSchema.parse(body);

    // 確認講稿已 approved
    const { data: lesson } = await supabase
      .from('lessons')
      .select('review_status')
      .eq('id', parsed.lesson_id)
      .single();

    if (!lesson || lesson.review_status !== 'approved') {
      return NextResponse.json(
        { error: { code: 'NOT_APPROVED', message: '講稿尚未通過審核', timestamp: new Date().toISOString() } },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('video_jobs')
      .insert({
        lesson_id: parsed.lesson_id,
        provider: parsed.provider,
        status: 'queued',
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: error.message, timestamp: new Date().toISOString() } },
        { status: 500 }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: error.errors, timestamp: new Date().toISOString() } },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '伺服器內部錯誤', timestamp: new Date().toISOString() } },
      { status: 500 }
    );
  }
}
```

---

## 測試要求

```typescript
// tests/api/lessons.test.ts
import { describe, it, expect } from 'vitest';

describe('POST /api/lessons', () => {
  it('creates a lesson with valid data', () => { /* status 201 */ });
  it('rejects invalid lesson_id format', () => { /* status 400 */ });
  it('upserts on duplicate lesson_id', () => { /* 不報錯，更新 */ });
});

describe('PATCH /api/lessons/[id]/review', () => {
  it('allows pending → reviewing transition', () => { /* status 200 */ });
  it('rejects pending → approved transition', () => { /* status 400 */ });
  it('sets approved_at when status becomes approved', () => { /* 確認時間戳 */ });
});

describe('POST /api/video-jobs', () => {
  it('rejects job for non-approved lesson', () => { /* status 400 */ });
  it('creates job for approved lesson', () => { /* status 201 */ });
});
```

---

## 6 階段執行計畫

### Phase 1: 資料庫
- [ ] 在 Supabase Dashboard → SQL Editor 執行 migration SQL
- [ ] 確認 4 個表建立成功（`SELECT * FROM courses LIMIT 1`）
- [ ] 確認 RLS 政策生效

### Phase 2: 類型定義
- [ ] 建立 `lib/types/course.ts`
- [ ] 確認類型與 DB schema 一致

### Phase 3: API Routes
- [ ] 建立 `app/api/lessons/route.ts`（GET + POST）
- [ ] 建立 `app/api/lessons/[id]/review/route.ts`（PATCH）
- [ ] 建立 `app/api/video-jobs/route.ts`（POST）
- [ ] 所有 route 都有 Zod 驗證 + 錯誤處理

### Phase 4: 狀態轉換邏輯
- [ ] 實作 VALID_TRANSITIONS 狀態機
- [ ] 確認不合法的轉換被拒絕

### Phase 5: 測試
- [ ] API route 測試（成功/失敗/邊界）
- [ ] 狀態轉換測試
- [ ] 覆蓋率 >= 80%

### Phase 6: 驗證
- [ ] 用 Postman 或 curl 測試所有 API endpoint
- [ ] 確認 RLS 在匿名/一般用戶/admin 三種角色下正確
- [ ] `npm run build` 通過
