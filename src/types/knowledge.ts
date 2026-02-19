// SSOT: Knowledge Deep Dive types (Stage 00)

export interface KeyConcept {
  term_zh: string;
  term_en: string;
  definition: string;
  clinical_relevance: string;
  teaching_points: string[];
}

export interface ClinicalScenario {
  scenario: string;
  challenge: string;
  approach: string;
  pitfalls: string[];
}

export interface Tool {
  name: string;
  name_en: string;
  purpose: string;
  usage_steps: string[];
  evidence_level: string;
}

export interface CommonProblem {
  problem: string;
  frequency: '高' | '中' | '低';
  impact: string;
  solutions: string[];
  case_example: string;
}

export interface LegalPoint {
  topic: string;
  regulation: string;
  practical_advice: string;
  risk_level: '高' | '中' | '低';
}

export interface TranslationalTool {
  human_tool: string;
  description: string;
  veterinary_adaptation: string;
  applicability: string;
  species_differences: string;
}

export interface Controversy {
  topic: string;
  positions: string[];
  current_evidence: string;
  practical_recommendation: string;
}

export interface KnowledgeDimension {
  dimension_id: string;
  name: string;
  name_en: string;
  description: string;
  content: Record<string, unknown>;
}

export interface Reference {
  id: string;
  authors: string;
  year: number;
  title: string;
  journal: string;
  key_finding: string;
}

export interface KnowledgeBase {
  course_name: string;
  target_audience: string;
  core_value: string;
  knowledge_generated_at: string;
  dimensions: KnowledgeDimension[];
  references: Reference[];
}
