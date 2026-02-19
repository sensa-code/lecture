import { z } from 'zod';

const ScoreSchema = z.number().min(1).max(10).int();

const IssueSchema = z.object({
  severity: z.enum(['high', 'medium', 'low']),
  segment_id: z.string().regex(/^seg-\d{2}$/),
  issue: z.string().min(5),
  original_text: z.string().min(5),
  suggestion: z.string().min(5),
  revised_text: z.string().min(5),
});

export const QualityReportSchema = z.object({
  lesson_id: z.string().regex(/^lesson-\d{2}-\d{2}$/),
  overall_score: z.number().min(0).max(100),
  scores: z.object({
    口語自然度: ScoreSchema,
    專業正確性: ScoreSchema,
    教學結構: ScoreSchema,
    案例實用性: ScoreSchema,
    字數節奏: ScoreSchema,
    視覺指示: ScoreSchema,
    測驗品質: ScoreSchema,
  }),
  issues: z.array(IssueSchema),
  general_feedback: z.string().max(150),
  verdict: z.enum(['approved', 'revision_needed', 'rejected']),
}).refine(
  (data) => {
    const hasHighIssue = data.issues.some(i => i.severity === 'high');
    if (data.verdict === 'approved') {
      return data.overall_score >= 80 && !hasHighIssue;
    }
    return true;
  },
  { message: 'approved 必須 overall_score >= 80 且無 high severity issue' }
).refine(
  (data) => {
    if (data.verdict === 'rejected') {
      return data.overall_score < 60;
    }
    return true;
  },
  { message: 'rejected 必須 overall_score < 60' }
);

export { ScoreSchema, IssueSchema };
export type QualityReport = z.infer<typeof QualityReportSchema>;
