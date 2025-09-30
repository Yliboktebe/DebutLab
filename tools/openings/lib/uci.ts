export function normalizeUci(raw: string): string {
  if (!raw) return raw;
  const s = raw.trim()
    .replace(/[+#?!]+/g, '')
    .replace(/^0-0-0$|^O-O-O$/i, 'CASTLE_Q')
    .replace(/^0-0$|^O-O$/i, 'CASTLE_K')
    .toLowerCase();

  // нередкие «битые» рокировки от конвертеров PV → UCI
  if (s === 'e1h1') return 'e1g1';
  if (s === 'e8h8') return 'e8g8';
  if (s === 'e1a1') return 'e1c1';
  if (s === 'e8a8') return 'e8c8';
  return s;
}

export function materializeCastle(uci: string, fen: string): string {
  if (uci !== 'CASTLE_K' && uci !== 'CASTLE_Q') return uci;
  const side = fen.split(' ')[1]; // 'w' | 'b'
  if (uci === 'CASTLE_K') return side === 'w' ? 'e1g1' : 'e8g8';
  return side === 'w' ? 'e1c1' : 'e8c8';
}

export function parseUci(uci: string): { from: string; to: string; promotion?: string } | null {
  // e2e4, e7e8q и т.п.
  const m = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/.exec(uci);
  if (!m) return null;
  const [, from, to, promo] = m;
  return promo ? { from, to, promotion: promo as any } : { from, to };
}
