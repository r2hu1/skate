#!/usr/bin/env bun
import { loadConfig } from "./config";
import { clipCommand } from "./commands/clip";
import { analyzeCommand } from "./commands/analyze";
import { renderCommand } from "./commands/render";
import { watchCommand } from "./commands/watch";
import { doctorCommand } from "./commands/doctor";

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    showHelp();
    process.exit(0);
  }

  const config = await loadConfig();
  const command = args[0];

  switch (command) {
    case "clip":
      await clipCommand(args.slice(1), config);
      break;
    case "youtube":
      await clipCommand(args.slice(1), config, true);
      break;
    case "analyze":
      await analyzeCommand(args.slice(1), config);
      break;
    case "render":
      await renderCommand(args.slice(1), config);
      break;
    case "watch":
      await watchCommand(args.slice(1), config);
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
        await clipCommand(args, config, true);
      } else {
        await clipCommand(args, config, false);
      }
  }
}

function showHelp() {
  console.log(`
Skate — AI-Powered YouTube → Shorts CLI

Usage:
  skate <url>                  Auto-detect and process a YouTube URL
  skate clip <file>            Process a local video file
  skate youtube <url>          Download and process a YouTube video
  skate analyze <file>         Run analysis pipeline only (no render)
  skate render <file>          Render from cached analysis
  skate watch <dir>            Watch directory for new files
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
