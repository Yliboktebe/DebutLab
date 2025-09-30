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
  tail?: TailExtendConfig;
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
  /** Если true, на корневом ходу берём ТОЛЬКО ходы из buckets, без добора до coverage */
  bucketsStrict?: boolean;
  /** Предпочтения репертуара (наши ходы) */
  repertoire?: RepertoirePrefs;
  /** Новое: режим тренера */
  coach?: CoachMode;
  /** Можно переопределить tail локально для дебюта */
  tail?: Partial<TailExtendConfig>;
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

// === Coach-mode: детерминированный "наш" ход, ветвление на ответах соперника ===
export interface CoachOurMovePolicy {
  /** Приоритеты выбора: "prefer>engine>data" | "engine>data>prefer" | "data>engine>prefer" */
  priority?: "prefer>engine>data" | "engine>data>prefer" | "data>engine>prefer";
  /** Явные предпочтения по конкретным позициям (ключ: "afterFen:<FEN>") — массив UCI по убыв. приоритета */
  preferByFen?: Record<string, string[]>;
}

export interface CoachOpponentPolicy {
  /** Покрытие ответов соперника (0..1), напр. 0.85..0.9 */
  coverage?: number;
  /** Жёсткий верхний предел вариантов на узле соперника */
  topN?: number;
  /** Пороги по глубине для допустимого минимума партий (если не задано — берём из global) */
  minGamesByDepth?: number[];
  /** Включать ли ловушки (ошибки соперника) сверх покрытия */
  traps?: {
    enable: boolean;
    /** cp-порог преимущества для нашей стороны (после хода соперника), напр. 180 */
    blunderCp?: number;
    /** минимум партий для такого хода соперника, чтобы считать его «инструктивным» */
    minGames?: number;
  };
}

export interface CoachMode {
  enabled: boolean;
  /** Наша сторона: "white"|"black" */
  side: "white"|"black";
  our: CoachOurMovePolicy;
  opp: CoachOpponentPolicy;
}

// === Новое: постобработка ===
export interface PostProcessParams {
  dedupePrefixLen?: number;
  tabiya?: {
    minDevelopedEachSide?: number;
    stopOnAnyCastling?: boolean;
  };
  moveGuards?: {
    bannedUcIs?: string[];
    bannedBeforePly?: number;
  };
  naming?: {
    useExplorerName?: boolean;
    enableCenterGameLabels?: boolean;
  };
}

// === Reporter API ===
export type HttpKind = "explorer" | "cloud";

export interface ProgressSnapshot {
  openingId: string;
  nodes: number;          // посещённые позиции (узлы DFS)
  branches: number;       // сгенерированные ветки
  maxDepth: number;       // максимальная достигнутая глубина (ply)
  explorerRequests: number;
  cloudRequests: number;
  trapsAdded: number;
  filteredByCoverage: number;
  filteredByEngine: number;
  skippedInvalidMoves: number;
  startedAt: number;      // ms epoch
  updatedAt: number;      // ms epoch
}

export interface Reporter {
  onStart?(openingId: string): void;
  onNode?(ply: number, fen: string): void;
  onHttp?(kind: HttpKind, fen: string): void;
  onBranch?(ucis: string[], ply: number): void;
  onTrap?(): void;
  onFiltered?(kind: "coverage" | "engine"): void;
  onInvalidMove?(uci: string, ply: number, msg: string): void;
  snapshot?(): ProgressSnapshot | undefined;
  onFinish?(summary: ProgressSnapshot): void;
  onError?(kind: string, msg: string): void;
}

// no-op reporter (по умолчанию)
export const NoopReporter: Reporter = {};

// === Tail Extend Config ===
export interface TailExtendConfig {
  /** Включить продление хвоста */
  enable: boolean;
  /** Минимальная целевая длина ветки в полуходах (ply). 30 = 15 ходов. */
  minBranchPly: number;
  /** Минимум партий для хода на хвосте (смягчённый порог) */
  minGames: number;
  /** Сколько лучших по частоте ходов рассматривать на хвосте */
  topN: number;
  /** Максимально допустимое ухудшение оценки для хвостового хода (cp). Если движка нет — игнорируется */
  maxCpDrop: number;
  /** Защита от "циклов": не возвращаться к FEN, встречавшемуся в последних N позициях ветки */
  avoidRevisitFenWindow: number;
}

// === МИНИ-ДОБАВКИ К ТИПАМ ===
export type Milestone = 'castle' | 'develop_minors' | 'connect_rooks';

export interface MilestoneConfig {
  enable: boolean;
  order: Milestone[];
  maxExtraTailPlies: number;      // мягкая доклейка полуходов до ближайшей вехи
  relaxAfterMilestone: {
    minGamesFactor: number;       // 0.6 = -40% к minGames на 2–4 полухода
    ignoreCoveragePlies: number;  // игнорировать coverage-стоп на N полуходов
  };
  antiCycleWindow: number;        // защитное окно от зацикливаний (по FEN)
  minLeafPlies: number;           // целевая минимальная глубина листа
}

export interface TrapPolicy {
  enable: boolean;
  budgetByDepth: number[];        // квота ловушек (шт) на глубину
  minSharePercent: number;        // мин. доля встречаемости, чтобы не мусорить (например, 3%)
  minGames: number;               // мин. кол-во партий для хода-ловушки
  maxCpDrop: number;              // падение оценки соперника (в центропешках), чтобы считать ловушкой
}

export interface SelectionPolicy {
  whiteSingleBest: boolean;       // у ученика ровно один ход
  topNBlackByDepth: number[];     // у соперника top-N по глубине
  traps?: TrapPolicy;
}

export interface ScenarioConfig {
  enable: boolean;
  /**
   * Жёсткий сценарий: последовательность UCI, которую мы поддерживаем как главный ствол.
   * Пример для центра: ["e2e4","e7e5","d2d4","e5d4","d1d4","b8c6","d4e3"]
   */
  forceUciPath: string[];
  /**
   * Максимальная глубина «сайдлайнов», если противник ушёл с сценария слишком рано.
   * 0 = не ограничивать.
   */
  sidelineMaxPlies: number;
}

export interface GlobalConfig extends GlobalParams {
  // ... уже существующие поля
  milestones?: MilestoneConfig;
  selection?: SelectionPolicy;
  scenario?: ScenarioConfig;
  api?: {
    concurrency?: {
      explorer?: number;   // по умолчанию 4
      cloudEval?: number;  // по умолчанию 2
    };
    retry?: {
      retries?: number;    // по умолчанию 4
      baseDelayMs?: number;// по умолчанию 250
      maxDelayMs?: number; // по умолчанию 4000
    };
  };
}

// Обновляем OpeningConfig для поддержки новых полей
export interface OpeningConfigExtended extends OpeningConfig {
  // ... уже существующие поля
  milestones?: Partial<MilestoneConfig>;
  selection?: Partial<SelectionPolicy>;
  scenario?: Partial<ScenarioConfig>;
}
