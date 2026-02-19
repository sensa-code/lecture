-- Course Management System
-- F-13: Uses content (JSONB) and lesson_id (TEXT), NOT script_json or lesson_number
-- F-14: upsert_lesson_with_version RPC for transaction safety
-- F-15: Owner-based RLS policies
-- F-28/F-30: DECIMAL precision for scores and costs

-- 1. Courses table
CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  target_audience TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'generating', 'reviewing', 'published')),
  total_chapters INTEGER NOT NULL DEFAULT 0,
  total_lessons INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Lessons table (F-13: content JSONB, lesson_id TEXT)
CREATE TABLE IF NOT EXISTS lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id TEXT NOT NULL REFERENCES courses(course_id),
  lesson_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content JSONB NOT NULL,
  quality_score DECIMAL(5,2),
  quality_verdict TEXT CHECK (quality_verdict IN ('approved', 'revision_needed', 'rejected', 'manual_review')),
  quality_report JSONB,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'generated', 'approved', 'manual_review', 'rejected', 'video_ready', 'published')),
  version INTEGER NOT NULL DEFAULT 1,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(course_id, lesson_id)
);

-- 3. Lesson versions (audit trail)
CREATE TABLE IF NOT EXISTS lesson_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  content JSONB NOT NULL,
  quality_score DECIMAL(5,2),
  quality_verdict TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(course_id, lesson_id, version)
);

-- 4. Video jobs
CREATE TABLE IF NOT EXISTS video_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id TEXT NOT NULL REFERENCES courses(course_id),
  lesson_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  video_path TEXT,
  subtitle_path TEXT,
  duration_seconds DECIMAL(8,2),
  cost_usd DECIMAL(10,2) DEFAULT 0,
  error_message TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Batch jobs (F-26: budget tracking)
CREATE TABLE IF NOT EXISTS batch_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id TEXT NOT NULL REFERENCES courses(course_id),
  stage TEXT NOT NULL CHECK (stage IN ('generate_scripts', 'quality_check', 'generate_videos')),
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled', 'budget_exceeded')),
  total_items INTEGER NOT NULL DEFAULT 0,
  completed_items INTEGER NOT NULL DEFAULT 0,
  failed_items INTEGER NOT NULL DEFAULT 0,
  budget DECIMAL(10,2),
  spent DECIMAL(10,2) DEFAULT 0,
  config JSONB,
  error_log JSONB DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lessons_course_id ON lessons(course_id);
CREATE INDEX IF NOT EXISTS idx_lessons_status ON lessons(status);
CREATE INDEX IF NOT EXISTS idx_lesson_versions_lookup ON lesson_versions(course_id, lesson_id, version);
CREATE INDEX IF NOT EXISTS idx_video_jobs_course ON video_jobs(course_id);
CREATE INDEX IF NOT EXISTS idx_video_jobs_status ON video_jobs(status);
CREATE INDEX IF NOT EXISTS idx_batch_jobs_course ON batch_jobs(course_id);
CREATE INDEX IF NOT EXISTS idx_batch_jobs_status ON batch_jobs(status);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS trigger_courses_updated ON courses;
CREATE TRIGGER trigger_courses_updated BEFORE UPDATE ON courses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_lessons_updated ON lessons;
CREATE TRIGGER trigger_lessons_updated BEFORE UPDATE ON lessons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_video_jobs_updated ON video_jobs;
CREATE TRIGGER trigger_video_jobs_updated BEFORE UPDATE ON video_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_batch_jobs_updated ON batch_jobs;
CREATE TRIGGER trigger_batch_jobs_updated BEFORE UPDATE ON batch_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- F-14: RPC function for transactional lesson upsert with versioning
CREATE OR REPLACE FUNCTION upsert_lesson_with_version(
  p_course_id TEXT,
  p_lesson_id TEXT,
  p_title TEXT,
  p_content JSONB,
  p_quality_score DECIMAL(5,2) DEFAULT NULL,
  p_quality_verdict TEXT DEFAULT NULL,
  p_quality_report JSONB DEFAULT NULL,
  p_status TEXT DEFAULT 'generated',
  p_created_by UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_lesson_uuid UUID;
  v_current_version INTEGER;
BEGIN
  -- Get current version
  SELECT version INTO v_current_version
  FROM lessons
  WHERE course_id = p_course_id AND lesson_id = p_lesson_id;

  IF v_current_version IS NULL THEN
    v_current_version := 0;
  END IF;

  -- Archive current version
  IF v_current_version > 0 THEN
    INSERT INTO lesson_versions (lesson_id, course_id, version, content, quality_score, quality_verdict)
    SELECT lesson_id, course_id, version, content, quality_score, quality_verdict
    FROM lessons
    WHERE course_id = p_course_id AND lesson_id = p_lesson_id;
  END IF;

  -- Upsert lesson
  INSERT INTO lessons (course_id, lesson_id, title, content, quality_score, quality_verdict, quality_report, status, version, created_by)
  VALUES (p_course_id, p_lesson_id, p_title, p_content, p_quality_score, p_quality_verdict, p_quality_report, p_status, v_current_version + 1, p_created_by)
  ON CONFLICT (course_id, lesson_id)
  DO UPDATE SET
    title = EXCLUDED.title,
    content = EXCLUDED.content,
    quality_score = EXCLUDED.quality_score,
    quality_verdict = EXCLUDED.quality_verdict,
    quality_report = EXCLUDED.quality_report,
    status = EXCLUDED.status,
    version = v_current_version + 1
  RETURNING id INTO v_lesson_uuid;

  RETURN v_lesson_uuid;
END;
$$ LANGUAGE plpgsql;

-- F-15: Owner-based RLS policies
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_jobs ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY service_all_courses ON courses FOR ALL
  USING (auth.role() = 'service_role');
CREATE POLICY service_all_lessons ON lessons FOR ALL
  USING (auth.role() = 'service_role');
CREATE POLICY service_all_video_jobs ON video_jobs FOR ALL
  USING (auth.role() = 'service_role');
CREATE POLICY service_all_batch_jobs ON batch_jobs FOR ALL
  USING (auth.role() = 'service_role');

-- Owner-based access for authenticated users
CREATE POLICY owner_courses ON courses FOR ALL
  USING (created_by = auth.uid());
CREATE POLICY owner_lessons ON lessons FOR ALL
  USING (created_by = auth.uid());
CREATE POLICY owner_video_jobs ON video_jobs FOR ALL
  USING (created_by = auth.uid());
CREATE POLICY owner_batch_jobs ON batch_jobs FOR ALL
  USING (created_by = auth.uid());
