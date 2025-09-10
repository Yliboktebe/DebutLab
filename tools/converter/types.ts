// Типы для нашего сгенерированного формата
export interface GeneratedBranch {
  id: string;
  startFen: string;
  ucis: string[];
}

export interface GeneratedDebutFile {
  id: string;
  side: "white" | "black";
  branches: GeneratedBranch[];
  meta: Record<string, unknown>;
}

// Типы для UI v1 формата
export interface UiBranch {
  id: string;
  type: "main_line" | "alternative";
  name: string;
  startFen: "startpos" | string;
  ucis: string[];
  minPly: number;
}

export interface UiDebutFile {
  schema: "debutlab.debut.v1";
  id: string;
  name: string;
  side: "white" | "black";
  tags: string[];
  branches: UiBranch[];
}

export interface CatalogItem {
  id: string;
  name: string;
  side: "white" | "black";
  tags: string[];
  file: string;
  hash?: string;
  branches: number;
  approxSizeKB: number;
}

