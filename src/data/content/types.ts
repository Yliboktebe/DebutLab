// DebutLab UI v1 Schema Types

export type Side = "white" | "black";
export type BranchType = "main_line" | "alternative";
export type BranchStatus = "New" | "GuidedDone" | "Review" | "Relearn" | "Mastered";

// Catalog schema
export interface Catalog {
  schema: "debutlab.catalog.v1";
  updatedAt: string;
  debuts: DebutCatalogItem[];
}

export interface DebutCatalogItem {
  id: string;
  name: string;
  side: Side;
  tags: string[];
  file: string;
  hash?: string;
  branches: number;
  approxSizeKB: number;
}

// Debut schema
export interface Debut {
  schema: "debutlab.debut.v1";
  id: string;
  name: string;
  side: Side;
  tags: string[];
  branches: Branch[];
}

export interface Branch {
  id: string;
  type: BranchType;
  name: string;
  startFen: "startpos" | string;
  ucis: string[];
  minPly: number;
}

// Progress tracking
export interface BranchProgress {
  status: BranchStatus;
  errors: number;
  nextReviewAt?: number;
  lastAttemptAt?: number;
  learnedMoves?: string[];
  stage?: number; // SRS stage: 0, 1, 2, 3
  completedAt?: number; // Timestamp when branch was completed
}

export type DebutProgress = Record<string, BranchProgress>;

export interface UserProgress {
  version: string; // версия схемы прогресса
  debuts: Record<string, DebutProgress>;
  learnedMoves: Record<string, string[]>; // теперь содержит позиционные ключи "fen#uci"
}

// Study state
export type StudyMode = "IDLE" | "LOAD" | "GUIDED" | "TEST" | "COMPLETE";

export interface StudyState {
  mode: StudyMode;
  currentDebut: Debut | null;
  currentBranch: Branch | null;
  currentStepIndex: number;
  errors: number;
  learnedMoves: Set<string>;
  stage?: number; // Current SRS stage
}
