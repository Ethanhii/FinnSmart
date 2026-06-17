/** Per-task timing entry (SERP or Kimi call). */
export interface TimedTask {
  label: string;
  ms: number;
}

/** Wall-clock breakdown returned when FINNSMART_PROFILE=true. */
export interface PipelineProfile {
  totalMs: number;
  phases: {
    /** Bright Data SERPs + Yahoo direct news (parallel batch). */
    researchMs: number;
    /** Kimi evaluateEntity calls (parallel batch). */
    entityEvalMs: number;
    /** Kimi buildVerdict (single call). */
    verdictMs: number;
  };
  research: {
    serpWallMs: number;
    yahooMs: number;
    serpCallCount: number;
    slowestSerp: TimedTask[];
  };
  entityEval: {
    callCount: number;
    slowestKimi: TimedTask[];
  };
  verdictMs: number;
}

const SLOWEST_TOP = 8;

export class PipelineProfiler {
  private serpTasks: TimedTask[] = [];
  private kimiTasks: TimedTask[] = [];
  private serpWallMs = 0;
  private yahooMs = 0;
  private verdictMs = 0;

  recordSerp(label: string, ms: number): void {
    this.serpTasks.push({ label, ms: Math.round(ms) });
  }

  recordKimi(label: string, ms: number): void {
    this.kimiTasks.push({ label, ms: Math.round(ms) });
  }

  setSerpWall(ms: number): void {
    this.serpWallMs = Math.round(ms);
  }

  setYahoo(ms: number): void {
    this.yahooMs = Math.round(ms);
  }

  setVerdict(ms: number): void {
    this.verdictMs = Math.round(ms);
  }

  private topSlowest(tasks: TimedTask[]): TimedTask[] {
    return [...tasks].sort((a, b) => b.ms - a.ms).slice(0, SLOWEST_TOP);
  }

  finalize(
    ticker: string,
    phases: PipelineProfile["phases"]
  ): PipelineProfile {
    const profile: PipelineProfile = {
      totalMs: phases.researchMs + phases.entityEvalMs + phases.verdictMs,
      phases,
      research: {
        serpWallMs: this.serpWallMs,
        yahooMs: this.yahooMs,
        serpCallCount: this.serpTasks.length,
        slowestSerp: this.topSlowest(this.serpTasks),
      },
      entityEval: {
        callCount: this.kimiTasks.length,
        slowestKimi: this.topSlowest(this.kimiTasks),
      },
      verdictMs: this.verdictMs,
    };

    this.logToConsole(ticker, profile);
    return profile;
  }

  private logToConsole(ticker: string, p: PipelineProfile): void {
    const bar = "─".repeat(52);
    console.log(`\n[FinnSmart profile] ${ticker} — ${p.totalMs}ms total`);
    console.log(bar);
    console.log(
      `  Research (SERP+Yahoo)  ${p.phases.researchMs}ms  (${p.research.serpCallCount} SERP calls, Yahoo ${p.research.yahooMs}ms)`
    );
    console.log(`  Entity eval (Kimi)    ${p.phases.entityEvalMs}ms  (${p.entityEval.callCount} calls)`);
    console.log(`  Verdict (Kimi)       ${p.phases.verdictMs}ms`);
    console.log(bar);

    if (p.research.slowestSerp.length > 0) {
      console.log("  Slowest SERP calls:");
      for (const t of p.research.slowestSerp) {
        console.log(`    ${String(t.ms).padStart(6)}ms  ${t.label}`);
      }
    }
    if (p.entityEval.slowestKimi.length > 0) {
      console.log("  Slowest Kimi entity evals:");
      for (const t of p.entityEval.slowestKimi) {
        console.log(`    ${String(t.ms).padStart(6)}ms  ${t.label}`);
      }
    }
    console.log("");
  }
}

export function createProfiler(enabled: boolean): PipelineProfiler | null {
  return enabled ? new PipelineProfiler() : null;
}
