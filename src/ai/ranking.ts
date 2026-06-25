import type { ScoredChunk, RankingResult } from "../types";
import { queryOllama } from "./ollama";
import { RANKING_SYSTEM_PROMPT, buildRankingPrompt } from "./prompts";

export async function rankWithAI(
  chunks: ScoredChunk[],
  ollamaUrl: string,
  model: string,
): Promise<RankingResult[]> {
  const promptChunks = chunks.map((c) => ({
    index: c.index,
    start: c.chunk.start,
    end: c.chunk.end,
    text: c.chunk.text,
  }));

  const prompt = buildRankingPrompt(promptChunks);
  const response = await queryOllama(
    prompt,
    ollamaUrl,
    model,
    RANKING_SYSTEM_PROMPT,
  );

  const results = parseRankingResponse(response, chunks);
  return results;
}

function parseRankingResponse(
  response: string,
  originalChunks: ScoredChunk[],
): RankingResult[] {
  const cleaned = response
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as RankingResult[];
    return parsed.map((r) => ({
      ...r,
      index: r.index ?? -1,
      start: r.start ?? 0,
      end: r.end ?? 0,
      score: Math.max(0, Math.min(10, r.score)),
    }));
  } catch {
    return fallbackParse(response, originalChunks);
  }
}

function fallbackParse(
  response: string,
  originalChunks: ScoredChunk[],
): RankingResult[] {
  const results: RankingResult[] = [];
  const lines = response.split("\n");

  for (const line of lines) {
    const scoreMatch = line.match(/score[:\s]+(\d+(?:\.\d+)?)/i);
    const titleMatch =
      line.match(/title[:\s]+"([^"]+)"/i) || line.match(/\d+\.\s+([^(]+)/);
    const startMatch = line.match(/start[:\s]+(\d+(?:\.\d+)?)/i);
    const endMatch = line.match(/end[:\s]+(\d+(?:\.\d+)?)/i);
    const indexMatch = line.match(/index[:\s]+(\d+)/i);

    if (scoreMatch) {
      results.push({
        title: titleMatch?.[1]?.trim() || `Clip ${results.length + 1}`,
        score: parseFloat(scoreMatch[1]),
        index: indexMatch ? parseInt(indexMatch[1], 10) : -1,
        start: startMatch ? parseFloat(startMatch[1]) : 0,
        end: endMatch ? parseFloat(endMatch[1]) : 0,
        reason: "",
      });
    }
  }

  if (results.length > 0) return results;

  return originalChunks.map((c, i) => ({
    title: c.chunk.text.slice(0, 80),
    score: 0,
    start: c.chunk.start,
    end: c.chunk.end,
    reason: "",
  }));
}
