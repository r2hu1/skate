import { watch } from "fs";
import { extname } from "path";
import type { SkateConfig } from "../types";
import { clipCommand } from "./clip";

const VIDEO_EXTENSIONS = new Set([".mp4", ".webm", ".mov", ".mkv", ".avi", ".m4v"]);

export async function watchCommand(args: string[], config: SkateConfig): Promise<void> {
  if (args.length === 0) {
    console.error("Usage: skate watch <directory>");
    process.exit(1);
  }
  const directory = args[0];
  console.log(`  Watching ${directory} for new video files...`);

  const seen = new Set<string>();

  watch(directory, (_eventType: string, rawFilename: string | null) => {
    const filename = rawFilename;
    if (!filename) return;
    const ext = extname(filename).toLowerCase();
    if (!VIDEO_EXTENSIONS.has(ext)) return;
    if (seen.has(filename)) return;
    seen.add(filename);

    const fullPath = `${directory}/${filename}`;
    console.log(`\n  New video detected: ${filename}`);
    clipCommand([fullPath], config).catch((err: Error) => {
      console.error(`  Failed to process ${filename}: ${err.message}`);
    });
  });

  await new Promise(() => {});
}
