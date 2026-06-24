import { homedir } from "os";
import { join } from "path";
import { existsSync } from "fs";
import ora from "ora";

const VENV_DIR = join(homedir(), ".skate", "venv");
const VENV_PYTHON = join(VENV_DIR, "bin", "python3");
const REQUIREMENTS = join(import.meta.dir, "..", "..", "scripts", "requirements.txt");

export async function checkPythonVenv(): Promise<boolean> {
  return existsSync(VENV_PYTHON);
}

export async function setupCommand(): Promise<void> {
  console.log("  Setting up Python environment\n");

  const skateDir = join(homedir(), ".skate");
  if (!existsSync(skateDir)) {
    Bun.spawnSync(["mkdir", "-p", skateDir]);
  }

  if (existsSync(VENV_DIR)) {
    const clean = ora("Removing old venv...").start();
    Bun.spawnSync(["rm", "-rf", VENV_DIR]);
    clean.succeed("Removed old venv");
  }

  const create = ora("Creating Python virtual environment...").start();
  const createProc = Bun.spawnSync(["python3", "-m", "venv", VENV_DIR], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (createProc.exitCode !== 0) {
    create.fail("Failed to create venv");
    throw new Error(createProc.stderr.toString());
  }
  create.succeed("Virtual environment created");

  const install = ora("Installing faster-whisper, opencv, numpy...").start();
  const pipProc = Bun.spawnSync([VENV_PYTHON, "-m", "pip", "install", "-r", REQUIREMENTS], {
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 600000,
  });
  if (pipProc.exitCode !== 0) {
    install.fail("Installation failed");
    throw new Error(pipProc.stderr.toString());
  }
  install.succeed("Dependencies installed");

  console.log("\n  Python environment ready at ~/.skate/venv\n");
}
