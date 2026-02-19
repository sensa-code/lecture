import { z } from 'zod';

const KeyConceptSchema = z.object({
  term_zh: z.string().min(1),
  term_en: z.string().min(1),
  definition: z.string().min(10),
  clinical_relevance: z.string().min(5),
  teaching_points: z.array(z.string().min(1)).min(1),
});

const ClinicalScenarioSchema = z.object({
  scenario: z.string().min(10),
  challenge: z.string().min(5),
  approach: z.string().min(10),
  pitfalls: z.array(z.string()).min(1),
});

const ToolSchema = z.object({
  name: z.string().min(1),
  name_en: z.string().min(1),
  purpose: z.string().min(5),
  usage_steps: z.array(z.string()).min(1),
  evidence_level: z.string().min(1),
});

const CommonProblemSchema = z.object({
  problem: z.string().min(5),
  frequency: z.enum(['高', '中', '低']),
  impact: z.string().min(5),
  solutions: z.array(z.string()).min(1),
  case_example: z.string().min(10),
});

const LegalPointSchema = z.object({
  topic: z.string().min(1),
  regulation: z.string().min(1),
  practical_advice: z.string().min(5),
  risk_level: z.enum(['高', '中', '低']),
});

const TranslationalToolSchema = z.object({
  human_tool: z.string().min(1),
  description: z.string().min(10),
  veterinary_adaptation: z.string().min(5),
  applicability: z.string().min(5),
  species_differences: z.string().min(5),
});

const ControversySchema = z.object({
  topic: z.string().min(1),
  positions: z.array(z.string()).min(2),
  current_evidence: z.string().min(10),
  practical_recommendation: z.string().min(5),
});

const DimensionSchema = z.object({
  dimension_id: z.string().regex(/^dim-\d{2}$/),
  name: z.string().min(2),
  name_en: z.string().min(2),
  description: z.string().min(10),
  content: z.record(z.unknown()),
});

const ReferenceSchema = z.object({
  id: z.string().regex(/^ref-\d{2}$/),
  authors: z.string().min(1),
  year: z.number().min(1990).max(2030),
  title: z.string().min(5),
  journal: z.string().min(1),
  key_finding: z.string().min(5),
});

export const KnowledgeBaseSchema = z.object({
  course_name: z.string().min(1),
  target_audience: z.string().min(1),
  core_value: z.string().min(1),
  knowledge_generated_at: z.string(),
  dimensions: z.array(DimensionSchema).length(7),
  references: z.array(ReferenceSchema).min(5),
}).refine(
  (data) => {
    return data.dimensions.every((d, i) =>
      d.dimension_id === `dim-${String(i + 1).padStart(2, '0')}`
    );
  },
  { message: 'dimensions 必須依序為 dim-01 到 dim-07' }
);

export {
  KeyConceptSchema,
  ClinicalScenarioSchema,
  ToolSchema,
  CommonProblemSchema,
  LegalPointSchema,
  TranslationalToolSchema,
  ControversySchema,
  DimensionSchema,
  ReferenceSchema,
};

export type KnowledgeBase = z.infer<typeof KnowledgeBaseSchema>;
