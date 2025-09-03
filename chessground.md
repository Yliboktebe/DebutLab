Ок, делаем Chessground «по-взрослому»: ставим последнюю версию, подключаем стили, включаем DnD, tap-tap и премувы, добавляем стрелки/подсветки, синхронизируем с chess.js, а также даём автодействие «за чёрных» по нашей ветке дебюта. Ниже — проверенные, документированные шаги + готовый код, который можно сразу класть в Vite (vanilla TS) проекта DebutLab.

1) Установка и файлы
Установить зависимости
npm i @lichess-org/chessground chess.js


Chessground — официальная сборка от lichess, пакет @lichess-org/chessground. Пример импорта: import { Chessground } from '@lichess-org/chessground'. 
GitHub

Подключить базовые стили и темы (обязательны!)

Добавьте в ваш entry-файл (например, src/main.ts):

import '@lichess-org/chessground/assets/chessground.base.css';     // базовая разметка доски
import '@lichess-org/chessground/assets/chessground.cburnett.css'; // набор фигур «cburnett»
import '@lichess-org/chessground/assets/chessground.brown.css';    // тема клеток (можно сменить/кастомизировать)


Имена и наличие этих CSS подтверждены в пакете (assets/chessground.base.css, chessground.cburnett.css, chessground.brown.css). 
app.unpkg.com
+1

Контейнер и размер

В HTML достаточно пустого контейнера:

<div id="board"></div>


CSS (современно и просто):

#board { width: 100%; max-width: 560px; aspect-ratio: 1 / 1; }


Chessground сам создаёт внутренние элементы и классы, стилизуемые base-CSS. 
app.unpkg.com

2) Инициализация «правильной» доски + связка с chess.js

Ниже — готовый src/board/chessground.ts (TypeScript), который:

включает drag&drop, tap-tap, премувы;

рисует зелёные стрелки и умеет их очищать;

подсвечивает последний ход, шах, показывает доступные поля;

синхронизирует состояние с chess.js (правила, FEN, легальность);

делает автоответ чёрных по заданной ветке (пример механики внизу кода).

В Chessground всё управляется одним config, который можно менять «на лету» через ground.set(config). Ключевые поля см. в интерфейсе Config (fen, orientation, turnColor, highlight, animation, movable, premovable, draggable, selectable, drawable, events …). 
app.unpkg.com

// src/board/chessground.ts
import { Chess } from 'chess.js';
import Chessground from '@lichess-org/chessground';

// Вспомогательные типы для удобства (без жёстких импортов .d.ts из пакета)
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
      syncBoard({ highlightLast: false }); // внешний импорт — без «последнего хода»
    },
    // Получить текущий FEN
    getFen(): string {
      return ground.getFen();
    },
    // Повернуть доску
    toggleOrientation() {
      ground.toggleOrientation();
    },
    // Принудительно перерисовать (например, после ресайза контейнера)
    redraw() {
      ground.redrawAll();
    },
    // Уничтожить (при размонтировании страницы/вкладки)
    destroy() {
      ground.destroy();
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
    ground.set({
      fen: chess.fen(),
      turnColor: whoMoves(),
      check: chess.inCheck() ? whoMoves() : false,
      lastMove: last,
      movable: {
        ...ground.state.movable,
        color: whoMoves(),
        dests: computeDests(),
      },
      highlight: {
        ...ground.state.highlight,
        lastMove: opts2.highlightLast ?? true,
      },
    });
    // Если был премув — можно попытаться выполнить его
    ground.playPremove();
  }

  function cancelAndResync() {
    ground.cancelMove();
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
        ground.move(mv.from as Key, mv.to as Key);
        applied = true;
      }
    } else {
      const mv = chess.move({ from: reply.from, to: reply.to, promotion: 'q' });
      if (mv) {
        ground.move(mv.from as Key, mv.to as Key);
        applied = true;
      }
    }
    if (applied) syncBoard({ lastMove: getLastMovePair() });
  }
}


Почему так:

В Chessground нет шахматной логики — её даёт chess.js. Мы рассчитываем легальные ходы через chess.moves({ verbose: true }) и собираем Map<from, to[]>, подавая её в movable.dests — это официальный способ «разрешать» ходы. 
GitHub
npmjs.com

Стейт доски обновляем через ground.set({...}), где можно менять fen, turnColor, check, lastMove, а также подменять movable.dests и movable.color. То, что эти поля поддерживаются, видно в Config. 
app.unpkg.com

Для стрелок включён drawable.enabled и используем ground.setAutoShapes([...]) (или setShapes([...])) — это часть публичного API. Цвет «green» есть по умолчанию (как и red/blue/yellow), а модификаторы клавиатуры при рисовании управляют выбором кисти. 
app.unpkg.com
+1

Встроенные премувы: конфиг premovable.enabled: true + методы playPremove()/cancelPremove() — доступны в API. 
app.unpkg.com
+1

С FEN работаем как через chess.js, так и напрямую из Chessground (api.getFen()/config.fen), поддержка FEN также есть во внутренних функциях пакета. 
app.unpkg.com
+1

3) Частые операции API (что ещё пригодится)

Применить ход визуально: ground.move('e2','e4'). Затем синхронизируйте движок и dests, как показано в syncBoard. Полный список методов API: set, getFen, toggleOrientation, move, setPieces, selectSquare, newPiece, playPremove, cancelPremove, cancelMove, stop, explode, setShapes, setAutoShapes, getKeyAtDomPos, redrawAll, dragNewPiece, destroy. 
app.unpkg.com

Добавить/заменить фигуры без FEN: ground.setPieces(new Map([['a2', undefined], ['a4', { role:'pawn', color:'white' }]])). Типы PiecesDiff, Piece, Color, Key см. в types.d.ts. 
app.unpkg.com
+1

Координаты и шах/последний ход: highlight.lastMove, highlight.check, lastMove: ['e2','e4'], check: 'black' | 'white' | false. Всё это — поля Config. 
app.unpkg.com

Ресайз/скрытие панелей: после изменения размеров контейнера вызовите ground.redrawAll(). 
app.unpkg.com

Цвета стрелок по ПКМ с модификаторами: по умолчанию есть 4 кисти (green/red/blue/yellow), переключаемые сочетаниями клавиш во время рисования (см. eventBrush в исходниках draw.js). Вы можете и жёстко назначить кисть: в shape укажите brush: 'green'. 
app.unpkg.com

4) Автоответ за чёрных по ветке дебюта (интеграция с вашим деревом)

В адаптере выше подключите ваш генератор словаря blackReplies: Record<FEN, SAN | {from,to}>.
Пример внешнего построения словаря (псевдокод):

import type { OpeningNode } from '../content/ui-schema'; // ваш формат узла
import { Chess } from 'chess.js';

export function buildBlackRepliesFromTree(root: OpeningNode): Record<string, string> {
  const out: Record<string, string> = {};
  const chess = new Chess();
  function dfs(node: OpeningNode) {
    // допустим, node хранит ход SAN
    if (node.moveSan) chess.move(node.moveSan);
    // когда ход чёрных — сохраняем ответ на FEN позиции
    if (chess.turn() === 'b' && node.replyBlackSan) {
      out[chess.fen()] = node.replyBlackSan;
    }
    for (const child of node.replies ?? []) dfs(child);
    if (node.moveSan) chess.undo();
  }
  dfs(root);
  return out;
}


Далее передаёте blackReplies в createChessgroundBoard({ … }) — и «чёрные» будут автоматически отвечать при совпадении FEN. (Мы применяем ход либо как SAN, либо как from/to.)

5) «Профессиональные» флаги и настройки, о которых чаще всего забывают

blockTouchScroll: true — чтобы на мобильных жесты по доске не прокручивали страницу. 
app.unpkg.com

disableContextMenu: true — чтобы ПКМ рисовал стрелки без всплывающего меню браузера. 
app.unpkg.com

rookCastle: true в movable — чтобы при рокировке ладья уезжала автоматически. 
app.unpkg.com

Промоушен — chess.js требует передавать promotion для пешки (мы по умолчанию ставим 'q'). Используйте свой UI диалог — и подставляйте выбранное значение. 
GitHub

Переинициализация dests после КАЖДОГО изменения позиции — иначе разрешённые ходы «застынут». (Смотрите syncBoard().) 
app.unpkg.com

Координаты/подсветки/анимация — тонко регулируются в Config. 
app.unpkg.com

6) Лицензия (важно для продукта)

Chessground распространяется под GPL-3.0. Это означает, что при его использовании ваш совмещённый продукт должен распространяться под GPL, а исходники должны быть доступны пользователям сайта/приложения. Убедитесь, что это согласуется с вашей моделью распространения. 
GitHub

Быстрый чек-лист готовности

 Пакеты установлены; импорты @lichess-org/chessground и chess.js работают. 
GitHub
+1

 Подключены три CSS из assets/ (base + фигуры + тема доски). 
app.unpkg.com

 Контейнер квадратный (aspect-ratio: 1/1), redrawAll() вызывается после ресайза. 
app.unpkg.com

 Включены draggable, selectable, premovable и обработчик movable.events.after. 
app.unpkg.com

 computeDests() пересчитывается после каждого хода/изменения FEN. 
app.unpkg.com

 Стрелки: drawable.enabled: true, рисование ПКМ, setAutoShapes() для подсказок; зелёные — brush: 'green'. 
app.unpkg.com

 Автоответ чёрных: словарь blackReplies по FEN → SAN/from/to подключён.