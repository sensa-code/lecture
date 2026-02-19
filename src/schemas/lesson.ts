import { z } from 'zod';

const SlideContentSchema = z.object({
  title: z.string().min(1),
  bullets: z.array(z.string().min(1)).min(2).max(5),
  animation: z.enum(['fade_in_sequence', 'slide_in_left', 'none']),
});

const SegmentSchema = z.object({
  segment_id: z.string().regex(/^seg-\d{2}$/),
  type: z.enum(['opening', 'teaching', 'case', 'summary']),
  speaker_mode: z.enum(['avatar', 'voiceover']),
  visual_type: z.enum(['talking_head', 'slides']),
  script_zh: z.string().min(30, '講稿至少 30 字'),
  key_points: z.array(z.string()),
  slide_content: SlideContentSchema.nullable(),
  visual_notes: z.string().min(5),
  duration_seconds: z.number().min(15).max(300),
});

const QuizSchema = z.object({
  question: z.string().min(5),
  options: z.array(z.string()).min(3).max(4),
  answer: z.string().min(1).max(1),
  explanation: z.string().min(10),
});

export const LessonScriptSchema = z.object({
  course_id: z.string(),
  lesson_id: z.string().regex(/^lesson-\d{2}-\d{2}$/),
  title: z.string().min(2),
  duration_target_minutes: z.number().min(10).max(15),
  segments: z.array(SegmentSchema).min(5).max(8),
  quiz: z.array(QuizSchema).min(2).max(3),
  metadata: z.object({
    topic: z.string(),
    chapter: z.string().regex(/^ch-\d{2}$/),
    difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
    generated_at: z.string(),
  }),
}).refine(
  (data) => data.segments.filter(s => s.type === 'opening').length === 1,
  { message: '必須恰好有 1 個 opening segment' }
).refine(
  (data) => data.segments.filter(s => s.type === 'summary').length === 1,
  { message: '必須恰好有 1 個 summary segment' }
).refine(
  (data) => data.segments.filter(s => s.type === 'case').length >= 1,
  { message: '必須至少有 1 個 case segment' }
).refine(
  (data) => data.segments.every(s =>
    s.visual_type !== 'slides' || s.slide_content !== null
  ),
  { message: 'visual_type 為 slides 時，slide_content 不可為 null' }
);

export { SlideContentSchema, SegmentSchema, QuizSchema };
export type LessonScript = z.infer<typeof LessonScriptSchema>;
