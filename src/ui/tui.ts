import ora, { type Ora } from "ora";
import type { RankingResult } from "../types";

class Tui {
  private spinner: Ora | null = null;
  private completedSteps: string[] = [];
  private rankings: RankingResult[] = [];

  startStep(step: string) {
    if (this.spinner) {
      this.spinner.succeed();
    }
    this.completedSteps.push(step);
    this.spinner = ora(step).start();
  }

  log(msg: string) {
    if (this.spinner) {
      this.spinner.text = msg;
    }
  }

  setRankings(rankings: RankingResult[]) {
    this.rankings = rankings;
  }

  succeed(msg?: string) {
    if (this.spinner) {
      this.spinner.succeed(msg);
      this.spinner = null;
    }
  }

  fail(msg?: string) {
    if (this.spinner) {
      this.spinner.fail(msg);
      this.spinner = null;
    }
  }

  done(outputDir?: string) {
    if (this.spinner) {
      this.spinner.succeed();
      this.spinner = null;
    }
    if (outputDir) {
      console.log(`\n Output: ${outputDir}/`);
    }
    console.log("\n Done!");
  }

  error(msg: string) {
    if (this.spinner) {
      this.spinner.fail(msg);
      this.spinner = null;
    }
    console.error(`\n Error: ${msg}`);
  }
}

export const tui = new Tui();
