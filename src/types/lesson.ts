// SSOT: Lesson Script types (Stage 02)

import type { LearningObjective } from './syllabus.js';

export interface SlideContent {
  title: string;
  bullets: string[];
  animation: 'fade_in_sequence' | 'slide_in_left' | 'none';
}

export interface Segment {
  segment_id: string;
  type: 'opening' | 'teaching' | 'case' | 'summary';
  speaker_mode: 'avatar' | 'voiceover';
  visual_type: 'talking_head' | 'slides';
  script_zh: string;
  key_points: string[];
  slide_content: SlideContent | null;
  visual_notes: string;
  duration_seconds: number;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  answer: string;
  explanation: string;
}

export interface LessonMetadata {
  topic: string;
  chapter: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  generated_at: string;
}

export interface LessonScript {
  course_id: string;
  lesson_id: string;
  title: string;
  duration_target_minutes: number;
  segments: Segment[];
  quiz: QuizQuestion[];
  metadata: LessonMetadata;
}

/**
 * 從 01 大綱中提取的單堂課資訊（作為 02 prompt 的輸入）
 * ⚠️ 此型別為 SSOT，07 batch script 必須 import 此定義
 */
export interface LessonInfo {
  lesson_id: string;
  title: string;
  key_topics: string[];
  learning_objectives: LearningObjective[];
  duration_target_minutes: number;
  case_scenario: string;
  chapter_id: string;
}
