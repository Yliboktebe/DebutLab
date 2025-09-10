import { Chess } from "chess.js";

/**
 * Конвертирует UCI ходы в SAN нотацию для создания читаемых названий веток
 */
export function ucisToSan(ucis: string[], startFen: string = "startpos"): string {
  const game = new Chess(startFen === "startpos" ? undefined : startFen);
  const moves: string[] = [];
  
  for (const uci of ucis) {
    if (!uci || uci.length < 4) continue;
    
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promo = uci[4];
    
    try {
      const move = game.move({ from, to, promotion: promo as any });
      if (move) {
        moves.push(move.san);
      }
    } catch (error) {
      // Если ход некорректный, пропускаем
      console.warn(`Invalid move ${uci}:`, error);
    }
  }
  
  return moves.join(" ");
}

/**
 * Создает читаемое название ветки из UCI ходов
 */
export function createBranchName(ucis: string[], startFen: string = "startpos"): string {
  // Если startFen не начальная позиция, создаем простое название
  if (startFen !== "startpos" && !startFen.includes("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR")) {
    return `${ucis.length} moves from position`;
  }
  
  const san = ucisToSan(ucis, startFen);
  const moves = san.split(" ");
  
  // Берем первые 8 ходов для названия
  const displayMoves = moves.slice(0, 8);
  const result = displayMoves.join(" ");
  
  // Если ходов больше 8, добавляем многоточие
  return moves.length > 8 ? result + "..." : result;
}

/**
 * Определяет тип ветки на основе позиции в списке
 */
export function getBranchType(index: number, totalBranches: number): "main_line" | "alternative" {
  // Первая ветка всегда main_line, остальные alternative
  return index === 0 ? "main_line" : "alternative";
}

/**
 * Создает уникальный ID для ветки на основе UCI ходов
 */
export function createBranchId(debutId: string, ucis: string[], index: number): string {
  // Создаем короткий хэш из первых нескольких ходов
  const moveHash = ucis.slice(0, 4).join("").replace(/[^a-z0-9]/g, "").slice(0, 8);
  return `${debutId}-${String(index + 1).padStart(4, "0")}-${moveHash}`;
}
