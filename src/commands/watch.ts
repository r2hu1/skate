import type { SkateConfig } from "../types";

export async function watchCommand(args: string[], config: SkateConfig): Promise<void> {
  if (args.length === 0) {
    console.error("Usage: skate watch <directory>");
    process.exit(1);
  }

  const dir = args[0];
  const dirFile = Bun.file(dir);
  const exists = await dirFile.exists();
  if (!exists) {
    console.error(`Directory not found: ${dir}`);
    process.exit(1);
  }

  console.log(` Skate — Watching ${dir} for new video files...\n`);
  console.log("   (Watch mode not yet implemented in V0.1)");
}
