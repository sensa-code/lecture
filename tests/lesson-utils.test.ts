import { describe, it, expect } from 'vitest';
import { buildLessonUserPrompt, estimateDuration } from '../src/lib/build-lesson-prompt.js';
import { extractLessonsFromSyllabus } from '../src/lib/generate-lesson.js';
import type { LessonInfo } from '../src/types/lesson.js';
import type { Syllabus } from '../src/types/syllabus.js';

describe('buildLessonUserPrompt', () => {
  const sampleInfo: LessonInfo = {
    lesson_id: 'lesson-01-03',
    title: '檢查費用說明的藝術',
    key_topics: ['費用透明化話術', '選項式溝通'],
    learning_objectives: [
      { objective: '應用選項式溝通框架說明檢查費用', bloom_level: 'L3', bloom_verb: '應用' },
    ],
    duration_target_minutes: 11,
    case_scenario: '飼主聽到血液檢查加影像檢查要價4000元',
    chapter_id: 'ch-01',
  };

  it('includes lesson_id in the prompt', () => {
    const prompt = buildLessonUserPrompt(sampleInfo);
    expect(prompt).toContain('lesson-01-03');
  });

  it('includes title in the prompt', () => {
    const prompt = buildLessonUserPrompt(sampleInfo);
    expect(prompt).toContain('檢查費用說明的藝術');
  });

  it('includes key_topics as JSON', () => {
    const prompt = buildLessonUserPrompt(sampleInfo);
    expect(prompt).toContain('費用透明化話術');
    expect(prompt).toContain('選項式溝通');
  });

  it('includes duration target', () => {
    const prompt = buildLessonUserPrompt(sampleInfo);
    expect(prompt).toContain('11');
  });

  it('includes case_scenario', () => {
    const prompt = buildLessonUserPrompt(sampleInfo);
    expect(prompt).toContain('飼主聽到血液檢查加影像檢查要價4000元');
  });

  it('includes chapter_id', () => {
    const prompt = buildLessonUserPrompt(sampleInfo);
    expect(prompt).toContain('ch-01');
  });

  it('includes JSON output instruction', () => {
    const prompt = buildLessonUserPrompt(sampleInfo);
    expect(prompt).toContain('JSON');
  });

  it('uses course_id from info when provided (P0-3 fix)', () => {
    const infoWithCourse = { ...sampleInfo, course_id: 'vet-derm-002' };
    const prompt = buildLessonUserPrompt(infoWithCourse);
    expect(prompt).toContain('vet-derm-002');
    expect(prompt).not.toContain('vet-comm-001'); // No hardcoded value
  });

  it('uses "unknown-course" as default when course_id not provided', () => {
    const prompt = buildLessonUserPrompt(sampleInfo);
    expect(prompt).toContain('unknown-course');
    expect(prompt).not.toContain('vet-comm-001'); // No hardcoded value
  });
});

describe('estimateDuration', () => {
  it('estimates empty string as 0 seconds', () => {
    expect(estimateDuration('')).toBe(0);
  });

  it('estimates known character count correctly (~3.5 chars/sec)', () => {
    // 35 chars → 10 seconds
    const script = '一'.repeat(35);
    expect(estimateDuration(script)).toBe(10);
  });

  it('estimates 100 chars as ~29 seconds', () => {
    const script = '一'.repeat(100);
    const duration = estimateDuration(script);
    expect(duration).toBe(29); // 100 / 3.5 = 28.57 → rounds to 29
  });

  it('ignores whitespace in character count', () => {
    const withSpaces = '一二三四五 六七八 九十';
    const withoutSpaces = '一二三四五六七八九十';
    expect(estimateDuration(withSpaces)).toBe(estimateDuration(withoutSpaces));
  });

  it('handles realistic Chinese text length (~200 chars = ~57 seconds)', () => {
    const script = '各位獸醫師大家好今天我們要來聊一個每天在診間都會遇到但很多人覺得很尷尬的話題就是怎麼跟飼主解釋檢查費用你有沒有遇過那種飼主一聽到費用就皺眉頭然後說為什麼這麼貴的情況今天我就來教大家一個很好用的溝通框架首先我們來看一個概念叫做選項式溝通很多醫師在報價的時候會直接說血檢加影像檢查總共四千塊這樣講其實就是把飼主推到一個只能說好或不好的死角';
    const duration = estimateDuration(script);
    expect(duration).toBeGreaterThan(40);
    expect(duration).toBeLessThan(80);
  });
});

describe('extractLessonsFromSyllabus', () => {
  const makeSyllabus = (): Syllabus => ({
    course_title: '獸醫師溝通話術完全攻略',
    target_audience: '執業獸醫師',
    total_chapters: 2,
    total_lessons: 5,
    estimated_total_hours: 1,
    knowledge_dimensions_used: ['dim-01', 'dim-02', 'dim-03', 'dim-04', 'dim-05'],
    chapters: [
      {
        chapter_id: 'ch-01',
        title: '第一章',
        description: '基礎溝通測試章節描述文字',
        knowledge_dimensions: ['dim-01'],
        lessons: [
          {
            lesson_id: 'lesson-01-01',
            title: '課程 1-1',
            key_topics: ['主題A'],
            learning_objectives: [
              { objective: '理解基本概念的重要性和應用場景', bloom_level: 'L2', bloom_verb: '理解' },
              { objective: '應用溝通技巧於臨床實務場景中', bloom_level: 'L3', bloom_verb: '應用' },
            ],
            duration_target_minutes: 12,
            case_scenario: '飼主帶著貓咪前來就診，需要溝通費用相關問題',
          },
          {
            lesson_id: 'lesson-01-02',
            title: '課程 1-2',
            key_topics: ['主題B'],
            learning_objectives: [
              { objective: '理解溝通框架的核心結構與運作方式', bloom_level: 'L2', bloom_verb: '理解' },
              { objective: '應用框架進行臨床溝通的實際操作', bloom_level: 'L3', bloom_verb: '應用' },
            ],
            duration_target_minutes: 11,
            case_scenario: '飼主對檢查費用提出質疑，需要運用溝通技巧化解',
          },
          {
            lesson_id: 'lesson-01-03',
            title: '課程 1-3',
            key_topics: ['主題C'],
            learning_objectives: [
              { objective: '理解進階溝通策略的理論基礎', bloom_level: 'L2', bloom_verb: '理解' },
              { objective: '應用進階策略處理困難溝通場景', bloom_level: 'L3', bloom_verb: '應用' },
            ],
            duration_target_minutes: 13,
            case_scenario: '飼主情緒激動需要安撫，同時傳達重要醫療資訊',
          },
        ],
      },
      {
        chapter_id: 'ch-02',
        title: '第二章',
        description: '進階溝通測試章節描述文字',
        knowledge_dimensions: ['dim-02'],
        lessons: [
          {
            lesson_id: 'lesson-02-01',
            title: '課程 2-1',
            key_topics: ['主題D'],
            learning_objectives: [
              { objective: '分析複雜溝通場景中的關鍵挑戰因素', bloom_level: 'L4', bloom_verb: '分析' },
              { objective: '評估不同溝通策略的效果與適用性', bloom_level: 'L5', bloom_verb: '評估' },
            ],
            duration_target_minutes: 14,
            case_scenario: '面對轉診病患，需要處理飼主對前一位醫師的不信任',
          },
          {
            lesson_id: 'lesson-02-02',
            title: '課程 2-2',
            key_topics: ['主題E'],
            learning_objectives: [
              { objective: '分析跨科別溝通中的障礙與解決方案', bloom_level: 'L4', bloom_verb: '分析' },
              { objective: '設計個人化的溝通改善行動計畫', bloom_level: 'L6', bloom_verb: '創造' },
            ],
            duration_target_minutes: 10,
            case_scenario: '需要向飼主解釋複雜的手術風險並取得同意書簽署',
          },
        ],
      },
    ],
  });

  it('extracts correct number of lessons', () => {
    const lessons = extractLessonsFromSyllabus(makeSyllabus());
    expect(lessons).toHaveLength(5);
  });

  it('preserves lesson_id for each lesson', () => {
    const lessons = extractLessonsFromSyllabus(makeSyllabus());
    expect(lessons[0].lesson_id).toBe('lesson-01-01');
    expect(lessons[2].lesson_id).toBe('lesson-01-03');
    expect(lessons[3].lesson_id).toBe('lesson-02-01');
  });

  it('includes chapter_id from parent chapter', () => {
    const lessons = extractLessonsFromSyllabus(makeSyllabus());
    expect(lessons[0].chapter_id).toBe('ch-01');
    expect(lessons[1].chapter_id).toBe('ch-01');
    expect(lessons[2].chapter_id).toBe('ch-01');
    expect(lessons[3].chapter_id).toBe('ch-02');
    expect(lessons[4].chapter_id).toBe('ch-02');
  });

  it('preserves learning_objectives', () => {
    const lessons = extractLessonsFromSyllabus(makeSyllabus());
    expect(lessons[0].learning_objectives).toHaveLength(2);
    expect(lessons[0].learning_objectives[0].bloom_level).toBe('L2');
  });

  it('preserves key_topics and case_scenario', () => {
    const lessons = extractLessonsFromSyllabus(makeSyllabus());
    expect(lessons[0].key_topics).toEqual(['主題A']);
    expect(lessons[0].case_scenario).toContain('飼主帶著貓咪');
  });

  it('preserves duration_target_minutes', () => {
    const lessons = extractLessonsFromSyllabus(makeSyllabus());
    expect(lessons[0].duration_target_minutes).toBe(12);
    expect(lessons[4].duration_target_minutes).toBe(10);
  });

  it('handles empty chapters', () => {
    const syllabus = makeSyllabus();
    syllabus.chapters = [];
    const lessons = extractLessonsFromSyllabus(syllabus);
    expect(lessons).toHaveLength(0);
  });

  it('passes course_id to all lessons when provided', () => {
    const lessons = extractLessonsFromSyllabus(makeSyllabus(), 'vet-derm-002');
    expect(lessons).toHaveLength(5);
    for (const lesson of lessons) {
      expect(lesson.course_id).toBe('vet-derm-002');
    }
  });

  it('leaves course_id undefined when not provided', () => {
    const lessons = extractLessonsFromSyllabus(makeSyllabus());
    for (const lesson of lessons) {
      expect(lesson.course_id).toBeUndefined();
    }
  });
});
