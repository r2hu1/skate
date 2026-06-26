import { join } from "path";
import { existsSync, mkdirSync } from "fs";
import type { AnalysisResult, PipelineOptions, ScoredChunk } from "../types";
import { getCacheDir } from "../config";
import { ensureOllama } from "../ai/ollama";
import { checkPythonVenv } from "../commands/setup";
import { downloadVideo, extractAudio } from "./downloader";
import { transcribeAudio } from "./transcriber";
import { chunkTranscript } from "./chunker";
import { rankChunks, selectClips } from "./ranker";
import { renderClips, exportMetadata } from "./renderer";
import { trackFacesInClip, generateCropForClip } from "./tracker";
import { getSourceDimensions } from "../vision/crop";
import { tui } from "../ui/tui";

export async function runPipeline(options: PipelineOptions): Promise<AnalysisResult> {
  const { source, isUrl, config, outputDir, skipDownload, skipRender, crop, cropMode, captions } = options;
  const cacheDir = getCacheDir(config);
  const tempBase = config.tempDir;

  let videoPath = source;
  let videoName: string;

  if (isUrl && !skipDownload) {
    tui.startStep("Download");
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

  if (!(await checkPythonVenv())) {
    tui.warn("Python venv not found — run 'skate setup' first");
    throw new Error("Python environment not set up. Run: skate setup");
  }

  tui.startStep("Transcribe");
  const audioPath = await extractAudio(videoPath, tempDir);

  const transcript = await transcribeAudio(audioPath, cacheDir);
  await Bun.write(join(tempDir, "transcript.json"), JSON.stringify(transcript, null, 2));

  tui.startStep("Chunk & Score");
  const chunks = chunkTranscript(transcript);
  tui.log(`Created ${chunks.length} chunks`);

  const scored: ScoredChunk[] = chunks.map((chunk, i) => ({
    index: i,
    chunk,
  }));

  tui.startStep("AI Rank");
  const ollamaReady = await ensureOllama(config.ollamaUrl);
  if (!ollamaReady) {
    throw new Error("Ollama is required for AI ranking. Run: skate setup");
  }
  const ranked = await rankChunks(scored, config.clips, config.ollamaUrl, config.model);
  tui.setRankings(ranked);

  tui.startStep("Select Clips");
  const selected = selectClips(ranked, scored, config.clips, config.minLength, config.maxLength);
  tui.log(`Selected ${selected.length} clips`);

  const metadata = selected.map((s, i) => ({
    title: ranked.find(r => Math.abs(r.start - s.chunk.start) < 1)?.title || `Clip ${i + 1}`,
    hook: s.chunk.text.slice(0, 60) + "...",
    hashtags: generateHashtags(s.chunk.text),
    score: s.aiScore ?? 0,
    duration: Math.round(s.chunk.end - s.chunk.start),
    start: s.chunk.start,
    end: s.chunk.end,
    sourceFile: source,
    clipFile: `clip-${String(i + 1).padStart(2, "0")}.mp4`,
    subtitleFile: `clip-${String(i + 1).padStart(2, "0")}.srt`,
  }));

  const shouldCrop = crop !== false && config.crop !== false;

  if (!skipRender) {
    const cropCacheFile = join(tempDir, "crop-data.json");
    let cachedCropData: Record<number, any> | null = null;

    if (shouldCrop && existsSync(cropCacheFile)) {
      try {
        cachedCropData = JSON.parse(await Bun.file(cropCacheFile).text());
        tui.log("Using cached crop data");
      } catch {
        cachedCropData = null;
      }
    }

    if (shouldCrop && !cachedCropData) {
      tui.startStep("Track Faces");
      const srcInfo = getSourceDimensions(videoPath);
      tui.log(`Source: ${srcInfo.width}x${srcInfo.height}`);
      const cropMap: Record<number, any> = {};
      for (let i = 0; i < selected.length; i++) {
        const s = selected[i];
        tui.log(`Tracking faces for clip ${i + 1}/${selected.length}`);
        const faces = await trackFacesInClip(videoPath, s.chunk.start, s.chunk.end);
        const cropData = await generateCropForClip(videoPath, faces, srcInfo.width, srcInfo.height, s.chunk.end - s.chunk.start, cropMode);
        cropMap[s.index] = cropData;
      }
      await Bun.write(cropCacheFile, JSON.stringify(cropMap));
      cachedCropData = cropMap;
    }

    if (shouldCrop) {
      for (const s of selected) {
        (s as any).cropData = cachedCropData?.[s.index] || null;
      }
    }

    tui.startStep("Render Clips");
    await renderClips(videoPath, selected, config.subtitleStyle, videoOutputDir, cropMode, captions);
    tui.done(videoOutputDir, selected.length);
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
