import type { FaceTrackPoint, CropFrame } from "../types";

const TARGET_WIDTH = 1080;
const TARGET_HEIGHT = 1920;

export function generateCropFrames(
  faceTracks: FaceTrackPoint[],
  sourceWidth: number,
  sourceHeight: number,
  duration: number,
  fps: number = 30,
  cropMode: "9:16" | "1" = "9:16",
): CropFrame[] {
  const aspectRatio = cropMode === "1" ? 1 : TARGET_WIDTH / TARGET_HEIGHT;

  if (faceTracks.length === 0) {
    return generateCenterCrop(sourceWidth, sourceHeight, duration, fps, aspectRatio);
  }

  const rawCrops = faceTracks.map(ft => ({
    ...calculateCrop(ft, sourceWidth, sourceHeight, aspectRatio),
    timestamp: ft.timestamp,
  }));
  return smoothCropPath(rawCrops, fps);
}

function generateCenterCrop(
  sourceWidth: number,
  sourceHeight: number,
  duration: number,
  fps: number,
  aspectRatio: number,
): CropFrame[] {
  const frameCount = Math.floor(duration * fps);
  const crop = calculateCenterCrop(sourceWidth, sourceHeight, aspectRatio);
  const frames: CropFrame[] = [];

  for (let i = 0; i < frameCount; i++) {
    frames.push({
      timestamp: i / fps,
      ...crop,
    });
  }

  return frames;
}

function calculateCenterCrop(sourceWidth: number, sourceHeight: number, aspectRatio: number): Omit<CropFrame, "timestamp"> {
  let cropWidth: number;
  let cropHeight: number;

  if (sourceWidth / sourceHeight > aspectRatio) {
    cropHeight = sourceHeight;
    cropWidth = Math.round(cropHeight * aspectRatio);
  } else {
    cropWidth = sourceWidth;
    cropHeight = Math.round(cropWidth / aspectRatio);
  }

  return {
    x: Math.round((sourceWidth - cropWidth) / 2),
    y: Math.round((sourceHeight - cropHeight) / 2),
    width: cropWidth,
    height: cropHeight,
  };
}

function calculateCrop(
  face: FaceTrackPoint,
  sourceWidth: number,
  sourceHeight: number,
  aspectRatio: number,
): Omit<CropFrame, "timestamp"> {
  const centerCrop = calculateCenterCrop(sourceWidth, sourceHeight, aspectRatio);
  const cropWidth = centerCrop.width;
  const cropHeight = centerCrop.height;

  const headroom = Math.max(face.height * 1.2, cropHeight * 0.1);
  let y = Math.round(face.centerY - cropHeight / 2 + headroom);
  y = Math.max(0, Math.min(y, sourceHeight - cropHeight));

  let x = Math.round(face.centerX - cropWidth / 2);
  x = Math.max(0, Math.min(x, sourceWidth - cropWidth));

  return { x, y, width: cropWidth, height: cropHeight };
}

function smoothCropPath(
  crops: Array<Omit<CropFrame, "timestamp"> & { timestamp: number }>,
  fps: number,
): CropFrame[] {
  if (crops.length <= 2) {
    return crops.map(c => ({ ...c }));
  }

  const smoothed: CropFrame[] = [];
  const windowSize = Math.max(1, Math.floor(fps * 0.3));

  for (let i = 0; i < crops.length; i++) {
    const start = Math.max(0, i - windowSize);
    const end = Math.min(crops.length - 1, i + windowSize);
    const window = crops.slice(start, end + 1);

    const avgX = Math.round(window.reduce((s, c) => s + c.x, 0) / window.length);
    const avgY = Math.round(window.reduce((s, c) => s + c.y, 0) / window.length);

    smoothed.push({
      timestamp: crops[i].timestamp,
      x: avgX,
      y: avgY,
      width: crops[i].width,
      height: crops[i].height,
    });
  }

  return smoothed;
}

export function getSourceDimensions(
  videoPath: string,
): { width: number; height: number } {
  const proc = Bun.spawnSync([
    "ffprobe",
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "stream=width,height",
    "-of", "default=noprint_wrappers=1:nokey=1",
    videoPath,
  ], { stdio: ["ignore", "pipe", "pipe"] });

  if (proc.exitCode !== 0) {
    return { width: 1920, height: 1080 };
  }

  const lines = proc.stdout.toString().trim().split("\n");
  const width = parseInt(lines[0], 10) || 1920;
  const height = parseInt(lines[1], 10) || 1080;
  return { width, height };
}

export function getSourceFps(videoPath: string): number {
  const proc = Bun.spawnSync([
    "ffprobe",
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "stream=r_frame_rate",
    "-of", "default=noprint_wrappers=1:nokey=1",
    videoPath,
  ], { stdio: ["ignore", "pipe", "pipe"] });

  if (proc.exitCode !== 0) return 30;

  const rate = proc.stdout.toString().trim();
  const parts = rate.split("/");
  if (parts.length === 2) {
    const num = parseInt(parts[0], 10);
    const den = parseInt(parts[1], 10);
    if (den > 0) return Math.round(num / den);
  }
  return parseInt(rate, 10) || 30;
}
