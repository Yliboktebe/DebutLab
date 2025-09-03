import type { Branch } from '@/content/types';
import { Chess } from 'chess.js';

// Функция для построения словаря автоответов черных по ветке дебюта
// Ключ — FEN позиции ПЕРЕД ходом чёрных, значение — пара from/to
export function buildBlackRepliesFromBranch(branch: Branch): Record<string, { from: string; to: string }> {
  const out: Record<string, { from: string; to: string }> = {};
  const chess = new Chess(branch.startFen === 'startpos' ? undefined : branch.startFen);
  
  // Проходим по всем ходам в ветке
  for (let i = 0; i < branch.ucis.length; i++) {
    const uci = branch.ucis[i];
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    
    // Если это ход черных (нечетный индекс), сохраняем ответ
    if (i % 2 === 1) {
      // Сохраняем FEN позиции ПЕРЕД ходом черных
      const fenBeforeBlackMove = chess.fen();
      out[fenBeforeBlackMove] = { from, to };
    }
    
    // Применяем ход к движку
    chess.move({ from, to, promotion: uci.length > 4 ? uci[4] as any : undefined });
  }
  
  return out;
}

// Функция для построения словаря автоответов по всем веткам дебюта
export function buildBlackRepliesFromDebut(branches: Branch[]): Record<string, { from: string; to: string }> {
  const allReplies: Record<string, { from: string; to: string }> = {};
  
  for (const branch of branches) {
    const branchReplies = buildBlackRepliesFromBranch(branch);
    // Объединяем ответы, приоритет у более поздних (если есть конфликты)
    Object.assign(allReplies, branchReplies);
  }
  
  return allReplies;
}
