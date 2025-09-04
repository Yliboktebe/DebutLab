import { Chess } from 'chess.js';
import type { Branch, Debut } from '@/content/types';
import { ProgressManager } from './progress-manager';
import { nextReviewAt, type SrsStage } from './srs';

export type StudyMode = 'GUIDED' | 'TEST' | 'REVIEW';

export type ModeTransition = "GUIDED_TO_TEST" | "COMPLETED";

export interface ApplyResult {
  accepted: boolean;
  errorMessage?: string;
  opponentUci?: string | null;
  branchFinished?: boolean;
  modeTransition?: ModeTransition;
  fenAfterUser?: string;       // <— NEW
  fenAfterBoth?: string;       // <— NEW (если есть автоответ)
}

export interface StudyState {
  mode: StudyMode;
  currentDebut: Debut | null;
  currentBranch: Branch | null;
  studentIndex: number;           // НОВЫЙ: индекс следующего хода ученика в branch.ucis
  currentFen: string;
  errors: number;
  learnedMoves: Set<string>;
  learningMode: 'withHints' | 'noHints';
  currentComment: string;
  showHint: boolean;
  stage: number;                  // НОВЫЙ: текущий SRS stage
}

export class StudyEngine {
  private state: StudyState;
  private chess: Chess;
  private progressManager: ProgressManager;
  private stateChangeCallback?: () => void;
  private studentStart: 0 | 1 = 0;         // 0 — учимся за белых, 1 — за чёрных
  private studentIndex = 0;                // номер шага ученика: 0,1,2...
  private nextHalfMove = 0;                // глобальный индекс полухода в ветке

  constructor() {
    this.state = {
      mode: 'GUIDED',
      currentDebut: null,
      currentBranch: null,
      studentIndex: 0,            // НОВЫЙ: будет установлен в start()
      currentFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      errors: 0,
      learnedMoves: new Set(),
      learningMode: 'withHints',
      currentComment: '',
      showHint: false,
      stage: 0                    // НОВЫЙ: начальный SRS stage
    };
    this.chess = new Chess();
    this.progressManager = ProgressManager.getInstance(); // НОВЫЙ: используем singleton
  }

  setStateChangeCallback(callback: () => void): void {
    this.stateChangeCallback = callback;
  }

  getState(): StudyState {
    return { ...this.state };
  }

  // НОВЫЙ: получить текущий FEN от движка
  getCurrentFen(): string {
    return this.chess.fen();
  }

  start(debut: Debut): void {
    this.state.currentDebut = debut;
    this.state.currentBranch = debut.branches[0];
    
    // в start(debut) / loadBranch(branch):
    this.studentStart = debut.side === 'black' ? 1 : 0;
    this.studentIndex = 0;
    this.nextHalfMove = 0;
    
    this.state.currentFen = this.getStartFen(debut.branches[0].startFen);
    this.state.errors = 0;
    this.state.learnedMoves.clear();
    this.state.mode = 'GUIDED'; // НОВЫЙ: всегда начинаем с GUIDED
    
    // Определяем режим обучения на основе прогресса
    const branchProgress = this.progressManager.getDebutProgress(debut.id)[debut.branches[0].id];
    this.state.learningMode = branchProgress?.status === 'Mastered' ? 'noHints' : 'withHints';
    this.state.stage = branchProgress?.stage || 0;
    
    this.chess = new Chess(this.state.currentFen);
    
    // ВАЖНО: если учимся за чёрных — прокрутить белые ходы до первого хода ученика
    this.prerollToStudentTurn();  // вернёт массив uci, уже применённых в this.chess
    
    // Инициализируем комментарий для первого шага
    if (this.state.currentBranch) {
      this.state.currentComment = this.getStepComment(this.state.currentBranch, this.studentIndex);
      this.state.showHint = this.state.learningMode === 'withHints';
    }
    
    this.updateState();
  }

  private getStartFen(startFen: string): string {
    if (startFen === 'startpos') {
      return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    }
    return startFen;
  }

  loadBranch(branch: Branch): void {
    this.state.currentBranch = branch;
    
    // в start(debut) / loadBranch(branch):
    if (this.state.currentDebut) {
      this.studentStart = this.state.currentDebut.side === 'black' ? 1 : 0;
    }
    this.studentIndex = 0;
    this.nextHalfMove = 0;
    
    this.state.currentFen = this.getStartFen(branch.startFen);
    this.state.errors = 0;
    this.state.learnedMoves.clear();
    this.state.mode = 'GUIDED'; // НОВЫЙ: всегда начинаем с GUIDED
    
    // Определяем режим обучения
    const branchProgress = this.progressManager.getDebutProgress(this.state.currentDebut!.id)[branch.id];
    this.state.learningMode = branchProgress?.status === 'Mastered' ? 'noHints' : 'withHints';
    this.state.stage = branchProgress?.stage || 0;
    
    this.chess = new Chess(this.state.currentFen);
    
    // ВАЖНО: если учимся за чёрных — прокрутить белые ходы до первого хода ученика
    this.prerollToStudentTurn();  // вернёт массив uci, уже применённых в this.chess
    
    // Инициализируем комментарий
    this.state.currentComment = this.getStepComment(branch, this.studentIndex);
    this.state.showHint = this.state.learningMode === 'withHints';
    
    this.updateState();
  }

  // ── applyUserMove: строго по индексу и с FEN'ами для UI ───────────────────────
  public applyUserMove(uci: string): ApplyResult {
    const expected = this.currentExpectedUci();
    if (!expected) {
      return { accepted: false, errorMessage: 'Ветка завершена' };
    }
    if (uci !== expected) {
      this.state.errors++;
      const sanExp = this.uciToSanSafe(expected);
      return { accepted: false, errorMessage: `Ожидался ход ${sanExp}` };
    }

    // полуход ученика
    try {
      const from = uci.slice(0, 2);
      const to = uci.slice(2, 4);
      let promotion = uci.length > 4 ? uci[4] as any : undefined;
      
      // Если продвижение на последнюю линию и промоушен не указан, добавляем q
      if (!promotion && this.isPawnPromotion(from, to)) {
        promotion = 'q';
      }
      
      const move = this.chess.move({ from, to, promotion });
      if (!move) {
        return { accepted: false, errorMessage: "Недопустимый ход" };
      }
      
      const fenAfterUser = this.chess.fen();

      // передвинем глобальный указатель с учётом стороны и шага ученика
      this.nextHalfMove = this.studentStart + this.studentIndex * 2 + 1;

      // автоответ оппонента (если есть)
      let opponentUci: string | null = null;
      if (this.nextHalfMove < this.state.currentBranch!.ucis.length) {
        opponentUci = this.state.currentBranch!.ucis[this.nextHalfMove++];
        try {
          const from = opponentUci.slice(0, 2);
          const to = opponentUci.slice(2, 4);
          let promotion = opponentUci.length > 4 ? opponentUci[4] as any : undefined;
          
          // Если продвижение на последнюю линию и промоушен не указан, добавляем q
          if (!promotion && this.isPawnPromotion(from, to)) {
            promotion = 'q';
          }
          
          const opponentMove = this.chess.move({ from, to, promotion });
          if (opponentMove) {
            this.state.currentFen = this.chess.fen();
          }
        } catch (error) {
          console.error('Error applying opponent move:', error);
        }
      }
      const fenAfterBoth = this.chess.fen();

      this.studentIndex += 1;

      const finished = this.studentStart + this.studentIndex * 2 >= this.state.currentBranch!.ucis.length;
      let modeTransition: "GUIDED_TO_TEST" | "COMPLETED" | undefined;
      
      if (finished) {
        if (this.state.mode === 'GUIDED') {
          // Переход в TEST режим
          this.resetToStart('TEST');
          modeTransition = "GUIDED_TO_TEST";
        } else {
          // TEST закончился - обновляем прогресс и learnedMoves
          this.handleBranchCompleted();
          modeTransition = "COMPLETED";
        }
      }
      
      // Обновляем комментарий для следующего шага
      if (this.state.currentBranch) {
        this.state.currentComment = this.getStepComment(this.state.currentBranch, this.studentIndex);
        this.state.showHint = this.state.learningMode === 'withHints';
      }
      
      this.updateState();
      return {
        accepted: true,
        opponentUci,
        branchFinished: finished,
        modeTransition,
        fenAfterUser,
        fenAfterBoth: opponentUci ? fenAfterBoth : fenAfterUser,
      };
      
    } catch (error) {
      console.error('Error applying user move:', error);
      return { accepted: false, errorMessage: "Ошибка применения хода" };
    }
  }

  // НОВЫЙ: приватный метод для сброса к началу ветки
  private resetToStart(nextMode: StudyMode) {
    this.state.mode = nextMode;
    this.studentIndex = 0;
    this.nextHalfMove = 0;
    this.state.errors = 0;
    this.state.stage = 0; // Сбрасываем stage при переходе в TEST
    
    if (this.state.currentBranch) {
      this.state.currentFen = this.getStartFen(this.state.currentBranch.startFen);
      this.state.currentComment = this.getStepComment(this.state.currentBranch, this.studentIndex);
      this.state.showHint = nextMode === 'GUIDED' && this.state.learningMode === 'withHints';
    }
    
    this.chess = new Chess(this.state.currentFen);
    
    // ВАЖНО: если учимся за чёрных — прокрутить белые ходы до первого хода ученика
    this.prerollToStudentTurn();  // вернёт массив uci, уже применённых в this.chess
    
    this.updateState();
  }

  // ── ожидаемый ход ученика в текущей позиции ───────────────────────────────────
  public currentExpectedUci(): string | null {
    const idx = this.studentStart + this.studentIndex * 2; // 0,+2,+4... (белые) или 1,+2,+4... (чёрные)
    return this.state.currentBranch?.ucis[idx] ?? null;
  }

  // НОВЫЙ: текущий ожидаемый ответ соперника
  currentOpponentUci(): string | null {
    if (this.state.currentBranch && this.state.studentIndex + 1 < this.state.currentBranch.ucis.length) {
      return this.state.currentBranch.ucis[this.state.studentIndex + 1];
    }
    return null;
  }

  // ── getAllowedMoves: карта ходов только для expectedUci ───────────────────────
  public getAllowedMoves(): Map<string, string[]> {
    const exp = this.currentExpectedUci();
    if (!exp) return new Map();
    const from = exp.slice(0, 2);
    const to = exp.slice(2, 4);
    return new Map([[from, [to]]]);
  }

  // ── преролл полуходов оппонента до очереди ученика ────────────────────────────
  public prerollToStudentTurn(): string[] {
    if (!this.state.currentBranch) return [];
    
    const played: string[] = [];
    // крутим пока глобальный индекс не совпадёт по чётности со стороной ученика
    while (
      this.nextHalfMove < this.state.currentBranch.ucis.length &&
      (this.nextHalfMove % 2) !== this.studentStart
    ) {
      const uci = this.state.currentBranch.ucis[this.nextHalfMove++];
      try {
        const from = uci.slice(0, 2);
        const to = uci.slice(2, 4);
        let promotion = uci.length > 4 ? uci[4] as any : undefined;
        
        // Если продвижение на последнюю линию и промоушен не указан, добавляем q
        if (!promotion && this.isPawnPromotion(from, to)) {
          promotion = 'q';
        }
        
        const move = this.chess.move({ from, to, promotion });
        if (move) {
          played.push(uci);
          this.state.currentFen = this.chess.fen();
        }
      } catch (error) {
        console.error('Error prerolling move:', uci, error);
      }
    }
    // здесь на очереди ход ученика; studentIndex остаётся 0
    return played;
  }

  // НОВЫЙ: проверка, является ли ход продвижением пешки
  private isPawnPromotion(from: string, to: string): boolean {
    // Проверяем, что это пешка (вторая координата 2 или 7) и ход на последнюю линию (8 или 1)
    const fromRank = from[1];
    const toRank = to[1];
    
    // Белая пешка с 2-й линии на 8-ю
    if (fromRank === '2' && toRank === '8') return true;
    // Чёрная пешка с 7-й линии на 1-ю
    if (fromRank === '7' && toRank === '1') return true;
    
    return false;
  }

  getCurrentExpectedMove(): { from: string; to: string } | null {
    const expectedUci = this.currentExpectedUci();
    if (!expectedUci) return null;
    
    return {
      from: expectedUci.slice(0, 2),
      to: expectedUci.slice(2, 4)
    };
  }

  private getStepComment(branch: Branch, stepIndex: number): string {
    if (stepIndex >= branch.ucis.length) return '';
    
    const move = branch.ucis[stepIndex];
    const san = this.uciToSanSafe(move);
    
    // Простые комментарии для первых ходов
    if (stepIndex === 0 && move === 'e2e4') {
      return 'e4 — белые занимают центр и открывают линию для слона и ферзя';
    }
    if (stepIndex === 2 && move === 'g1f3') {
      return 'Nf3 — развитие коня и контроль центральных полей';
    }
    if (stepIndex === 4 && move === 'f1b5') {
      return 'Bb5 — испанская партия, атака на коня c6';
    }
    
    return `${san} — следующий ход в теории`;
  }

  private uciToSanSafe(uci: string): string {
    try {
      const from = uci.slice(0, 2);
      const to   = uci.slice(2, 4);
      const promo = uci[4];
      // используем временную копию по текущему FEN
      const tmp = new Chess(this.chess.fen());
      const move = tmp.move({ from, to, promotion: promo as any });
      return move?.san ?? uci; // если всё равно не смогли — вернём uci
    } catch {
      return uci;
    }
  }


  // НОВЫЙ: обработка завершения ветки
  private handleBranchCompleted(): void {
    if (!this.state.currentBranch || !this.state.currentDebut) return;
    
    const branchId = this.state.currentBranch.id;
    const debutId = this.state.currentDebut.id;
    
    // 1. Обновляем статус ветки на 'Mastered'
    this.progressManager.updateBranch(debutId, branchId, {
      status: 'Mastered',
      errors: this.state.errors,
      completedAt: Date.now()
    });
    
    // 2. Добавляем все ученические UCI ходы в learnedMoves
    const studentMoves: string[] = [];
    for (let i = this.studentStart; i < this.state.currentBranch.ucis.length; i += 2) {
      const move = this.state.currentBranch.ucis[i];
      if (move) {
        studentMoves.push(move);
      }
    }
    this.progressManager.addLearnedMoves(debutId, studentMoves);
    
    // 3. Вызываем nextReviewAt и сохраняем dueAt
    const currentStage = (this.state.stage || 0) as SrsStage;
    const { dueAt, nextStage } = nextReviewAt(this.state.errors, currentStage);
    this.progressManager.updateBranch(debutId, branchId, {
      nextReviewAt: dueAt,
      stage: nextStage
    });
    
    // 4. Обновляем stage в состоянии
    this.state.stage = nextStage;
    
    console.log('StudyEngine: Branch completed, progress updated:', {
      branchId,
      errors: this.state.errors,
      studentMoves,
      nextReviewAt: dueAt,
      nextStage
    });
  }

  private updateState(): void {
    if (this.stateChangeCallback) {
      this.stateChangeCallback();
    }
  }
}

// Singleton экземпляр
export const studyEngine = new StudyEngine();
