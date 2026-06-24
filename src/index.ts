#!/usr/bin/env bun
import { loadConfig } from "./config";
import { renderCommand } from "./commands/render";
import { watchCommand } from "./commands/watch";
import { doctorCommand } from "./commands/doctor";
import { setupCommand } from "./commands/setup";
import { runPipeline } from "./core/pipeline";
import { tui } from "./ui/tui";

function parseFlags(args: string[]): { positional: string[]; crop: boolean } {
  let crop = true;
  const positional: string[] = [];
  for (const arg of args) {
    if (arg === "--crop=false" || arg === "--no-crop") {
      crop = false;
    } else if (arg.startsWith("--crop=")) {
      crop = arg.split("=")[1] !== "false";
    } else {
      positional.push(arg);
    }
  }
  return { positional, crop };
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    showHelp();
    process.exit(0);
  }

  const config = await loadConfig();
  const { positional, crop } = parseFlags(args);
  const command = positional[0];

  try {
    switch (command) {
      case "clip": {
        const source = positional[1];
        if (!source) {
          console.error("Usage: skate clip <file>");
          process.exit(1);
        }
        const file = Bun.file(source);
        if (!(await file.exists())) {
          console.error(`File not found: ${source}`);
          process.exit(1);
        }
        console.log(` Skate — Processing video file`);
        console.log(`   Source: ${source}\n`);
        await runPipeline({
          source,
          isUrl: false,
          config,
          outputDir: config.outputDir,
          crop,
        });
        break;
      }
      case "youtube": {
        const url = positional[1];
        if (!url || !url.startsWith("http")) {
          console.error("YouTube URL must start with http(s)://");
          process.exit(1);
        }
        console.log(`Processing YouTube URL`);
        console.log(`Source: ${url}\n`);
        await runPipeline({
          source: url,
          isUrl: true,
          config,
          outputDir: config.outputDir,
          crop,
        });
        break;
      }
      case "analyze": {
        const source = positional[1];
        if (!source) {
          console.error("Usage: skate analyze <file>");
          process.exit(1);
        }
        const file = Bun.file(source);
        if (!(await file.exists())) {
          console.error(`File not found: ${source}`);
          process.exit(1);
        }
        console.log(`Analyzing ${source}\n`);
        const result = await runPipeline({
          source,
          isUrl: false,
          config,
          outputDir: config.outputDir,
          skipRender: true,
          crop,
        });
        console.log(
          `\n Analysis complete. ${result.selected.length} clips would be rendered.`,
        );
        break;
      }
      case "render":
        await renderCommand(positional.slice(1), config);
        break;
      case "watch":
        await watchCommand(positional.slice(1), config);
        break;
      case "setup":
        await setupCommand();
        break;
      case "doctor":
        await doctorCommand();
        break;
      case "help":
      case "--help":
      case "-h":
        showHelp();
        break;
      default:
        if (command.startsWith("http")) {
          console.log(`Processing YouTube URL`);
          console.log(`Source: ${command}\n`);
          await runPipeline({
            source: command,
            isUrl: true,
            config,
            outputDir: config.outputDir,
            crop,
          });
        } else {
          const file = Bun.file(command);
          if (!(await file.exists())) {
            console.error(`File not found: ${command}`);
            process.exit(1);
          }
          console.log(`Processing video file`);
          console.log(`Source: ${command}\n`);
          await runPipeline({
            source: command,
            isUrl: false,
            config,
            outputDir: config.outputDir,
            crop,
          });
        }
    }
  } catch (err: any) {
    tui.error(err.message || String(err));
    process.exit(1);
  }
}

function showHelp() {
  console.log(`
Skate - AI-Powered YouTube → Shorts CLI

Usage:
  skate <url>                  Auto-detect and process a YouTube URL
  skate clip <file>            Process a local video file
  skate youtube <url>          Download and process a YouTube video
  skate analyze <file>         Run analysis pipeline only (no render)
  skate render <file>          Render from cached analysis
  skate watch <dir>            Watch directory for new files
  skate setup                  Install Python deps (whisper + opencv)
  skate doctor                 Check system dependencies

Options:
  --help, -h  Show this help message
  --version   Show version
`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
