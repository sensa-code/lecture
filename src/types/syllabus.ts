// SSOT: Syllabus types (Stage 01)

export type BloomLevel = 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6';

export interface LearningObjective {
  objective: string;
  bloom_level: BloomLevel;
  bloom_verb: string;
}

export interface Lesson {
  lesson_id: string;
  title: string;
  key_topics: string[];
  learning_objectives: LearningObjective[];
  duration_target_minutes: number;
  case_scenario: string;
}

export interface Chapter {
  chapter_id: string;
  title: string;
  description: string;
  knowledge_dimensions: string[];
  lessons: Lesson[];
}

export interface Syllabus {
  course_title: string;
  target_audience: string;
  total_chapters: number;
  total_lessons: number;
  estimated_total_hours: number;
  knowledge_dimensions_used: string[];
  chapters: Chapter[];
}
