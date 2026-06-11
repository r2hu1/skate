import { homedir } from "os";
import type { DependencyCheck } from "../types";

interface CheckResult {
  name: string;
  status: "ok" | "missing" | "error";
  version?: string;
  path?: string;
  error?: string;
}

async function checkBinary(name: string, versionFlag: string, versionRegex?: RegExp): Promise<CheckResult> {
  try {
    const proc = Bun.spawnSync([name, versionFlag], { stdio: ["ignore", "pipe", "pipe"] });
    if (proc.exitCode !== 0) {
      return { name, status: "missing" };
    }
    const output = proc.stdout.toString();
    const stderr = proc.stderr.toString();
    const all = output || stderr;
    let version: string | undefined;
    if (versionRegex) {
      const match = all.match(versionRegex);
      if (match) {
        version = match[1] || match[0];
      }
    }
    return { name, status: "ok", version, path: whichSync(name) };
  } catch {
    return { name, status: "missing" };
  }
}

function whichSync(name: string): string | undefined {
  const paths = (process.env.PATH || "").split(":");
  for (const dir of paths) {
    try {
      const fullPath = `${dir}/${name}`;
      const file = Bun.file(fullPath);
      if (file.size > 0) {
        return fullPath;
      }
    } catch {}
  }
  return undefined;
}

async function checkOllama(): Promise<CheckResult> {
  try {
    const res = await fetch("http://localhost:11434/api/tags");
    if (!res.ok) return { name: "ollama", status: "error", error: `HTTP ${res.status}` };
    const data = await res.json() as any;
    const models = (data.models || []).map((m: any) => m.name);
    return { name: "ollama", status: "ok", version: `running (models: ${models.join(", ") || "none"})` };
  } catch {
    return { name: "ollama", status: "missing", error: "not running on localhost:11434" };
  }
}

async function checkWhisper(): Promise<CheckResult> {
  const pythons = [`${homedir()}/.skate/venv/bin/python3`, "python3"];
  for (const py of pythons) {
    try {
      const proc = Bun.spawnSync([
        py, "-c", "from faster_whisper import WhisperModel; print('ok')",
      ], { stdio: ["ignore", "pipe", "pipe"] });
      if (proc.exitCode === 0 && proc.stdout.toString().trim() === "ok") {
        return { name: "faster-whisper", status: "ok" };
      }
    } catch {}
  }
  return { name: "faster-whisper", status: "missing" };
}

export async function doctorCommand(): Promise<void> {
  console.log(" Skate Doctor — Checking system dependencies\n");

  const checks = await Promise.all([
    checkBinary("ffmpeg", "-version", /ffmpeg version (\S+)/),
    checkBinary("yt-dlp", "--version"),
    checkOllama(),
    checkWhisper(),
    checkBinary("python3", "--version", /Python (\S+)/),
  ]);

  const results: DependencyCheck[] = checks;

  let allOk = true;
  for (const check of results) {
    const icon = check.status === "ok" ? "✓" : check.status === "missing" ? "✗" : "⚠";
    console.log(`  ${icon} ${check.name}`);
    if (check.version) {
      console.log(`     Version: ${check.version}`);
    }
    if (check.path) {
      console.log(`     Path: ${check.path}`);
    }
    if (check.error) {
      console.log(`     ${check.error}`);
    }
    if (check.status !== "ok") {
      allOk = false;
    }
    console.log();
  }

  if (allOk) {
    console.log(" All dependencies are installed and reachable.");
  } else {
    console.log(" Some dependencies are missing. Install them to use Skate.");
    console.log("  - FFmpeg: brew install ffmpeg");
    console.log("  - yt-dlp: brew install yt-dlp");
    console.log("  - Ollama: brew install ollama && ollama serve");
    console.log("  - faster-whisper: pip install faster-whisper");
  }
}
