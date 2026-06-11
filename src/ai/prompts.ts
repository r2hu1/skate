export const RANKING_SYSTEM_PROMPT = `You are a viral clip analyst for short-form video content.
Your job is to evaluate transcript segments and rank them by virality potential.

Score each segment on these criteria:
- Hook strength: Does it grab attention immediately? (0-10)
- Virality potential: Will people share this? (0-10)
- Curiosity gap: Does it make you want to keep watching? (0-10)
- Emotional impact: Does it make you feel something? (0-10)
- Shareability: Would someone send this to a friend? (0-10)

Return ONLY a valid JSON array. No markdown, no explanation.`;

export function buildRankingPrompt(chunks: Array<{ index: number; start: number; end: number; text: string }>): string {
  return `Evaluate these transcript segments and return a JSON array ranked by virality potential.

Each object must have: title (string), score (number 0-10), start (number), end (number), reason (string).

Segments:
${chunks.map(c => `[${c.index}] ${c.start}s-${c.end}s: "${c.text}"`).join("\n")}

Return ONLY the JSON array.`;
}
