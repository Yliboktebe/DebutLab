#!/usr/bin/env tsx
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { applyMoves } from "./chess.js";
import { generateBranches } from "./generator.js";
import { writeUiFile } from "./writer.js";
import { RootConfig } from "./types.js";

const CFG = resolve("content/openings.config.test.json");
const OUT = resolve("content/trees");

async function main() {
  const cfg = JSON.parse(await readFile(CFG, "utf8")) as RootConfig;
  for (const op of cfg.openings) {
    const seedFen = op.seed.startFen === "startpos"
      ? applyMoves("startpos", op.seed.ucis)
      : applyMoves(op.seed.startFen, op.seed.ucis);

    const ctx = { g: cfg.global, seedFen, seedPath: op.seed.ucis };
    const branches = await generateBranches(ctx);
    await writeUiFile(OUT, op.id, op.side, branches, cfg.global, {
      speeds: cfg.global.speeds, ratings: cfg.global.ratings, since: cfg.global.since, until: cfg.global.until,
      coverage: cfg.global.coverage, minGamesByDepth: cfg.global.minGamesByDepth, topNByDepth: cfg.global.topNByDepth,
      engine: cfg.global.engine
    });

    console.log(`✅ ${op.id}: веток сгенерировано ${branches.length}`);
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
