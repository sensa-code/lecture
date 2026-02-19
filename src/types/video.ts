// SSOT: Video Pipeline types (Stage 06)

export interface SegmentInput {
  segment_id: string;
  type: 'opening' | 'teaching' | 'case' | 'summary';
  visual_type: 'talking_head' | 'slides';
  script_zh: string;
  slide_content: {
    title: string;
    bullets: string[];
    animation: string;
  } | null;
  visual_notes: string;
  duration_seconds: number;
}

export interface LessonInput {
  lesson_id: string;
  title: string;
  segments: SegmentInput[];
}

export interface TTSResult {
  segment_id: string;
  audio_path: string;
  duration_seconds: number;
  srt_path: string | null;
}

export interface HeyGenResult {
  segment_id: string;
  video_id: string;
  video_url: string;
  status: 'completed' | 'failed';
  error: string | null;
}

export interface SlideRenderResult {
  segment_id: string;
  video_path: string;
  duration_seconds: number;
}

export interface PipelineResult {
  lesson_id: string;
  final_video_path: string;
  final_srt_path: string;
  total_duration_seconds: number;
  segments_processed: number;
  cost_usd: number;
  errors: string[];
}
