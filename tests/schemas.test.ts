import { describe, it, expect } from 'vitest';
import { KnowledgeBaseSchema } from '../src/schemas/knowledge.js';
import { SyllabusSchema, LessonSchema, ChapterSchema } from '../src/schemas/syllabus.js';
import { LessonScriptSchema } from '../src/schemas/lesson.js';
import { CaseDialogueSchema } from '../src/schemas/dialogue.js';
import { QualityReportSchema } from '../src/schemas/quality.js';

// ============================================
// Test Data Factories
// ============================================

function makeDimension(id: string) {
  return {
    dimension_id: id,
    name: '核心概念與理論基礎',
    name_en: 'Core Concepts',
    description: '本課程涉及的核心概念、理論框架、關鍵定義說明',
    content: { key_concepts: [], clinical_pearls: ['臨床珠璣'] },
  };
}

function makeReference(id: string, year = 2024) {
  return {
    id,
    authors: 'Smith et al.',
    year,
    title: 'Veterinary Communication Skills',
    journal: 'JAVMA',
    key_finding: 'Structured communication improves outcomes significantly',
  };
}

function makeKnowledgeBase() {
  return {
    course_name: '獸醫師溝通話術完全攻略',
    target_audience: '執業獸醫師、獸醫學生',
    core_value: '提升獸醫師與飼主的溝通品質',
    knowledge_generated_at: new Date().toISOString(),
    dimensions: [
      makeDimension('dim-01'),
      makeDimension('dim-02'),
      makeDimension('dim-03'),
      makeDimension('dim-04'),
      makeDimension('dim-05'),
      makeDimension('dim-06'),
      makeDimension('dim-07'),
    ],
    references: [
      makeReference('ref-01'),
      makeReference('ref-02'),
      makeReference('ref-03'),
      makeReference('ref-04'),
      makeReference('ref-05'),
    ],
  };
}

function makeLesson(chapterNum: number, lessonNum: number) {
  const chId = String(chapterNum).padStart(2, '0');
  const lId = String(lessonNum).padStart(2, '0');
  return {
    lesson_id: `lesson-${chId}-${lId}`,
    title: `測試課程 ${chId}-${lId}`,
    key_topics: ['主題A', '主題B'],
    learning_objectives: [
      { objective: '理解基本溝通技巧的重要性', bloom_level: 'L2' as const, bloom_verb: '理解' },
      { objective: '運用同理心回應技巧於臨床場景', bloom_level: 'L3' as const, bloom_verb: '應用' },
    ],
    duration_target_minutes: 12,
    case_scenario: `案例情境：飼主帶著${chId}${lId}號寵物就診，面臨溝通挑戰需要專業處理`,
  };
}

function makeChapter(chapterNum: number, lessonCount = 4) {
  const chId = String(chapterNum).padStart(2, '0');
  return {
    chapter_id: `ch-${chId}`,
    title: `第${chapterNum}章測試`,
    description: `測試章節描述，描述第${chapterNum}章內容`,
    knowledge_dimensions: ['dim-01'],
    lessons: Array.from({ length: lessonCount }, (_, i) => makeLesson(chapterNum, i + 1)),
  };
}

function makeSyllabus(chapterCount = 6) {
  const chapters = Array.from({ length: chapterCount }, (_, i) => makeChapter(i + 1));
  const totalLessons = chapters.reduce((sum, ch) => sum + ch.lessons.length, 0);
  return {
    course_title: '獸醫師溝通話術完全攻略',
    target_audience: '執業獸醫師',
    total_chapters: chapterCount,
    total_lessons: totalLessons,
    estimated_total_hours: 5,
    knowledge_dimensions_used: ['dim-01', 'dim-02', 'dim-03', 'dim-04', 'dim-05'],
    chapters,
  };
}

function makeSegment(id: string, type: 'opening' | 'teaching' | 'case' | 'summary', visualType: 'talking_head' | 'slides' = 'talking_head') {
  return {
    segment_id: id,
    type,
    speaker_mode: 'avatar' as const,
    visual_type: visualType,
    script_zh: '各位獸醫師大家好，今天我們要來聊一個非常重要的話題，就是如何跟飼主進行有效的溝通。',
    key_points: ['重點一', '重點二'],
    slide_content: visualType === 'slides'
      ? { title: '簡報標題', bullets: ['重點1', '重點2'], animation: 'fade_in_sequence' as const }
      : null,
    visual_notes: '講師數位人半身，背景為明亮的診間環境',
    duration_seconds: 45,
  };
}

function makeLessonScript() {
  return {
    course_id: 'vet-comm-001',
    lesson_id: 'lesson-01-03',
    title: '檢查費用說明的藝術',
    duration_target_minutes: 11,
    segments: [
      makeSegment('seg-01', 'opening'),
      makeSegment('seg-02', 'teaching', 'slides'),
      makeSegment('seg-03', 'teaching'),
      makeSegment('seg-04', 'case'),
      makeSegment('seg-05', 'teaching', 'slides'),
      makeSegment('seg-06', 'summary'),
    ],
    quiz: [
      {
        question: '當飼主說「別家醫院比較便宜」時，最佳的第一反應是什麼？',
        options: ['A. 解釋自己的收費標準', 'B. 先同理飼主的擔心', 'C. 告訴飼主別家醫院不同'],
        answer: 'B',
        explanation: '先同理再說明是最有效的溝通策略，能降低飼主的防禦心理。',
      },
      {
        question: '選項式溝通的核心概念是什麼？',
        options: ['A. 給飼主最便宜的選項', 'B. 提供2-3個方案讓飼主選擇', 'C. 列出所有檢查項目'],
        answer: 'B',
        explanation: '選項式溝通提供有限但合理的選項，讓飼主有選擇的主導感。',
      },
    ],
    metadata: {
      topic: 'veterinary_communication',
      chapter: 'ch-01',
      difficulty: 'intermediate' as const,
      generated_at: new Date().toISOString(),
    },
  };
}

function makeCaseDialogue() {
  return {
    scenario: {
      setting: '週五下午，手術室外的會談室。獸醫師剛完成一隻10歲黃金獵犬的脾臟腫塊切除手術。',
      patient: {
        species: '犬' as const,
        breed: '黃金獵犬',
        age: '10歲',
        name: '大福',
        condition: '脾臟腫塊（術中發現已破裂，肝臟疑似轉移）',
      },
      owner: {
        name: '林先生',
        personality: '理性但感性，與狗狗感情深厚',
        emotion_state: 'anxious' as const,
        main_concern: '大福是否能康復，手術是否成功',
      },
      challenge: '術中發現比預期更嚴重的病況，需要在飼主期待手術成功的情緒下傳達壞消息',
    },
    dialogue: [
      { turn: 1, speaker: 'vet' as const, text: '林先生，手術結束了，大福目前生命徵象穩定。', intention: '先報平安再深入談', technique: 'ask_permission' as const },
      { turn: 2, speaker: 'owner' as const, text: '好的，手術順利嗎？大福還好嗎？', emotion: 'anxious' as const, subtext: '急切想聽好消息' },
      { turn: 3, speaker: 'vet' as const, text: '大福在手術中表現穩定。不過我需要跟您談一些發現。', intention: '預告壞消息', technique: 'warning_shot' as const },
      { turn: 4, speaker: 'owner' as const, text: '什麼狀況？是不是腫瘤是壞的？', emotion: 'anxious' as const, subtext: '有心理準備但不願面對' },
      { turn: 5, speaker: 'vet' as const, text: '您做了很多功課。確實，腫塊已經有破裂出血。', intention: '肯定飼主，分段告知', technique: 'chunk_and_check' as const },
      { turn: 6, speaker: 'owner' as const, text: '肝臟也有？大福還能活多久？', emotion: 'shocked' as const, subtext: '最害怕的事發生了' },
      { turn: 7, speaker: 'vet' as const, text: '我理解這很讓人擔心。目前還不能確定是轉移。', intention: '同理情緒不過度悲觀', technique: 'empathetic_reflection' as const },
      { turn: 8, speaker: 'owner' as const, text: '我不想讓大福受苦...', emotion: 'crying' as const, subtext: '在掙扎救治與放棄之間' },
      { turn: 9, speaker: 'vet' as const, text: '（沉默，給飼主時間消化）', intention: '給飼主情緒消化空間', technique: 'silence_and_wait' as const },
      { turn: 10, speaker: 'owner' as const, text: '對不起...大福跟了我十年了...', emotion: 'crying' as const, subtext: '需要被理解' },
      { turn: 11, speaker: 'vet' as const, text: '不需要道歉，大福是您的家人。等病理報告出來，我們再一起討論。', intention: '正常化情緒、減輕壓力', technique: 'normalization' as const },
      { turn: 12, speaker: 'owner' as const, text: '好...謝謝醫師。', emotion: 'resigned' as const, subtext: '感受到支持' },
    ],
    analysis: {
      good_practices: ['先報平安再談壞消息', '使用 warning shot 預告', '沉默等待給飼主消化空間'],
      pitfalls_avoided: ['沒有第一句就說壞消息', '沒有反駁飼主的網路資訊'],
      alternative_responses: [{
        at_turn: 5,
        bad_response: '網路上的資訊不一定正確，您不要亂看。',
        why_bad: '否定飼主的努力，關閉溝通',
        good_response: '您做了很多功課。確實，腫塊已經有破裂出血。',
      }],
      key_takeaway: '壞消息傳達的關鍵是「分段、同理、留白」。',
    },
  };
}

function makeQualityReport(overallScore: number, verdict: 'approved' | 'revision_needed' | 'rejected', issues: Array<{ severity: 'high' | 'medium' | 'low' }> = []) {
  return {
    lesson_id: 'lesson-01-03',
    overall_score: overallScore,
    scores: {
      口語自然度: 8,
      專業正確性: 9,
      教學結構: 8,
      案例實用性: 8,
      字數節奏: 7,
      視覺指示: 7,
      測驗品質: 7,
    },
    issues: issues.map((i, idx) => ({
      severity: i.severity,
      segment_id: `seg-${String(idx + 1).padStart(2, '0')}`,
      issue: '書面語過多，不像真人口語表達',
      original_text: '透過選項式溝通的方式進行費用說明',
      suggestion: '改為口語化表達',
      revised_text: '用選項式溝通這個方法來談費用',
    })),
    general_feedback: '整體教學結構清晰，案例寫實度高。',
    verdict,
  };
}

// ============================================
// KnowledgeBaseSchema Tests
// ============================================

describe('KnowledgeBaseSchema', () => {
  it('validates a complete knowledge base', () => {
    const result = KnowledgeBaseSchema.safeParse(makeKnowledgeBase());
    expect(result.success).toBe(true);
  });

  it('requires exactly 7 dimensions', () => {
    const data = makeKnowledgeBase();
    data.dimensions = data.dimensions.slice(0, 5);
    const result = KnowledgeBaseSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('requires at least 5 references', () => {
    const data = makeKnowledgeBase();
    data.references = data.references.slice(0, 3);
    const result = KnowledgeBaseSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('validates dimension_id sequence (dim-01 to dim-07)', () => {
    const data = makeKnowledgeBase();
    data.dimensions[3].dimension_id = 'dim-99';
    const result = KnowledgeBaseSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('rejects invalid dimension_id format', () => {
    const data = makeKnowledgeBase();
    data.dimensions[0].dimension_id = 'dim-1'; // should be dim-01
    const result = KnowledgeBaseSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('rejects reference year out of range', () => {
    const data = makeKnowledgeBase();
    data.references[0].year = 1980;
    const result = KnowledgeBaseSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});

// ============================================
// SyllabusSchema Tests
// ============================================

describe('SyllabusSchema', () => {
  it('validates a complete 6-chapter syllabus', () => {
    const result = SyllabusSchema.safeParse(makeSyllabus(6));
    expect(result.success).toBe(true);
  });

  it('validates an 8-chapter syllabus', () => {
    // 8 chapters × 3 lessons = 24 (within 20-30 range)
    const chapters = Array.from({ length: 8 }, (_, i) => makeChapter(i + 1, 3));
    const totalLessons = chapters.reduce((sum, ch) => sum + ch.lessons.length, 0);
    const result = SyllabusSchema.safeParse({
      course_title: '獸醫師溝通話術完全攻略',
      target_audience: '執業獸醫師',
      total_chapters: 8,
      total_lessons: totalLessons,
      estimated_total_hours: 6,
      knowledge_dimensions_used: ['dim-01', 'dim-02', 'dim-03', 'dim-04', 'dim-05'],
      chapters,
    });
    expect(result.success).toBe(true);
  });

  it('rejects syllabus with less than 6 chapters', () => {
    const data = makeSyllabus(3);
    const result = SyllabusSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('rejects syllabus with more than 8 chapters', () => {
    const data = makeSyllabus(9);
    const result = SyllabusSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('rejects total_chapters mismatch', () => {
    const data = makeSyllabus(6);
    data.total_chapters = 7;
    const result = SyllabusSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('rejects total_lessons mismatch', () => {
    const data = makeSyllabus(6);
    data.total_lessons = 999;
    const result = SyllabusSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('validates total_lessons matches actual count', () => {
    const data = makeSyllabus(6);
    const actualLessons = data.chapters.reduce((sum, ch) => sum + ch.lessons.length, 0);
    expect(data.total_lessons).toBe(actualLessons);
  });

  it('rejects lesson_id with wrong format', () => {
    const data = makeSyllabus(6);
    data.chapters[0].lessons[0].lesson_id = 'bad-id';
    const result = SyllabusSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('rejects chapter_id with wrong format', () => {
    const data = makeSyllabus(6);
    data.chapters[0].chapter_id = 'chapter-1';
    const result = SyllabusSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('rejects duration outside 10-15 minutes', () => {
    const data = makeSyllabus(6);
    data.chapters[0].lessons[0].duration_target_minutes = 5;
    const result = SyllabusSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('requires at least 2 learning objectives per lesson', () => {
    const data = makeSyllabus(6);
    data.chapters[0].lessons[0].learning_objectives = [
      { objective: '只有一個目標不夠', bloom_level: 'L2', bloom_verb: '理解' },
    ];
    const result = SyllabusSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});

// ============================================
// LessonScriptSchema Tests
// ============================================

describe('LessonScriptSchema', () => {
  it('validates a complete lesson script', () => {
    const result = LessonScriptSchema.safeParse(makeLessonScript());
    expect(result.success).toBe(true);
  });

  it('requires exactly 1 opening segment', () => {
    const data = makeLessonScript();
    data.segments[0].type = 'teaching';
    const result = LessonScriptSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('requires exactly 1 summary segment', () => {
    const data = makeLessonScript();
    data.segments[5].type = 'teaching';
    const result = LessonScriptSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('requires at least 1 case segment', () => {
    const data = makeLessonScript();
    data.segments[3].type = 'teaching';
    const result = LessonScriptSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('rejects slides segment without slide_content', () => {
    const data = makeLessonScript();
    data.segments[1].visual_type = 'slides';
    data.segments[1].slide_content = null;
    const result = LessonScriptSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('allows talking_head with null slide_content', () => {
    const data = makeLessonScript();
    data.segments[0].visual_type = 'talking_head';
    data.segments[0].slide_content = null;
    const result = LessonScriptSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('requires 2-3 quiz questions', () => {
    const data = makeLessonScript();
    data.quiz = [data.quiz[0]]; // only 1
    const result = LessonScriptSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('requires 5-8 segments', () => {
    const data = makeLessonScript();
    data.segments = data.segments.slice(0, 3); // only 3
    const result = LessonScriptSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('validates segment_id format', () => {
    const data = makeLessonScript();
    data.segments[0].segment_id = 'segment-1';
    const result = LessonScriptSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('rejects script_zh shorter than 30 chars', () => {
    const data = makeLessonScript();
    data.segments[0].script_zh = '太短了';
    const result = LessonScriptSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});

// ============================================
// CaseDialogueSchema Tests
// ============================================

describe('CaseDialogueSchema', () => {
  it('validates a complete case dialogue', () => {
    const result = CaseDialogueSchema.safeParse(makeCaseDialogue());
    expect(result.success).toBe(true);
  });

  it('requires at least one difficult moment', () => {
    const data = makeCaseDialogue();
    // Replace all difficult emotions with calm
    data.dialogue = data.dialogue.map(t => {
      if (t.speaker === 'owner') {
        return { ...t, emotion: 'calm' as const };
      }
      return t;
    });
    const result = CaseDialogueSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('validates turn numbers are sequential', () => {
    const data = makeCaseDialogue();
    data.dialogue[5].turn = 99; // break sequence
    const result = CaseDialogueSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('requires at least 8 dialogue turns', () => {
    const data = makeCaseDialogue();
    data.dialogue = data.dialogue.slice(0, 5);
    // Fix turn numbers
    data.dialogue.forEach((t, i) => { t.turn = i + 1; });
    const result = CaseDialogueSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('rejects more than 16 turns', () => {
    const data = makeCaseDialogue();
    // Add turns to exceed 16
    while (data.dialogue.length <= 16) {
      const nextTurn = data.dialogue.length + 1;
      if (nextTurn % 2 === 1) {
        data.dialogue.push({
          turn: nextTurn,
          speaker: 'vet' as const,
          text: '醫師繼續說明情況',
          intention: '持續溝通',
          technique: 'empathetic_reflection' as const,
        });
      } else {
        data.dialogue.push({
          turn: nextTurn,
          speaker: 'owner' as const,
          text: '飼主回應',
          emotion: 'calm' as const,
          subtext: '飼主的內心想法',
        });
      }
    }
    const result = CaseDialogueSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('validates discriminated union (vet has technique, owner has emotion)', () => {
    const data = makeCaseDialogue();
    // Try to add emotion to vet turn (should fail discriminated union)
    const badTurn = { turn: 1, speaker: 'vet' as const, text: '你好', intention: '打招呼' };
    // Missing 'technique' field
    data.dialogue[0] = badTurn as typeof data.dialogue[0];
    const result = CaseDialogueSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('requires at least 2 good_practices', () => {
    const data = makeCaseDialogue();
    data.analysis.good_practices = ['只有一個'];
    const result = CaseDialogueSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('requires at least 1 alternative_response', () => {
    const data = makeCaseDialogue();
    data.analysis.alternative_responses = [];
    const result = CaseDialogueSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});

// ============================================
// QualityReportSchema Tests
// ============================================

describe('QualityReportSchema', () => {
  it('validates approved report (score >= 80, no high issues)', () => {
    const result = QualityReportSchema.safeParse(
      makeQualityReport(85, 'approved', [])
    );
    expect(result.success).toBe(true);
  });

  it('validates revision_needed report', () => {
    const result = QualityReportSchema.safeParse(
      makeQualityReport(76, 'revision_needed', [{ severity: 'medium' }])
    );
    expect(result.success).toBe(true);
  });

  it('validates rejected report (score < 60)', () => {
    const result = QualityReportSchema.safeParse(
      makeQualityReport(55, 'rejected', [{ severity: 'high' }])
    );
    expect(result.success).toBe(true);
  });

  it('rejects approved with high severity issue', () => {
    const result = QualityReportSchema.safeParse(
      makeQualityReport(85, 'approved', [{ severity: 'high' }])
    );
    expect(result.success).toBe(false);
  });

  it('rejects approved with score < 80', () => {
    const result = QualityReportSchema.safeParse(
      makeQualityReport(75, 'approved', [])
    );
    expect(result.success).toBe(false);
  });

  it('rejects rejected with score >= 60', () => {
    const result = QualityReportSchema.safeParse(
      makeQualityReport(65, 'rejected', [])
    );
    expect(result.success).toBe(false);
  });

  it('validates score range (1-10 per dimension)', () => {
    const data = makeQualityReport(80, 'approved', []);
    data.scores.口語自然度 = 11; // out of range
    const result = QualityReportSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('rejects score of 0 for a dimension', () => {
    const data = makeQualityReport(80, 'approved', []);
    data.scores.專業正確性 = 0;
    const result = QualityReportSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('rejects non-integer scores', () => {
    const data = makeQualityReport(80, 'approved', []);
    data.scores.教學結構 = 7.5;
    const result = QualityReportSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('validates issue segment_id format', () => {
    const data = makeQualityReport(76, 'revision_needed', [{ severity: 'medium' }]);
    data.issues[0].segment_id = 'bad-id';
    const result = QualityReportSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});
