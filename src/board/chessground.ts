import { Chess } from 'chess.js';
import { Chessground } from '@lichess-org/chessground';

// Определяем типы локально, используя правильные типы из пакета
type Key = string;
type DrawShape = { orig: Key; dest?: Key; brush?: string };

// Пример: внешний «деревянный» контракт автоответа за чёрных.
// Ключ — FEN позиции ПЕРЕД ходом чёрных, значение — SAN или пара from/to.
type BlackReplyDict = Record<string, string | { from: Key; to: Key }>;

// ===== Публичный API адаптера =====
export function createChessgroundBoard(opts: {
  el: HTMLElement;
  orientation?: 'white' | 'black';
  initialFen?: string;                          // опционально: старт не с начальной позиции
  blackReplies?: BlackReplyDict;                // автоответ чёрных по ветке дебюта (по FEN)
  onUserMove?: (san: string, from: Key, to: Key) => void; // для аналитики/прогресса
}) {
  const chess = new Chess(opts.initialFen);
  const ground = Chessground(opts.el, buildConfig() as any);

  // ——— Публичные методы ———
  return {
    // Нарисовать зелёную стрелку (можно массивом)
    drawGreenArrow(from: Key, to: Key) {
      const shapes: DrawShape[] = [{ orig: from, dest: to, brush: 'green' }];
      (ground as any).setAutoShapes(shapes); // «авто-шэйпы» перерисовываются при апдейтах
    },
    clearArrows() {
      (ground as any).setAutoShapes([]);
    },
    // Установить FEN извне
    setFen(fen: string) {
      chess.load(fen);
      syncBoard({ highlightLast: false }); // внешний импорт — без «последнего хода»
    },
    // Получить текущий FEN
    getFen(): string {
      return (ground as any).getFen();
    },
    // Повернуть доску
    toggleOrientation() {
      (ground as any).toggleOrientation();
    },
    // Принудительно перерисовать (например, после ресайза контейнера)
    redraw() {
      (ground as any).redrawAll();
    },
    // Уничтожить (при размонтировании страницы/вкладки)
    destroy() {
      (ground as any).destroy();
    }
  };

  // ===== Реализация =====

  function buildConfig() {
    return {
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
        color: whoMoves(),                                  // 'white' | 'black'
        dests: computeDests(),                              // Map<from, string[]>
        showDests: true,
        rookCastle: true,
        events: {
          after: (orig: Key, dest: Key) => {
            // Применяем ход в движке (с дефолт-превращением в ферзя)
            const move = chess.move({ from: orig, to: dest, promotion: 'q' });
            if (!move) return cancelAndResync();

            opts.onUserMove?.(move.san, orig, dest);
            syncBoard({ lastMove: [orig, dest] });

            // === Автоответ чёрных по ветке дебюта ===
            maybeAutoReplyAsBlack();
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
        move:   (from: Key, to: Key) => { /* каждый «переезд» фигуры */ },
        select: (sq: Key) => { /* выбор клетки tap-tap */ },
      }
    } as const;
  }

  function syncBoard(opts2: { lastMove?: [Key, Key]; highlightLast?: boolean } = {}) {
    const last = opts2.lastMove ?? getLastMovePair();
    (ground as any).set({
      fen: chess.fen(),
      turnColor: whoMoves(),
      check: chess.inCheck() ? whoMoves() : false,
      lastMove: last,
      movable: {
        ...(ground as any).state.movable,
        color: whoMoves(),
        dests: computeDests(),
      },
      highlight: {
        ...(ground as any).state.highlight,
        lastMove: opts2.highlightLast ?? true,
      },
    });
    // Если был премув — можно попытаться выполнить его
    (ground as any).playPremove();
  }

  function cancelAndResync() {
    (ground as any).cancelMove();
    syncBoard();
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

  // Автоответ чёрных: ищем подготовленный ответ по FEN и делаем ход в один тик
  function maybeAutoReplyAsBlack() {
    if (whoMoves() !== 'black') return;
    const reply = opts.blackReplies?.[chess.fen()];
    if (!reply) return;

    // Разрешены оба формата: SAN или from/to
    let applied = false;
    if (typeof reply === 'string') {
      const mv = chess.move(reply);     // SAN из словаря
      if (mv) {
        (ground as any).move(mv.from as Key, mv.to as Key);
        applied = true;
      }
    } else {
      const mv = chess.move({ from: reply.from, to: reply.to, promotion: 'q' });
      if (mv) {
        (ground as any).move(mv.from as Key, mv.to as Key);
        applied = true;
      }
    }
    if (applied) syncBoard({ lastMove: getLastMovePair() });
  }
}
