export type SrsStage = 0 | 1 | 2 | 3; // 0: начальный, дальше 1/2/3

export function nextReviewAt(errors: number, stage: SrsStage, now = Date.now()): { dueAt: number; nextStage: SrsStage } {
  if (errors >= 3) return { dueAt: now + 60 * 60 * 1000, nextStage: stage }; // +1 час
  if (errors >= 1) return { dueAt: now + 10 * 60 * 1000, nextStage: stage }; // +10 минут
  
  // 0 ошибок — продвижение по интервалам: 3д → 7д → 14д → 30д
  const days = stage === 0 ? 3 : stage === 1 ? 7 : stage === 2 ? 14 : 30;
  const nextStage: SrsStage = Math.min(stage + 1, 3) as SrsStage;
  
  return { dueAt: now + days * 24 * 60 * 60 * 1000, nextStage };
}
