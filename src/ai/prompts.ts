export const RANKING_SYSTEM_PROMPT = `You are a viral short-form clip analyst. Your job is to evaluate transcript segments and rank them by how well they work as standalone 20-90 second vertical videos.

Evaluate each segment holistically. The top clips must:
1. OPEN WITH A STRONG HOOK — The first 5 seconds must grab attention. Great hooks use questions, bold claims, surprising facts, pattern interrupts, or high-stakes statements.
2. MAINTAIN MOMENTUM — No dead air, rambling, or filler. Every sentence should build interest.
3. DELIVER VALUE — The viewer should feel they learned something, felt something, or had curiosity satisfied by the end.
4. FEEL COMPLETE — The segment should have a mini arc: hook → build → payoff. It should not feel like it starts or ends mid-thought.

Score each segment 0-10 considering: hook quality (most weight), pacing, emotional impact, curiosity, and shareability.

Return ONLY a valid JSON array. No markdown, no explanation.`;

export function buildRankingPrompt(chunks: Array<{ index: number; start: number; end: number; text: string; before?: string; after?: string }>): string {
  return `Evaluate these transcript segments for virality as short-form clips.

Each object in the JSON array must have: index (number), title (string), score (number 0-10), start (number), end (number), reason (string).

Segments:
${chunks.map(c => {
  const ctx = [];
  ctx.push(`[${c.index}] ${c.start}s-${c.end}s: "${c.text.slice(0, 350)}"`);
  return ctx.join("\n");
}).join("\n\n")}

Return ONLY the JSON array ranked by score (highest first). No markdown. No explanation.`;
}
