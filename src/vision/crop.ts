import type { FaceTrackPoint, CropFrame } from "../types";

const TARGET_WIDTH = 1080;
const TARGET_HEIGHT = 1920;
const ASPECT_RATIO = TARGET_WIDTH / TARGET_HEIGHT;

export function generateCropFrames(
  faceTracks: FaceTrackPoint[],
  sourceWidth: number,
  sourceHeight: number,
  duration: number,
  fps: number = 30,
): CropFrame[] {
  if (faceTracks.length === 0) {
    return generateCenterCrop(sourceWidth, sourceHeight, duration, fps);
  }

  const rawCrops = faceTracks.map(ft => ({
    ...calculateCrop(ft, sourceWidth, sourceHeight),
    timestamp: ft.timestamp,
  }));
  return smoothCropPath(rawCrops, fps);
}

function generateCenterCrop(
  sourceWidth: number,
  sourceHeight: number,
  duration: number,
  fps: number,
): CropFrame[] {
  const frameCount = Math.floor(duration * fps);
  const crop = calculateCenterCrop(sourceWidth, sourceHeight);
  const frames: CropFrame[] = [];

  for (let i = 0; i < frameCount; i++) {
    frames.push({
      timestamp: i / fps,
      ...crop,
    });
  }

  return frames;
}

function calculateCenterCrop(sourceWidth: number, sourceHeight: number): Omit<CropFrame, "timestamp"> {
  let cropWidth: number;
  let cropHeight: number;

  if (sourceWidth / sourceHeight > ASPECT_RATIO) {
    cropHeight = sourceHeight;
    cropWidth = Math.round(cropHeight * ASPECT_RATIO);
  } else {
    cropWidth = sourceWidth;
    cropHeight = Math.round(cropWidth / ASPECT_RATIO);
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
): Omit<CropFrame, "timestamp"> {
  const centerCrop = calculateCenterCrop(sourceWidth, sourceHeight);
  const cropWidth = centerCrop.width;
  const cropHeight = centerCrop.height;

  let x = Math.round(face.centerX - cropWidth / 2);
  let y = Math.round(face.centerY - cropHeight / 3);

  x = Math.max(0, Math.min(x, sourceWidth - cropWidth));
  y = Math.max(0, Math.min(y, sourceHeight - cropHeight));

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
  const windowSize = Math.max(1, Math.floor(fps * 0.15));

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

interface CropKeyframe {
  frame: number;
  x: number;
  y: number;
}

export function buildCropFilterString(
  cropFrames: CropFrame[],
  sourceFps: number,
): string | null {
  if (cropFrames.length === 0) return null;

  const { width, height } = cropFrames[0];
  const totalFrames = cropFrames.length;

  const keyframes = compressToKeyframes(cropFrames, sourceFps, 8);

  if (keyframes.length <= 1) {
    const kf = keyframes[0];
    return `crop=${width}:${height}:${kf.x}:${kf.y}`;
  }

  const xExpr = buildBetweenExpr(keyframes, totalFrames, "x");
  const yExpr = buildBetweenExpr(keyframes, totalFrames, "y");

  return `crop=${width}:${height}:'${xExpr}':'${yExpr}'`;
}

function compressToKeyframes(
  cropFrames: CropFrame[],
  sourceFps: number,
  threshold: number,
): CropKeyframe[] {
  if (cropFrames.length === 0) return [];

  const keyframes: CropKeyframe[] = [];
  keyframes.push({ frame: 0, x: cropFrames[0].x, y: cropFrames[0].y });

  for (let i = 1; i < cropFrames.length; i++) {
    const prev = keyframes[keyframes.length - 1];
    const curr = cropFrames[i];
    const dx = Math.abs(curr.x - prev.x);
    const dy = Math.abs(curr.y - prev.y);

    if (dx > threshold || dy > threshold) {
      const frame = Math.round(curr.timestamp * sourceFps);
      keyframes.push({ frame, x: curr.x, y: curr.y });
    }
  }

  const last = keyframes[keyframes.length - 1];
  const lastSrc = cropFrames[cropFrames.length - 1];
  const lastFrame = Math.round(lastSrc.timestamp * sourceFps);
  if (last.frame !== lastFrame) {
    keyframes.push({ frame: lastFrame, x: lastSrc.x, y: lastSrc.y });
  }

  return keyframes;
}

function buildBetweenExpr(keyframes: CropKeyframe[], totalFrames: number, field: "x" | "y"): string {
  const terms: string[] = [];

  for (let i = 0; i < keyframes.length; i++) {
    const start = keyframes[i].frame;
    const end = i < keyframes.length - 1 ? keyframes[i + 1].frame - 1 : totalFrames - 1;
    if (start > end) continue;
    terms.push(`between(n,${start},${end})*${keyframes[i][field]}`);
  }

  return terms.join("+");
}

export function getSourceDimensions(
  videoPath: string,
): { width: number; height: number } {
  const proc = Bun.spawnSync([
    "ffprobe",
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "stream=width,height",
    "-of", "csv=p=1",
    videoPath,
  ], { stdio: ["ignore", "pipe", "pipe"] });

  if (proc.exitCode !== 0) {
    return { width: 1920, height: 1080 };
  }

  const parts = proc.stdout.toString().trim().split(",");
  const width = parseInt(parts[0], 10) || 1920;
  const height = parseInt(parts[1], 10) || 1080;
  return { width, height };
}
