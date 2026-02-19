import { describe, it, expect } from 'vitest';
import { applyFixes, shouldForceManualReview } from '../src/lib/auto-fix.js';
import type { LessonScript } from '../src/types/lesson.js';
import type { QualityReport } from '../src/types/quality.js';

function makeLessonScript(overrides?: Partial<LessonScript>): LessonScript {
  return {
    course_id: 'vet-comm-001',
    lesson_id: 'lesson-01-01',
    title: '測試課程',
    duration_target_minutes: 12,
    segments: [
      {
        segment_id: 'seg-01',
        type: 'opening',
        speaker_mode: 'avatar',
        visual_type: 'talking_head',
        script_zh: '各位獸醫師大家好，今天我們要來談一個關於臨床溝通非常重要的主題。',
        key_points: ['溝通重要性'],
        slide_content: null,
        visual_notes: '講師半身像',
        duration_seconds: 30,
      },
      {
        segment_id: 'seg-02',
        type: 'teaching',
        speaker_mode: 'avatar',
        visual_type: 'talking_head',
        script_zh: '透過選項式溝通的方式，我們可以有效地進行費用說明的實施，讓飼主更容易接受。',
        key_points: ['選項式溝通'],
        slide_content: null,
        visual_notes: '講師講解教學內容',
        duration_seconds: 45,
      },
      {
        segment_id: 'seg-03',
        type: 'case',
        speaker_mode: 'avatar',
        visual_type: 'talking_head',
        script_zh: '現在我們來看一個案例情境，一位飼主帶著貓咪來就診，面臨費用溝通的挑戰。',
        key_points: ['案例模擬'],
        slide_content: null,
        visual_notes: '情境模擬場景',
        duration_seconds: 60,
      },
      {
        segment_id: 'seg-04',
        type: 'teaching',
        speaker_mode: 'avatar',
        visual_type: 'slides',
        script_zh: '接下來我們整理一下今天學到的三個溝通技巧的重點，讓大家可以馬上應用在臨床。',
        key_points: ['技巧整理'],
        slide_content: { title: '三大溝通技巧', bullets: ['技巧一', '技巧二', '技巧三'], animation: 'fade_in_sequence' },
        visual_notes: '簡報整理重點',
        duration_seconds: 40,
      },
      {
        segment_id: 'seg-05',
        type: 'summary',
        speaker_mode: 'avatar',
        visual_type: 'talking_head',
        script_zh: '好的，今天的課程就到這裡，我們下次見！希望大家回去試試看今天學到的溝通技巧。',
        key_points: ['課程總結'],
        slide_content: null,
        visual_notes: '講師微笑收尾',
        duration_seconds: 25,
      },
    ],
    quiz: [
      { question: '選項式溝通的核心是什麼？', options: ['A. 給最便宜的', 'B. 提供2-3個方案', 'C. 不說價格'], answer: 'B', explanation: '提供有限但合理的選項讓飼主選擇。' },
      { question: '費用預告制的重點？', options: ['A. 先做再說', 'B. 先告知費用', 'C. 不提費用'], answer: 'B', explanation: '先告知飼主預計費用範圍。' },
    ],
    metadata: {
      topic: 'veterinary_communication',
      chapter: 'ch-01',
      difficulty: 'intermediate',
      generated_at: '2026-02-19T10:00:00Z',
    },
    ...overrides,
  };
}

function makeReport(overrides?: Partial<QualityReport>): QualityReport {
  return {
    lesson_id: 'lesson-01-01',
    overall_score: 76,
    scores: {
      口語自然度: 7, 專業正確性: 9, 教學結構: 8,
      案例實用性: 8, 字數節奏: 7, 視覺指示: 6, 測驗品質: 7,
    },
    issues: [],
    general_feedback: '整體表現良好，需要改善口語自然度。',
    verdict: 'revision_needed',
    ...overrides,
  };
}

describe('applyFixes', () => {
  it('applies medium severity fix at segment object level', () => {
    const lesson = makeLessonScript();
    const report = makeReport({
      issues: [{
        severity: 'medium',
        segment_id: 'seg-02',
        issue: '書面語過多',
        original_text: '透過選項式溝通的方式，我們可以有效地進行費用說明的實施',
        suggestion: '改為口語化',
        revised_text: '用選項式溝通這個方法，我們可以更自然地跟飼主談費用',
      }],
    });

    const { fixed, appliedCount, remainingHighIssues } = applyFixes(lesson, report);
    expect(appliedCount).toBe(1);
    expect(remainingHighIssues).toBe(0);
    expect(fixed.segments[1].script_zh).toContain('用選項式溝通這個方法');
    expect(fixed.segments[1].script_zh).not.toContain('透過選項式溝通的方式');
  });

  it('applies low severity fix', () => {
    const lesson = makeLessonScript();
    const report = makeReport({
      issues: [{
        severity: 'low',
        segment_id: 'seg-02',
        issue: '小問題',
        original_text: '有效地',
        suggestion: '改為口語',
        revised_text: '很好地',
      }],
    });

    const { fixed, appliedCount } = applyFixes(lesson, report);
    expect(appliedCount).toBe(1);
    expect(fixed.segments[1].script_zh).toContain('很好地');
  });

  it('skips high severity issues (left for human review)', () => {
    const lesson = makeLessonScript();
    const report = makeReport({
      issues: [{
        severity: 'high',
        segment_id: 'seg-02',
        issue: '嚴重問題',
        original_text: '透過選項式溝通的方式',
        suggestion: '需要人工處理',
        revised_text: '改寫版本',
      }],
    });

    const { fixed, appliedCount, remainingHighIssues } = applyFixes(lesson, report);
    expect(appliedCount).toBe(0);
    expect(remainingHighIssues).toBe(1);
    // Original text should be unchanged
    expect(fixed.segments[1].script_zh).toContain('透過選項式溝通的方式');
  });

  it('returns 0 appliedCount when segment not found', () => {
    const lesson = makeLessonScript();
    const report = makeReport({
      issues: [{
        severity: 'medium',
        segment_id: 'seg-99',
        issue: '不存在的 segment',
        original_text: '任意文字',
        suggestion: '修改建議',
        revised_text: '修改後版本',
      }],
    });

    const { appliedCount } = applyFixes(lesson, report);
    expect(appliedCount).toBe(0);
  });

  it('returns 0 appliedCount when original_text not found in segment', () => {
    const lesson = makeLessonScript();
    const report = makeReport({
      issues: [{
        severity: 'medium',
        segment_id: 'seg-02',
        issue: '文字不匹配',
        original_text: '這段文字在講稿中不存在',
        suggestion: '修改建議',
        revised_text: '修改後版本',
      }],
    });

    const { appliedCount } = applyFixes(lesson, report);
    expect(appliedCount).toBe(0);
  });

  it('handles empty issues array', () => {
    const lesson = makeLessonScript();
    const report = makeReport({ issues: [] });

    const { fixed, appliedCount, remainingHighIssues } = applyFixes(lesson, report);
    expect(appliedCount).toBe(0);
    expect(remainingHighIssues).toBe(0);
    expect(fixed.segments.length).toBe(lesson.segments.length);
  });

  it('does not mutate original lesson (uses structuredClone)', () => {
    const lesson = makeLessonScript();
    const originalText = lesson.segments[1].script_zh;
    const report = makeReport({
      issues: [{
        severity: 'medium',
        segment_id: 'seg-02',
        issue: '書面語',
        original_text: '透過選項式溝通的方式',
        suggestion: '改為口語',
        revised_text: '用選項式溝通',
      }],
    });

    applyFixes(lesson, report);
    // Original should be unchanged
    expect(lesson.segments[1].script_zh).toBe(originalText);
  });

  it('applies multiple fixes across different segments', () => {
    const lesson = makeLessonScript();
    const report = makeReport({
      issues: [
        {
          severity: 'medium',
          segment_id: 'seg-01',
          issue: '問題1',
          original_text: '各位獸醫師大家好',
          suggestion: '改為口語',
          revised_text: '嗨大家好',
        },
        {
          severity: 'low',
          segment_id: 'seg-02',
          issue: '問題2',
          original_text: '有效地',
          suggestion: '改為口語',
          revised_text: '很好地',
        },
        {
          severity: 'high',
          segment_id: 'seg-03',
          issue: '高嚴重度',
          original_text: '案例情境',
          suggestion: '跳過',
          revised_text: '不應被套用',
        },
      ],
    });

    const { appliedCount, remainingHighIssues } = applyFixes(lesson, report);
    expect(appliedCount).toBe(2);
    expect(remainingHighIssues).toBe(1);
  });
});

describe('shouldForceManualReview', () => {
  it('returns true for index 0 with default sampleRate (5)', () => {
    expect(shouldForceManualReview(0)).toBe(true);
  });

  it('returns false for index 1-4 with default sampleRate', () => {
    expect(shouldForceManualReview(1)).toBe(false);
    expect(shouldForceManualReview(2)).toBe(false);
    expect(shouldForceManualReview(3)).toBe(false);
    expect(shouldForceManualReview(4)).toBe(false);
  });

  it('returns true for index 5 with default sampleRate', () => {
    expect(shouldForceManualReview(5)).toBe(true);
  });

  it('returns true for index 10, 15, 20 with default sampleRate', () => {
    expect(shouldForceManualReview(10)).toBe(true);
    expect(shouldForceManualReview(15)).toBe(true);
    expect(shouldForceManualReview(20)).toBe(true);
  });

  it('respects custom sampleRate', () => {
    expect(shouldForceManualReview(0, 3)).toBe(true);
    expect(shouldForceManualReview(1, 3)).toBe(false);
    expect(shouldForceManualReview(2, 3)).toBe(false);
    expect(shouldForceManualReview(3, 3)).toBe(true);
    expect(shouldForceManualReview(6, 3)).toBe(true);
  });

  it('sampleRate 1 means every lesson is reviewed', () => {
    expect(shouldForceManualReview(0, 1)).toBe(true);
    expect(shouldForceManualReview(1, 1)).toBe(true);
    expect(shouldForceManualReview(99, 1)).toBe(true);
  });
});
