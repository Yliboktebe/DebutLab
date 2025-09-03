import { Chess } from 'chess.js';

// Convert UCI move to SAN
export function uciToSan(uci: string): string {
  try {
    const chess = new Chess();
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length > 4 ? uci[4] : undefined;
    
    const move = {
      from,
      to,
      promotion: promotion as 'q' | 'r' | 'b' | 'n' | undefined
    };
    
    return chess.move(move).san;
  } catch (error) {
    console.error('Error converting UCI to SAN:', error);
    return uci; // Fallback to UCI if conversion fails
  }
}

// Convert SAN to UCI
export function sanToUci(san: string, fen: string): string {
  try {
    const chess = new Chess(fen);
    const move = chess.move(san);
    return move.from + move.to + (move.promotion || '');
  } catch (error) {
    console.error('Error converting SAN to UCI:', error);
    throw new Error(`Invalid SAN: ${san}`);
  }
}

// Get FEN after move
export function getFenAfterMove(fen: string, uci: string): string {
  try {
    const chess = new Chess(fen);
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length > 4 ? uci[4] : undefined;
    
    chess.move({
      from,
      to,
      promotion: promotion as 'q' | 'r' | 'b' | 'n' | undefined
    });
    
    return chess.fen();
  } catch (error) {
    console.error('Error getting FEN after move:', error);
    return fen; // Return original FEN if move fails
  }
}

// Check if move is legal
export function isLegalMove(fen: string, uci: string): boolean {
  try {
    const chess = new Chess(fen);
    const from = uci.slice(0, 2) as any;
    const to = uci.slice(2, 4) as any;
    const promotion = uci.length > 4 ? uci[4] : undefined;
    
    const moves = chess.moves({ square: from });
    const targetSquare = to + (promotion || '');
    
    return moves.some(move => move.includes(targetSquare));
  } catch (error) {
    console.error('Error checking move legality:', error);
    return false;
  }
}

// Get starting FEN
export function getStartFen(fen: string | "startpos"): string {
  if (fen === "startpos") {
    return "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  }
  return fen;
}

// Get student move indices based on side
export function getStudentMoveIndices(side: "white" | "black"): number[] {
  if (side === "white") {
    return [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30];
  } else {
    return [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31];
  }
}

// Check if current step is student's turn
export function isStudentTurn(side: "white" | "black", stepIndex: number): boolean {
  const studentIndices = getStudentMoveIndices(side);
  return studentIndices.includes(stepIndex);
}
