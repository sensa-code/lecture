import { describe, it, expect } from 'vitest';
import { calculateOverallScore, determineVerdict } from '../src/lib/quality-utils.js';
import type { ScoreBreakdown, QualityIssue } from '../src/types/quality.js';

describe('calculateOverallScore', () => {
  it('calculates weighted average correctly for mixed scores', () => {
    const scores: ScoreBreakdown = {
      口語自然度: 8,   // weight 20
      專業正確性: 9,   // weight 20
      教學結構: 8,     // weight 15
      案例實用性: 7,   // weight 15
      字數節奏: 8,     // weight 10
      視覺指示: 6,     // weight 10
      測驗品質: 7,     // weight 10
    };
    // Manual calculation:
    // (8*20 + 9*20 + 8*15 + 7*15 + 8*10 + 6*10 + 7*10) / 100 = 7.75
    // * 10 = 77.5 → rounds to 78
    const result = calculateOverallScore(scores);
    expect(result).toBe(78);
  });

  it('returns 100 for all perfect scores', () => {
    const scores: ScoreBreakdown = {
      口語自然度: 10, 專業正確性: 10, 教學結構: 10,
      案例實用性: 10, 字數節奏: 10, 視覺指示: 10, 測驗品質: 10,
    };
    expect(calculateOverallScore(scores)).toBe(100);
  });

  it('returns 10 for all minimum scores', () => {
    const scores: ScoreBreakdown = {
      口語自然度: 1, 專業正確性: 1, 教學結構: 1,
      案例實用性: 1, 字數節奏: 1, 視覺指示: 1, 測驗品質: 1,
    };
    expect(calculateOverallScore(scores)).toBe(10);
  });

  it('weights 口語自然度 and 專業正確性 highest (20 each)', () => {
    // Two scenarios that differ only in the heavily-weighted dimensions
    const highWeighted: ScoreBreakdown = {
      口語自然度: 10, 專業正確性: 10, 教學結構: 5,
      案例實用性: 5, 字數節奏: 5, 視覺指示: 5, 測驗品質: 5,
    };
    const lowWeighted: ScoreBreakdown = {
      口語自然度: 5, 專業正確性: 5, 教學結構: 10,
      案例實用性: 10, 字數節奏: 10, 視覺指示: 10, 測驗品質: 10,
    };
    // High weighted: (10*20 + 10*20 + 5*15 + 5*15 + 5*10 + 5*10 + 5*10) / 100 = 7.0 * 10 = 70
    // Low weighted: (5*20 + 5*20 + 10*15 + 10*15 + 10*10 + 10*10 + 10*10) / 100 = 8.0 * 10 = 80
    expect(calculateOverallScore(highWeighted)).toBe(70);
    expect(calculateOverallScore(lowWeighted)).toBe(80);
  });
});

describe('determineVerdict', () => {
  const makeIssue = (severity: 'high' | 'medium' | 'low'): QualityIssue => ({
    severity,
    segment_id: 'seg-01',
    issue: '測試問題描述',
    original_text: '原始文字內容',
    suggestion: '修改建議文字',
    revised_text: '修改後的文字',
  });

  it('returns approved when score >= 80 and no high issues', () => {
    expect(determineVerdict(80, [])).toBe('approved');
    expect(determineVerdict(85, [makeIssue('medium')])).toBe('approved');
    expect(determineVerdict(100, [makeIssue('low')])).toBe('approved');
  });

  it('returns revision_needed when score >= 80 but has high issue', () => {
    expect(determineVerdict(85, [makeIssue('high')])).toBe('revision_needed');
    expect(determineVerdict(95, [makeIssue('high'), makeIssue('low')])).toBe('revision_needed');
  });

  it('returns revision_needed when score 60-79', () => {
    expect(determineVerdict(60, [])).toBe('revision_needed');
    expect(determineVerdict(79, [])).toBe('revision_needed');
    expect(determineVerdict(70, [makeIssue('medium')])).toBe('revision_needed');
  });

  it('returns rejected when score < 60', () => {
    expect(determineVerdict(59, [])).toBe('rejected');
    expect(determineVerdict(0, [])).toBe('rejected');
    expect(determineVerdict(55, [makeIssue('high')])).toBe('rejected');
  });

  it('rejected takes precedence over high issue at low score', () => {
    // score < 60 → rejected, regardless of high issues
    expect(determineVerdict(50, [makeIssue('high')])).toBe('rejected');
  });
});
