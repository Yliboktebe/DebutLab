import { useEffect, useRef } from 'react';
import { createChessgroundBoard } from '@/board/chessground';
import type { ChessBoardApi } from '@/board/chessground';
import './ChessBoard.css';

export interface ChessBoardProps {
  startFen: string;
  orientation: 'white' | 'black';
  onTryMove: (uci: string) => boolean;  // НОВЫЙ: возвращает boolean
  allowedMoves?: Map<string, string[]>;
  expectedUci?: string | null;          // НОВЫЙ: для отрисовки стрелки
  onBoardMounted?: (api: ChessBoardApi) => void;  // НОВЫЙ: callback при монтировании доски
}

export default function ChessBoard({ 
  startFen, 
  orientation, 
  onTryMove, 
  allowedMoves,
  expectedUci,
  onBoardMounted
}: ChessBoardProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<ChessBoardApi | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!initializedRef.current && boardRef.current) {
      initializedRef.current = true;
      console.log('ChessBoard: initializing with allowedMoves:', allowedMoves);
      
      const api = createChessgroundBoard({
        el: boardRef.current,
        initialFen: startFen,
        orientation,
        onTryMove,
        allowedMoves
      });
      
      apiRef.current = api;
      
      // НОВЫЙ: вызываем callback при монтировании доски
      if (onBoardMounted) {
        onBoardMounted(api);
      }
    }
  }, [startFen, orientation, onTryMove, allowedMoves]);

  // НОВЫЙ: обновление стрелки при смене expectedUci
  useEffect(() => {
    if (apiRef.current && expectedUci !== undefined) {
      console.log('ChessBoard: updating arrow to:', expectedUci);
      apiRef.current.showArrow(expectedUci);
    }
  }, [expectedUci]);

  // НОВЫЙ: обновление разрешенных ходов
  useEffect(() => {
    if (apiRef.current && allowedMoves) {
      console.log('ChessBoard: updating allowedMoves:', allowedMoves);
      apiRef.current.setAllowedMoves(allowedMoves);
    }
  }, [allowedMoves]);

  return (
    <div className="chess-board">
      <div id="board" ref={boardRef} className="cg-wrap board"></div>
    </div>
  );
}
