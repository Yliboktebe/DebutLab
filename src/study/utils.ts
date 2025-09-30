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

// Get student move indices based on side
export function getStudentMoveIndices(side: "white" | "black"): number[] {
  if (side === "white") {
    return [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30];
  } else {
    return [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31];
  }
}
