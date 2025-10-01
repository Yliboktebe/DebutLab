import { useEffect, useRef } from 'react';
import { createChessgroundBoard } from '@/board/chessground';
import type { ChessBoardApi } from '@/board/chessground';
import './ChessBoard.css';

export interface ChessBoardProps {
  startFen: string;
  orientation: 'white' | 'black';
  onTryMove: (uci: string) => boolean;  // НОВЫЙ: возвращает boolean
  // allowedMoves,      // ← больше не используем пропсы для управления
  // expectedUci,
  onBoardMounted?: (api: ChessBoardApi) => void;  // НОВЫЙ: callback при монтировании доски
}

export default function ChessBoard({ 
  startFen, 
  orientation, 
  onTryMove, 
  // allowedMoves,      // ← больше не используем пропсы для управления
  // expectedUci,
  onBoardMounted
}: ChessBoardProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<ChessBoardApi | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!initializedRef.current && boardRef.current) {
      initializedRef.current = true;
      console.log('ChessBoard: initializing board');
      
      const api = createChessgroundBoard({
        el: boardRef.current,
        initialFen: startFen,
        orientation,
        onTryMove
        // allowedMoves      // ← больше не используем пропсы для управления
      });
      
      apiRef.current = api;
      
      // НОВЫЙ: вызываем callback при монтировании доски
      if (onBoardMounted) {
        onBoardMounted(api);
      }
    }
  }, [startFen, orientation, onTryMove]);

  // Добавляем cleanup при размонтировании
  useEffect(() => {
    return () => {
      apiRef.current?.destroy();
      apiRef.current = null;
      initializedRef.current = false;
    };
  }, []);

  // Стрелка и доступные ходы теперь управляются ТОЛЬКО через boardApi из useStudyEngine

  return (
    <div className="chess-board">
      <div ref={boardRef} className="cg-wrap board" />
    </div>
  );
}
