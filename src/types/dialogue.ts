// SSOT: Case Dialogue types (Stage 03)

export type EmotionState =
  | 'calm'
  | 'anxious'
  | 'angry'
  | 'crying'
  | 'frustrated'
  | 'confused'
  | 'grateful'
  | 'defensive'
  | 'resigned'
  | 'relieved'
  | 'suspicious'
  | 'shocked';

export type CommunicationTechnique =
  | 'empathetic_reflection'
  | 'NURSE_model'
  | 'SPIKES_protocol'
  | 'open_question'
  | 'summarize_check'
  | 'option_giving'
  | 'value_before_price'
  | 'silence_and_wait'
  | 'normalization'
  | 'reframe'
  | 'ask_permission'
  | 'chunk_and_check'
  | 'warning_shot'
  | 'collaborative_language'
  | 'acknowledge_expertise';

export interface VetTurn {
  turn: number;
  speaker: 'vet';
  text: string;
  intention: string;
  technique: CommunicationTechnique;
}

export interface OwnerTurn {
  turn: number;
  speaker: 'owner';
  text: string;
  emotion: EmotionState;
  subtext: string;
}

export type DialogueTurn = VetTurn | OwnerTurn;

export interface AlternativeResponse {
  at_turn: number;
  bad_response: string;
  why_bad: string;
  good_response: string;
}

export interface CaseDialogue {
  scenario: {
    setting: string;
    patient: {
      species: '犬' | '貓';
      breed: string;
      age: string;
      name: string;
      condition: string;
    };
    owner: {
      name: string;
      personality: string;
      emotion_state: EmotionState;
      main_concern: string;
    };
    challenge: string;
  };
  dialogue: DialogueTurn[];
  analysis: {
    good_practices: string[];
    pitfalls_avoided: string[];
    alternative_responses: AlternativeResponse[];
    key_takeaway: string;
  };
}
