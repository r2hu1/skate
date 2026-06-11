import type { FaceTrackPoint } from "../types";

export async function detectFaces(
  videoPath: string,
  timestamps: number[],
): Promise<Map<number, FaceTrackPoint[]>> {
  console.log("  Detecting faces...");
  return new Map();
}

export function trackFaces(
  videoPath: string,
  start: number,
  end: number,
): Promise<FaceTrackPoint[]> {
  console.log("  Tracking faces across frames...");
  return Promise.resolve([]);
}
