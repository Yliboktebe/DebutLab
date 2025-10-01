// Единая функция для формирования UCI без промоушена для не-пешек
export function toUci(orig: string, dest: string, pieceRole?: 'pawn'|'knight'|'bishop'|'rook'|'queen'|'king') {
  const isPawn = pieceRole === 'pawn';
  const destRank = dest[1];
  const needPromo = isPawn && (destRank === '8' || destRank === '1');
  return `${orig}${dest}${needPromo ? 'q' : ''}`;
}
