import { Chess } from "chess.js";

/** Применяет UCI-ходы к FEN и возвращает новую позицию (FEN) */
export function applyMoves(fenOrStartpos: string, ucis: string[]): string {
  const game = new Chess(fenOrStartpos === "startpos" ? undefined : fenOrStartpos);
  for (const uci of ucis) {
    if (!uci || uci.length < 4) {
      throw new Error(`Invalid UCI move format: ${uci}`);
    }
    const from = uci.slice(0, 2), to = uci.slice(2, 4), promo = uci[4];
    const move = game.move({ from, to, promotion: promo as any });
    if (!move) {
      throw new Error(`Illegal UCI move ${uci} on fen ${game.fen()}`);
    }
  }
  return game.fen();
}
