import { useEffect, useRef, useCallback } from 'react';
import { Side } from '@/content/types';
import { createChessgroundBoard } from '@/board/chessground';
import { buildBlackRepliesFromDebut } from '@/board/black-replies';
import './ChessBoard.css';

export interface ChessBoardApi {
  setFen(fen: string): void;
  playUci(uci: string): void;
  setOrientation(side: Side): void;
  showArrow(uciOrNull: string | null): void;
  highlight(uci: string | null): void;
  setExpectedMove(from: string, to: string): void;
  clearExpectedMove(): void;
  destroy(): void;
}

interface ChessBoardProps {
  orientation: Side;
  startFen: "startpos" | string;
  expectedUci?: string | null;
  onTryMove: (uci: string) => boolean;
  onMounted?: (api: ChessBoardApi) => void;
  branches?: any[]; // Для автоответов черных
}

export function ChessBoard({ 
  orientation, 
  startFen, 
  expectedUci, 
  onTryMove, 
  onMounted,
  branches = []
}: ChessBoardProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const boardApiRef = useRef<ReturnType<typeof createChessgroundBoard> | null>(null);
  const apiRef = useRef<ChessBoardApi | null>(null);
  const initializedRef = useRef(false);

  const getStartFen = useCallback((fen: "startpos" | string): string => {
    if (fen === "startpos") {
      return "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    }
    return fen;
  }, []);

  const createApi = useCallback((): ChessBoardApi => {
    return {
      setFen: (fen: string) => {
        if (boardApiRef.current) {
          boardApiRef.current.setFen(fen);
        }
      },
      
      playUci: (uci: string) => {
        // В новом адаптере ходы делаются автоматически через movable.events.after
        // Этот метод может понадобиться для программных ходов
        console.log('ChessBoard: playUci called with:', uci);
      },
      
      setOrientation: (side: Side) => {
        if (boardApiRef.current) {
          // В новом адаптере ориентация устанавливается при создании
          console.log('ChessBoard: setOrientation called with:', side);
        }
      },
      
      showArrow: (uciOrNull: string | null) => {
        if (boardApiRef.current) {
          if (uciOrNull) {
            const from = uciOrNull.slice(0, 2);
            const to = uciOrNull.slice(2, 4);
            boardApiRef.current.drawGreenArrow(from, to);
          } else {
            boardApiRef.current.clearArrows();
          }
        }
      },
      
      highlight: (uci: string | null) => {
        // В новом адаптере подсветка управляется автоматически
        console.log('ChessBoard: highlight called with:', uci);
      },
      
      setExpectedMove: (from: string, to: string) => {
        if (boardApiRef.current) {
          boardApiRef.current.drawGreenArrow(from, to);
        }
      },

      clearExpectedMove: () => {
        if (boardApiRef.current) {
          boardApiRef.current.clearArrows();
        }
      },

      destroy: () => {
        if (boardApiRef.current) {
          boardApiRef.current.destroy();
          boardApiRef.current = null;
        }
        initializedRef.current = false;
      }
    };
  }, []);

  useEffect(() => {
    if (!boardRef.current || initializedRef.current) return;

    console.log('ChessBoard: Initializing new chessground adapter...');

    // Строим словарь автоответов черных
    const blackReplies = buildBlackRepliesFromDebut(branches);
    console.log('ChessBoard: Built black replies:', blackReplies);

    // Создаем доску с новым адаптером
    boardApiRef.current = createChessgroundBoard({
      el: boardRef.current,
      orientation: orientation,
      initialFen: getStartFen(startFen),
      blackReplies: blackReplies,
      onUserMove: (san: string, from: string, to: string) => {
        const uci = from + to;
        console.log('ChessBoard: User move made:', { san, from, to, uci });
        
        // Вызываем callback для обработки хода
        const accepted = onTryMove(uci);
        if (!accepted) {
          console.log('ChessBoard: Move rejected by onTryMove');
        }
      }
    });

    // Создаем API для внешнего использования
    apiRef.current = createApi();
    onMounted?.(apiRef.current);
    
    initializedRef.current = true;
    console.log('ChessBoard: New adapter initialized successfully');

    return () => {
      console.log('ChessBoard: Cleaning up...');
      if (boardApiRef.current) {
        boardApiRef.current.destroy();
        boardApiRef.current = null;
      }
      apiRef.current = null;
      initializedRef.current = false;
    };
  }, [startFen, orientation, onTryMove, onMounted, getStartFen, createApi, branches]);

  // Update expected move arrow
  useEffect(() => {
    if (apiRef.current && expectedUci) {
      const from = expectedUci.slice(0, 2);
      const to = expectedUci.slice(2, 4);
      apiRef.current.setExpectedMove(from, to);
    } else if (apiRef.current) {
      apiRef.current.clearExpectedMove();
    }
  }, [expectedUci]);

  return (
    <div className="chess-board">
      <div ref={boardRef} id="board"></div>
    </div>
  );
}
