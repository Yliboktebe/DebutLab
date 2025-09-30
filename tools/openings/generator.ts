// import { applyMoves } from "./chess.js";
import { explorerQuery, cloudEvalQuery } from "./lichess.js";
import { isBigBlunderCp, pickByCoverage, engineIntersect, applyMotifGuard } from "./filters.js";
import { dedupeByPrefix, isTabiyaStop } from "./post.js";
import { branchId } from "./id.js";
import { nextFenAfterUci } from './lib/board.js';
import { parseUci, materializeCastle, normalizeUci } from './lib/uci.js';
import { LichessApi } from './api/lichess.js';
import {
  ExplorerMove,
  // ExplorerResponse,
  UiBranch,
  GlobalParams,
  FamilyBucket,
  RepertoirePrefs,
  CoachMode,
  Reporter,
  NoopReporter,
  TailExtendConfig,
  Milestone,
  MilestoneConfig,
  SelectionPolicy,
  ScenarioConfig,
  GlobalConfig,
  OpeningConfigExtended
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

// === Новые функции для milestones и selection ===

function resolveMilestones(g: GlobalConfig, op?: OpeningConfigExtended): MilestoneConfig {
  const base: MilestoneConfig = {
    enable: false,
    order: ['castle','develop_minors'],
    maxExtraTailPlies: 4,
    relaxAfterMilestone: { minGamesFactor: 0.7, ignoreCoveragePlies: 2 },
    antiCycleWindow: 8,
    minLeafPlies: 30
  };
  const patch = { ...(g.milestones||{}), ...(op?.milestones||{}) };
  return { ...base, ...patch };
}

function resolveSelection(g: GlobalConfig, op?: OpeningConfigExtended): SelectionPolicy {
  const base: SelectionPolicy = {
    whiteSingleBest: false,
    topNBlackByDepth: [],
    traps: { enable:false, budgetByDepth:[], minSharePercent:3, minGames:6, maxCpDrop:120 }
  };
  const patch = { ...(g.selection||{}), ...(op?.selection||{}) };
  const traps = { 
    enable: patch.traps?.enable ?? base.traps!.enable,
    budgetByDepth: patch.traps?.budgetByDepth ?? base.traps!.budgetByDepth,
    minSharePercent: patch.traps?.minSharePercent ?? base.traps!.minSharePercent,
    minGames: patch.traps?.minGames ?? base.traps!.minGames,
    maxCpDrop: patch.traps?.maxCpDrop ?? base.traps!.maxCpDrop
  };
  return { ...base, ...patch, traps };
}

function resolveScenario(g: GlobalConfig, op?: OpeningConfigExtended): ScenarioConfig {
  const base: ScenarioConfig = {
    enable: false,
    forceUciPath: [],
    sidelineMaxPlies: 18
  };
  const patch = { ...(g.scenario||{}), ...(op?.scenario||{}) };
  return { ...base, ...patch };
}

function makeApi(g: GlobalConfig): LichessApi {
  return new LichessApi({
    explorerConcurrency: g.api?.concurrency?.explorer,
    cloudConcurrency:    g.api?.concurrency?.cloudEval,
    retries:             g.api?.retry?.retries,
    baseDelayMs:         g.api?.retry?.baseDelayMs,
    maxDelayMs:          g.api?.retry?.maxDelayMs
  });
}

function sideCastled(fen: string, side: 'w'|'b'): boolean {
  const [board] = fen.split(' ');
  // быстрая проверка: король на g/c и ладья на f/d, но надёжнее дернуть chess.js при желании
  if (side === 'w') return board.includes('K') && (board.includes('R') && (board.indexOf('K') < board.indexOf('R'))); // упрощённо
  return board.includes('k') && (board.includes('r') && (board.indexOf('k') < board.indexOf('r')));
}

function reached(fen: string, m: Milestone): boolean {
  const [board, side, castling] = fen.split(' ');
  switch (m) {
    case 'castle': 
      return castling.indexOf('K') === -1 && castling.indexOf('Q') === -1 && castling.indexOf('k') === -1 && castling.indexOf('q') === -1; // очень грубо: прав на рокировку больше нет
    case 'develop_minors': 
      return !/b1|g1|c1|f1/.test(board) || !/b8|g8|c8|f8/.test(board);
    case 'connect_rooks':
      return !/[BNQ]1/.test(board); // упрощённо: на 1-й линии нет фигур между ладьями
    default: return false;
  }
}

const moveGames = (m: ExplorerMove) => (m.white||0)+(m.black||0)+(m.draws||0);

function rankByFrequency(moves: ExplorerMove[]): ExplorerMove[] {
  return [...moves].sort((a,b) => moveGames(b) - moveGames(a));
}

function pickWhite(ms: ExplorerMove[], whiteSingleBest: boolean) {
  return whiteSingleBest ? rankByFrequency(ms).slice(0,1) : rankByFrequency(ms);
}

function pickBlack(ms: ExplorerMove[], depth: number, sel: SelectionPolicy) {
  const main = rankByFrequency(ms).slice(0, Math.max(1, sel.topNBlackByDepth[depth] ?? 2));
  // ловушки — опционально, если есть CloudEval
  return main; // упрощенно: ловушки уже есть в проекте, не дублируем здесь
}

function pathPrefixOk(played: string[], force: string[]): boolean {
  for (let i=0;i<played.length;i++) if (force[i] && force[i] !== played[i]) return false;
  return true;
}

function forceNextIfNeeded(played: string[], sideToMove: 'w'|'b', moves: ExplorerMove[], scenario: ScenarioConfig) {
  if (!scenario.enable || scenario.forceUciPath.length === 0) return null;
  // если уже ушли с пути — не форсим
  if (!pathPrefixOk(played, scenario.forceUciPath)) return null;
  const nextIdx = played.length;
  const forced = scenario.forceUciPath[nextIdx];
  if (!forced) return null; // путь закончился
  // форсируем только ход ученика (в центральном — белых) и только если он сейчас на ходу
  if (sideToMove !== 'w') return null;
  const hit = moves.find(m => m.uci === forced);
  return hit ? [hit] : null;
}

async function pickTraps(all: ExplorerMove[], depth: number, sel: SelectionPolicy, evalCp?: (uci: string)=>Promise<number|undefined>|undefined): Promise<ExplorerMove[]> {
  const tp = sel.traps;
  if (!tp?.enable) return [];
  const budget = tp.budgetByDepth[depth] ?? 0;
  if (budget <= 0) return [];
  const total = all.reduce((s,m)=>s+moveGames(m),0)||1;
  const cand = all.filter(m => {
    const share = (moveGames(m)/total)*100;
    if (share < tp.minSharePercent) return false;
    if (moveGames(m) < tp.minGames) return false;
    if (!evalCp) return false; // нет оценки — не рискуем
    const cp = evalCp(m.uci);
    return typeof cp === 'number' && cp <= -tp.maxCpDrop; // «их ход» ухудшает их оценку (в нашу пользу)
  });
  return rankByFrequency(cand).slice(0, budget);
}

// основной селектор
async function selectCandidates(
  fen: string,
  depth: number,
  sideToMove: 'w'|'b',
  moves: ExplorerMove[],
  sel: SelectionPolicy,
  evalCp?: (uci: string)=>Promise<number|undefined>|undefined
): Promise<ExplorerMove[]> {
  const ranked = rankByFrequency(moves);
  if (sideToMove === 'w' && sel.whiteSingleBest) {
    return ranked.slice(0,1);
  }
  // black (или white без режима singleBest) — берём topNBlackByDepth
  const topN = sel.topNBlackByDepth[depth] ?? 2;
  const main = ranked.slice(0, Math.max(1, topN));
  const traps = sideToMove === 'b' ? await pickTraps(ranked, depth, sel, evalCp) : [];
  // dedup по uci
  const seen = new Set<string>();
  return [...main, ...traps].filter(m => (seen.has(m.uci) ? false : (seen.add(m.uci), true)));
}

async function softExtendToMilestone(ctx: Ctx, fen: string, depth: number): Promise<string|undefined> {
  const ms = ctx.milestones;
  if (!ms?.enable) return undefined;

  // если уже достигли первой цели — не доклеиваем
  const need = ms.order.find(m => !reached(fen, m));
  if (!need) return undefined;

  try {
    // достаём самый частый ход из explorer
    const data = await explorerQuery({
      fen,
      speeds: ctx.g.speeds,
      ratings: ctx.g.ratings,
      since: ctx.g.since,
      until: ctx.g.until
    });
    const ranked = rankByFrequency(data.moves || []);
    const best = ranked[0];
    if (!best) return undefined;

    const next = nextFenAfterUci(fen, best.uci);
    if (!next.fen) return undefined;

    // возвращаем следующий fen — вызывающая сторона сама добавит его в текущую ветку (без форка)
    return next.fen;
  } catch (error) {
    // Игнорируем ошибки API
    return undefined;
  }
}

async function softExtend(ctx: any, fen: string, pliesDone: number) {
  const { milestones } = ctx;
  if (!milestones.enable) return fen;

  // 1) «дотяни до ближайшей вехи»
  const need = milestones.order.find(m => !reached(fen, m));
  let cur = fen, extra = 0;
  while (need && extra < milestones.maxExtraTailPlies) {
    const data = await ctx.api.explorer({ variant:'standard', fen:cur, speeds:'rapid,classical', ratings:'2000,2200,2500' });
    const best = rankByFrequency(data.moves || [])[0];
    if (!best) break;
    const next = nextFenAfterUci(cur, best.uci);
    if (!next.fen) break;
    cur = next.fen;
    extra++;
    if (reached(cur, need)) break;
  }

  // 2) «дотяни минимум глубины листа»
  const minLeaf = milestones.minLeafPlies;
  while (pliesDone + extra < minLeaf) {
    const data = await ctx.api.explorer({ variant:'standard', fen:cur, speeds:'rapid,classical', ratings:'2000,2200,2500' });
    const best = rankByFrequency(data.moves || [])[0];
    if (!best) break;
    const next = nextFenAfterUci(cur, best.uci);
    if (!next.fen) break;
    cur = next.fen;
    extra++;
  }
  return cur;
}

function leafFenOf(startFen: string, ucis: string[]): string | undefined {
  try {
    const { Chess } = require('chess.js');
    const ch = new Chess(startFen);
    for (const raw of ucis) {
      const u = materializeCastle(normalizeUci(raw), ch.fen());
      const m = parseUci(u);
      if (!m) return undefined;
      const r = ch.move(m);
      if (!r) return undefined;
    }
    return ch.fen();
  } catch { return undefined; }
}

export function postProcessDedupe(startFen: string, branches: UiBranch[]): { pruned: number; result: UiBranch[] } {
  const buckets = new Map<string, UiBranch[]>();
  for (const b of branches) {
    const leaf = leafFenOf(startFen, b.ucis);
    const key = leaf || `__no_fen__:${b.id}`;
    const arr = buckets.get(key) || [];
    arr.push(b);
    buckets.set(key, arr);
  }
  let pruned = 0;
  const result: UiBranch[] = [];
  for (const [, arr] of buckets) {
    if (arr.length === 1) { result.push(arr[0]); continue; }
    // оставляем самую длинную
    arr.sort((a,b) => b.ucis.length - a.ucis.length);
    result.push(arr[0]);
    pruned += (arr.length - 1);
  }
  return { pruned, result };
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
  milestones?: MilestoneConfig;
  selection?: SelectionPolicy;
  scenario?: ScenarioConfig;
  api?: LichessApi;
}

export async function generateBranches(ctxIn: { g: GlobalConfig; side: "white"|"black"; openingId: string; seedFen: string; seedPath: string[]; rootBuckets?: FamilyBucket[]; openingBucketsStrict?: boolean; repertoire?: RepertoirePrefs; coach?: CoachMode; reporter?: Reporter; tail?: TailExtendConfig; opening?: OpeningConfigExtended }): Promise<UiBranch[]> {
  const reporter: Reporter = ctxIn.reporter ?? NoopReporter;
  reporter.onStart?.(ctxIn.openingId);
  
  const milestones = resolveMilestones(ctxIn.g, ctxIn.opening);
  const selection  = resolveSelection(ctxIn.g, ctxIn.opening);
  const scenario   = resolveScenario(ctxIn.g, ctxIn.opening);
  const api        = makeApi(ctxIn.g);

  const ctx: Ctx = {
    g: ctxIn.g,
    side: ctxIn.side,
    openingId: ctxIn.openingId,
    seedFen: ctxIn.seedFen,
    seedPath: ctxIn.seedPath,
    rootBuckets: ctxIn.rootBuckets,
    openingBucketsStrict: ctxIn.openingBucketsStrict,
    repertoire: ctxIn.repertoire,
    coach: ctxIn.coach,
    reporter: ctxIn.reporter,
    tail: ctxIn.tail,
    milestones,
    selection,
    scenario,
    api
  };
  
  const out: UiBranch[] = [];
  try {
    await dfs(ctx, ctx.seedFen, 0, [], out, { fens: [] });
  } finally {
    reporter.onFinish?.(reporter.snapshot?.()!);
  }
  
  // Применяем дедупликацию по leaf-FEN
  const { pruned, result } = postProcessDedupe(ctx.seedFen, out);
  if (pruned > 0) {
    console.info(`Dedupe pruned: ${pruned} branches`);
  }
  
  const deduped = dedupeByPrefix(result, ctx.g.post?.dedupePrefixLen ?? 12);
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
  
  // хранение последних FEN для антициклов
  trail.fens = trail.fens || [];
  const { milestones } = ctx;
  if (milestones?.enable && milestones.antiCycleWindow > 0) {
    const recent = trail.fens.slice(-milestones.antiCycleWindow);
    if (recent.includes(fen)) {
      // просто возвращаемся — без логов/ошибок
      return;
    }
  }
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

  // Ослабление фильтров после вехи
  const firstNeed = ctx.milestones?.enable ? ctx.milestones.order.find(m => !reached(fen, m)) : 'none';
  const afterMilestone = ctx.milestones?.enable && firstNeed !== ctx.milestones.order[0]; // первую веху прошли
  const minGamesBase = ctx.g.minGamesByDepth[Math.min(ply, ctx.g.minGamesByDepth.length - 1)] ?? 10;
  const minGames = afterMilestone
    ? Math.max(3, Math.floor(minGamesBase * (ctx.milestones!.relaxAfterMilestone.minGamesFactor ?? 1)))
    : minGamesBase;
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

  // сценарий: если мы идём по главному пути — форсируем следующий белый ход
  const sideToMove: 'w'|'b' = fen.split(' ')[1] as any;
  const forced = forceNextIfNeeded(path, sideToMove, candidates, ctx.scenario!);
  if (forced) {
    candidates = forced;
  } else if (ctx.selection) {
    // обычный селектор
    candidates = sideToMove === 'w'
      ? pickWhite(candidates, ctx.selection.whiteSingleBest)
      : pickBlack(candidates, ply, ctx.selection);
  }

  // --- TAIL EXTEND: если ходы закончились, а нужной длины ещё нет --- //
  const tail = ctx.tail ?? { enable: false } as TailExtendConfig;
  if ((candidates == null || candidates.length === 0) && tail.enable && ply < tail.minBranchPly) {
    // Берём мягкие хвостовые кандидаты
    const tailMoves = pickTailCandidates(data.moves as any, tail);
    candidates = tailMoves;
  }

  // Если есть selection policy, используем её
  if (ctx.selection) {
    const sideToMove = fen.split(" ")[1] === "w" ? "w" : "b";
    const evalCp = ctx.g.engine?.useCloud ? async (uci: string) => {
      try {
        const nextFen = nextFenAfterUci(fen, uci);
        if (!nextFen.fen) return undefined;
        const ce = await cloudEvalQuery(nextFen.fen, 1);
        return ce?.pvs?.[0]?.cp;
      } catch (error) {
        // Игнорируем ошибки CloudEval (429, etc.)
        return undefined;
      }
    } : undefined;
    
    candidates = await selectCandidates(fen, ply, sideToMove, data.moves || [], ctx.selection, evalCp);
  }

  // если на глубине кандидатов нет, попробуем мягко продлить до вех/минимума
  if (!candidates || candidates.length === 0) {
    const extendedFen = await softExtend(ctx, fen, path.length);
    if (extendedFen && extendedFen !== fen) {
      return await dfs(ctx, extendedFen, ply, path, out, trail);
    }
    return; // нечего добавить
  }

  const sideToMoveCoach = fen.split(" ")[1] === "w" ? "white" : "black";
  const weMove = sideToMoveCoach === (ctx.coach?.enabled ? ctx.coach.side : ctx.side);

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
        const r = nextFenAfterUci(fen, picked.uci);
        if (!r.fen) {
          ctx.reporter?.onInvalidMove?.(picked.uci, ply, r.error || 'invalid');
          out.push(mkBranch(ctx, path, trail));
          ctx.reporter?.onBranch?.(path, ply);
          return;
        }
        const nextFen = r.fen;
        
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
          const r = nextFenAfterUci(fen, mv.uci);
          if (!r.fen) {
            ctx.reporter?.onInvalidMove?.(mv.uci, ply, r.error || 'invalid');
            continue;
          }
          const nextFen = r.fen;
          
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
      const r = nextFenAfterUci(fen, mv.uci);
      if (!r.fen) {
        ctx.reporter?.onInvalidMove?.(mv.uci, ply, r.error || 'invalid');
        continue;
      }
      const nextFen = r.fen;

      // если мы ушли с форс-пути достаточно рано и включён «короткий сайдлайн» — ограничим глубину
      if (ctx.scenario?.enable && !pathPrefixOk([...path, mv.uci], ctx.scenario.forceUciPath)) {
        const cap = ctx.scenario.sidelineMaxPlies || 0;
        if (cap > 0 && (path.length+1) >= cap) {
          // финализируем как короткий сайдлайн
          out.push(mkBranch(ctx, [...path, mv.uci], trail));
          ctx.reporter?.onBranch?.([...path, mv.uci], ply + 1);
          continue;
        }
      }

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
      try {
        // оценка позиции после хода соперника (ход следующей стороны — наша)
        const r = nextFenAfterUci(fen, x.m.uci);
        if (!r.fen) continue;
        const nextFen = r.fen;
        ctx.reporter?.onHttp?.("cloud", nextFen);
        const ce = await cloudEvalQuery(nextFen, 1);
        const cp = ce?.pvs?.[0]?.cp;
        if (isBigBlunderCp(cp, threshold)) {
          picked.push(x.m); // маркировать как Trap будем в нейминге
          ctx.reporter?.onTrap?.();
        }
      } catch (error) {
        // Игнорируем ошибки CloudEval (429, etc.)
        continue;
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