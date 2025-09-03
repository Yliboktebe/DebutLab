import { BranchStatus, BranchProgress, DebutProgress, UserProgress } from '@/content/types';

const STORAGE_KEY = 'debutlab.v1';

export class ProgressManager {
  private static instance: ProgressManager;
  private progress: UserProgress;

  private constructor() {
    this.progress = this.loadFromStorage();
  }

  static getInstance(): ProgressManager {
    if (!ProgressManager.instance) {
      ProgressManager.instance = new ProgressManager();
    }
    return ProgressManager.instance;
  }

  private loadFromStorage(): UserProgress {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Ensure learnedMoves exists
        if (!parsed.learnedMoves) {
          parsed.learnedMoves = {};
        }
        if (!parsed.debuts) {
          parsed.debuts = {};
        }
        return parsed;
      }
    } catch (error) {
      console.error('Error loading progress from storage:', error);
    }
    
    return { debuts: {}, learnedMoves: {} };
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.progress));
    } catch (error) {
      console.error('Error saving progress to storage:', error);
    }
  }

  getDebutProgress(debutId: string): DebutProgress {
    return this.progress.debuts[debutId] || {};
  }

  updateBranch(debutId: string, branchId: string, updates: Partial<BranchProgress>): void {
    if (!this.progress.debuts[debutId]) {
      this.progress.debuts[debutId] = {};
    }

    this.progress.debuts[debutId][branchId] = {
      ...this.progress.debuts[debutId][branchId],
      ...updates,
      lastAttemptAt: Date.now()
    };

    this.saveToStorage();
  }

  addLearnedMoves(debutId: string, moves: string[]): void {
    if (!this.progress.learnedMoves[debutId]) {
      this.progress.learnedMoves[debutId] = [];
    }

    // Add new moves without duplicates
    moves.forEach(move => {
      if (!this.progress.learnedMoves[debutId].includes(move)) {
        this.progress.learnedMoves[debutId].push(move);
      }
    });

    this.saveToStorage();
  }

  getLearnedMoves(debutId: string): string[] {
    return this.progress.learnedMoves[debutId] || [];
  }

  getDueBranches(debutId: string): string[] {
    const debutProgress = this.getDebutProgress(debutId);
    const now = Date.now();
    
    return Object.entries(debutProgress)
      .filter(([_, progress]) => {
        if (progress.status === 'New') return true;
        if (progress.status === 'Review' || progress.status === 'Relearn') {
          return progress.nextReviewAt && progress.nextReviewAt <= now;
        }
        return false;
      })
      .map(([branchId, _]) => branchId);
  }

  getBranchStatus(debutId: string, branchId: string): BranchStatus {
    const debutProgress = this.getDebutProgress(debutId);
    return debutProgress[branchId]?.status || 'New';
  }

  getBranchErrors(debutId: string, branchId: string): number {
    const debutProgress = this.getDebutProgress(debutId);
    return debutProgress[branchId]?.errors || 0;
  }

  isBranchMastered(debutId: string, branchId: string): boolean {
    return this.getBranchStatus(debutId, branchId) === 'Mastered';
  }

  getOverallProgress(debutId: string, totalBranches: number): number {
    const masteredBranches = Object.values(this.getDebutProgress(debutId))
      .filter(progress => progress.status === 'Mastered').length;
    
    return totalBranches > 0 ? Math.round((masteredBranches / totalBranches) * 100) : 0;
  }

  clearProgress(debutId?: string): void {
    if (debutId) {
      delete this.progress.debuts[debutId];
    } else {
      this.progress = { debuts: {}, learnedMoves: {} };
    }
    this.saveToStorage();
  }
}

export const progressManager = ProgressManager.getInstance();
