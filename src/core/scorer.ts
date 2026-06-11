import type { TranscriptChunk, HeuristicScores } from "../types";

const EMOTIONAL_WORDS = new Set([
  "secret", "mistake", "never", "always", "million", "billion", "worst",
  "best", "amazing", "terrible", "incredible", "shocking", "unbelievable",
  "genius", "stupid", "dangerous", "brilliant", "horrible", "fantastic",
  "disaster", "miracle", "nightmare", "legend", "epic", "huge",
  "massive", "tiny", "massive", "destroy", "save", "kill", "love",
  "hate", "fear", "angry", "excited", "devastating", "extraordinary",
  "insane", "ridiculous", "hilarious", "tragic", "epic", "critical",
]);

const ENGAGEMENT_PHRASES = [
  "did you know", "here's why", "what happened next", "the reason why",
  "here's the thing", "the truth is", "you won't believe", "this is why",
  "that's why", "here's how", "the problem is", "the best part",
  "wait until", "the moment", "check this out", "think about",
  "the secret to", "you need to know", "this changes everything",
  "here's the deal", "most people don't know", "what they don't tell you",
  "the real reason", "this is what happens", "you'll never guess",
];

const STORY_MARKERS = [
  { pattern: /problem|issue|challenge|struggle|difficult/, type: "problem" },
  { pattern: /but|however|although|despite|yet/, type: "conflict" },
  { pattern: /so|therefore|that's why|which means|turns out/, type: "lesson" },
  { pattern: /suddenly|unexpectedly|out of nowhere|then/, type: "surprise" },
];

export function scoreChunk(chunk: TranscriptChunk): HeuristicScores {
  const text = chunk.text;
  const duration = chunk.end - chunk.start;
  const wordCount = chunk.words.length;
  const words = text.toLowerCase().split(/\s+/);

  const speakingRate = scoreSpeakingRate(wordCount, duration);
  const emotionalLanguage = scoreEmotionalLanguage(words);
  const sentimentShift = scoreSentimentShift(chunk.words.map(w => w.word));
  const storyStructure = scoreStoryStructure(text);
  const engagementHooks = scoreEngagementHooks(text);

  const total = (
    speakingRate * 0.15 +
    emotionalLanguage * 0.20 +
    sentimentShift * 0.15 +
    storyStructure * 0.25 +
    engagementHooks * 0.25
  );

  return {
    speakingRate: Math.round(speakingRate),
    emotionalLanguage: Math.round(emotionalLanguage),
    sentimentShift: Math.round(sentimentShift),
    storyStructure: Math.round(storyStructure),
    engagementHooks: Math.round(engagementHooks),
    total: Math.round(total),
  };
}

function scoreSpeakingRate(wordCount: number, durationSec: number): number {
  if (durationSec <= 0) return 0;
  const wpm = (wordCount / durationSec) * 60;

  if (wpm < 100) return 20;
  if (wpm < 140) return 40;
  if (wpm < 180) return 70;
  if (wpm < 220) return 90;
  return 80;
}

function scoreEmotionalLanguage(words: string[]): number {
  const matches = words.filter(w => EMOTIONAL_WORDS.has(w)).length;
  if (words.length === 0) return 0;

  const ratio = matches / words.length;

  if (ratio < 0.01) return 10;
  if (ratio < 0.03) return 40;
  if (ratio < 0.06) return 70;
  if (ratio < 0.10) return 90;
  return 80;
}

function scoreSentimentShift(words: string[]): number {
  const positive = new Set(["amazing", "great", "love", "best", "fantastic", "incredible", "perfect", "wonderful", "brilliant", "excellent"]);
  const negative = new Set(["terrible", "worst", "hate", "awful", "horrible", "disaster", "terrible", "dreadful", "atrocious", "fear"]);

  let posCount = 0;
  let negCount = 0;

  for (const word of words) {
    const clean = word.toLowerCase().replace(/[^a-z]/g, "");
    if (positive.has(clean)) posCount++;
    if (negative.has(clean)) negCount++;
  }

  if (posCount > 0 && negCount > 0) {
    const ratio = Math.min(posCount, negCount) / Math.max(posCount, negCount);
    return Math.round(ratio * 100);
  }

  const total = posCount + negCount;
  if (total === 0) return 20;
  return 30;
}

function scoreStoryStructure(text: string): number {
  const lower = text.toLowerCase();
  let score = 10;

  for (const marker of STORY_MARKERS) {
    if (marker.pattern.test(lower)) {
      score += 20;
    }
  }

  return Math.min(score, 100);
}

function scoreEngagementHooks(text: string): number {
  const lower = text.toLowerCase();
  let score = 10;

  for (const phrase of ENGAGEMENT_PHRASES) {
    if (lower.includes(phrase)) {
      score += 20;
    }
  }

  return Math.min(score, 100);
}
