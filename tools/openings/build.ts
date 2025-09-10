#!/usr/bin/env tsx
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { applyMoves } from "./chess.js";
import { generateBranches } from "./generator.js";
import { writeUiFile } from "./writer.js";
import { RootConfig } from "./types.js";

const CFG = resolve("content/openings.config.json");
const OUT = resolve("content/trees");
const only = process.argv.includes("--only")
  ? process.argv[process.argv.indexOf("--only") + 1]
  : undefined;

async function main() {
  const cfg = JSON.parse(await readFile(CFG, "utf8")) as RootConfig;
  for (const op of cfg.openings) {
    if (only && op.id !== only) continue;

    const seedFen = op.seed.startFen === "startpos"
      ? applyMoves("startpos", op.seed.ucis)
      : applyMoves(op.seed.startFen, op.seed.ucis);

    // Настройка preferByFen для central в coach mode
    if (op.id === "central" && op.coach?.enabled) {
      op.coach.our.preferByFen ??= {};

      // FEN после ...exd4 (ход чёрных на 2-м ходу)
      const fenAfterExd4 = applyMoves(seedFen, ["e5d4"]);
      op.coach.our.preferByFen[`afterFen:${fenAfterExd4}`] = ["d1d4"]; // 3.Qxd4

      // FEN после ...Nc6 (после 3.Qxd4)
      const fenAfterNc6 = applyMoves(fenAfterExd4, ["d1d4","b8c6"]); // белый сходил Qxd4, чёрный Nc6
      op.coach.our.preferByFen[`afterFen:${fenAfterNc6}`] = ["d4e3"]; // 4.Qe3 (Berger)
    }

    const branches = await generateBranches({
      g: cfg.global,
      side: op.side,
      openingId: op.id,
      seedFen,
      seedPath: op.seed.ucis,
      rootBuckets: op.buckets,
      repertoire: op.repertoire,
      coach: op.coach // <— добавлено
    });

    await writeUiFile(OUT, op.id, op.side, branches, cfg.global, {
      speeds: cfg.global.speeds, ratings: cfg.global.ratings,
      since: cfg.global.since, until: cfg.global.until,
      coverage: cfg.global.coverage,
      minGamesByDepth: cfg.global.minGamesByDepth,
      topNByDepth: cfg.global.topNByDepth,
      engine: cfg.global.engine
    });

    console.log(`✅ ${op.id}: веток сгенерировано ${branches.length}`);
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
