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
        
        // Миграция: добавляем версию если её нет
        if (!parsed.version) {
          parsed.version = "1.0.0";
        }
        
        // Ensure learnedMoves exists
        if (!parsed.learnedMoves) {
          parsed.learnedMoves = {};
        }
        if (!parsed.debuts) {
          parsed.debuts = {};
        }
        
        // Миграция: конвертируем старые UCI ключи в позиционные (если нужно)
        this.migrateLearnedMoves(parsed);
        
        return parsed;
      }
    } catch (error) {
      console.error('Error loading progress from storage:', error);
    }
    
    return { version: "1.0.0", debuts: {}, learnedMoves: {} };
  }

  private migrateLearnedMoves(progress: UserProgress): void {
    // Если версия старая, конвертируем UCI ключи в позиционные
    // Пока оставляем как есть, но структура готова для миграции
    console.log('ProgressManager: Loaded progress version', progress.version);
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.progress));
    } catch (error) {
      console.error('Error saving progress to storage:', error);
    }
  }

  public save(): void {
    this.saveToStorage();
  }

  getDebutProgress(debutId: string): DebutProgress {
    return this.progress.debuts[debutId] || {};
  }

  private getEmptyDebutProgress(): DebutProgress {
    return {};
  }

  /** Сбрасывает ТОЛЬКО указанный дебют */
  resetDebut(debutId: string): void {
    this.progress.debuts[debutId] = this.getEmptyDebutProgress();
    // также чистим изученные ходы по дебюту, иначе стрелки не вернутся
    if (this.progress.learnedMoves && this.progress.learnedMoves[debutId]) {
      delete this.progress.learnedMoves[debutId];
    }
    this.save();
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
      this.progress = { version: "1.0.0", debuts: {}, learnedMoves: {} };
    }
    this.saveToStorage();
  }

  // НОВЫЙ: получить ID следующей ветки для изучения
  getNextBranchId(debutId: string, branches: any[], now = Date.now()): string {
    const debutProgress = this.getDebutProgress(debutId);
    
    // 1. Собрать due ветки (status in ["Review","Relearn","Mastered"] и nextReviewAt <= now)
    const dueBranches = branches.filter(branch => {
      const progress = debutProgress[branch.id];
      if (!progress) return false;
      
      return (progress.status === 'Review' || progress.status === 'Relearn' || progress.status === 'Mastered') &&
             progress.nextReviewAt && progress.nextReviewAt <= now;
    });
    
    if (dueBranches.length > 0) {
      // Возвращаем первую due ветку
      return dueBranches[0].id;
    }
    
    // 2. Вернуть первую status="New" из type="main_line"
    const newMainLineBranches = branches.filter(branch => {
      const progress = debutProgress[branch.id];
      return (!progress || progress.status === 'New') && branch.type === 'main_line';
    });
    
    if (newMainLineBranches.length > 0) {
      return newMainLineBranches[0].id;
    }
    
    // 3. Иначе — первую status="New" из type="alternative"
    const newAlternativeBranches = branches.filter(branch => {
      const progress = debutProgress[branch.id];
      return (!progress || progress.status === 'New') && branch.type === 'alternative';
    });
    
    if (newAlternativeBranches.length > 0) {
      return newAlternativeBranches[0].id;
    }
    
    // 4. Fallback — любую Review с ближайшим dueAt
    const reviewBranches = branches.filter(branch => {
      const progress = debutProgress[branch.id];
      return progress && progress.status === 'Review' && progress.nextReviewAt;
    });
    
    if (reviewBranches.length > 0) {
      // Сортируем по ближайшему dueAt
      reviewBranches.sort((a, b) => {
        const aProgress = debutProgress[a.id];
        const bProgress = debutProgress[b.id];
        return (aProgress?.nextReviewAt || 0) - (bProgress?.nextReviewAt || 0);
      });
      return reviewBranches[0].id;
    }
    
    // Если ничего не найдено, возвращаем первую ветку
    return branches[0]?.id || '';
  }
}

export const progressManager = ProgressManager.getInstance();
