import { join } from "path";
import { homedir } from "os";
import type { Transcript, TranscriptSegment, WordTimestamp } from "../types";

const SCRIPTS_DIR = join(import.meta.dir, "..", "..", "scripts");
const HOME_SCRIPT = join(homedir(), ".skate", "whisper_transcribe.py");
const VENV_PYTHON = join(homedir(), ".skate", "venv", "bin", "python3");
const SYSTEM_PYTHON = "python3";

function findWhisperScript(): string {
  const repoScript = Bun.file(join(SCRIPTS_DIR, "whisper_transcribe.py"));
  if (repoScript.size > 0) return join(SCRIPTS_DIR, "whisper_transcribe.py");
  const homeScript = Bun.file(HOME_SCRIPT);
  if (homeScript.size > 0) return HOME_SCRIPT;
  return join(SCRIPTS_DIR, "whisper_transcribe.py");
}

export async function transcribeAudio(audioPath: string, cacheDir: string, modelSize = "base"): Promise<Transcript> {
  console.log("  Transcribing audio...");

  const cacheFile = cachePath(audioPath, cacheDir);
  const cached = Bun.file(cacheFile);
  if (await cached.exists()) {
    console.log("  Using cached transcript");
    return await cached.json() as Transcript;
  }

  const python = await findPython();
  const script = findWhisperScript();

  const proc = Bun.spawnSync([
    python,
    script,
    audioPath,
    modelSize,
  ], {
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 600000,
  });

  if (proc.exitCode !== 0) {
    const stderr = proc.stderr.toString();
    const stdout = proc.stdout.toString();
    throw new Error(`Transcription failed: ${stderr || stdout}`);
  }

  const stdout = proc.stdout.toString();
  const raw = JSON.parse(stdout);

  if (raw.error) {
    throw new Error(`Transcription error: ${raw.error}`);
  }

  const segments: TranscriptSegment[] = (raw.segments || []).map((seg: any) => ({
    start: seg.start ?? 0,
    end: seg.end ?? 0,
    text: (seg.text || "").trim(),
    words: (seg.words || []).map((w: any) => ({
      word: w.word,
      start: w.start,
      end: w.end,
    })),
  }));

  const transcript: Transcript = {
    segments,
    language: raw.language || "unknown",
    duration: raw.duration || (segments.length > 0 ? segments[segments.length - 1].end : 0),
  };

  await Bun.write(cacheFile, JSON.stringify(transcript, null, 2));
  console.log(`  Transcribed ${segments.length} segments (${transcript.language})`);
  return transcript;
}

function cachePath(audioPath: string, cacheDir: string): string {
  const name = audioPath.split("/").pop() || audioPath.split("\\").pop() || "audio";
  const base = name.replace(/\.[^.]+$/, "");
  return join(cacheDir, `${base}.transcript.json`);
}

async function findPython(): Promise<string> {
  const venvPython = Bun.file(VENV_PYTHON);
  if (await venvPython.exists()) return VENV_PYTHON;
  return SYSTEM_PYTHON;
}
