import { applyMoves } from "./chess.js";
import { explorerQuery, cloudEvalQuery } from "./lichess.js";
import { pickByCoverage, engineIntersect } from "./filters.js";
import { ExplorerResponse, UiBranch, GlobalParams } from "./types.js";

interface Ctx {
  g: GlobalParams;
  seedFen: string;
  seedPath: string[]; // UCI уже сыгранных до стартовой позиции
}

export async function generateBranches(ctx: Ctx): Promise<UiBranch[]> {
  const branches: UiBranch[] = [];
  // DFS от корня: каждый путь (seedPath + ход1 + ход2 + ...) => одна ветка (ucis[])
  await dfs(ctx, ctx.seedFen, 0, [], branches);
  return branches;
}

async function dfs(ctx: Ctx, fen: string, ply: number, path: string[], out: UiBranch[]) {
  if (ply >= ctx.g.maxPlies) {
    out.push(mkBranch(ctx, path));
    return;
  }

  const data = await explorerQuery({
    fen, speeds: ctx.g.speeds, ratings: ctx.g.ratings, since: ctx.g.since, until: ctx.g.until,
  });

  if (!data.moves?.length) {
    out.push(mkBranch(ctx, path));
    return;
  }

  const minGames = ctx.g.minGamesByDepth[Math.min(ply, ctx.g.minGamesByDepth.length-1)] ?? 10;
  const topN     = ctx.g.topNByDepth[Math.min(ply, ctx.g.topNByDepth.length-1)] ?? 2;

  let candidates = pickByCoverage(data.moves, ctx.g.coverage, minGames, topN);

  // Optional: Cloud Eval пересечение с топ-N
  if (ctx.g.engine?.useCloud) {
    const ce = await cloudEvalQuery(fen, ctx.g.engine.multiPv);
    if (ce?.pvs?.length) {
      const topUcIs = ce.pvs.slice(0, ctx.g.engine.topN)
        .flatMap(pv => pv.moves.split(" ").filter(Boolean)) // это последовательность из многих ходов
        .slice(0, ctx.g.engine.topN); // возьмём первые ходы из PVs
      candidates = engineIntersect(candidates, topUcIs);
      // (опционально: оценочный фильтр по cpDrop — требуются сопоставления UCI->cp из первой полуходной PV)
    }
  }

  // Если после фильтра нечего развивать — закрываем ветку
  if (!candidates.length) {
    out.push(mkBranch(ctx, path));
    return;
  }

  // Углубляемся по каждому кандидату
  for (const mv of candidates) {
    try {
      const nextFen = applyMoves(fen, [mv.uci]);
      await dfs(ctx, nextFen, ply + 1, [...path, mv.uci], out);
    } catch (error) {
      console.warn(`Skipping invalid move ${mv.uci} at ply ${ply}: ${error}`);
      // Продолжаем с другими ходами
    }
  }
}

function mkBranch(ctx: Ctx, path: string[]): UiBranch {
  return {
    id: `${Date.now().toString(36)}-${path.length.toString(36)}`,
    startFen: ctx.seedFen === "startpos" && ctx.seedPath.length === 0 ? "startpos" : ctx.seedFen,
    ucis: [...ctx.seedPath, ...path],
  };
}
