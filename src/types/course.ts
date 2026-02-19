// SSOT: Course & DB layer types (Stage 05)

export type ReviewStatus =
  | 'pending'
  | 'reviewing'
  | 'revision_needed'
  | 'approved'
  | 'production'
  | 'manual_review';

export type CourseStatus = 'draft' | 'active' | 'archived';

export type BatchStage = 'script_gen' | 'quality_check' | 'video_gen';
export type BatchStatus = 'in_progress' | 'paused' | 'completed' | 'failed';

export interface Course {
  id: string;
  title: string;
  description: string | null;
  status: CourseStatus;
  total_chapters: number;
  total_lessons: number;
  syllabus_json: Record<string, unknown> | null;
  knowledge_base_json: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DBLesson {
  id: string;
  course_id: string;
  lesson_id: string;
  chapter_id: string;
  title: string;
  content: Record<string, unknown>;
  review_status: ReviewStatus;
  reviewer_notes: string | null;
  quality_report: Record<string, unknown> | null;
  quality_score: number | null;
  version: number;
  created_by: string | null;
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

export interface VideoJob {
  id: string;
  lesson_id: string;
  provider: 'heygen' | 'elevenlabs' | 'remotion' | 'ffmpeg';
  status: 'queued' | 'processing' | 'completed' | 'failed';
  video_url: string | null;
  subtitle_url: string | null;
  cost_usd: number;
  error_log: string | null;
  created_by: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

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
