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
    
    // НОВЫЙ: после старта вызываем preroll если есть boardApi
    if (boardApiRef.current) {
      const autos = studyEngine.prerollToStudentTurn();
      autos.forEach(uci => boardApiRef.current!.playUci(uci));
      updateArrowAndDests();
    }
    
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

  // НОВЫЙ: обновляем стрелку и разрешенные ходы
  const updateArrowAndDests = useCallback(() => {
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
  }, [state.mode, debut.id]);

  // НОВЫЙ: обновляем стрелку и dests при изменении состояния
  useEffect(() => {
    updateArrowAndDests();
  }, [state.studentIndex, state.mode, updateArrowAndDests]);

  const onMove = useCallback((uci: string): boolean => {
    console.log('useStudyEngine: onMove called with UCI:', uci);
    
    const result: ApplyResult = studyEngine.applyUserMove(uci);
    console.log('useStudyEngine: onMove result:', result);
    
    // Логи для отладки автоответа
    console.debug('[ENGINE]', { 
      exp: studyEngine.currentExpectedUci(), 
      opp: result.opponentUci 
    });
    
    if (!result.accepted) {
      // Ход отклонён - показываем сообщение об ошибке
      console.log('useStudyEngine: Move rejected:', result.errorMessage);
      return false; // доска откатит ход
    }
    
    // 1) автоответ соперника — сразу на доску
    if (result.opponentUci && boardApiRef.current) {
      boardApiRef.current.playUci(result.opponentUci);
    }
    
    // 2) если был переход режима — сначала сброс позиции/преролл, потом подсказки
    if (result.modeTransition === "GUIDED_TO_TEST") {
      console.log('useStudyEngine: Transitioning to TEST mode');
      if (boardApiRef.current && state.currentBranch) {
        boardApiRef.current.showArrow(null);
        
        // Проигрываем преролл
        const autos = studyEngine.prerollToStudentTurn();
        autos.forEach(uci => boardApiRef.current!.playUci(uci));
        
        // Сбрасываем позицию к началу ветки
        const startFen = state.currentBranch.startFen === 'startpos' 
          ? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
          : state.currentBranch.startFen;
        boardApiRef.current.setFen(startFen);
      }
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
            // Проигрываем преролл и обновляем UI
            const autos = studyEngine.prerollToStudentTurn();
            autos.forEach(uci => boardApiRef.current!.playUci(uci));
            updateArrowAndDests();
          }
        }
      }
    }
    
    // 3) И ТОЛЬКО ПОТОМ — стрелка и dests (на СВЕЖЕМ FEN)
    queueMicrotask(() => {            // или requestAnimationFrame
      updateArrowAndDests(); // внутри: boardApi.showArrow(...); boardApi.setAllowedMoves(...)
    });
    
    return true; // доска оставит ход
  }, [state.currentBranch, updateArrowAndDests]);

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
