// SSOT: Quality Check types (Stage 04)

export type Severity = 'high' | 'medium' | 'low';
export type Verdict = 'approved' | 'revision_needed' | 'rejected';

export interface ScoreBreakdown {
  口語自然度: number;
  專業正確性: number;
  教學結構: number;
  案例實用性: number;
  字數節奏: number;
  視覺指示: number;
  測驗品質: number;
}

export interface QualityIssue {
  severity: Severity;
  segment_id: string;
  issue: string;
  original_text: string;
  suggestion: string;
  revised_text: string;
}

export interface QualityReport {
  lesson_id: string;
  overall_score: number;
  scores: ScoreBreakdown;
  issues: QualityIssue[];
  general_feedback: string;
  verdict: Verdict;
}
