import { z } from 'zod';

export const BloomLevelSchema = z.enum(['L1', 'L2', 'L3', 'L4', 'L5', 'L6']);

export const LearningObjectiveSchema = z.object({
  objective: z.string().min(5),
  bloom_level: BloomLevelSchema,
  bloom_verb: z.string().min(1),
});

export const LessonSchema = z.object({
  lesson_id: z.string().regex(/^lesson-\d{2}-\d{2}$/, 'lesson_id 格式必須為 lesson-XX-XX'),
  title: z.string().min(2).max(50),
  key_topics: z.array(z.string().min(1)).min(1).max(5),
  learning_objectives: z.array(LearningObjectiveSchema).min(2).max(5),
  duration_target_minutes: z.number().min(10).max(15),
  case_scenario: z.string().min(10).max(200),
});

export const ChapterSchema = z.object({
  chapter_id: z.string().regex(/^ch-\d{2}$/, 'chapter_id 格式必須為 ch-XX'),
  title: z.string().min(2).max(30),
  description: z.string().min(5).max(50),
  knowledge_dimensions: z.array(z.string().regex(/^dim-\d{2}$/)).min(1),
  lessons: z.array(LessonSchema).min(3).max(4),
});

export const SyllabusSchema = z.object({
  course_title: z.string().min(1),
  target_audience: z.string().min(1),
  total_chapters: z.number().min(6).max(8),
  total_lessons: z.number().min(20).max(30),
  estimated_total_hours: z.number().positive(),
  knowledge_dimensions_used: z.array(z.string().regex(/^dim-\d{2}$/)).min(5),
  chapters: z.array(ChapterSchema).min(6).max(8),
}).refine(
  (data) => data.chapters.length === data.total_chapters,
  { message: 'total_chapters 必須等於 chapters 陣列長度' }
).refine(
  (data) => {
    const actualLessons = data.chapters.reduce((sum, ch) => sum + ch.lessons.length, 0);
    return actualLessons === data.total_lessons;
  },
  { message: 'total_lessons 必須等於所有章節的 lessons 總數' }
);

export type Syllabus = z.infer<typeof SyllabusSchema>;
