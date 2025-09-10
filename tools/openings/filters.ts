import { ExplorerMove } from "./types.js";

export function pickByCoverage(moves: ExplorerMove[], coverage: number, minGames: number, topN?: number) {
  // сортируем по частоте (сумма партий после хода)
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

export function engineIntersect(candidates: ExplorerMove[], engineSanList: string[], maxCpDrop?: number, pvMap?: Record<string, number>) {
  // engineSanList — список SAN/или UCI из топ-N Cloud Eval.
  // На практике удобнее сравнивать UCI; при необходимости подайте сюда UCI.
  const set = new Set(engineSanList);
  const filtered = candidates.filter(m => set.has(m.uci) || set.has(m.san));
  if (filtered.length) return filtered;

  // если пересечение пустое — оставим data-driven (не режем всё)
  return candidates;
}
