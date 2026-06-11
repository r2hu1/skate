import type { Transcript, TranscriptChunk, WordTimestamp } from "../types";

const MIN_CHUNK_DURATION = 20;
const MAX_CHUNK_DURATION = 90;
const IDEAL_CHUNK_DURATION = 45;

const SENTENCE_ENDERS = /[.!?]+/g;

const ENGAGEMENT_MARKERS = [
  "but", "however", "actually", "basically", "here's the thing",
  "the truth is", "the problem is", "the reason", "what most people",
  "here's why", "did you know", "what happened", "suddenly",
  "the moment", "this is", "that's why", "here's what",
];

export function chunkTranscript(transcript: Transcript): TranscriptChunk[] {
  const words = transcript.segments.flatMap(s => s.words);

  if (words.length === 0) {
    return chunkBySegments(transcript.segments);
  }

  const sentenceBoundaries = findSentenceBoundaries(words);
  const topicBoundaries = findTopicBoundaries(words);
  const pauseBoundaries = findPauseBoundaries(words);

  const boundaries = mergeBoundaries(sentenceBoundaries, topicBoundaries, pauseBoundaries);
  return buildChunks(words, boundaries);
}

function chunkBySegments(segments: Transcript["segments"]): TranscriptChunk[] {
  const chunks: TranscriptChunk[] = [];
  let current: TranscriptChunk = { start: 0, end: 0, text: "", words: [] };

  for (const seg of segments) {
    const duration = (current.end - current.start) + (seg.end - seg.start);
    if (duration > MAX_CHUNK_DURATION && current.text) {
      chunks.push(current);
      current = { start: seg.start, end: seg.end, text: seg.text, words: [] };
    } else {
      if (!current.text) current.start = seg.start;
      current.end = seg.end;
      current.text += (current.text ? " " : "") + seg.text;
    }
  }

  if (current.text) chunks.push(current);
  return chunks;
}

function findSentenceBoundaries(words: WordTimestamp[]): Set<number> {
  const boundaries = new Set<number>();

  for (let i = 0; i < words.length; i++) {
    const word = words[i].word.replace(/[^a-zA-Z0-9']/g, "");
    if (SENTENCE_ENDERS.test(word)) {
      boundaries.add(i);
    }
  }

  return boundaries;
}

function findTopicBoundaries(words: WordTimestamp[]): Set<number> {
  const boundaries = new Set<number>();

  for (let i = 0; i < words.length; i++) {
    const lower = words[i].word.toLowerCase().replace(/[^a-zA-Z']/g, "");
    if (ENGAGEMENT_MARKERS.includes(lower)) {
      if (i > 0) boundaries.add(i - 1);
    }
  }

  return boundaries;
}

function findPauseBoundaries(words: WordTimestamp[]): Set<number> {
  const boundaries = new Set<number>();
  const PAUSE_THRESHOLD = 1.5;

  for (let i = 1; i < words.length; i++) {
    const gap = words[i].start - words[i - 1].end;
    if (gap >= PAUSE_THRESHOLD) {
      boundaries.add(i - 1);
    }
  }

  return boundaries;
}

function mergeBoundaries(...boundarySets: Set<number>[]): Set<number> {
  const merged = new Set<number>();
  for (const set of boundarySets) {
    for (const b of set) {
      merged.add(b);
    }
  }
  return merged;
}

function buildChunks(words: WordTimestamp[], boundaries: Set<number>): TranscriptChunk[] {
  const chunks: TranscriptChunk[] = [];
  let chunkStart = 0;

  for (let i = 0; i < words.length; i++) {
    if (!boundaries.has(i)) continue;

    const duration = words[i].end - words[chunkStart].start;
    if (duration < MIN_CHUNK_DURATION) continue;
    if (duration > MAX_CHUNK_DURATION) {
      const mid = findMidpoint(words, chunkStart, i, IDEAL_CHUNK_DURATION);
      if (mid > chunkStart) {
        chunks.push(makeChunk(words, chunkStart, mid));
        chunkStart = mid + 1;
      }
      continue;
    }

    chunks.push(makeChunk(words, chunkStart, i));
    chunkStart = i + 1;
  }

  if (chunkStart < words.length - 1) {
    const remaining = words.slice(chunkStart);
    const duration = remaining[remaining.length - 1].end - remaining[0].start;
    if (duration >= MIN_CHUNK_DURATION) {
      chunks.push(makeChunk(words, chunkStart, words.length - 1));
    } else if (chunks.length > 0) {
      const last = chunks[chunks.length - 1];
      last.end = words[words.length - 1].end;
      last.text += " " + remaining.map(w => w.word).join(" ");
      last.words.push(...remaining);
    }
  }

  return chunks;
}

function findMidpoint(words: WordTimestamp[], start: number, end: number, targetDuration: number): number {
  const targetTime = words[start].start + targetDuration;

  for (let i = start; i <= end; i++) {
    if (words[i].start >= targetTime) {
      return i;
    }
  }

  return Math.floor((start + end) / 2);
}

function makeChunk(words: WordTimestamp[], start: number, end: number): TranscriptChunk {
  const slice = words.slice(start, end + 1);
  return {
    start: slice[0].start,
    end: slice[slice.length - 1].end,
    text: slice.map(w => w.word).join(" "),
    words: slice,
  };
}
