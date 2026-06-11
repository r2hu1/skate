import { join } from "path";
import { existsSync } from "fs";
import type { ScoredChunk, CropFrame, SubtitleStyle } from "../types";
import { generateSRT, generateASS } from "./subtitles";

const FFMPEG_PATHS = [
  "/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg",
  "/usr/local/opt/ffmpeg-full/bin/ffmpeg",
  "ffmpeg",
];

const OUTPUT_DIRS = ["clips", "captions", "thumbnails"];

function findFfmpeg(): string {
  for (const p of FFMPEG_PATHS) {
    const file = Bun.file(p);
    if (file.size > 0) return p;
  }
  return "ffmpeg";
}

export async function renderClips(
  sourceFile: string,
  selected: ScoredChunk[],
  subtitleStyle: SubtitleStyle,
  outputDir: string,
): Promise<void> {
  ensureOutputDirs(outputDir);

  for (let i = 0; i < selected.length; i++) {
    const chunk = selected[i];
    const clipNum = String(i + 1).padStart(2, "0");
    console.log(`  Rendering clip ${clipNum}/${String(selected.length).padStart(2, "0")}...`);

    const clipPath = join(outputDir, "clips", `clip-${clipNum}.mp4`);
    const srtPath = join(outputDir, "captions", `clip-${clipNum}.srt`);
    const assPath = srtPath.replace(/\.srt$/, ".ass");

    const chunkStart = chunk.chunk.start;
    await Bun.write(srtPath, generateSRT(chunk.chunk.words, subtitleStyle, chunkStart));
    await Bun.write(assPath, generateASS(chunk.chunk.words, subtitleStyle, chunkStart));

    await cutClip(sourceFile, clipPath, chunk.chunk.start, chunk.chunk.end, assPath, subtitleStyle);
  }
}

export async function cutClip(
  sourceFile: string,
  outputPath: string,
  start: number,
  end: number,
  srtPath?: string,
  subtitleStyle?: SubtitleStyle,
  cropData?: CropFrame[],
): Promise<void> {
  const duration = end - start;
  const tempRaw = outputPath.replace(".mp4", "-raw.mp4");
  const filterParts: string[] = [];

  if (cropData && cropData.length > 0) {
    filterParts.push(`crop=${cropData[0].width}:${cropData[0].height}:${cropData[0].x}:${cropData[0].y}`);
  }

  filterParts.push("scale=1080:1920:force_original_aspect_ratio=decrease");
  filterParts.push("pad=1080:1920:(ow-iw)/2:(oh-ih)/2");

  const filter = filterParts.join(",");

  const args = [
    "-ss", String(start),
    "-i", sourceFile,
    "-t", String(duration),
    "-vf", filter,
    "-c:v", "libx264",
    "-preset", "fast",
    "-crf", "22",
    "-c:a", "aac",
    "-b:a", "128k",
    "-y",
    tempRaw,
  ];

  const ffmpeg = findFfmpeg();

  const proc = Bun.spawnSync([ffmpeg, ...args], {
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 300000,
  });

  if (proc.exitCode !== 0) {
    const stderr = proc.stderr.toString();
    throw new Error(`Render failed for segment ${start}s-${end}s: ${stderr}`);
  }

  if (srtPath) {
    const subProc = Bun.spawnSync([
      ffmpeg,
      "-i", tempRaw,
      "-vf", `ass=${srtPath}`,
      "-c:a", "copy",
      "-y",
      outputPath,
    ], {
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 120000,
    });

    if (subProc.exitCode !== 0) {
      const stderr = subProc.stderr.toString();
      Bun.spawnSync(["mv", tempRaw, outputPath]);
      throw new Error(`Subtitle burn-in failed: ${stderr}`);
    }

    Bun.spawnSync(["rm", tempRaw]);
  } else {
    Bun.spawnSync(["mv", tempRaw, outputPath]);
  }
}

function ensureOutputDirs(baseDir: string): void {
  for (const dir of OUTPUT_DIRS) {
    const fullPath = join(baseDir, dir);
    if (!existsSync(fullPath)) {
      Bun.spawnSync(["mkdir", "-p", fullPath]);
    }
  }
}

export async function exportMetadata(
  metadata: any[],
  outputDir: string,
): Promise<void> {
  const metaPath = join(outputDir, "metadata.json");
  await Bun.write(metaPath, JSON.stringify(metadata, null, 2));

  const reportPath = join(outputDir, "report.md");
  const report = generateReport(metadata);
  await Bun.write(reportPath, report);
}

function generateReport(metadata: any[]): string {
  const lines: string[] = [];
  lines.push("# Skate Export Report");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Total clips: ${metadata.length}`);
  lines.push("");
  lines.push("## Clips");
  lines.push("");

  for (const clip of metadata) {
    lines.push(`### ${clip.title || "Untitled"}`);
    lines.push(`- Score: ${clip.score}/10`);
    lines.push(`- Duration: ${clip.duration}s`);
    lines.push(`- Hashtags: ${(clip.hashtags || []).join(", ")}`);
    if (clip.hook) lines.push(`- Hook: ${clip.hook}`);
    lines.push("");
  }

  return lines.join("\n");
}
