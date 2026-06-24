import type { ScoredChunk, RankingResult } from "../types";
import { rankWithAI } from "../ai/ranking";
import { tui } from "../ui/tui";

export async function rankChunks(
  scoredChunks: ScoredChunk[],
  topN: number,
  ollamaUrl: string,
  model: string,
): Promise<RankingResult[]> {
  const sorted = [...scoredChunks].sort((a, b) => b.heuristic.total - a.heuristic.total);
  const candidates = sorted.slice(0, Math.min(topN * 2 + 3, sorted.length));

  tui.log(`Sending ${candidates.length} top chunks to AI...`);

  try {
    const results = await rankWithAI(candidates, ollamaUrl, model);
    return results;
  } catch (err) {
    tui.log(`AI ranking failed: ${err instanceof Error ? err.message : String(err)}`);
    tui.log(`Falling back to heuristic scores`);

    return candidates.map((c, i) => ({
      title: c.chunk.text.slice(0, 80) + (c.chunk.text.length > 80 ? "..." : ""),
      score: Math.round((c.heuristic.total / 100) * 10),
      start: c.chunk.start,
      end: c.chunk.end,
      reason: `Heuristic score: ${c.heuristic.total}/100`,
    }));
  }
}

export function selectClips(
  ranked: RankingResult[],
  scoredChunks: ScoredChunk[],
  maxClips: number,
  minLength: number,
  maxLength: number,
): ScoredChunk[] {
  const sorted = [...ranked].sort((a, b) => b.score - a.score);

  const selected: ScoredChunk[] = [];
  const usedRanges: Array<{ start: number; end: number }> = [];

  for (const rank of sorted) {
    if (selected.length >= maxClips) break;

    const duration = rank.end - rank.start;
    if (duration < minLength || duration > maxLength) continue;

    if (overlapsAny(rank.start, rank.end, usedRanges)) continue;

    let chunk: ScoredChunk | undefined;

    if (rank.index !== undefined && rank.index >= 0) {
      chunk = scoredChunks.find(c => c.index === rank.index);
    }

    if (!chunk) {
      chunk = scoredChunks.find(
        c => Math.abs(c.chunk.start - rank.start) < 2 && Math.abs(c.chunk.end - rank.end) < 2
      );
    }

    if (!chunk) {
      chunk = scoredChunks.find(
        c => Math.abs(c.chunk.start - rank.start) < 5
      );
    }

    if (chunk) {
      chunk.aiScore = rank.score;
      chunk.combinedScore = Math.round((chunk.heuristic.total + rank.score * 10) / 2);
      selected.push(chunk);
      usedRanges.push({ start: rank.start, end: rank.end });
    }
  }

  return selected;
}

function overlapsAny(start: number, end: number, ranges: Array<{ start: number; end: number }>): boolean {
  return ranges.some(r => start < r.end && end > r.start);
}
