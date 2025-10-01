import { useState, useEffect, useCallback, useRef } from 'react';
import { Debut } from '@/data/content/types';
import { studyEngine, StudyState, ApplyResult } from './study-engine';
import { progressManager, ProgressManager } from './progress-manager';
import type { ChessBoardApi } from '@/core/chess/chessground';

type UiMsg = { text: string; kind: "success" | "info"; until: number } | null;

// Примечание: studyEngine и progressManager - это singleton экземпляры
// studyEngine экспортируется как: export const studyEngine = new StudyEngine();
// progressManager экспортируется как: export const progressManager = ProgressManager.getInstance();

export function useStudyEngine(debut: Debut) {
  const [state, setState] = useState<StudyState>(studyEngine.getState());
  const boardApiRef = useRef<ChessBoardApi | null>(null);
  const didInitialSyncRef = useRef(false);
  const [uiMsg, setUiMsg] = useState<UiMsg>(null);

  // ⬇️ ОБЪЯВЛЕНИЕ ВВЕРХУ (HOISTED)
  function updateArrowAndDests() {
    // если ветка ещё не загружена — ничего не делаем
    if (!studyEngine.getCurrentBranch?.()) return;
    if (!boardApiRef.current) return;

    // Если сейчас не очередь ученика — не подсказываем (без shapes/dests)
    const fen = studyEngine.getState().currentFen;
    const turn = fen.includes(' w ') ? 'white' : 'black';
    if (turn !== studyEngine.getStudentColor()) {
      boardApiRef.current.setAllowedMoves(new Map());
      boardApiRef.current.showArrow(null);
      return;
    }
    const u = studyEngine.currentExpectedUci();
    const showArrow = studyEngine.getState().mode === "GUIDED" && u && !studyEngine.isMoveLearned(u);

    const dests = u
      ? new Map([[u.slice(0,2), [u.slice(2,4)]]])
      : new Map<string, string[]>();

    boardApiRef.current.setAllowedMoves(dests);
    boardApiRef.current.showArrow(showArrow ? u : null);
    
    console.log('useStudyEngine: Updated arrow and dests:', {
      expectedUci: u,
      shouldShowArrow: showArrow,
      dests: Array.from(dests.entries()),
      mode: studyEngine.getState().mode
    });
  }

  const showUiMsg = (m?: { kind: "success" | "info"; text: string; ttlMs?: number }) => {
    if (!m) return;
    const ttl = m.ttlMs ?? 1000;
    setUiMsg({ text: m.text, kind: m.kind, until: Date.now() + ttl });
    // автоочистка
    setTimeout(() => setUiMsg((cur) => (cur && Date.now() >= cur.until ? null : cur)), ttl + 50);
  };

  const resetCurrentDebut = useCallback(() => {
    // 1) чистим persistent
    const pm = ProgressManager.getInstance();
    pm.resetDebut(debut.id);

    // 2) перечитать прогресс в движке (иначе останутся старые learnedMoves)
    studyEngine.reloadProgressForCurrentDebut();

    // 3) жёстко сбросить состояние движка на первую ветку (GUIDED)
    studyEngine.hardResetCurrentDebutToFirstBranch();

    // 4) синхронизировать доску и подсказки
    const fen = studyEngine.getCurrentFen();
    const expectedUci = studyEngine.currentExpectedUci(); // первый ход ученика
    const dests = expectedUci
      ? new Map([[expectedUci.slice(0, 2), [expectedUci.slice(2, 4)]]])
      : new Map();

    // аккуратно, чтобы не было гонок: сначала fen, затем dests и стрелка
    if (boardApiRef.current) {
      boardApiRef.current.setFen(fen);
      boardApiRef.current.setAllowedMoves(dests);
      boardApiRef.current.showArrow(expectedUci ?? null);
    }

    // Сбрасываем флаг синхронизации для принудительной пересинхронизации
    didInitialSyncRef.current = false;

    // короткое зелёное сообщение в блок подсказок
    showUiMsg({ kind: "success", text: "Прогресс сброшен. Начинаем заново!", ttlMs: 900 });
  }, [debut.id, showUiMsg]);

  useEffect(() => {
    // Проверяем, не загружен ли уже этот дебют
    const currentDebut = studyEngine.getState().currentDebut;
    if (currentDebut?.id === debut.id) {
      console.log('StudyEngine: Debut already loaded, skipping start');
      return;
    }

    console.log('StudyEngine: Starting new debut:', debut.id);
    studyEngine.setStateChangeCallback(() => setState(studyEngine.getState()));
    
    (async () => {
      // старт дебюта/ветки (как у вас сделано)
      await studyEngine.startDebutIfNeeded(debut.id);
      studyEngine.start(debut);
      updateArrowAndDests();
    })();
    
    return () => {
      studyEngine.setStateChangeCallback(() => {});
    };
  }, [debut.id]); // Изменяем зависимость на debut.id вместо всего объекта debut

  // Debug: логируем изменения состояния
  useEffect(() => {
    console.log('useStudyEngine: State changed:', {
      mode: state.mode,
      studentIndex: state.studentIndex,
      currentFen: state.currentFen,
      currentBranch: state.currentBranch?.id,
      learningMode: state.learningMode,
      currentComment: state.currentComment
    });
  }, [state]);

  // НОВЫЙ: устанавливаем ссылку на API доски
  const setBoardApi = useCallback((api: ChessBoardApi) => {
    boardApiRef.current = api;
  }, []);

  // Синхронизация борда с движком при монтировании
  useEffect(() => {
    // условия: есть борд, есть активная ветка/дебют, и мы ещё не синхронизировались
    if (!boardApiRef.current) return;
    if (!state.currentBranch) return;
    if (didInitialSyncRef.current) return;

    didInitialSyncRef.current = true;

    // 1) выставляем стартовый FEN из движка (он уже set'нут в start())
    boardApiRef.current.setFen(studyEngine.getCurrentFen());

    // 2) преролл уже выполнен внутри studyEngine.start(); здесь больше НИЧЕГО не докручиваем

    // 3) только теперь выставляем стрелку и единственный доступный ход
    updateArrowAndDests();
  }, [boardApiRef.current, state.currentBranch?.id]);

  // Сбрасываем флаг при смене дебюта/ветки
  useEffect(() => {
    didInitialSyncRef.current = false;
  }, [debut.id, state.currentBranch?.id]);

  // НОВЫЙ: обновляем стрелку и dests при изменении состояния
  useEffect(() => {
    updateArrowAndDests();
  }, [state.studentIndex, state.mode]);

  const onMove = useCallback(async (uci: string): Promise<boolean> => {
    console.log('useStudyEngine: onMove called with UCI:', uci);
    
    const result: ApplyResult = studyEngine.applyUserMove(uci);
    console.log('useStudyEngine: onMove result:', result);
    
    if (!result.accepted) {
      // Ход отклонён - показываем сообщение об ошибке
      console.log('useStudyEngine: Move rejected:', result.errorMessage);
      return false; // доска откатит ход
    }
    
    // если был автоответ — двигаем доску с FEN реальности
    if (result.opponentUci && boardApiRef.current) {
      await boardApiRef.current.playUci(result.opponentUci, studyEngine.getCurrentFen());
    }

    // теперь обновляем стрелку и разрешённые ходы
    updateArrowAndDests();

    // показать временное сообщение (если есть)
    showUiMsg(result.uiMessage);

    // обработка переходов
    if (result.modeTransition === "GUIDED_TO_TEST") {
      console.log('useStudyEngine: Transitioning to TEST mode (sync board)');
      // движок уже в TEST и уже прероллил белых внутри resetToStart('TEST')
      if (boardApiRef.current) {
        boardApiRef.current.setFen(studyEngine.getCurrentFen());
      }
      updateArrowAndDests();  // TEST: стрелок не будет, но ход ученика должен быть разрешён
    } else if (result.modeTransition === "COMPLETED") {
      await handleBranchCompletedAndMaybeGoNext();
    }
    
    return true; // доска оставит ход
  }, [state.currentBranch]);

  // НОВЫЙ: обработка завершения ветки и переход к следующей
  const handleBranchCompletedAndMaybeGoNext = useCallback(async () => {
    const nextId = studyEngine.getNextBranchId();

    if (!nextId) {
      showUiMsg({ kind: "success", text: "Все ветки дебюта изучены. 👍", ttlMs: 1200 });
      return;
    }

    await studyEngine.loadBranchById(nextId);
    studyEngine.setMode('GUIDED');      // первый проход следующей ветки
    // движок уже стоит в стартовой позиции ветки и прероллит белых сам
    if (boardApiRef.current) {
      boardApiRef.current.setFen(studyEngine.getCurrentFen());
    }
    updateArrowAndDests();
  }, []);

  const onNextBranch = useCallback(async () => {
    const nextId = studyEngine.getNextBranchId?.();
    if (!nextId) return;                // дебют завершён
    await studyEngine.loadBranchById(nextId);
    studyEngine.setMode('GUIDED');      // первый проход следующей ветки
  }, []);

  const onRestart = useCallback(() => {
    // TODO: реализовать перезапуск
    console.log('useStudyEngine: onRestart called');
  }, []);

  // Get current branch info
  const currentBranch = state.currentBranch;
  const studentIndex = state.studentIndex; // НОВЫЙ: используем studentIndex вместо currentStepIndex
  const mode = state.mode;
  const errors = state.errors;
  const expectedUci = studyEngine.currentExpectedUci();
  const allowedMoves = studyEngine.getAllowedMoves();
  const currentExpectedMove = studyEngine.getCurrentExpectedMove();

  // Debug: логируем разрешенные ходы
  console.log('useStudyEngine: allowedMoves:', allowedMoves);
  console.log('useStudyEngine: currentExpectedMove:', currentExpectedMove);

  // Calculate progress
  const progress = currentBranch 
    ? progressManager.getOverallProgress(debut.id, debut.branches.length)
    : 0;

  return {
    currentBranch,
    studentIndex, // НОВЫЙ: возвращаем studentIndex
    currentFen: state.currentFen, // НОВЫЙ: добавляем currentFen
    mode,
    errors,
    expectedUci,
    progress,
    learningMode: state.learningMode,
    currentComment: state.currentComment,
    showHint: state.showHint,
    allowedMoves,
    currentExpectedMove,
    onMove,
    onNextBranch,
    onRestart,
    setBoardApi, // НОВЫЙ: для установки ссылки на API доски
    updateArrowAndDests, // НОВЫЙ: для принудительного обновления стрелки и dests
    uiMsg, // НОВЫЙ: для отображения временных сообщений
    resetCurrentDebut // НОВЫЙ: для сброса прогресса текущего дебюта
  };
}
