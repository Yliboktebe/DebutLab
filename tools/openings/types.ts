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
  // === Новое ===
  post?: PostProcessParams;
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
  /** Необязательные корзины на корне (или в других ключевых позициях — пока используем на корне) */
  buckets?: FamilyBucket[];
  /** Предпочтения репертуара (наши ходы) */
  repertoire?: RepertoirePrefs;
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
export interface UiBranch { 
  id: string; 
  startFen: string; 
  ucis: string[];
  /** Новое: человекочитаемое имя (необязательно) */
  name?: string;
}
export interface UiDebutFile {
  id: string; side: "white"|"black"; branches: UiBranch[];
  meta: Record<string, unknown>;
}

// === Новое: управление корзинами и предпочтениями репертуара ===
export interface FamilyBucket {
  /** Человекочитаемое имя (например, "Accepted …exd4") */
  label: string;
  /** Набор UCI-ответов соперника, которые мы считаем одним "семейством" в данной позиции */
  matchUcIs: string[];
  /** Сколько минимум/максимум линий хотим взять из этого семейства */
  min: number;
  max: number;
  /** Бонус к глубине для этого семейства (чтобы главные катить глубже) */
  depthBonus?: number;
}

export interface RepertoirePrefs {
  /** Белые/чёрные: whitelist наших ответов (UCI) из конкретной позиции (ключ формата "afterFen:<FEN>") */
  allowedRepliesByFen?: Record<string, string[]>;
}

// === Новое: постобработка ===
export interface PostProcessParams {
  /** Длина префикса UCI для дедупликации */
  dedupePrefixLen?: number; // напр. 12
  /** Табиные условия остановки (эвристики) */
  tabiya?: {
    /** Мин. число выведенных лёгких фигур у каждой стороны */
    minDevelopedEachSide?: number; // напр. 2
    /** Останавливать ли при рокировке любой стороны */
    stopOnAnyCastling?: boolean;
  };
  /** Guard на «мусорные» мотивы в дебюте */
  moveGuards?: {
    /** Запрещённые UCI до указанного ply (если они не в whitelist) */
    bannedUcIs?: string[];         // по умолчанию ["h2h4","a2a4","h7h5","a7a5"]
    bannedBeforePly?: number;      // напр. 6
  };
  /** Формирование имён веток */
  naming?: {
    useExplorerName?: boolean;
    enableCenterGameLabels?: boolean; // специальные лейблы для id=central
  };
}
