export interface SceneChange {
  timestamp: number;
  confidence: number;
}

export async function detectSceneChanges(videoPath: string): Promise<SceneChange[]> {
  console.log("Detecting scene changes...");

  try {
    const proc = Bun.spawnSync([
      "ffmpeg",
      "-i", videoPath,
      "-filter:v", "select='gt(scene,0.4)',showinfo",
      "-f", "null",
      "-",
    ], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    const output = proc.stderr.toString();
    const changes: SceneChange[] = [];
    const regex = /pts_time:(\d+\.?\d*)/g;
    let match;

    while ((match = regex.exec(output)) !== null) {
      changes.push({
        timestamp: parseFloat(match[1]),
        confidence: 0.5,
      });
    }

    return changes;
  } catch {
    return [];
  }
}
