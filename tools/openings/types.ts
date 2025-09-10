export type Speed = "ultraBullet"|"bullet"|"blitz"|"rapid"|"classical"|"correspondence";
export type RatingBucket = 1600|1800|2000|2200|2500;

export interface GlobalParams {
  speeds: Speed[];
  ratings?: RatingBucket[];
  since?: string; // YYYY-MM
  until?: string; // YYYY-MM
  maxPlies: number;
  coverage: number;            // 0..1
  minGamesByDepth: number[];   // per ply
  topNByDepth: number[];       // per ply
  engine?: { useCloud: boolean; multiPv: number; topN: number; maxCpDrop: number };
}

export interface OpeningSeed {
  startFen: string; // "startpos" или FEN
  ucis: string[];   // последовательность UCI ходов до стартовой позиции ветвления
}

export interface OpeningConfig {
  id: string;
  name: string;
  side: "white"|"black";
  seed: OpeningSeed;
}

export interface RootConfig {
  version: number;
  global: GlobalParams;
  openings: OpeningConfig[];
}

// ==== Lichess Explorer response (упрощённо) ====
export interface ExplorerMove {
  uci: string;
  san: string;
  white: number;
  draws: number;
  black: number;
  averageOpponentRating?: number|null;
}

export interface ExplorerResponse {
  white: number; draws: number; black: number;
  opening?: { eco: string; name: string };
  moves: ExplorerMove[];
  recentGames?: unknown[];
}

// ==== Cloud Eval (упрощённо) ====
export interface CloudPV { moves: string; cp?: number; mate?: number }
export interface CloudEvalResponse { fen: string; depth: number; pvs: CloudPV[] }

// ==== UI v1 ====
export interface UiBranch { id: string; startFen: string; ucis: string[] }
export interface UiDebutFile {
  id: string; side: "white"|"black"; branches: UiBranch[];
  meta: Record<string, unknown>;
}
