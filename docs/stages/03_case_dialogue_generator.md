---
prompt_id: "03-case-dialogue-generator"
version: "2.0"
estimated_tokens: ~2,500
output_format: JSON
dependencies: []
tech_stack: [Claude API, TypeScript, Zod]
---

# Prompt #3：案例對話生成器

## 使用方式
輸入教學主題，生成寫實的臨床對話情境模擬。
可獨立使用，也可以用來豐富步驟 2 中 case segment 的內容。
輸出為經過 Zod 驗證的 JSON 格式對話情境。

---

## System Prompt

```
你是一位資深獸醫師，專門為教育訓練設計寫實的臨床溝通案例。

### 設計原則
1. 對話必須極度寫實，像真實診間會發生的對話
2. 飼主的反應要多元且真實（不是每個飼主都理性配合）
3. 必須包含至少一個「困難時刻」（飼主生氣/哭泣/質疑）
4. 獸醫師的每句話都要標註溝通意圖和使用的技巧
5. 對話至少 8~12 輪
6. 嚴格以 JSON 格式輸出，不要加任何說明文字
```

## User Prompt Builder

```
請為以下教學主題生成一個寫實的臨床對話情境模擬。

教學主題：{topic}

請以 JSON 格式輸出，結構如下：
{
  "scenario": {
    "setting": "場景描述",
    "patient": {
      "species": "犬/貓",
      "breed": "品種",
      "age": "年齡",
      "name": "名字",
      "condition": "疾病/症狀描述"
    },
    "owner": {
      "name": "飼主名字",
      "personality": "個性特徵",
      "emotion_state": "目前情緒狀態",
      "main_concern": "最擔心的事"
    },
    "challenge": "這個情境的溝通難點"
  },
  "dialogue": [
    {
      "turn": 1,
      "speaker": "vet",
      "text": "獸醫師說的話",
      "intention": "這句話的溝通目的",
      "technique": "使用的溝通技巧名稱"
    },
    {
      "turn": 2,
      "speaker": "owner",
      "text": "飼主的回應",
      "emotion": "此時的情緒",
      "subtext": "飼主真正想表達的（潛台詞）"
    }
  ],
  "analysis": {
    "good_practices": ["這段對話中好的做法"],
    "pitfalls_avoided": ["避免了哪些常見錯誤"],
    "alternative_responses": [
      {
        "at_turn": 5,
        "bad_response": "不好的回應方式",
        "why_bad": "為什麼不好",
        "good_response": "建議的回應方式（就是目前的版本）"
      }
    ],
    "key_takeaway": "核心學習點"
  }
}

請只輸出 JSON，不要加說明文字。
```

---

## TypeScript 類型定義

```typescript
// types/dialogue.ts

export type EmotionState =
  | 'calm'         // 平靜
  | 'anxious'      // 焦慮
  | 'angry'        // 生氣
  | 'crying'       // 哭泣
  | 'frustrated'   // 挫折
  | 'confused'     // 困惑
  | 'grateful'     // 感謝
  | 'defensive'    // 防衛
  | 'resigned'     // 無奈
  | 'relieved'     // 鬆了口氣
  | 'suspicious'   // 懷疑
  | 'shocked';     // 震驚

export type CommunicationTechnique =
  | 'empathetic_reflection'  // 同理心回應——複述飼主的情緒和擔心
  | 'NURSE_model'            // Name/Understand/Respect/Support/Explore
  | 'SPIKES_protocol'        // 壞消息傳達六步驟
  | 'open_question'          // 開放式提問
  | 'summarize_check'        // 摘要確認——確保雙方理解一致
  | 'option_giving'          // 選項式溝通——提供 2-3 個選項
  | 'value_before_price'     // 先說價值再說價格
  | 'silence_and_wait'       // 留白等待——給飼主消化的時間
  | 'normalization'          // 正常化——「很多飼主都有同樣的擔心」
  | 'reframe'                // 重新框架——用不同角度詮釋
  | 'ask_permission'         // 請求許可——「我可以跟您解釋一下嗎？」
  | 'chunk_and_check'        // 分段說明——每說完一段確認理解
  | 'warning_shot'           // 預告鋪陳——「我需要跟您談一些比較嚴重的事」
  | 'collaborative_language' // 合作式語言——「我們一起」
  | 'acknowledge_expertise'; // 承認飼主的專業——「您觀察得很仔細」

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
```

## Zod Schema 驗證

```typescript
// schemas/dialogue.ts
import { z } from 'zod';

const EmotionStateEnum = z.enum([
  'calm', 'anxious', 'angry', 'crying', 'frustrated', 'confused',
  'grateful', 'defensive', 'resigned', 'relieved', 'suspicious', 'shocked',
]);

const TechniqueEnum = z.enum([
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
    const hasAnger = data.dialogue.some(
      (t) => t.speaker === 'owner' && ['angry', 'crying', 'frustrated', 'defensive'].includes(t.emotion)
    );
    return hasAnger;
  },
  { message: '對話中必須包含至少一個困難時刻（飼主生氣/哭泣/挫折/防衛）' }
).refine(
  (data) => {
    const turns = data.dialogue.map(t => t.turn);
    return turns.every((t, i) => t === i + 1);
  },
  { message: 'turn 編號必須從 1 開始連續遞增' }
);

export type CaseDialogue = z.infer<typeof CaseDialogueSchema>;
```

## Prompt Builder 函數

```typescript
// lib/build-dialogue-prompt.ts

const SYSTEM_PROMPT = `你是一位資深獸醫師，專門為教育訓練設計寫實的臨床溝通案例。

### 設計原則
1. 對話必須極度寫實，像真實診間會發生的對話
2. 飼主的反應要多元且真實（不是每個飼主都理性配合）
3. 必須包含至少一個「困難時刻」（飼主生氣/哭泣/質疑）
4. 獸醫師的每句話都要標註溝通意圖和使用的技巧
5. 對話至少 8~12 輪
6. 嚴格以 JSON 格式輸出，不要加任何說明文字

### 可用的溝通技巧標籤
empathetic_reflection, NURSE_model, SPIKES_protocol, open_question,
summarize_check, option_giving, value_before_price, silence_and_wait,
normalization, reframe, ask_permission, chunk_and_check,
warning_shot, collaborative_language, acknowledge_expertise

### 可用的情緒狀態標籤
calm, anxious, angry, crying, frustrated, confused, grateful,
defensive, resigned, relieved, suspicious, shocked`;

export function buildDialoguePrompt(topic: string): { system: string; user: string } {
  return {
    system: SYSTEM_PROMPT,
    user: `請為以下教學主題生成一個寫實的臨床對話情境模擬。

教學主題：${topic}

JSON 輸出結構：scenario（setting, patient, owner, challenge）, dialogue（8-12 turns, vet/owner 交替）, analysis（good_practices, pitfalls_avoided, alternative_responses, key_takeaway）

vet turn 需有 intention + technique 標籤。owner turn 需有 emotion + subtext。

請只輸出 JSON。`,
  };
}
```

## 完整 JSON 輸出範例

```json
{
  "scenario": {
    "setting": "週五下午，手術室外的會談室。獸醫師剛完成一隻10歲黃金獵犬的脾臟腫塊切除手術，術中發現腫塊已經破裂出血，且肝臟表面有疑似轉移結節。",
    "patient": {
      "species": "犬",
      "breed": "黃金獵犬",
      "age": "10歲",
      "name": "大福",
      "condition": "脾臟腫塊（術中發現已破裂，肝臟疑似轉移），術後穩定但預後不佳"
    },
    "owner": {
      "name": "林先生",
      "personality": "理性但感性，與狗狗感情深厚，經常上網查資料",
      "emotion_state": "anxious",
      "main_concern": "大福是否能康復，手術是否成功"
    },
    "challenge": "術中發現比預期更嚴重的病況，需要在飼主期待手術成功的情緒下，傳達可能是惡性腫瘤且已轉移的壞消息"
  },
  "dialogue": [
    {
      "turn": 1,
      "speaker": "vet",
      "text": "林先生，手術結束了，大福目前在恢復室休息，生命徵象都很穩定。我想先跟您聊聊手術的情況，方便嗎？",
      "intention": "先報平安讓飼主放下最大的擔心，再請求許可深入談",
      "technique": "ask_permission"
    },
    {
      "turn": 2,
      "speaker": "owner",
      "text": "好的好的，手術順利嗎？大福還好嗎？牠有沒有不舒服？",
      "emotion": "anxious",
      "subtext": "急切想聽到好消息，害怕聽到壞的"
    },
    {
      "turn": 3,
      "speaker": "vet",
      "text": "大福在手術過程中表現很穩定，目前已經醒過來了。不過，林先生，我需要跟您談一些我們在手術中發現的狀況。",
      "intention": "肯定正面的部分，但用 warning shot 預告有嚴重資訊要分享",
      "technique": "warning_shot"
    },
    {
      "turn": 4,
      "speaker": "owner",
      "text": "什麼狀況？是不是腫瘤是壞的？我之前有上網查過，黃金獵犬很容易得脾臟血管肉瘤...",
      "emotion": "anxious",
      "subtext": "其實已經有心理準備但不願面對"
    },
    {
      "turn": 5,
      "speaker": "vet",
      "text": "您做了很多功課，觀察力也很好。確實，我們在切除脾臟的時候發現腫塊已經有破裂出血的跡象，這一點比我們術前預期的嚴重。另外，我也注意到肝臟表面有一些小結節，這個需要等病理報告回來才能確定是什麼。",
      "intention": "先肯定飼主的努力，再分段告知壞消息，不一次全部倒出來",
      "technique": "chunk_and_check"
    },
    {
      "turn": 6,
      "speaker": "owner",
      "text": "肝臟也有？那...那是不是已經轉移了？大福還能活多久？",
      "emotion": "shocked",
      "subtext": "最害怕的事情發生了，急需一個明確的答案來準備自己"
    },
    {
      "turn": 7,
      "speaker": "vet",
      "text": "我理解這個消息很讓人擔心。目前我們還不能確定那些結節就是轉移，有可能是良性的變化。病理報告大概需要五到七個工作天，到時候我們才能給您一個比較準確的判斷。",
      "intention": "同理情緒，誠實但不過度悲觀，保留不確定性",
      "technique": "empathetic_reflection"
    },
    {
      "turn": 8,
      "speaker": "owner",
      "text": "可是網路上說如果是血管肉瘤轉移的話，就算化療也只能多活幾個月而已...我不想讓大福受苦...",
      "emotion": "crying",
      "subtext": "內心在掙扎——想救大福但又怕治療過程讓牠痛苦"
    },
    {
      "turn": 9,
      "speaker": "vet",
      "text": "...",
      "intention": "給飼主哭泣和整理情緒的時間，不急著用言語填滿空白",
      "technique": "silence_and_wait"
    },
    {
      "turn": 10,
      "speaker": "owner",
      "text": "對不起...我只是...大福跟了我十年了...",
      "emotion": "crying",
      "subtext": "需要被理解和接納這份悲傷"
    },
    {
      "turn": 11,
      "speaker": "vet",
      "text": "林先生，不需要道歉，大福對您來說就是家人，面對這種情況擔心是很正常的。很多飼主在這個階段都會有類似的感受。我們現在不需要馬上做任何決定，等病理報告回來之後，我會把所有的選項整理好，我們再一起討論最適合大福的方案。",
      "intention": "正常化情緒反應、減輕決策壓力、用合作式語言建立信任",
      "technique": "normalization"
    },
    {
      "turn": 12,
      "speaker": "owner",
      "text": "好...謝謝醫師。那大福今天可以回家嗎？",
      "emotion": "resigned",
      "subtext": "雖然很難過，但感受到醫師的支持，願意配合等待"
    }
  ],
  "analysis": {
    "good_practices": [
      "術後第一句先報平安（生命徵象穩定），讓飼主卸下最大壓力",
      "使用 warning shot 預告壞消息，給飼主心理緩衝時間",
      "分段告知（脾臟→肝臟），不一次倒完所有壞消息",
      "飼主哭泣時選擇沉默等待，而非急著安慰或轉移話題",
      "不做超出現有證據的預後判斷，等病理報告再討論"
    ],
    "pitfalls_avoided": [
      "沒有在第一句就說壞消息（避免飼主在最焦慮時接收最壞的資訊）",
      "沒有反駁飼主的網路資訊（避免讓飼主覺得自己做功課被否定）",
      "沒有在飼主情緒崩潰時強迫做決定（避免事後後悔和糾紛）"
    ],
    "alternative_responses": [
      {
        "at_turn": 5,
        "bad_response": "網路上的資訊不一定正確，您不要亂看。我跟您說，我們在手術中發現很多問題...",
        "why_bad": "否定飼主的努力和擔心，會讓飼主感到被輕視，關閉後續溝通的可能",
        "good_response": "您做了很多功課，觀察力也很好。確實，我們在切除脾臟的時候發現...（分段告知）"
      },
      {
        "at_turn": 9,
        "bad_response": "林先生不要哭，我們現在還不知道是不是惡性的，而且就算是的話也有很多治療方法可以試...",
        "why_bad": "急著安慰和提供解決方案，沒有給飼主消化情緒的空間，也可能給出過於樂觀的暗示",
        "good_response": "（沉默等待）"
      }
    ],
    "key_takeaway": "壞消息傳達的關鍵是「分段、同理、留白」——分段告知避免資訊過載，同理情緒建立信任，留白等待讓飼主有消化的空間。不要急著安慰或提供解決方案，有時候沉默本身就是最好的支持。"
  }
}
```

---

## 常用主題範例

可替換 `{topic}` 的內容：
- 「初診接待——飼主帶著從其他醫院轉來的重症貓」
- 「檢查費用說明——飼主覺得太貴想要只做部分檢查」
- 「住院回報——病情惡化需要加做檢查但費用已經很高」
- 「手術前風險告知——高齡犬需要緊急手術」
- 「手術後通報——發現額外問題需要延長手術」
- 「出院衛教——飼主似乎沒在認真聽」
- 「安樂死討論——飼主無法接受建議」
- 「飼主要求賠償——動物術後出現併發症」

---

## 測試要求

```typescript
// tests/dialogue.test.ts
import { describe, it, expect } from 'vitest';
import { CaseDialogueSchema } from '../schemas/dialogue';

describe('CaseDialogueSchema', () => {
  it('requires at least one difficult moment', () => {
    // 所有 owner turns 都是 calm → 應失敗
  });

  it('validates turn numbers are sequential', () => {
    // turn 跳號 → 應失敗
  });

  it('requires at least 8 dialogue turns', () => {
    // 只有 5 個 turns → 應失敗
  });

  it('validates alternative_responses reference existing turns', () => {
    // at_turn 超出範圍 → 應報錯
  });

  it('ensures vet turns have technique and owner turns have emotion', () => {
    // discriminatedUnion 自動處理
  });
});
```

---

## 6 階段執行計畫

### Phase 1: Schema 定義
- [ ] 建立 `types/dialogue.ts`（含 EmotionState, CommunicationTechnique 枚舉）
- [ ] 建立 `schemas/dialogue.ts`（含 discriminatedUnion 驗證）

### Phase 2: Prompt Builder
- [ ] 建立 `lib/build-dialogue-prompt.ts`
- [ ] system prompt 嵌入標準化的技巧和情緒標籤列表

### Phase 3: API 呼叫
- [ ] 建立 `lib/generate-dialogue.ts`
- [ ] 含 retry + Zod 驗證 + cost tracking

### Phase 4: CLI 入口
- [ ] 支援 `--topic` 參數
- [ ] 支援 `--dry-run`
- [ ] 輸出到 `output/dialogues/`

### Phase 5: 測試
- [ ] 困難時刻驗證測試
- [ ] Turn 序號驗證
- [ ] 覆蓋率 >= 70%

### Phase 6: 驗證
- [ ] 生成 2-3 個不同主題的對話
- [ ] 人工審核對話寫實度
- [ ] 確認溝通技巧標註準確

---

## 品質檢查清單

- [ ] 對話 8-12 輪
- [ ] 至少 1 個困難時刻（angry/crying/frustrated/defensive）
- [ ] vet 每句都有 intention + technique
- [ ] owner 每句都有 emotion + subtext
- [ ] analysis 有 ≥2 good_practices, ≥1 alternative_response
- [ ] 溝通技巧標籤來自標準化列表
- [ ] 情緒標籤來自標準化列表
