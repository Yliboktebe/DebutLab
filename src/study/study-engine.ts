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
  private studentStart: 0 | 1 = 0;  // НОВЫЙ: начальный индекс ученика (0 для белых, 1 для черных)

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
    
    // НОВЫЙ: определяем начальный индекс ученика по стороне дебюта
    this.studentStart = debut.side === 'white' ? 0 : 1;
    this.state.studentIndex = this.studentStart;
    
    this.state.currentFen = this.getStartFen(debut.branches[0].startFen);
    this.state.errors = 0;
    this.state.learnedMoves.clear();
    this.state.mode = 'GUIDED'; // НОВЫЙ: всегда начинаем с GUIDED
    
    // Определяем режим обучения на основе прогресса
    const branchProgress = this.progressManager.getDebutProgress(debut.id)[debut.branches[0].id];
    this.state.learningMode = branchProgress?.status === 'Mastered' ? 'noHints' : 'withHints';
    this.state.stage = branchProgress?.stage || 0;
    
    // Инициализируем комментарий для первого шага
    if (this.state.currentBranch) {
      this.state.currentComment = this.getStepComment(this.state.currentBranch, this.state.studentIndex);
      this.state.showHint = this.state.learningMode === 'withHints';
    }
    
    this.chess = new Chess(this.state.currentFen);
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
    
    // НОВЫЙ: определяем начальный индекс ученика по стороне дебюта
    if (this.state.currentDebut) {
      this.studentStart = this.state.currentDebut.side === 'white' ? 0 : 1;
      this.state.studentIndex = this.studentStart;
    }
    
    this.state.currentFen = this.getStartFen(branch.startFen);
    this.state.errors = 0;
    this.state.learnedMoves.clear();
    this.state.mode = 'GUIDED'; // НОВЫЙ: всегда начинаем с GUIDED
    
    // Определяем режим обучения
    const branchProgress = this.progressManager.getDebutProgress(this.state.currentDebut!.id)[branch.id];
    this.state.learningMode = branchProgress?.status === 'Mastered' ? 'noHints' : 'withHints';
    this.state.stage = branchProgress?.stage || 0;
    
    // Инициализируем комментарий
    this.state.currentComment = this.getStepComment(branch, this.state.studentIndex);
    this.state.showHint = this.state.learningMode === 'withHints';
    
    this.chess = new Chess(this.state.currentFen);
    this.updateState();
  }

  // НОВЫЙ: переименован и изменена сигнатура
  applyUserMove(uci: string): ApplyResult {
    const expectedUci = this.currentExpectedUci();
    
    if (!expectedUci) {
      return { accepted: false, errorMessage: "Ветка завершена", branchFinished: true };
    }
    
    if (uci !== expectedUci) {
      this.state.errors++;
      const sanExp = this.uciToSan(expectedUci);
      return { 
        accepted: false, 
        errorMessage: `Ожидался ход ${sanExp}` 
      };
    }

    // Приняли ход ученика
    try {
      const move = this.chess.move({ 
        from: uci.slice(0, 2), 
        to: uci.slice(2, 4), 
        promotion: uci.length > 4 ? uci[4] as any : undefined 
      });
      
      if (!move) {
        return { accepted: false, errorMessage: "Недопустимый ход" };
      }
      
      // 1) применяем ход ученика в движке
      const fenAfterUser = this.chess.fen();
      
      // 2) СЧИТАЕМ ОТВЕТ ДО ИНКРЕМЕНТА!
      const opponentUci = this.currentOpponentUci();
      
      // 3) если он есть — применяем в движке
      let fenAfterBoth: string | undefined;
      if (opponentUci) {
        try {
          const from = opponentUci.slice(0, 2);
          const to = opponentUci.slice(2, 4);
          let promotion = opponentUci.length > 4 ? opponentUci[4] as any : undefined;
          
          // НОВЫЙ: добавляем промоушен q по умолчанию для продвижения на последнюю линию
          if (!promotion && this.isPawnPromotion(from, to)) {
            promotion = 'q';
          }
          
          const opponentMove = this.chess.move({ from, to, promotion });
          
          if (opponentMove) {
            fenAfterBoth = this.chess.fen();
            this.state.currentFen = fenAfterBoth;
          }
        } catch (error) {
          console.error('Error applying opponent move:', error);
        }
      }
      
      // 4) теперь можно сдвинуться на два полухода
      this.state.studentIndex += 2;
      
      // Проверяем, завершена ли ветка
      const finished = this.state.studentIndex >= (this.state.currentBranch?.ucis.length || 0);
      
      if (finished) {
        if (this.state.mode === 'GUIDED') {
          // Переход в TEST режим
          this.resetToStart('TEST');
          return { 
            accepted: true, 
            opponentUci, 
            branchFinished: true, 
            modeTransition: "GUIDED_TO_TEST",
            fenAfterUser,
            fenAfterBoth
          };
        } else {
          // TEST закончился - обновляем прогресс и learnedMoves
          this.handleBranchCompleted();
          return { 
            accepted: true, 
            opponentUci, 
            branchFinished: true, 
            modeTransition: "COMPLETED",
            fenAfterUser,
            fenAfterBoth
          };
        }
      }
      
      // Обновляем комментарий для следующего шага
      if (this.state.currentBranch) {
        this.state.currentComment = this.getStepComment(this.state.currentBranch, this.state.studentIndex);
        this.state.showHint = this.state.learningMode === 'withHints';
      }
      
      this.updateState();
      return { accepted: true, opponentUci, branchFinished: false, fenAfterUser, fenAfterBoth };
      
    } catch (error) {
      console.error('Error applying user move:', error);
      return { accepted: false, errorMessage: "Ошибка применения хода" };
    }
  }

  // НОВЫЙ: приватный метод для сброса к началу ветки
  private resetToStart(nextMode: StudyMode) {
    this.state.mode = nextMode;
    this.state.studentIndex = this.studentStart;
    this.state.errors = 0;
    this.state.stage = 0; // Сбрасываем stage при переходе в TEST
    
    if (this.state.currentBranch) {
      this.state.currentFen = this.getStartFen(this.state.currentBranch.startFen);
      this.state.currentComment = this.getStepComment(this.state.currentBranch, this.state.studentIndex);
      this.state.showHint = nextMode === 'GUIDED' && this.state.learningMode === 'withHints';
    }
    
    this.chess = new Chess(this.state.currentFen);
    this.updateState();
  }

  // НОВЫЙ: текущий ожидаемый ход ученика
  currentExpectedUci(): string | null {
    if (this.state.currentBranch && this.state.studentIndex < this.state.currentBranch.ucis.length) {
      return this.state.currentBranch.ucis[this.state.studentIndex];
    }
    return null;
  }

  // НОВЫЙ: текущий ожидаемый ответ соперника
  currentOpponentUci(): string | null {
    if (this.state.currentBranch && this.state.studentIndex + 1 < this.state.currentBranch.ucis.length) {
      return this.state.currentBranch.ucis[this.state.studentIndex + 1];
    }
    return null;
  }

  // НОВЫЙ: разрешенные ходы (только ожидаемый ход ученика)
  getAllowedMoves(): Map<string, string[]> {
    const expectedUci = this.currentExpectedUci();
    if (!expectedUci) {
      console.log('StudyEngine: getAllowedMoves - no expected UCI');
      return new Map();
    }
    
    const from = expectedUci.slice(0, 2);
    const to = expectedUci.slice(2, 4);
    
    console.log('StudyEngine: getAllowedMoves - expected move:', expectedUci, 'from:', from, 'to:', to);
    
    // Возвращаем только один разрешенный ход
    const allowedMoves = new Map<string, string[]>();
    allowedMoves.set(from, [to]);
    
    console.log('StudyEngine: getAllowedMoves - returning:', allowedMoves);
    return allowedMoves;
  }

  // НОВЫЙ: прокрутить ответы соперника до первого хода ученика (при старте ветки/режима)
  prerollToStudentTurn(): string[] {
    if (!this.state.currentBranch) return [];
    
    const autos: string[] = [];
    
    // Проигрываем все ходы соперника от начала до первого хода ученика
    for (let i = 0; i < this.state.studentIndex; i++) {
      const uci = this.state.currentBranch.ucis[i];
      if (uci) {
        try {
          // НОВЫЙ: добавляем промоушен q по умолчанию для продвижения на последнюю линию
          const from = uci.slice(0, 2);
          const to = uci.slice(2, 4);
          let promotion = uci.length > 4 ? uci[4] as any : undefined;
          
          // Если продвижение на последнюю линию и промоушен не указан, добавляем q
          if (!promotion && this.isPawnPromotion(from, to)) {
            promotion = 'q';
          }
          
          const move = this.chess.move({ from, to, promotion });
          
          if (move) {
            autos.push(uci);
            this.state.currentFen = this.chess.fen();
          }
        } catch (error) {
          console.error('Error prerolling move:', uci, error);
        }
      }
    }
    
    console.log('StudyEngine: Prerolled moves:', autos, 'currentFen:', this.state.currentFen);
    return autos;
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
    const san = this.uciToSan(move);
    
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

  private uciToSan(uci: string): string {
    if (!uci || uci.length < 4) return '';
    
    try {
      // Используем chess.js для конвертации UCI в SAN
      const tempChess = new Chess(this.state.currentFen);
      const move = tempChess.move({ 
        from: uci.slice(0, 2), 
        to: uci.slice(2, 4), 
        promotion: uci.length > 4 ? uci[4] as any : undefined 
      });
      
      if (move) {
        return move.san;
      }
    } catch (error) {
      console.error('Error converting UCI to SAN:', error);
    }
    
    // Fallback для простых случаев
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    
    if (from === 'e2' && to === 'e4') return 'e4';
    if (from === 'e7' && to === 'e5') return 'e5';
    if (from === 'g1' && to === 'f3') return 'Nf3';
    if (from === 'b8' && to === 'c6') return 'Nc6';
    if (from === 'f1' && to === 'b5') return 'Bb5';
    if (from === 'a7' && to === 'a6') return 'a6';
    if (from === 'b5' && to === 'a4') return 'Ba4';
    if (from === 'g8' && to === 'f6') return 'Nf6';
    
    return `${from}-${to}`;
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
