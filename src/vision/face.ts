import { join } from "path";
import { homedir } from "os";
import type { FaceTrackPoint } from "../types";

const SCRIPTS_DIR = join(import.meta.dir, "..", "..", "scripts");
const HOME_SCRIPT = join(homedir(), ".skate", "face_detect.py");
const VENV_PYTHON = join(homedir(), ".skate", "venv", "bin", "python3");
const SYSTEM_PYTHON = "python3";

function findScript(): string {
  const repoScript = Bun.file(join(SCRIPTS_DIR, "face_detect.py"));
  if (repoScript.size > 0) return join(SCRIPTS_DIR, "face_detect.py");
  const homeScript = Bun.file(HOME_SCRIPT);
  if (homeScript.size > 0) return HOME_SCRIPT;
  return join(SCRIPTS_DIR, "face_detect.py");
}

export async function detectFaces(
  videoPath: string,
  timestamps: number[],
): Promise<Map<number, FaceTrackPoint[]>> {
  console.log("  Detecting faces...");

  const python = await findPython();
  const script = findScript();
  const timestampsJson = JSON.stringify(timestamps);

  const proc = Bun.spawnSync([python, script, videoPath, timestampsJson], {
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 300000,
  });

  if (proc.exitCode !== 0) {
    const stderr = proc.stderr.toString();
    const stdout = proc.stdout.toString();
    console.warn(`  Face detection failed: ${stderr || stdout}`);
    return new Map();
  }

  const stdout = proc.stdout.toString();
  let raw: any;
  try {
    raw = JSON.parse(stdout);
  } catch {
    console.warn("  Face detection: invalid JSON output");
    return new Map();
  }

  if (!Array.isArray(raw)) {
    const errMsg = raw?.error || "unexpected response format";
    console.warn(`  Face detection error: ${errMsg}`);
    return new Map();
  }

  const faceMap = new Map<number, FaceTrackPoint[]>();
  for (const item of raw) {
    const ts = item.timestamp;
    const w = item.width ?? 0;
    const h = item.height ?? 0;
    if (w < 10 || h < 10) continue;
    if (!faceMap.has(ts)) {
      faceMap.set(ts, []);
    }
    const list = faceMap.get(ts)!;
    list.push({
      timestamp: ts,
      centerX: item.centerX ?? 0,
      centerY: item.centerY ?? 0,
      width: w,
      height: h,
    });
  }

  if (faceMap.size === 0) {
    console.log("  No faces detected, will use center crop");
    return faceMap;
  }

  console.log(`  Detected faces at ${faceMap.size} timestamps`);
  return faceMap;
}

export function trackFaces(
  videoPath: string,
  start: number,
  end: number,
): Promise<FaceTrackPoint[]> {
  console.log("  Tracking faces across frames...");
  return Promise.resolve([]);
}

async function findPython(): Promise<string> {
  const venvPython = Bun.file(VENV_PYTHON);
  if (await venvPython.exists()) return VENV_PYTHON;
  return SYSTEM_PYTHON;
}
