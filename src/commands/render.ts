import type { SkateConfig } from "../types";
import { getCacheDir } from "../config";

export async function renderCommand(args: string[], config: SkateConfig): Promise<void> {
  if (args.length === 0) {
    console.error("Usage: skate render <file>");
    process.exit(1);
  }

  const source = args[0];
  const cacheDir = getCacheDir(config);
  const baseName = source.replace(/\.\w+$/, "").replace(/[/\\:]/g, "_");
  const cacheFile = `${cacheDir}/${baseName}-analysis.json`;

  const file = Bun.file(cacheFile);
  const exists = await file.exists();
  if (!exists) {
    console.error(`No cached analysis found for ${source}`);
    console.error(`Expected: ${cacheFile}`);
    process.exit(1);
  }

  console.log(` Skate — Rendering from cached analysis\n`);

  const data = await file.json();
  console.log(`   Loaded analysis for: ${data.sourceFile || source}`);
  console.log(`   Duration: ${data.duration || "?"}s`);
  console.log(`   Clips to render: ${data.selected?.length || 0}`);
}
