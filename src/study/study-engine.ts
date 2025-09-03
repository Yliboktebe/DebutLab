import { Chess } from 'chess.js';
import { Debut, Branch, StudyMode, Side } from '@/content/types';
import { getStartFen, isStudentTurn, getStudentMoveIndices } from './utils';
import { progressManager } from './progress-manager';
import { SRS } from './srs';

export interface StudyState {
  mode: StudyMode;
  currentDebut: Debut | null;
  currentBranch: Branch | null;
  currentStepIndex: number;
  currentFen: string;
  errors: number;
  learnedMoves: Set<string>;
}

export class StudyEngine {
  private state: StudyState;
  private chess: Chess;
  private onStateChange?: (state: StudyState) => void;

  constructor() {
    this.state = {
      mode: 'IDLE',
      currentDebut: null,
      currentBranch: null,
      currentStepIndex: 0,
      currentFen: '',
      errors: 0,
      learnedMoves: new Set()
    };
    this.chess = new Chess();
  }

  setStateChangeCallback(callback: (state: StudyState) => void): void {
    this.onStateChange = callback;
  }

  private updateState(updates: Partial<StudyState>): void {
    this.state = { ...this.state, ...updates };
    this.onStateChange?.(this.state);
  }

  start(debut: Debut): void {
    this.updateState({
      mode: 'LOAD',
      currentDebut: debut,
      currentBranch: null,
      currentStepIndex: 0,
      errors: 0,
      learnedMoves: new Set(progressManager.getLearnedMoves(debut.id))
    });

    this.pickNextBranch();
  }

  pickNextBranch(): void {
    if (!this.state.currentDebut) return;

    const { currentDebut } = this.state;
    const dueBranches = progressManager.getDueBranches(currentDebut.id);
    
    // Priority: SRS-due > new branches (main_line first, then alternative)
    let nextBranch: Branch | null = null;
    
    // First, check due branches
    for (const branchId of dueBranches) {
      const branch = currentDebut.branches.find(b => b.id === branchId);
      if (branch) {
        nextBranch = branch;
        break;
      }
    }
    
    // If no due branches, pick new ones in order
    if (!nextBranch) {
      const newBranches = currentDebut.branches.filter(branch => 
        progressManager.getBranchStatus(currentDebut.id, branch.id) === 'New'
      );
      
      if (newBranches.length > 0) {
        // Sort: main_line first, then alternative
        nextBranch = newBranches.sort((a, b) => {
          if (a.type === 'main_line' && b.type === 'alternative') return -1;
          if (a.type === 'alternative' && b.type === 'main_line') return 1;
          return 0;
        })[0];
      }
    }

    if (nextBranch) {
      this.loadBranch(nextBranch);
    } else {
      // All branches completed
      this.updateState({ mode: 'COMPLETE' });
    }
  }

  private loadBranch(branch: Branch): void {
    const startFen = getStartFen(branch.startFen);
    this.chess = new Chess(startFen);
    
    this.updateState({
      mode: 'GUIDED',
      currentBranch: branch,
      currentStepIndex: 0,
      currentFen: startFen,
      errors: 0
    });
  }

  currentExpectedUci(): string | null {
    const { currentBranch, currentStepIndex, currentDebut } = this.state;
    
    console.log('StudyEngine.currentExpectedUci:', {
      currentBranch: currentBranch?.id,
      currentStepIndex,
      currentDebut: currentDebut?.id,
      side: currentDebut?.side,
      ucis: currentBranch?.ucis
    });
    
    if (!currentBranch || !currentDebut) {
      console.log('StudyEngine: No currentBranch or currentDebut');
      return null;
    }
    
    // Check if this is a student's turn
    const isStudent = isStudentTurn(currentDebut.side, currentStepIndex);
    console.log('StudyEngine: isStudentTurn:', isStudent, 'for step', currentStepIndex, 'side', currentDebut.side);
    
    if (!isStudent) {
      console.log('StudyEngine: Not student turn');
      return null;
    }
    
    // Check if move is already learned
    const expectedUci = currentBranch.ucis[currentStepIndex];
    console.log('StudyEngine: Expected UCI:', expectedUci, 'at step', currentStepIndex);
    
    if (this.state.learnedMoves.has(expectedUci)) {
      console.log('StudyEngine: Move already learned');
      return null; // No arrow for learned moves
    }
    
    console.log('StudyEngine: Returning expected UCI:', expectedUci);
    return expectedUci;
  }

  applyUserMove(uci: string): boolean {
    const { currentBranch, currentStepIndex, currentDebut } = this.state;
    
    if (!currentBranch || !currentDebut) return false;
    
    // Check if this is student's turn
    if (!isStudentTurn(currentDebut.side, currentStepIndex)) {
      return false;
    }
    
    const expectedUci = currentBranch.ucis[currentStepIndex];
    
    if (uci === expectedUci) {
      // Correct move
      this.handleCorrectMove(uci);
      return true;
    } else {
      // Wrong move
      this.handleWrongMove(expectedUci);
      return false;
    }
  }

  private handleCorrectMove(uci: string): void {
    const { currentBranch, currentStepIndex, currentDebut } = this.state;
    if (!currentBranch || !currentDebut) return;

    console.log('StudyEngine: Handling correct move:', uci);

    // Add to learned moves
    this.state.learnedMoves.add(uci);
    
    // Execute the move
    this.chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] as any });
    console.log('StudyEngine: Student move executed, FEN after:', this.chess.fen());
    
    // Check if opponent has a response
    const nextStepIndex = currentStepIndex + 1;
    if (nextStepIndex < currentBranch.ucis.length) {
      const opponentUci = currentBranch.ucis[nextStepIndex];
      console.log('StudyEngine: Opponent has response:', opponentUci);
      
      // Auto-play opponent move
      this.chess.move({ from: opponentUci.slice(0, 2), to: opponentUci.slice(2, 4), promotion: opponentUci[4] as any });
      const afterOpponentFen = this.chess.fen();
      console.log('StudyEngine: Opponent move executed, FEN after:', afterOpponentFen);
      
      this.updateState({
        currentStepIndex: nextStepIndex + 1,
        currentFen: afterOpponentFen
      });
      
      // Check if branch is complete
      if (nextStepIndex + 1 >= currentBranch.ucis.length) {
        this.completeBranch();
      }
    } else {
      // Branch complete
      this.completeBranch();
    }
  }

  private handleWrongMove(expectedUci: string): void {
    this.updateState({
      errors: this.state.errors + 1
    });
    
    // In GUIDED mode, wrong moves are not allowed
    if (this.state.mode === 'GUIDED') {
      return;
    }
    
    // In TEST mode, show error but don't advance
    console.log(`Ожидался ход: ${expectedUci}`);
  }

  private completeBranch(): void {
    const { currentBranch, currentDebut, errors } = this.state;
    if (!currentBranch || !currentDebut) return;

    // Determine next status based on errors
    let nextStatus: 'Mastered' | 'Review' | 'Relearn';
    let nextReviewAt: number | undefined;
    
    if (errors === 0) {
      nextStatus = 'Mastered';
      const srsInterval = SRS.calculateNextReview(0);
      nextReviewAt = srsInterval.nextReviewAt;
      
      // Add learned moves to progress
      const studentMoves = this.getStudentMovesFromBranch(currentBranch, currentDebut.side);
      progressManager.addLearnedMoves(currentDebut.id, studentMoves);
    } else if (errors <= 2) {
      nextStatus = 'Review';
      const srsInterval = SRS.calculateNextReview(errors);
      nextReviewAt = srsInterval.nextReviewAt;
    } else {
      nextStatus = 'Relearn';
      const srsInterval = SRS.calculateNextReview(errors);
      nextReviewAt = srsInterval.nextReviewAt;
    }
    
    // Update progress
    progressManager.updateBranch(currentDebut.id, currentBranch.id, {
      status: nextStatus,
      errors,
      nextReviewAt
    });
    
    // Move to next branch
    this.pickNextBranch();
  }

  private getStudentMovesFromBranch(branch: Branch, side: Side): string[] {
    const studentIndices = getStudentMoveIndices(side);
    return studentIndices
      .filter(index => index < branch.ucis.length)
      .map(index => branch.ucis[index]);
  }

  getState(): StudyState {
    return { ...this.state };
  }

  restart(): void {
    if (this.state.currentDebut) {
      this.start(this.state.currentDebut);
    }
  }
}

export const studyEngine = new StudyEngine();
