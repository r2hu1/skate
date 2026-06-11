import { existsSync } from "fs";
import { join } from "path";
import type { AnalysisResult, SkateConfig } from "../types";
import { getCacheDir } from "../config";
import { renderClips, exportMetadata } from "../core/renderer";

export async function renderCommand(args: string[], config: SkateConfig): Promise<void> {
  if (args.length === 0) {
    console.error("Usage: skate render <file>");
    process.exit(1);
  }
  const videoPath = args[0];
  const cacheDir = getCacheDir(config);
  const videoName = deriveVideoName(videoPath);
  const cacheFile = join(cacheDir, `${videoName}-analysis.json`);

  if (!existsSync(cacheFile)) {
    console.error(`  No cached analysis found for ${videoName}`);
    console.error(`  Run "skate analyze ${videoPath}" first`);
    return;
  }

  const file = Bun.file(cacheFile);
  const analysis = await file.json() as AnalysisResult;

  if (!analysis.selected || analysis.selected.length === 0) {
    console.error("  No clips selected in cached analysis");
    return;
  }

  console.log(`  Rendering ${analysis.selected.length} clips from cached analysis...`);
  console.log(`  Source: ${analysis.sourceFile}`);

  const outputDir = join(process.cwd(), "output", videoName);
  await renderClips(analysis.sourceFile, analysis.selected, config.subtitleStyle, outputDir);

  const metadata = analysis.selected.map((s, i) => ({
    title: analysis.ranked?.find(r => Math.abs(r.start - s.chunk.start) < 1)?.title || `Clip ${i + 1}`,
    hook: s.chunk.text.slice(0, 60) + "...",
    hashtags: [] as string[],
    score: s.combinedScore ?? s.heuristic.total,
    duration: Math.round(s.chunk.end - s.chunk.start),
    start: s.chunk.start,
    end: s.chunk.end,
    sourceFile: analysis.sourceFile,
    clipFile: `clip-${String(i + 1).padStart(2, "0")}.mp4`,
    subtitleFile: `clip-${String(i + 1).padStart(2, "0")}.srt`,
  }));

  await exportMetadata(metadata, outputDir);
  console.log(`\n  Output: ${outputDir}/`);
}

function deriveVideoName(videoPath: string): string {
  let name = videoPath.split("/").pop() || videoPath.split("\\").pop() || "video";
  name = name.replace(/\.[^.]+$/, "");
  name = name.replace(/[^a-zA-Z0-9_-]/g, "_");
  name = name.replace(/_+/g, "_").replace(/^_|_$/g, "");
  return name.toLowerCase() || "video";
}
