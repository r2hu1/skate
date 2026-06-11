import { join } from "path";
import { existsSync, mkdirSync } from "fs";
import type { AnalysisResult, PipelineOptions, ScoredChunk } from "../types";
import { getCacheDir } from "../config";
import { downloadVideo, extractAudio } from "./downloader";
import { transcribeAudio } from "./transcriber";
import { chunkTranscript } from "./chunker";
import { scoreChunk } from "./scorer";
import { rankChunks, selectClips } from "./ranker";
import { renderClips, exportMetadata } from "./renderer";
import { trackFacesInClip, generateCropForClip } from "./tracker";

export async function runPipeline(options: PipelineOptions): Promise<AnalysisResult> {
  const { source, isUrl, config, outputDir, skipDownload, skipRender } = options;
  const cacheDir = getCacheDir(config);
  const tempBase = join(process.cwd(), "temp");

  let videoPath = source;
  let videoName: string;

  if (isUrl && !skipDownload) {
    const downloadedPath = await downloadVideo(source, tempBase);
    videoName = deriveVideoName(downloadedPath);
    const tempDir = join(tempBase, videoName);
    if (!existsSync(tempDir)) mkdirSync(tempDir, { recursive: true });
    const destPath = join(tempDir, downloadedPath.split("/").pop() || "video.webm");
    Bun.spawnSync(["mv", downloadedPath, destPath]);
    videoPath = destPath;
  } else {
    videoName = deriveVideoName(videoPath);
  }

  const tempDir = join(tempBase, videoName);
  if (!existsSync(tempDir)) mkdirSync(tempDir, { recursive: true });
  const videoOutputDir = join(outputDir, videoName);

  const audioPath = await extractAudio(videoPath, tempDir);

  const transcript = await transcribeAudio(audioPath, cacheDir);

  await Bun.write(join(tempDir, "transcript.json"), JSON.stringify(transcript, null, 2));

  console.log(`  Chunking transcript...`);
  const chunks = chunkTranscript(transcript);
  console.log(`  Created ${chunks.length} chunks`);

  const scored: ScoredChunk[] = chunks.map((chunk, i) => ({
    index: i,
    chunk,
    heuristic: scoreChunk(chunk),
  }));

  console.log(`  Scoring complete. Top scores:`);
  const sorted = [...scored].sort((a, b) => b.heuristic.total - a.heuristic.total);
  for (const s of sorted.slice(0, 5)) {
    console.log(`    [${s.index}] Score: ${s.heuristic.total}/100 | "${s.chunk.text.slice(0, 60)}..."`);
  }

  const ranked = await rankChunks(scored, config.clips, config.ollamaUrl, config.model);
  console.log(`\n  AI Rankings:`);
  for (const r of ranked.slice(0, 5)) {
    console.log(`    ${r.score.toFixed(1)}/10 | ${r.title.slice(0, 60)}`);
  }

  const selected = selectClips(ranked, scored, config.clips, config.minLength, config.maxLength);
  console.log(`\n  Selected ${selected.length} clips for rendering`);

  const metadata = selected.map((s, i) => ({
    title: ranked.find(r => Math.abs(r.start - s.chunk.start) < 1)?.title || `Clip ${i + 1}`,
    hook: s.chunk.text.slice(0, 60) + "...",
    hashtags: generateHashtags(s.chunk.text),
    score: s.combinedScore ?? s.heuristic.total,
    duration: Math.round(s.chunk.end - s.chunk.start),
    start: s.chunk.start,
    end: s.chunk.end,
    sourceFile: source,
    clipFile: `clip-${String(i + 1).padStart(2, "0")}.mp4`,
    subtitleFile: `clip-${String(i + 1).padStart(2, "0")}.srt`,
  }));

  if (!skipRender) {
    const cropCacheFile = join(tempDir, "crop-data.json");
    let cachedCropData: Record<number, any> | null = null;

    if (existsSync(cropCacheFile)) {
      try {
        cachedCropData = JSON.parse(await Bun.file(cropCacheFile).text());
        console.log(`  Using cached crop data`);
      } catch {
        cachedCropData = null;
      }
    }

    if (!cachedCropData) {
      console.log(`  Tracking faces for crop data...`);
      const cropMap: Record<number, any> = {};
      for (const s of selected) {
        const faces = await trackFacesInClip(videoPath, s.chunk.start, s.chunk.end);
        const cropData = await generateCropForClip(videoPath, faces, 1920, 1080, s.chunk.end - s.chunk.start);
        cropMap[s.index] = cropData;
      }
      await Bun.write(cropCacheFile, JSON.stringify(cropMap));
      cachedCropData = cropMap;
    }

    for (const s of selected) {
      (s as any).cropData = cachedCropData[s.index] || null;
    }

    await renderClips(videoPath, selected, config.subtitleStyle, videoOutputDir);
    await exportMetadata(metadata, videoOutputDir);
    console.log(`\n  Output: ${videoOutputDir}/`);
  }

  const result: AnalysisResult = {
    sourceFile: source,
    duration: transcript.duration,
    transcript,
    chunks: scored,
    ranked,
    selected,
    metadata,
  };

  const cacheFile = join(cacheDir, `${videoName}-analysis.json`);
  await Bun.write(cacheFile, JSON.stringify(result, null, 2));
  await Bun.write(join(tempDir, "analysis.json"), JSON.stringify(result, null, 2));

  return result;
}

function deriveVideoName(videoPath: string): string {
  let name = videoPath.split("/").pop() || videoPath.split("\\").pop() || "video";
  name = name.replace(/\.[^.]+$/, "");
  name = name.replace(/[^a-zA-Z0-9_-]/g, "_");
  name = name.replace(/_+/g, "_").replace(/^_|_$/g, "");
  return name.toLowerCase() || "video";
}

function generateHashtags(text: string): string[] {
  const tags = new Set<string>();
  const lower = text.toLowerCase();

  const tagMap: Record<string, string[]> = {
    productivity: ["#productivity", "#tips"],
    money: ["#money", "#finance"],
    health: ["#health", "#wellness"],
    tech: ["#tech", "#technology"],
    social: ["#socialmedia", "#viral"],
    life: ["#life", "#advice"],
    business: ["#business", "#entrepreneur"],
    learn: ["#learning", "#education"],
    mistake: ["#mistakes", "#lesson"],
    success: ["#success", "#growth"],
  };

  for (const [keyword, hashtags] of Object.entries(tagMap)) {
    if (lower.includes(keyword)) {
      for (const tag of hashtags) {
        tags.add(tag);
      }
    }
  }

  tags.add("#shorts");
  return [...tags].slice(0, 5);
}
