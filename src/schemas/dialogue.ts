import { z } from 'zod';

export const EmotionStateEnum = z.enum([
  'calm', 'anxious', 'angry', 'crying', 'frustrated', 'confused',
  'grateful', 'defensive', 'resigned', 'relieved', 'suspicious', 'shocked',
]);

export const TechniqueEnum = z.enum([
  'empathetic_reflection', 'NURSE_model', 'SPIKES_protocol', 'open_question',
  'summarize_check', 'option_giving', 'value_before_price', 'silence_and_wait',
  'normalization', 'reframe', 'ask_permission', 'chunk_and_check',
  'warning_shot', 'collaborative_language', 'acknowledge_expertise',
]);

const VetTurnSchema = z.object({
  turn: z.number().int().positive(),
  speaker: z.literal('vet'),
  text: z.string().min(5),
  intention: z.string().min(5),
  technique: TechniqueEnum,
});

const OwnerTurnSchema = z.object({
  turn: z.number().int().positive(),
  speaker: z.literal('owner'),
  text: z.string().min(3),
  emotion: EmotionStateEnum,
  subtext: z.string().min(5),
});

const DialogueTurnSchema = z.discriminatedUnion('speaker', [VetTurnSchema, OwnerTurnSchema]);

export const CaseDialogueSchema = z.object({
  scenario: z.object({
    setting: z.string().min(10),
    patient: z.object({
      species: z.enum(['犬', '貓']),
      breed: z.string().min(1),
      age: z.string().min(1),
      name: z.string().min(1),
      condition: z.string().min(5),
    }),
    owner: z.object({
      name: z.string().min(1),
      personality: z.string().min(5),
      emotion_state: EmotionStateEnum,
      main_concern: z.string().min(5),
    }),
    challenge: z.string().min(10),
  }),
  dialogue: z.array(DialogueTurnSchema).min(8).max(16),
  analysis: z.object({
    good_practices: z.array(z.string()).min(2),
    pitfalls_avoided: z.array(z.string()).min(1),
    alternative_responses: z.array(z.object({
      at_turn: z.number().int().positive(),
      bad_response: z.string().min(5),
      why_bad: z.string().min(5),
      good_response: z.string().min(5),
    })).min(1),
    key_takeaway: z.string().min(10),
  }),
}).refine(
  (data) => {
    const hasDifficultMoment = data.dialogue.some(
      (t) => t.speaker === 'owner' && ['angry', 'crying', 'frustrated', 'defensive'].includes(t.emotion)
    );
    return hasDifficultMoment;
  },
  { message: '對話中必須包含至少一個困難時刻（飼主生氣/哭泣/挫折/防衛）' }
).refine(
  (data) => {
    const turns = data.dialogue.map(t => t.turn);
    return turns.every((t, i) => t === i + 1);
  },
  { message: 'turn 編號必須從 1 開始連續遞增' }
);

export { VetTurnSchema, OwnerTurnSchema, DialogueTurnSchema };
export type CaseDialogue = z.infer<typeof CaseDialogueSchema>;
