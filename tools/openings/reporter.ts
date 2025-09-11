// tools/openings/reporter.ts
import fs from "node:fs";
import { Reporter, ProgressSnapshot, HttpKind } from "./types.js";

export type LogMode = "quiet" | "normal" | "verbose";

export interface ConsoleReporterOptions {
  openingId: string;
  mode: LogMode;               // "normal" default
  showErrors: boolean;         // false => не спамим каждой ошибкой, только счётчики + финальная сводка
  updateIntervalMs: number;    // как часто перерисовывать строку прогресса
  jsonProgressPath?: string;   // если задан — писать снапшоты JSON
}

export class ConsoleReporter implements Reporter {
  private opts: ConsoleReporterOptions;
  private t?: NodeJS.Timeout;
  private stats: ProgressSnapshot;
  private errBuckets = new Map<string, { count: number; sample: string }>();
  private lastRender = 0;

  constructor(opts: Partial<ConsoleReporterOptions>) {
    const openingId = opts.openingId ?? "opening";
    this.opts = {
      openingId,
      mode: opts.mode ?? "normal",
      showErrors: opts.showErrors ?? false,
      updateIntervalMs: opts.updateIntervalMs ?? 300,
      jsonProgressPath: opts.jsonProgressPath
    };
    const now = Date.now();
    this.stats = {
      openingId,
      nodes: 0,
      branches: 0,
      maxDepth: 0,
      explorerRequests: 0,
      cloudRequests: 0,
      trapsAdded: 0,
      filteredByCoverage: 0,
      filteredByEngine: 0,
      skippedInvalidMoves: 0,
      startedAt: now,
      updatedAt: now
    };
  }

  onStart = () => {
    if (this.opts.mode === "quiet") return;
    this.render(true);
    this.t = setInterval(() => this.render(false), this.opts.updateIntervalMs);
  };

  onNode = (ply: number) => {
    this.stats.nodes++;
    if (ply > this.stats.maxDepth) this.stats.maxDepth = ply;
    this.touch();
  };

  onHttp = (kind: HttpKind) => {
    if (kind === "explorer") this.stats.explorerRequests++;
    else this.stats.cloudRequests++;
    this.touch();
  };

  onBranch = () => {
    this.stats.branches++;
    this.touch();
  };

  onTrap = () => {
    this.stats.trapsAdded++;
    this.touch();
  };

  onFiltered = (kind: "coverage" | "engine") => {
    if (kind === "coverage") this.stats.filteredByCoverage++;
    else this.stats.filteredByEngine++;
    this.touch();
  };

  onInvalidMove = (uci: string, ply: number, msg: string) => {
    this.stats.skippedInvalidMoves++;
    const key = `invalid:${uci}:${ply}`;
    const bucket = this.errBuckets.get(key) ?? { count: 0, sample: msg };
    bucket.count += 1;
    this.errBuckets.set(key, bucket);
    if (this.opts.showErrors || this.opts.mode === "verbose") {
      // показать единичную строку, без стека
      process.stdout.write(`\n[warn] Skip invalid move ${uci} @ ply ${ply}: ${msg}\n`);
    }
    this.touch();
  };

  onError = (kind: string, msg: string) => {
    const key = `err:${kind}:${msg.slice(0,80)}`;
    const bucket = this.errBuckets.get(key) ?? { count: 0, sample: msg };
    bucket.count += 1;
    this.errBuckets.set(key, bucket);
    if (this.opts.showErrors || this.opts.mode === "verbose") {
      process.stdout.write(`\n[warn] ${kind}: ${msg}\n`);
    }
    this.touch();
  };

  snapshot = () => ({ ...this.stats });

  onFinish = () => {
    if (this.t) clearInterval(this.t);
    this.render(true, true);
    if (this.opts.mode !== "quiet") {
      const dur = ((Date.now() - this.stats.startedAt) / 1000).toFixed(1);
      process.stdout.write(
        `\n\n=== Build summary: ${this.stats.openingId} ===\n` +
        `Nodes: ${this.stats.nodes}\n` +
        `Branches: ${this.stats.branches}\n` +
        `Max depth (ply): ${this.stats.maxDepth}\n` +
        `Explorer requests: ${this.stats.explorerRequests}\n` +
        `Cloud requests:    ${this.stats.cloudRequests}\n` +
        `Traps added:       ${this.stats.trapsAdded}\n` +
        `Filtered (coverage/engine): ${this.stats.filteredByCoverage}/${this.stats.filteredByEngine}\n` +
        `Skipped invalid moves: ${this.stats.skippedInvalidMoves}\n` +
        `Duration: ${dur}s\n`
      );

      if (this.errBuckets.size && !this.opts.showErrors && this.opts.mode !== "verbose") {
        process.stdout.write(`\nWarnings (collapsed):\n`);
        for (const [k, v] of this.errBuckets) {
          process.stdout.write(`  ${k} — ${v.count}×  ${v.sample}\n`);
        }
      }
    }
  };

  // internals
  private touch() {
    this.stats.updatedAt = Date.now();
    if (this.opts.jsonProgressPath) {
      try { fs.writeFileSync(this.opts.jsonProgressPath, JSON.stringify(this.stats)); } catch {}
    }
  }

  private render(force = false, final = false) {
    if (this.opts.mode === "quiet") return;
    const now = Date.now();
    if (!force && now - this.lastRender < this.opts.updateIntervalMs) return;
    this.lastRender = now;
    const s = this.stats;
    const line =
      `[${s.openingId}] nodes:${s.nodes}  branches:${s.branches}  depth:${s.maxDepth}` +
      `  explorer:${s.explorerRequests}  cloud:${s.cloudRequests}` +
      `  traps:${s.trapsAdded}  skipped:${s.skippedInvalidMoves}`;
    if (process.stdout.isTTY && !final) {
      process.stdout.write("\r" + line + " ".repeat(12));
    } else {
      process.stdout.write("\n" + line + "\n");
    }
  }
}
