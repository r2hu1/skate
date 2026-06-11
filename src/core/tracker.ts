import type { FaceTrackPoint, CropFrame } from "../types";
import { detectFaces } from "../vision/face";
import { generateCropFrames } from "../vision/crop";

export async function trackFacesInClip(
  videoPath: string,
  start: number,
  end: number,
): Promise<FaceTrackPoint[]> {
  console.log("  Tracking faces...");

  const timestamps = generateTimestampGrid(start, end);
  const faceMap = await detectFaces(videoPath, timestamps);

  const tracks: FaceTrackPoint[] = [];
  for (const ts of timestamps) {
    const faces = faceMap.get(ts) || [];
    if (faces.length > 0) {
      tracks.push(faces[0]);
    }
  }

  return tracks;
}

export async function generateCropForClip(
  videoPath: string,
  faceTracks: FaceTrackPoint[],
  sourceWidth: number,
  sourceHeight: number,
  duration: number,
): Promise<CropFrame[]> {
  return generateCropFrames(faceTracks, sourceWidth, sourceHeight, duration);
}

function generateTimestampGrid(start: number, end: number, sampleRate: number = 0.2): number[] {
  const timestamps: number[] = [];
  for (let t = start; t <= end; t += sampleRate) {
    timestamps.push(Math.round(t * 100) / 100);
  }
  return timestamps;
}
