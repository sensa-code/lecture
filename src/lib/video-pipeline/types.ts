// Re-export video pipeline types from SSOT
export type {
  SegmentInput,
  LessonInput,
  TTSResult,
  HeyGenResult,
  SlideRenderResult,
  PipelineResult,
} from '../../types/video.js';

/** Internal TTS result used within the pipeline before writing to disk */
export interface TTSWorkResult {
  audioBuffer: Buffer;
  audioDuration: number;
  srtContent: string;
  cost: number;
}

/** Internal HeyGen result used within the pipeline before writing to disk */
export interface HeyGenWorkResult {
  videoBuffer: Buffer;
  videoDuration: number;
  cost: number;
}

export interface CostEstimate {
  heygenSegments: number;
  heygenCost: number;
  elevenLabsCharacters: number;
  elevenLabsCost: number;
  totalEstimatedCost: number;
}
