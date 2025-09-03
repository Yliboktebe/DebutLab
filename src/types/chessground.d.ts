declare module "@lichess-org/chessground" {
  type Key = string; // "e2", "e4" и т.п.
  type Brush = "green" | "red" | "blue" | "yellow" | string;

  interface MoveMetadata { 
    premove?: boolean; 
    captured?: boolean; 
  }
  
  interface AutoShape { 
    orig: Key; 
    dest: Key; 
    brush?: Brush; 
  }

  interface Api {
    set(opts: any): void;
    state: any;
    setAutoShapes(shapes: AutoShape[]): void;
    redrawAll(): void;
    cancelMove(): void;
    move(from: Key, to: Key): void;
    destroy(): void;
  }

  interface Config {
    fen?: string;
    orientation?: "white" | "black";
    coordinates?: boolean;
    addDimensionsCssVars?: boolean;
    blockTouchScroll?: boolean;
    disableContextMenu?: boolean;
    highlight?: {
      lastMove?: boolean;
      check?: boolean;
    };
    animation?: {
      enabled?: boolean;
      duration?: number;
    };
    selectable?: {
      enabled?: boolean;
    };
    draggable?: {
      enabled?: boolean;
      autoDistance?: boolean;
      showGhost?: boolean;
    };
    movable?: {
      free?: boolean;
      color?: "white" | "black";
      dests?: Map<Key, Key[]>;
      showDests?: boolean;
      rookCastle?: boolean;
      events?: { 
        after?: (orig: Key, dest: Key, metadata: MoveMetadata) => void 
      };
    };
    premovable?: {
      enabled?: boolean;
      showDests?: boolean;
      castle?: boolean;
      events?: { 
        set?: (orig: Key, dest: Key) => void; 
        unset?: () => void 
      };
    };
    drawable?: {
      enabled?: boolean;
      visible?: boolean;
      defaultSnapToValidMove?: boolean;
      eraseOnClick?: boolean;
    };
    events?: { 
      change?: () => void;
      move?: (orig: Key, dest: Key, metadata: MoveMetadata) => void;
      select?: (sq: Key) => void;
    };
  }

  export default function Chessground(el: HTMLElement, config?: Config): Api;
}
