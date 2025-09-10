import { applyMoves } from "./chess.js";
import { explorerQuery, cloudEvalQuery } from "./lichess.js";
import { pickByCoverage, engineIntersect, applyMotifGuard } from "./filters.js";
import { dedupeByPrefix, isTabiyaStop } from "./post.js";
import {
  ExplorerMove,
  ExplorerResponse,
  UiBranch,
  GlobalParams,
  FamilyBucket,
  RepertoirePrefs
} from "./types.js";

type OpeningTrail = { name?: string; eco?: string };

interface Ctx {
  g: GlobalParams;
  side: "white"|"black";
  openingId: string;
  seedFen: string;
  seedPath: string[];
  rootBuckets?: FamilyBucket[];
  repertoire?: RepertoirePrefs;
}

export async function generateBranches(ctx: Ctx): Promise<UiBranch[]> {
  const out: UiBranch[] = [];
  await dfs(ctx, ctx.seedFen, 0, [], out, {});
  const deduped = dedupeByPrefix(out, ctx.g.post?.dedupePrefixLen ?? 12);
  return deduped;
}

async function dfs(
  ctx: Ctx,
  fen: string,
  ply: number,
  path: string[],
  out: UiBranch[],
  trail: OpeningTrail
) {
  if (ply >= ctx.g.maxPlies) {
    out.push(mkBranch(ctx, path, trail));
    return;
  }

  const data = await explorerQuery({
    fen,
    speeds: ctx.g.speeds,
    ratings: ctx.g.ratings,
    since: ctx.g.since,
    until: ctx.g.until
  });

  if (data.opening?.name) trail = { ...trail, name: data.opening.name, eco: data.opening.eco };

  if (!data.moves?.length) {
    out.push(mkBranch(ctx, path, trail));
    return;
  }

  const minGames = ctx.g.minGamesByDepth[Math.min(ply, ctx.g.minGamesByDepth.length - 1)] ?? 10;
  const topN = ctx.g.topNByDepth[Math.min(ply, ctx.g.topNByDepth.length - 1)] ?? 2;

  // кандидаты: либо корзинами на корне, либо обычным отбором
  let candidates: ExplorerMove[];
  const isRoot = ply === 0 && ctx.rootBuckets?.length;
  if (isRoot) {
    candidates = pickByBucketsAtRoot(data.moves, ctx.rootBuckets!, ctx.g.coverage, minGames);
  } else {
    candidates = pickByCoverage(data.moves, ctx.g.coverage, minGames, topN);
  }

  // пересечение с CloudEval: только первые ходы PV
  if (ctx.g.engine?.useCloud) {
    const ce = await cloudEvalQuery(fen, ctx.g.engine.multiPv);
    if (ce?.pvs?.length) {
      const firstMovesUci = ce.pvs
        .slice(0, ctx.g.engine.topN)
        .map(pv => pv.moves.split(" ").filter(Boolean)[0])
        .filter(Boolean);
      candidates = engineIntersect(candidates, firstMovesUci);
    }
  }

  // репертуарный whitelist для нашей стороны
  const sideToMove = fen.split(" ")[1] === "w" ? "white" : "black";
  const weMove = sideToMove === ctx.side;
  if (weMove && ctx.repertoire?.allowedRepliesByFen) {
    const key = `afterFen:${fen}`;
    const allowed = ctx.repertoire.allowedRepliesByFen[key];
    if (allowed?.length) {
      const set = new Set(allowed);
      const wh = candidates.filter(m => set.has(m.uci));
      if (wh.length) candidates = wh;
    }
  }

  // motif guard (ранние h/a толчки), если разрешено конфигом
  if (ctx.g.post?.moveGuards) {
    const gb = ctx.g.post.moveGuards;
    const wl = weMove && ctx.repertoire?.allowedRepliesByFen
      ? new Set(ctx.repertoire.allowedRepliesByFen[`afterFen:${fen}`] ?? [])
      : undefined;
    candidates = applyMotifGuard(
      candidates,
      ply,
      gb.bannedUcIs ?? ["h2h4","a2a4","h7h5","a7a5"],
      gb.bannedBeforePly ?? 6,
      wl
    );
  }

  // если после фильтров нечего — закрываем ветку
  if (!candidates.length) {
    out.push(mkBranch(ctx, path, trail));
    return;
  }

  for (const mv of candidates) {
    try {
      const nextFen = applyMoves(fen, [mv.uci]);

      // табия-стоп (после хода)
      const stopByTabiya = isTabiyaStop(nextFen, ctx.g.post?.tabiya);
      if (stopByTabiya) {
        out.push(mkBranch(ctx, [...path, mv.uci], trail));
        continue;
      }

      await dfs(ctx, nextFen, ply + 1, [...path, mv.uci], out, trail);
    } catch (error) {
      console.warn(`Skipping invalid move ${mv.uci} at ply ${ply}: ${error}`);
      // Продолжаем с другими ходами
    }
  }
}

function pickByBucketsAtRoot(
  moves: ExplorerMove[],
  buckets: FamilyBucket[],
  coverage: number,
  minGames: number
): ExplorerMove[] {
  const enriched = moves
    .map(m => ({ m, total: m.white + m.draws + m.black }))
    .filter(x => x.total >= minGames)
    .sort((a, b) => b.total - a.total);

  const picked: ExplorerMove[] = [];
  let acc = 0;
  const sumAll = enriched.reduce((s, x) => s + x.total, 0) || 1;

  for (const b of buckets) {
    const family = enriched.filter(x => b.matchUcIs.includes(x.m.uci));
    family.sort((a, b) => b.total - a.total);
    let taken = 0;
    for (const f of family) {
      if (taken >= b.max) break;
      if (!picked.find(p => p.uci === f.m.uci)) {
        picked.push(f.m);
        acc += f.total;
        taken++;
      }
    }
  }

  // добор до coverage
  if (acc / sumAll < coverage) {
    for (const x of enriched) {
      if (picked.find(p => p.uci === x.m.uci)) continue;
      picked.push(x.m);
      acc += x.total;
      if (acc / sumAll >= coverage) break;
    }
  }
  return picked;
}

function mkBranch(ctx: Ctx, path: string[], trail: OpeningTrail): UiBranch {
  return {
    id: `${Date.now().toString(36)}-${path.length.toString(36)}`,
    startFen: ctx.seedFen === "startpos" && ctx.seedPath.length === 0 ? "startpos" : ctx.seedFen,
    ucis: [...ctx.seedPath, ...path],
    name: deriveBranchName(ctx, path, trail)
  };
}

function deriveBranchName(ctx: Ctx, path: string[], trail: OpeningTrail): string | undefined {
  const useExp = ctx.g.post?.naming?.useExplorerName;
  const centerLabels = ctx.g.post?.naming?.enableCenterGameLabels && ctx.openingId === "central";
  const parts: string[] = [];

  if (centerLabels) {
    const line = [...ctx.seedPath, ...path].join(" ");
    if (line.includes("e5d4") && line.includes("d1d4")) parts.push("Center Game: Accepted (Qxd4)");
    if (line.includes("e5d4") && line.includes("c2c3")) parts.push("Center Game: Danish Gambit");
    if (line.includes("b8c6") && line.includes("g1f3")) parts.push("Center Game → Scotch structures");
    if (line.includes("d7d5")) parts.push("Center Game: ...d5");
    if (line.includes("d7d6")) parts.push("Center Game: ...d6");
  }

  if (useExp && trail?.name) parts.push(trail.name);
  return parts.length ? parts.join(" — ") : undefined;
}