import { homedir } from "os";
import { join } from "path";
import type { SkateConfig, SubtitleStyle } from "./types";

const CONFIG_DIR = join(homedir(), ".skate");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");

const DEFAULT_CONFIG: SkateConfig = {
  model: "llama3.2:3b",
  clips: 10,
  minLength: 20,
  maxLength: 90,
  subtitleStyle: "minimal",
  outputDir: join(process.cwd(), "output"),
  cacheDir: join(CONFIG_DIR, "cache"),
  ollamaUrl: "http://localhost:11434",
};

export function getDefaultConfig(): SkateConfig {
  return { ...DEFAULT_CONFIG };
}

export async function loadConfig(): Promise<SkateConfig> {
  try {
    const file = Bun.file(CONFIG_PATH);
    const exists = await file.exists();
    if (!exists) {
      await saveConfig(DEFAULT_CONFIG);
      return { ...DEFAULT_CONFIG };
    }
    const data = await file.json();
    return { ...DEFAULT_CONFIG, ...data };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function saveConfig(config: SkateConfig): Promise<void> {
  await Bun.write(CONFIG_PATH, JSON.stringify(config, null, 2));
}

export function getConfigDir(): string {
  return CONFIG_DIR;
}

export function getConfigPath(): string {
  return CONFIG_PATH;
}

export function getCacheDir(config?: SkateConfig): string {
  return config?.cacheDir ?? join(CONFIG_DIR, "cache");
}

export function getOutputDir(config?: SkateConfig): string {
  return config?.outputDir ?? join(process.cwd(), "output");
}
