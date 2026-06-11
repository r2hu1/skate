import type { SkateConfig } from "../types";
import { runPipeline } from "../core/pipeline";

export async function analyzeCommand(args: string[], config: SkateConfig): Promise<void> {
  if (args.length === 0) {
    console.error("Usage: skate analyze <file>");
    process.exit(1);
  }

  const source = args[0];
  const file = Bun.file(source);
  const exists = await file.exists();
  if (!exists) {
    console.error(`File not found: ${source}`);
    process.exit(1);
  }

  console.log(` Skate — Analyzing ${source}\n`);

  const result = await runPipeline({
    source,
    isUrl: false,
    config,
    outputDir: config.outputDir,
    skipRender: true,
  });

  console.log("\n Analysis complete. Results would be shown here.");
}
