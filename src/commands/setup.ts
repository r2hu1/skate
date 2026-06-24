import { homedir } from "os";
import { join } from "path";
import { existsSync } from "fs";

const VENV_DIR = join(homedir(), ".skate", "venv");
const VENV_PYTHON = join(VENV_DIR, "bin", "python3");
const REQUIREMENTS = join(import.meta.dir, "..", "..", "scripts", "requirements.txt");

export async function checkPythonVenv(): Promise<boolean> {
  return existsSync(VENV_PYTHON);
}

export async function setupCommand(): Promise<void> {
  console.log(" Setting up Python environment...\n");

  const skateDir = join(homedir(), ".skate");
  if (!existsSync(skateDir)) {
    Bun.spawnSync(["mkdir", "-p", skateDir]);
  }

  if (existsSync(VENV_DIR)) {
    console.log("  Removing existing venv...");
    Bun.spawnSync(["rm", "-rf", VENV_DIR]);
  }

  console.log("  Creating Python virtual environment...");
  const createProc = Bun.spawnSync(["python3", "-m", "venv", VENV_DIR], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (createProc.exitCode !== 0) {
    throw new Error(`Failed to create venv: ${createProc.stderr.toString()}`);
  }
  console.log("  Venv created");

  console.log("  Installing dependencies (faster-whisper, opencv, numpy)...");
  const pipProc = Bun.spawnSync([VENV_PYTHON, "-m", "pip", "install", "-r", REQUIREMENTS], {
    stdio: ["inherit", "pipe", "pipe"],
    timeout: 600000,
  });
  if (pipProc.exitCode !== 0) {
    throw new Error(`pip install failed: ${pipProc.stderr.toString()}`);
  }

  console.log("\n Python environment ready at ~/.skate/venv");
}
