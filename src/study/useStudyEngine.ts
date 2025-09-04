import { useState, useEffect, useCallback, useRef } from 'react';
import { Debut } from '@/content/types';
import { studyEngine, StudyState, ApplyResult } from './study-engine';
import { progressManager } from './progress-manager';
import type { ChessBoardApi } from '@/board/chessground';

// Примечание: studyEngine и progressManager - это singleton экземпляры
// studyEngine экспортируется как: export const studyEngine = new StudyEngine();
// progressManager экспортируется как: export const progressManager = ProgressManager.getInstance();

export function useStudyEngine(debut: Debut) {
  const [state, setState] = useState<StudyState>(studyEngine.getState());
  const boardApiRef = useRef<ChessBoardApi | null>(null);
  const didInitialSyncRef = useRef(false);

  // ⬇️ ОБЪЯВЛЕНИЕ ВВЕРХУ (HOISTED)
  function updateArrowAndDests() {
    if (!boardApiRef.current) return;

    const expectedUci = studyEngine.currentExpectedUci();
    const allowedMoves = studyEngine.getAllowedMoves();
    
    // В GUIDED показываем стрелку на ожидаемый ход (если не в learnedMoves[debutId])
    // В TEST стрелок нет
    const shouldShowArrow = state.mode === 'GUIDED' && 
                           expectedUci && 
                           !progressManager.getLearnedMoves(debut.id).includes(expectedUci);
    
    // НОВЫЙ: сначала позиция/стрелка, потом allowedMoves (порядок важен!)
    boardApiRef.current.showArrow(shouldShowArrow ? expectedUci : null);
    
    // Всегда обновляем allowedMoves последними, иначе cg иногда применяет старые dests
    setTimeout(() => {
      if (boardApiRef.current) {
        boardApiRef.current.setAllowedMoves(allowedMoves);
      }
    }, 0);
    
    // Логи для верификации
    console.debug('FEN', studyEngine.getState().currentFen, 'expected', expectedUci);
    console.debug('[BOARD]', 'setAllowedMoves', Array.from(allowedMoves.entries()));
    
    console.log('useStudyEngine: Updated arrow and dests:', {
      expectedUci,
      shouldShowArrow,
      allowedMoves,
      mode: state.mode
    });
  }

  useEffect(() => {
    // Проверяем, не загружен ли уже этот дебют
    const currentDebut = studyEngine.getState().currentDebut;
    if (currentDebut?.id === debut.id) {
      console.log('StudyEngine: Debut already loaded, skipping start');
      return;
    }

    console.log('StudyEngine: Starting new debut:', debut.id);
    studyEngine.setStateChangeCallback(() => setState(studyEngine.getState()));
    studyEngine.start(debut);
    
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

    // 2) прероллим до очереди ученика (для чёрных это белые ходы),
    //    каждый полуход отрисуем на борде ПО FEN ИСТИНЫ
    const autos = studyEngine.prerollToStudentTurn();
    for (const u of autos) {
      boardApiRef.current.playUci(u, studyEngine.getCurrentFen());
    }

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

  const onMove = useCallback((uci: string): boolean => {
    console.log('useStudyEngine: onMove called with UCI:', uci);
    
    const result: ApplyResult = studyEngine.applyUserMove(uci);
    console.log('useStudyEngine: onMove result:', result);
    
    // Логи для отладки автоответа
    console.debug('[ENGINE]', { 
      uci, 
      opp: result.opponentUci, 
      fenAfterUser: !!result.fenAfterUser, 
      fenAfterBoth: !!result.fenAfterBoth 
    });
    
    if (!result.accepted) {
      // Ход отклонён - показываем сообщение об ошибке
      console.log('useStudyEngine: Move rejected:', result.errorMessage);
      return false; // доска откатит ход
    }
    
    // 1) закрепляем ход ученика по fen истины
    if (boardApiRef.current && result.fenAfterUser) {
      boardApiRef.current.playUci(uci, result.fenAfterUser);
    }

    // 2) тут же рисуем автоответ соперника (если есть) — тоже по fen истины
    if (boardApiRef.current && result.opponentUci && result.fenAfterBoth) {
      boardApiRef.current.playUci(result.opponentUci, result.fenAfterBoth);
    }

    // 2) переходы режима (reset/preroll) – если были
    if (result.modeTransition === "GUIDED_TO_TEST") {
      console.log('useStudyEngine: Transitioning to TEST mode');
      // Синхронизация произойдет автоматически через useEffect
    }
    
    if (result.modeTransition === "COMPLETED") {
      console.log('useStudyEngine: Branch completed');
      // НОВЫЙ: автоматически загружаем следующую ветку
      if (boardApiRef.current && state.currentDebut) {
        const nextBranchId = progressManager.getNextBranchId(state.currentDebut.id, state.currentDebut.branches);
        if (nextBranchId && nextBranchId !== state.currentBranch?.id) {
          console.log('useStudyEngine: Loading next branch:', nextBranchId);
          const nextBranch = state.currentDebut.branches.find(b => b.id === nextBranchId);
          if (nextBranch) {
            studyEngine.loadBranch(nextBranch);
          }
        }
      }
    }

    // 4) стрелка и dests — ТОЛЬКО теперь (позиция уже после ответа)
    updateArrowAndDests();
    
    return true; // доска оставит ход
  }, [state.currentBranch]);

  const onNextBranch = useCallback(() => {
    // TODO: реализовать переход к следующей ветке
    console.log('useStudyEngine: onNextBranch called');
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
    updateArrowAndDests // НОВЫЙ: для принудительного обновления стрелки и dests
  };
}
