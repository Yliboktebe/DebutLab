import { ExplorerMove } from "./types.js";

/** Отбор по покрытию/частоте (как было) */
export function pickByCoverage(
  moves: ExplorerMove[],
  coverage: number,
  minGames: number,
  topN?: number
) {
  const withTotal = moves
    .map(m => ({ m, total: m.white + m.draws + m.black }))
    .filter(x => x.total >= minGames)
    .sort((a, b) => b.total - a.total);

  const sumAll = withTotal.reduce((s, x) => s + x.total, 0) || 1;
  const picked: ExplorerMove[] = [];
  let acc = 0;

  for (const x of withTotal) {
    if (topN && picked.length >= topN) break;
    picked.push(x.m);
    acc += x.total;
    if (acc / sumAll >= coverage) break;
  }
  return picked;
}

/** Пересечение с CloudEval: строго первый ход PV в UCI */
export function engineIntersect(
  candidates: ExplorerMove[],
  engineFirstUci: string[]
) {
  const set = new Set(engineFirstUci);
  const filtered = candidates.filter(m => set.has(m.uci));
  return filtered.length ? filtered : candidates; // если пересечения нет — не рубим всё
}

/** Motif guard: выкидываем ранние "мусорные" толчки, если не whitelisted */
export function applyMotifGuard(
  candidates: ExplorerMove[],
  ply: number,
  bannedUcIs: string[] = ["h2h4", "a2a4", "h7h5", "a7a5"],
  bannedBeforePly = 6,
  whitelist?: Set<string>
) {
  if (ply >= bannedBeforePly) return candidates;
  return candidates.filter(m => {
    if (whitelist?.has(m.uci)) return true;
    return !bannedUcIs.includes(m.uci);
  });
}
