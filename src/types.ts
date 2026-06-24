export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  words: WordTimestamp[];
}

export interface Transcript {
  segments: TranscriptSegment[];
  language: string;
  duration: number;
}

export interface TranscriptChunk {
  start: number;
  end: number;
  text: string;
  words: WordTimestamp[];
}

export interface HeuristicScores {
  speakingRate: number;
  emotionalLanguage: number;
  sentimentShift: number;
  storyStructure: number;
  engagementHooks: number;
  total: number;
}

export interface ScoredChunk {
  index: number;
  chunk: TranscriptChunk;
  heuristic: HeuristicScores;
  aiScore?: number;
  combinedScore?: number;
}

export interface RankingResult {
  index?: number;
  title: string;
  score: number;
  start: number;
  end: number;
  reason: string;
}

export interface FaceTrackPoint {
  timestamp: number;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
}

export interface CropFrame {
  timestamp: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ClipMetadata {
  title: string;
  hook: string;
  hashtags: string[];
  score: number;
  duration: number;
  start: number;
  end: number;
  sourceFile: string;
  clipFile: string;
  subtitleFile: string;
  thumbnailFile?: string;
}

export interface AnalysisResult {
  sourceFile: string;
  duration: number;
  transcript: Transcript;
  chunks: ScoredChunk[];
  ranked: RankingResult[];
  selected: ScoredChunk[];
  metadata: ClipMetadata[];
}

export type SubtitleStyle = "minimal" | "tiktok" | "mrbeast" | "podcast";

export interface SkateConfig {
  model: string;
  clips: number;
  minLength: number;
  maxLength: number;
  subtitleStyle: SubtitleStyle;
  outputDir: string;
  cacheDir: string;
  ollamaUrl: string;
  crop: boolean;
}

export type DependencyStatus = "ok" | "missing" | "error";

export interface DependencyCheck {
  name: string;
  status: DependencyStatus;
  version?: string;
  path?: string;
  error?: string;
}

export interface PipelineOptions {
  source: string;
  isUrl: boolean;
  config: SkateConfig;
  outputDir: string;
  skipDownload?: boolean;
  skipRender?: boolean;
  crop?: boolean;
}
