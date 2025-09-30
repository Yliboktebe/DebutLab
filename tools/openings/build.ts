#!/usr/bin/env tsx
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { applyMoves } from "./chess.js";
import { generateBranches } from "./generator.js";
import { writeUiFile } from "./writer.js";
import { RootConfig, NoopReporter, TailExtendConfig } from "./types.js";
import { ConsoleReporter } from "./reporter.js";

const CFG = resolve("content/openings.config.json");
const OUT = resolve("content/trees");
const only = process.argv.includes("--only")
  ? process.argv[process.argv.indexOf("--only") + 1]
  : undefined;

// very light CLI flags:
//   --progress=quiet|normal|verbose
//   --no-errors  (сворачивать ошибки; по умолчанию ошибки свёрнуты)
//   --json-progress=path/to/file.json
//   --white-single-best (принудительно selection.whiteSingleBest=true)
//   --milestones=castle (включает milestones.enable=true)
function parseFlags(argv: string[]) {
  const flags = { 
    progress: "normal" as "quiet"|"normal"|"verbose", 
    showErrors: false, 
    jsonPath: undefined as string|undefined,
    whiteSingleBest: false,
    milestones: undefined as string|undefined
  };
  for (const a of argv) {
    if (a.startsWith("--progress=")) flags.progress = a.split("=")[1] as any;
    else if (a === "--no-errors") flags.showErrors = false;
    else if (a === "--show-errors") flags.showErrors = true;
    else if (a.startsWith("--json-progress=")) flags.jsonPath = a.split("=")[1];
    else if (a === "--white-single-best") flags.whiteSingleBest = true;
    else if (a.startsWith("--milestones=")) flags.milestones = a.split("=")[1];
  }
  return flags;
}
const flags = parseFlags(process.argv.slice(2));

// helper: глобальные дефолты + локальные оверрайды
function resolveTailConfig(globalTail?: TailExtendConfig, openingTail?: Partial<TailExtendConfig>): TailExtendConfig | undefined {
  const base: TailExtendConfig = globalTail ?? {
    enable: false,
    minBranchPly: 0,
    minGames: 0,
    topN: 1,
    maxCpDrop: 120,
    avoidRevisitFenWindow: 8
  };
  if (!openingTail) return base;
  return { ...base, ...openingTail };
}

async function main() {
  const cfg = JSON.parse(await readFile(CFG, "utf8")) as RootConfig;
  
  // Обработчик SIGINT для красивого завершения
  process.on("SIGINT", () => {
    try {
      // Попытаемся завершить текущий репортёр если он есть
      if ((global as any).currentReporter?.onFinish && (global as any).currentReporter?.snapshot) {
        (global as any).currentReporter.onFinish((global as any).currentReporter.snapshot());
      }
    } finally {
      process.exit(130);
    }
  });
  
  for (const op of cfg.openings) {
    if (only && op.id !== only) continue;

    const seedFen = op.seed.startFen === "startpos"
      ? applyMoves("startpos", op.seed.ucis)
      : applyMoves(op.seed.startFen, op.seed.ucis);

    // ...после вычисления seedFen и перед вызовом generateBranches:
    if (op.id === "central" && op.coach?.enabled) {
      op.coach.our ??= {};
      op.coach.our.preferByFen ??= {};

      // Ствол: e4 e5 d4 ...e5d4 3.Qxd4 ...Nc6 4.Qe3
      const fenAfterExd4 = applyMoves(seedFen, ["e5d4"]);
      const fenAfterQxd4 = applyMoves(fenAfterExd4, ["d1d4"]);
      const fenAfterNc6  = applyMoves(fenAfterQxd4, ["b8c6"]);
      const fenAfterQe3  = applyMoves(fenAfterNc6,  ["d4e3"]);

      // Карты единых реакций белых на популярные ответы чёрных ПОСЛЕ Qe3:
      const preferMap: Array<[string, string]> = [
        ["g8f6", "b1c3"], // ...Nf6 → Nc3
        ["f8b4", "c1d2"], // ...Bb4 → Bd2
        ["d7d6", "b1c3"], // ...d6  → Nc3   (спокойная схема)
        ["b7b6", "e3g3"], // ...b6  → Qg3   (нажим по g7)
        ["d8f6", "e3f3"], // ...Qf6 → Qf3   (intermezzo)
        ["f8c5", "b1c3"]  // ...Bc5 → Nc3   (выбери единый стиль)
      ];

      for (const [oppUci, ourUci] of preferMap) {
        const fenAfterOpp = applyMoves(fenAfterQe3, [oppUci]);
        op.coach.our.preferByFen[`afterFen:${fenAfterOpp}`] = [ourUci];
      }

      // Также закрепим обязательные ходы до Qe3:
      // после ...exd4 → Qxd4
      op.coach.our.preferByFen[`afterFen:${fenAfterExd4}`] = ["d1d4"];
      // после ...Nc6   → Qe3
      op.coach.our.preferByFen[`afterFen:${fenAfterNc6}`]  = ["d4e3"];
    }

    const reporter =
      flags.progress === "quiet"
        ? NoopReporter
        : new ConsoleReporter({
            openingId: op.id,
            mode: flags.progress as any,
            showErrors: flags.showErrors,
            jsonProgressPath: flags.jsonPath
          });
    
    // Сохраняем репортёр для обработчика SIGINT
    (global as any).currentReporter = reporter;

    // Применяем CLI флаги к конфигурации
    const openingConfig = { ...op };
    if (flags.whiteSingleBest) {
      openingConfig.selection = {
        ...openingConfig.selection,
        whiteSingleBest: true
      };
    }
    if (flags.milestones) {
      openingConfig.milestones = {
        ...openingConfig.milestones,
        enable: true,
        order: flags.milestones === "castle" ? ["castle"] : ["castle", "develop_minors"]
      };
    }

    const branches = await generateBranches({
      g: cfg.global,
      side: op.side,
      openingId: op.id,
      seedFen,
      seedPath: op.seed.ucis,
      rootBuckets: op.buckets,
      openingBucketsStrict: op.bucketsStrict ?? false,
      repertoire: op.repertoire,
      coach: op.coach, // <— добавлено
      reporter,
      tail: resolveTailConfig(cfg.global.tail, op.tail),
      opening: openingConfig
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
