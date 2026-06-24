import ora, { type Ora } from "ora";
import type { RankingResult } from "../types";

const dim = (s: string) => `\x1b[2m${s}\x1b[22m`;
const green = (s: string) => `\x1b[32m${s}\x1b[39m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[39m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[39m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[22m`;

class Tui {
  private spinner: Ora | null = null;
  private stepName: string = "";
  private rankings: RankingResult[] = [];

  private bar = dim("\u2502");

  startStep(name: string) {
    if (this.spinner) {
      this.spinner.succeed(green(this.stepName));
      this.spinner = null;
    }
    this.stepName = name;
    this.spinner = ora({
      text: bold(cyan(name)),
    }).start();
  }

  log(msg: string) {
    if (this.spinner) {
      this.spinner.text = `${this.bar} ${dim(msg)}`;
    }
  }

  raw(msg: string) {
    if (this.spinner) {
      this.spinner.clear();
      console.log(`  ${this.bar} ${dim(msg)}`);
      this.spinner.render();
    } else {
      console.log(`  ${dim(msg)}`);
    }
  }

  warn(msg: string) {
    if (this.spinner) {
      this.spinner.clear();
      console.log(`  ${this.bar} ${yellow("!")} ${msg}`);
      this.spinner.render();
    } else {
      console.log(`  ${yellow("!")} ${msg}`);
    }
  }

  setRankings(rankings: RankingResult[]) {
    this.rankings = rankings;
  }

  succeed(msg?: string) {
    if (this.spinner) {
      this.spinner.succeed(msg ? green(msg) : green(this.stepName));
      this.spinner = null;
    }
  }

  fail(msg?: string) {
    if (this.spinner) {
      this.spinner.fail(msg ? yellow(msg) : yellow(this.stepName));
      this.spinner = null;
    }
  }

  info(msg: string) {
    if (this.spinner) {
      const prev = this.spinner.text;
      this.spinner.text = `${this.bar} ${dim(msg)}`;
      setTimeout(() => {
        if (this.spinner) this.spinner.text = prev;
      }, 100);
    }
  }

  done(videoDir?: string, clipCount?: number) {
    if (this.spinner) {
      this.spinner.succeed(green(this.stepName));
      this.spinner = null;
    }
    console.log();
    if (videoDir) {
      console.log(`  ${green("\u2713")} Output: ${cyan(videoDir)}`);
    }
    if (clipCount) {
      console.log(`  ${green("\u2713")} ${clipCount} clip${clipCount > 1 ? "s" : ""} created`);
    }
    console.log(`  ${green("\u2713")} Done`);
    console.log();
  }

  showRankings() {
    if (this.rankings.length === 0) return;
    console.log();
    for (const r of this.rankings.slice(0, 5)) {
      const stars = "\u2605".repeat(Math.min(Math.round(r.score / 2), 5));
      const empty = "\u2606".repeat(Math.max(5 - Math.round(r.score / 2), 0));
      console.log(`  ${dim(`${r.start}s-${r.end}s`)} ${yellow(stars)}${dim(empty)} ${dim(`${r.score}/10`)}`);
      console.log(`  ${dim(r.title.slice(0, 60))}`);
      console.log();
    }
  }

  error(msg: string) {
    if (this.spinner) {
      this.spinner.fail(yellow(this.stepName));
      this.spinner = null;
    }
    console.error(`  ${yellow("!")} ${msg}`);
  }
}

export const tui = new Tui();
