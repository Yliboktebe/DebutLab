// Единая функция для формирования UCI с поддержкой рокировки и промоушена
export function toUci(orig: string, dest: string, pieceRole?: 'pawn'|'knight'|'bishop'|'rook'|'queen'|'king') {
  const isPawn = pieceRole === 'pawn';
  const isKing = pieceRole === 'king';
  
  // Обработка рокировки
  if (isKing) {
    // Белые: e1->g1 (короткая), e1->c1 (длинная)
    // Черные: e8->g8 (короткая), e8->c8 (длинная)
    if ((orig === 'e1' && dest === 'g1') || (orig === 'e8' && dest === 'g8')) {
      return `${orig}${dest}`; // Короткая рокировка
    }
    if ((orig === 'e1' && dest === 'c1') || (orig === 'e8' && dest === 'c8')) {
      return `${orig}${dest}`; // Длинная рокировка
    }
  }
  
  // Обработка промоушена пешек
  const destRank = dest[1];
  const needPromo = isPawn && (destRank === '8' || destRank === '1');
  return `${orig}${dest}${needPromo ? 'q' : ''}`;
}
