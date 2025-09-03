import { useState, useEffect, useCallback } from 'react';
import { Debut } from '@/content/types';
import { studyEngine, StudyState } from './study-engine';
import { progressManager } from './progress-manager';

export function useStudyEngine(debut: Debut) {
  const [state, setState] = useState<StudyState>(studyEngine.getState());

  useEffect(() => {
    // Проверяем, не загружен ли уже этот дебют
    const currentDebut = studyEngine.getState().currentDebut;
    if (currentDebut?.id === debut.id) {
      console.log('StudyEngine: Debut already loaded, skipping start');
      return;
    }

    console.log('StudyEngine: Starting new debut:', debut.id);
    studyEngine.setStateChangeCallback(setState);
    studyEngine.start(debut);
    
    return () => {
      studyEngine.setStateChangeCallback(() => {});
    };
  }, [debut.id]); // Изменяем зависимость на debut.id вместо всего объекта debut

  // Debug: логируем изменения состояния
  useEffect(() => {
    console.log('useStudyEngine: State changed:', {
      mode: state.mode,
      currentStepIndex: state.currentStepIndex,
      currentFen: state.currentFen,
      currentBranch: state.currentBranch?.id
    });
  }, [state]);

  const onMove = useCallback((uci: string): boolean => {
    console.log('useStudyEngine: onMove called with UCI:', uci);
    const result = studyEngine.applyUserMove(uci);
    console.log('useStudyEngine: onMove result:', result);
    return result;
  }, []);

  const onNextBranch = useCallback(() => {
    studyEngine.pickNextBranch();
  }, []);

  const onRestart = useCallback(() => {
    studyEngine.restart();
  }, []);

  // Get current branch info
  const currentBranch = state.currentBranch;
  const currentStepIndex = state.currentStepIndex;
  const mode = state.mode;
  const errors = state.errors;
  const expectedUci = studyEngine.currentExpectedUci();

  // Calculate progress
  const progress = currentBranch 
    ? progressManager.getOverallProgress(debut.id, debut.branches.length)
    : 0;

  return {
    currentBranch,
    currentStepIndex,
    mode,
    errors,
    expectedUci,
    progress,
    onMove,
    onNextBranch,
    onRestart
  };
}
