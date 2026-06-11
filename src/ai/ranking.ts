import type { ScoredChunk, RankingResult } from "../types";
import { queryOllama } from "./ollama";
import { RANKING_SYSTEM_PROMPT, buildRankingPrompt } from "./prompts";

export async function rankWithAI(
  chunks: ScoredChunk[],
  ollamaUrl: string,
  model: string,
): Promise<RankingResult[]> {
  const promptChunks = chunks.map(c => ({
    index: c.index,
    start: c.chunk.start,
    end: c.chunk.end,
    text: c.chunk.text,
  }));

  const prompt = buildRankingPrompt(promptChunks);
  const response = await queryOllama(prompt, ollamaUrl, model, RANKING_SYSTEM_PROMPT);

  const results = parseRankingResponse(response, chunks);
  if (results.length === 0) {
    console.warn("  AI returned empty results, falling back to heuristic");
    return chunks.map((c, i) => ({
      title: c.chunk.text.slice(0, 80) + (c.chunk.text.length > 80 ? "..." : ""),
      score: Math.round((c.heuristic.total / 100) * 10),
      start: c.chunk.start,
      end: c.chunk.end,
      reason: `Heuristic score: ${c.heuristic.total}/100`,
    }));
  }
  return results;
}

function parseRankingResponse(response: string, originalChunks: ScoredChunk[]): RankingResult[] {
  const cleaned = response
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as RankingResult[];
    return parsed.map(r => ({
      ...r,
      start: r.start ?? 0,
      end: r.end ?? 0,
      score: Math.max(0, Math.min(10, r.score)),
    }));
  } catch {
    return fallbackParse(response, originalChunks);
  }
}

function fallbackParse(response: string, originalChunks: ScoredChunk[]): RankingResult[] {
  const results: RankingResult[] = [];
  const lines = response.split("\n");

  for (const line of lines) {
    const scoreMatch = line.match(/score[:\s]+(\d+(?:\.\d+)?)/i);
    const titleMatch = line.match(/title[:\s]+"([^"]+)"/i) || line.match(/\d+\.\s+([^(]+)/);
    const startMatch = line.match(/start[:\s]+(\d+(?:\.\d+)?)/i);
    const endMatch = line.match(/end[:\s]+(\d+(?:\.\d+)?)/i);

    if (scoreMatch) {
      results.push({
        title: titleMatch?.[1]?.trim() || `Clip ${results.length + 1}`,
        score: parseFloat(scoreMatch[1]),
        start: startMatch ? parseFloat(startMatch[1]) : 0,
        end: endMatch ? parseFloat(endMatch[1]) : 0,
        reason: "",
      });
    }
  }

  if (results.length > 0) return results;

  return originalChunks.map((c, i) => ({
    title: c.chunk.text.slice(0, 80),
    score: c.heuristic.total / 10,
    start: c.chunk.start,
    end: c.chunk.end,
    reason: `Heuristic fallback: ${c.heuristic.total}/100`,
  }));
}
