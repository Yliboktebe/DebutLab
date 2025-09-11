import { applyMoves } from "./chess.js";
import { explorerQuery, cloudEvalQuery } from "./lichess.js";
import { isBigBlunderCp, pickByCoverage, engineIntersect, applyMotifGuard } from "./filters.js";
import { dedupeByPrefix, isTabiyaStop } from "./post.js";
import { branchId } from "./id.js";
import {
  ExplorerMove,
  ExplorerResponse,
  UiBranch,
  GlobalParams,
  FamilyBucket,
  RepertoirePrefs,
  CoachMode,
  Reporter,
  NoopReporter,
  TailExtendConfig
} from "./types.js";

type OpeningTrail = { name?: string; eco?: string; fens: string[] };

// Мягкий отбор "хвостовых" ходов: по частоте + topN.
function pickTailCandidates(allMoves: ExplorerMove[], tail: TailExtendConfig): ExplorerMove[] {
  const pool = (allMoves ?? []).filter(m => totalGames(m) >= tail.minGames);
  // по убыванию частоты
  pool.sort((a, b) => totalGames(b) - totalGames(a));
  return pool.slice(0, Math.max(1, tail.topN));
}

function totalGames(m?: ExplorerMove): number {
  if (!m) return 0;
  const w = m.white ?? 0, b = m.black ?? 0, d = m.draws ?? 0;
  return w + b + d;
}

interface Ctx {
  g: GlobalParams;
  side: "white"|"black";
  openingId: string;
  seedFen: string;
  seedPath: string[];
  rootBuckets?: FamilyBucket[];
  openingBucketsStrict?: boolean;
  repertoire?: RepertoirePrefs;
  coach?: CoachMode; // <— новое
  reporter?: Reporter;
  tail?: TailExtendConfig;
}

export async function generateBranches(ctx: Ctx): Promise<UiBranch[]> {
  const reporter: Reporter = ctx.reporter ?? NoopReporter;
  reporter.onStart?.(ctx.openingId);
  const out: UiBranch[] = [];
  try {
    await dfs(ctx, ctx.seedFen, 0, [], out, { fens: [] });
  } finally {
    reporter.onFinish?.(reporter.snapshot?.()!);
  }
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
  ctx.reporter?.onNode?.(ply, fen);
  
  // регистрируем текущий FEN в истории
  trail.fens.push(fen);
  
  if (ply >= ctx.g.maxPlies) {
    out.push(mkBranch(ctx, path, trail));
    ctx.reporter?.onBranch?.(path, ply);
    return;
  }

  ctx.reporter?.onHttp?.("explorer", fen);
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
    ctx.reporter?.onBranch?.(path, ply);
    return;
  }

  const minGames = ctx.g.minGamesByDepth[Math.min(ply, ctx.g.minGamesByDepth.length - 1)] ?? 10;
  const topN = ctx.g.topNByDepth[Math.min(ply, ctx.g.topNByDepth.length - 1)] ?? 2;

  // кандидаты: либо корзинами на корне, либо обычным отбором
  let candidates: ExplorerMove[];
  const isRoot = ply === 0 && ctx.rootBuckets?.length;
  if (isRoot) {
    const cov = ctx.openingBucketsStrict ? 0 : ctx.g.coverage; // ← строго: без добора
    candidates = pickByBucketsAtRoot(data.moves, ctx.rootBuckets!, cov, minGames);
  } else {
    candidates = pickByCoverage(data.moves, ctx.g.coverage, minGames, topN);
  }

  // --- TAIL EXTEND: если ходы закончились, а нужной длины ещё нет --- //
  const tail = ctx.tail ?? { enable: false } as TailExtendConfig;
  if ((candidates == null || candidates.length === 0) && tail.enable && ply < tail.minBranchPly) {
    // Берём мягкие хвостовые кандидаты
    const tailMoves = pickTailCandidates(data.moves as any, tail);
    candidates = tailMoves;
  }

  const sideToMove = fen.split(" ")[1] === "w" ? "white" : "black";
  const weMove = sideToMove === (ctx.coach?.enabled ? ctx.coach.side : ctx.side);

  if (ctx.coach?.enabled) {
    if (weMove) {
      // === НАШ ХОД: выбрать РОВНО ОДИН ===
      const picked = await pickOurSingleMove(ctx, fen, ply, data.moves);
      if (!picked) {
        // fallback: если вообще ничего — закрываем ветку
        out.push(mkBranch(ctx, path, trail));
        ctx.reporter?.onBranch?.(path, ply);
        return;
      }
      try {
        const nextFen = applyMoves(fen, [picked.uci]);
        
        // Проверка на циклы
        const tailCfg = ctx.tail ?? { enable: false } as TailExtendConfig;
        const recent = tailCfg.avoidRevisitFenWindow && trail.fens.length
          ? trail.fens.slice(-tailCfg.avoidRevisitFenWindow)
          : [];
        if (recent.includes(nextFen)) {
          // пропускаем ход, чтобы не зациклиться
          out.push(mkBranch(ctx, path, trail));
          ctx.reporter?.onBranch?.(path, ply);
          return;
        }
        
        const stopByTabiya = isTabiyaStop(nextFen, ctx.g.post?.tabiya);
        if (stopByTabiya) {
          out.push(mkBranch(ctx, [...path, picked.uci], trail));
          ctx.reporter?.onBranch?.([...path, picked.uci], ply + 1);
        } else {
          await dfs(ctx, nextFen, ply + 1, [...path, picked.uci], out, trail);
        }
      } catch (error) {
        ctx.reporter?.onInvalidMove?.(picked.uci, ply, error instanceof Error ? error.message : String(error));
        out.push(mkBranch(ctx, path, trail));
        ctx.reporter?.onBranch?.(path, ply);
      }
      return; // ВАЖНО: у нас только один ход — выходим
    } else {
      // === ХОД СОПЕРНИКА: несколько по покрытию + ловушки ===
      candidates = await pickOpponentResponses(ctx, fen, ply, data.moves);
      if (!candidates.length) {
        out.push(mkBranch(ctx, path, trail));
        ctx.reporter?.onBranch?.(path, ply);
        return;
      }
      // спускаемся по каждому ответу соперника
      for (const mv of candidates) {
        try {
          const nextFen = applyMoves(fen, [mv.uci]);
          
          // Проверка на циклы
          const tailCfg = ctx.tail ?? { enable: false } as TailExtendConfig;
          const recent = tailCfg.avoidRevisitFenWindow && trail.fens.length
            ? trail.fens.slice(-tailCfg.avoidRevisitFenWindow)
            : [];
          if (recent.includes(nextFen)) {
            // пропускаем ход, чтобы не зациклиться
            continue;
          }
          
          const stopByTabiya = isTabiyaStop(nextFen, ctx.g.post?.tabiya);
          if (stopByTabiya) {
            out.push(mkBranch(ctx, [...path, mv.uci], trail));
            ctx.reporter?.onBranch?.([...path, mv.uci], ply + 1);
          } else {
            await dfs(ctx, nextFen, ply + 1, [...path, mv.uci], out, trail);
          }
        } catch (error) {
          ctx.reporter?.onInvalidMove?.(mv.uci, ply, error instanceof Error ? error.message : String(error));
          // Продолжаем с другими ходами
        }
      }
      return;
    }
  }
  // === если coach не включён — старая логика ниже ===

  // пересечение с CloudEval: только первые ходы PV
  if (ctx.g.engine?.useCloud) {
    ctx.reporter?.onHttp?.("cloud", fen);
    const ce = await cloudEvalQuery(fen, ctx.g.engine.multiPv);
    if (ce?.pvs?.length) {
      const firstMovesUci = ce.pvs
        .slice(0, ctx.g.engine.topN)
        .map(pv => pv.moves.split(" ").filter(Boolean)[0])
        .filter(Boolean);
      const beforeCount = candidates.length;
      candidates = engineIntersect(candidates, firstMovesUci);
      if (candidates.length < beforeCount) {
        ctx.reporter?.onFiltered?.("engine");
      }
    }
  }

  // репертуарный whitelist для нашей стороны
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

      // Проверка на циклы
      const tailCfg = ctx.tail ?? { enable: false } as TailExtendConfig;
      const recent = tailCfg.avoidRevisitFenWindow && trail.fens.length
        ? trail.fens.slice(-tailCfg.avoidRevisitFenWindow)
        : [];
      if (recent.includes(nextFen)) {
        // пропускаем ход, чтобы не зациклиться
        continue;
      }

      // табия-стоп (после хода)
      const stopByTabiya = isTabiyaStop(nextFen, ctx.g.post?.tabiya);
      if (stopByTabiya) {
        out.push(mkBranch(ctx, [...path, mv.uci], trail));
        ctx.reporter?.onBranch?.([...path, mv.uci], ply + 1);
        continue;
      }

      await dfs(ctx, nextFen, ply + 1, [...path, mv.uci], out, trail);
    } catch (error) {
      ctx.reporter?.onInvalidMove?.(mv.uci, ply, error instanceof Error ? error.message : String(error));
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
  const ucis = [...ctx.seedPath, ...path];
  return {
    id: branchId(ctx.seedFen, ucis),
    startFen: ctx.seedFen === "startpos" && ctx.seedPath.length === 0 ? "startpos" : ctx.seedFen,
    ucis,
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

async function pickOurSingleMove(
  ctx: Ctx,
  fen: string,
  ply: number,
  moves: ExplorerMove[]
): Promise<ExplorerMove | null> {
  // 1) motif guard для «наших» ходов (в ранней фазе)
  let candidates = moves;
  if (ctx.g.post?.moveGuards) {
    const gb = ctx.g.post.moveGuards;
    candidates = applyMotifGuard(
      candidates,
      ply,
      gb.bannedUcIs ?? ["h2h4","a2a4","h7h5","a7a5"],
      gb.bannedBeforePly ?? 6
    );
  }
  if (!candidates.length) return null;

  // 2) try preferByFen
  const key = `afterFen:${fen}`;
  const preferList = ctx.coach?.our?.preferByFen?.[key];
  const byUci = new Map(candidates.map(m => [m.uci, m]));
  const tryPrefer = () => {
    if (!preferList) return null;
    for (const u of preferList) {
      const hit = byUci.get(u);
      if (hit) return hit;
    }
    return null;
  };

  // 3) try engine best (CloudEval first move)
  const tryEngine = async () => {
    if (!ctx.g.engine?.useCloud) return null;
    ctx.reporter?.onHttp?.("cloud", fen);
    const ce = await cloudEvalQuery(fen, ctx.g.engine.multiPv);
    if (!ce?.pvs?.length) return null;
    const firstMovesUci = ce.pvs.map(pv => pv.moves.split(" ").filter(Boolean)[0]).filter(Boolean);
    for (const u of firstMovesUci) {
      const hit = byUci.get(u);
      if (hit) return hit;
    }
    return null;
  };

  // 4) try data best (по частоте)
  const tryData = () => {
    const sorted = candidates
      .map(m => ({ m, total: m.white + m.draws + m.black }))
      .sort((a, b) => b.total - a.total);
    return sorted[0]?.m ?? null;
  };

  const order = ctx.coach?.our?.priority ?? "prefer>engine>data";
  if (order === "prefer>engine>data") {
    return tryPrefer() ?? (await tryEngine()) ?? tryData();
  }
  if (order === "engine>data>prefer") {
    return (await tryEngine()) ?? tryData() ?? tryPrefer();
  }
  // data>engine>prefer
  return tryData() ?? (await tryEngine()) ?? tryPrefer();
}

async function pickOpponentResponses(
  ctx: Ctx,
  fen: string,
  ply: number,
  moves: ExplorerMove[]
): Promise<ExplorerMove[]> {
  const minGames = ctx.coach?.opp?.minGamesByDepth?.[Math.min(ply, (ctx.coach?.opp?.minGamesByDepth?.length ?? 1) - 1)]
    ?? ctx.g.minGamesByDepth[Math.min(ply, ctx.g.minGamesByDepth.length - 1)]
    ?? 10;

  const topN = ctx.coach?.opp?.topN ?? ctx.g.topNByDepth[Math.min(ply, ctx.g.topNByDepth.length - 1)] ?? 2;
  const coverage = ctx.coach?.opp?.coverage ?? ctx.g.coverage;

  // базовая выборка по покрытию
  let picked = pickByCoverage(moves, coverage, minGames, topN);

  // добавим ловушки (если включены) — кандидаты сверх покрытия
  const traps = ctx.coach?.opp?.traps;
  if (traps?.enable && ctx.g.engine?.useCloud) {
    const threshold = traps.blunderCp ?? 180;
    const minGamesTrap = traps.minGames ?? Math.max(10, Math.floor(minGames * 0.5));

    // найдём «дополнительные» ходы соперника, которые достаточно частотны и сильно хуже по оценке
    const rest = moves
      .map(m => ({ m, total: m.white + m.draws + m.black }))
      .filter(x => x.total >= minGamesTrap && !picked.find(p => p.uci === x.m.uci))
      .sort((a, b) => b.total - a.total);

    for (const x of rest) {
      // оценка позиции после хода соперника (ход следующей стороны — наша)
      const nextFen = applyMoves(fen, [x.m.uci]);
      ctx.reporter?.onHttp?.("cloud", nextFen);
      const ce = await cloudEvalQuery(nextFen, 1);
      const cp = ce?.pvs?.[0]?.cp;
      if (isBigBlunderCp(cp, threshold)) {
        picked.push(x.m); // маркировать как Trap будем в нейминге
        ctx.reporter?.onTrap?.();
      }
    }
  }

  // motif guard против "мусора" соперника в ранней фазе — обычно не нужен, но можно применить мягко
  if (ctx.g.post?.moveGuards) {
    const gb = ctx.g.post.moveGuards;
    picked = applyMotifGuard(picked, ply, gb.bannedUcIs, gb.bannedBeforePly);
  }
  return picked;
}

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