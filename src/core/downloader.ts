import { join, extname } from "path";
import { tui } from "../ui/tui";

export async function downloadVideo(url: string, outputDir: string): Promise<string> {
  tui.log(`Downloading from ${url}...`);

  const outputTemplate = join(outputDir, "%(id)s.%(ext)s");

  const proc = Bun.spawnSync([
    "yt-dlp",
    "-f", "bestvideo[height<=1080]+bestaudio/best[height<=1080]",
    "-o", outputTemplate,
    "--print", "after_move:filepath",
    "--no-simulate",
    url,
  ], {
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 300000,
  });

  if (proc.exitCode !== 0) {
    const stderr = proc.stderr.toString();
    throw new Error(`Download failed: ${stderr}`);
  }

  const outputPath = proc.stdout.toString().trim().split("\n").pop() || "";
  if (!outputPath) {
    throw new Error("Download succeeded but could not determine output path");
  }

  const file = Bun.file(outputPath);
  if (!(await file.exists())) {
    throw new Error(`Download claimed success but file not found: ${outputPath}`);
  }

  tui.raw(`Downloaded to: ${outputPath}`);
  return outputPath;
}

export async function extractAudio(videoPath: string, outputDir: string): Promise<string> {
  tui.log("Extracting audio...");

  const baseName = videoPath.split("/").pop() || videoPath.split("\\").pop() || "audio";
  const nameWithoutExt = baseName.replace(/\.[^.]+$/, "");
  const audioFile = join(outputDir, `${nameWithoutExt}.wav`);

  const proc = Bun.spawnSync([
    "ffmpeg",
    "-i", videoPath,
    "-vn",
    "-acodec", "pcm_s16le",
    "-ar", "16000",
    "-ac", "1",
    "-y",
    audioFile,
  ], {
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 300000,
  });

  if (proc.exitCode !== 0) {
    const stderr = proc.stderr.toString();
    throw new Error(`Audio extraction failed: ${stderr}`);
  }

  tui.raw(`Audio extracted to: ${audioFile}`);
  return audioFile;
}
