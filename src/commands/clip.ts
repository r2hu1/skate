import type { SkateConfig } from "../types";
import { runPipeline } from "../core/pipeline";

export async function clipCommand(args: string[], config: SkateConfig, isUrl = false): Promise<void> {
  if (args.length === 0) {
    console.error("Usage: skate clip <file>");
    process.exit(1);
  }

  const source = args[0];

  if (isUrl && !source.startsWith("http")) {
    console.error("YouTube URL must start with http(s)://");
    process.exit(1);
  }

  if (!isUrl) {
    const file = Bun.file(source);
    const exists = await file.exists();
    if (!exists) {
      console.error(`File not found: ${source}`);
      process.exit(1);
    }
  }

  console.log(` Skate — Processing ${isUrl ? "YouTube URL" : "video file"}`);
  console.log(`   Source: ${source}`);
  console.log();

  await runPipeline({
    source,
    isUrl,
    config,
    outputDir: config.outputDir,
  });

  console.log("\n Done! Check the output directory for results.");
}
