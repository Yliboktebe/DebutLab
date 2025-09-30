import { Chess } from 'chess.js';
import { normalizeUci, materializeCastle, parseUci } from './uci.js';

export function nextFenAfterUci(fen: string, rawUci: string): { fen?: string; error?: string } {
  try {
    const chess = new Chess(fen);
    const u = materializeCastle(normalizeUci(rawUci), fen);
    const obj = parseUci(u);
    if (!obj) return { error: `Invalid UCI: ${rawUci}` };
    const res = chess.move(obj);
    if (!res) return { error: `Illegal move from parsed UCI: ${u}` };
    return { fen: chess.fen() };
  } catch (e: any) {
    return { error: e?.message || String(e) };
  }
}
