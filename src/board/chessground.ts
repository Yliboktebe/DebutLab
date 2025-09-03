import { Chess } from 'chess.js';
// @ts-ignore
import { Chessground } from '@lichess-org/chessground';

// Определяем типы локально, используя правильные типы из пакета
type Key = string;
type DrawShape = { orig: Key; dest: Key; brush?: string };

  // ===== Публичный API адаптера =====
  export interface ChessBoardApi {
    // Нарисовать зелёную стрелку (можно массивом)
    drawGreenArrow(from: Key, to: Key): void;
    clearArrows(): void;
    // Установить FEN извне
    setFen(fen: string): void;
    // Получить текущий FEN
    getFen(): string;
    // Повернуть доску
    toggleOrientation(): void;
    // НОВЫЙ: установить ориентацию и обновить movable.color
    setOrientation(orientation: 'white' | 'black'): void;
    // Принудительно перерисовать (например, после ресайза контейнера)
    redraw(): void;
    // Уничтожить (при размонтировании страницы/вкладки)
    destroy(): void;
    // НОВЫЕ МЕТОДЫ: обновление разрешенных ходов и стрелки
    setAllowedMoves(dests: Map<string, string[]>): void;
    showArrow(uciOrNull: string | null): void;
    playUci(uci: string): void;
  }

export function createChessgroundBoard(opts: {
  el: HTMLElement;
  orientation?: 'white' | 'black';
  initialFen?: string;                          // опционально: старт не с начальной позиции
  onTryMove?: (uci: string) => boolean;         // НОВЫЙ: UI решает принять или отклонить ход
  allowedMoves?: Map<string, string[]>;         // разрешенные ходы только из ветки
}) {
  const chess = new Chess(opts.initialFen);
  let currentFen = chess.fen();
  const ground = Chessground(opts.el, buildConfig());

  // ——— Публичные методы ———
  return {
    // Нарисовать зелёную стрелку (можно массивом)
    drawGreenArrow(from: Key, to: Key) {
      const shapes: DrawShape[] = [{ orig: from, dest: to, brush: 'green' }];
      ground.setAutoShapes(shapes); // «авто-шэйпы» перерисовываются при апдейтах
    },
    clearArrows() {
      ground.setAutoShapes([]);
    },
    // Установить FEN извне
    setFen(fen: string) {
      chess.load(fen);
      currentFen = fen;
      syncBoard({ highlightLast: false }); // внешний импорт — без «последнего хода»
    },
    // Получить текущий FEN
    getFen(): string {
      return currentFen;
    },
    // Повернуть доску
    toggleOrientation() {
      // TODO: реализовать поворот доски
      console.log('toggleOrientation not implemented yet');
    },
    
    // НОВЫЙ: установить ориентацию и обновить movable.color
    setOrientation(orientation: 'white' | 'black') {
      ground.set({
        orientation,
        movable: {
          ...ground.state.movable,
          color: orientation
        }
      });
    },
    // Принудительно перерисовать (например, после ресайза контейнера)
    redraw() {
      ground.redrawAll();
    },
    // Уничтожить (при размонтировании страницы/вкладки)
    destroy() {
      ground.destroy();
    },
    // НОВЫЕ МЕТОДЫ
    setAllowedMoves(dests: Map<string, string[]>) {
      // ЕДИНСТВЕННОЕ место, где меняем dests - сохраняем текущие события/цвет
      const m = ground.state.movable;
      ground.set({ movable: { ...m, dests } });
    },
    showArrow(uciOrNull: string | null) {
      if (!uciOrNull) {
        ground.setAutoShapes([]);
        return;
      }
      const from = uciOrNull.slice(0, 2);
      const to = uciOrNull.slice(2, 4);
      const shapes: DrawShape[] = [{ orig: from, dest: to, brush: 'green' }];
      ground.setAutoShapes(shapes);
    },
    playUci(uci: string) {
      // применяем в локальном chess адаптера
      const from = uci.slice(0, 2);
      const to = uci.slice(2, 4);
      const promotion = uci.length > 4 ? uci[4] as any : undefined;
      
      try {
        const move = chess.move({ from, to, promotion });
        if (move) {
          currentFen = chess.fen();
          
          // ВАЖНО: тут НЕ трогаем movable/dests!
          ground.set({
            fen: currentFen,
            lastMove: [from, to],
            turnColor: whoMoves(),
            check: chess.inCheck() ? whoMoves() : false
          });
        }
      } catch (error) {
        console.error('Error playing UCI move:', error);
      }
    }
  };

  // ===== Реализация =====

  function buildConfig() {
    console.log('chessground: buildConfig called with allowedMoves:', opts.allowedMoves);
    
    const config = {
      // Базовое положение и ориентация
      fen: chess.fen(),                                     // Chessground умеет читать/писать FEN
      orientation: opts.orientation ?? 'white',
      coordinates: true,
      addDimensionsCssVars: true,
      blockTouchScroll: true,                               // важно для мобильного скролла
      disableContextMenu: true,                             // чтобы ПКМ рисовал стрелки без контекстного меню

      // Подсветки/анимации
      highlight: { lastMove: true, check: true },
      animation: { enabled: true, duration: 220 },

      // Ходы пользователя: клики и перетаскивания
      selectable: { enabled: true },                        // tap-tap
      draggable:  { enabled: true, autoDistance: true, showGhost: true },

                           // Легальные ходы и эвенты после хода
        movable: {
          color: opts.orientation ?? 'white',                  // НОВЫЙ: только сторона дебюта может ходить
          free: false,                                         // НОВЫЙ: ограничиваем DnD только стороной ученика
          dests: opts.allowedMoves || computeDests(),         // Используем разрешенные ходы из ветки или все легальные
          showDests: true,
          rookCastle: true,
                                       events: {
              after: (orig: Key, dest: Key) => {
                // НОВЫЙ ПОДХОД: не применяем ход автоматически, спрашиваем UI
                const uci = orig + dest;
                const accepted = opts.onTryMove?.(uci) ?? false;
                
                if (!accepted) {
                  // ROLLBACK: вернуть FEN до попытки
                  ground.cancelMove();
                  ground.set({ fen: currentFen, lastMove: undefined });
                  return;
                }
                
                // ПРИНЯТО: фиксируем ход ученика в адаптере
                try {
                  const move = chess.move({ from: orig, to: dest, promotion: 'q' });
                  if (move) {
                    currentFen = chess.fen();
                    ground.set({ fen: currentFen, lastMove: [orig, dest] });
                  }
                } catch (error) {
                  console.error('Error applying accepted move:', error);
                  ground.cancelMove();
                  ground.set({ fen: currentFen, lastMove: undefined });
                }
              },
            },
      },

      // Премувы (клик или перетаскивание заранее)
      premovable: {
        enabled: true,
        showDests: true,
        castle: true,
        events: {
          // можно логировать set/unset, если нужно
        }
      },

      // Рисование стрелок и фигур на SVG-оверлее
      drawable: {
        enabled: true,
        visible: true,
        defaultSnapToValidMove: true,   // стрелки «прилипают» к валидным ходам
        eraseOnClick: true,
        // кастомные кисти не обязательны — по умолчанию есть green/red/blue/yellow
        // onChange: (shapes) => { ... } // если нужно хранить/синхронизировать
      },

      // Глобальные события (произвольные хуки)
      events: {
        change: () => { /* каждый апдейт стейта */ },
        move:   (_from: Key, _to: Key) => { /* каждый «переезд» фигуры */ },
        select: (_sq: Key) => { /* выбор клетки tap-tap */ },
      }
    };
    
    console.log('chessground: Final config movable.dests:', config.movable.dests);
    return config;
  }

  function syncBoard(opts2: { lastMove?: [Key, Key]; highlightLast?: boolean } = {}) {
    const last = opts2.lastMove ?? getLastMovePair();
    ground.set({
      fen: currentFen,
      turnColor: whoMoves(),
      check: chess.inCheck() ? whoMoves() : false,
      lastMove: last,
      movable: {
        ...ground.state.movable,
        color: whoMoves(),
        // НЕ перезаписываем dests здесь - они должны обновляться только через setAllowedMoves
        // dests: opts.allowedMoves || computeDests(),
      },
      highlight: {
        ...ground.state.highlight,
        lastMove: opts2.highlightLast ?? true,
      },
    });
    // Если был премув — можно попытаться выполнить его
    // TODO: реализовать playPremove
    // ground.playPremove();
  }

  function whoMoves() {
    return chess.turn() === 'w' ? 'white' : 'black';
  }

  // Пересчёт карты легальных ходов из chess.js
  function computeDests() {
    const dests = new Map<Key, Key[]>();
    for (const m of chess.moves({ verbose: true })) {
      const arr = dests.get(m.from) ?? [];
      arr.push(m.to);
      dests.set(m.from, arr);
    }
    return dests;
  }

  function getLastMovePair(): [Key, Key] | undefined {
    const h = chess.history({ verbose: true });
    if (!h.length) return undefined;
    const last = h[h.length - 1];
    return [last.from, last.to];
  }
}
