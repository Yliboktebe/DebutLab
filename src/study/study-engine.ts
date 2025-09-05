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
  uiMessage?: { kind: "success" | "info"; text: string; ttlMs?: number };
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
  // nextHalfMove больше не храним — вычисляем при необходимости

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
    this.state.studentIndex = 0;
    
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
      this.state.currentComment = this.getStepComment(this.state.currentBranch, this.state.studentIndex);
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
    this.state.studentIndex = 0;
    
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
    this.state.currentComment = this.getStepComment(branch, this.state.studentIndex);
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

    // ход ученика
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

      // автоответ соперника (ровно один ход)
      const br = this.state.currentBranch!;
      const curStudentHalfMove = this.studentStart + this.state.studentIndex * 2;
      const oppIndex = curStudentHalfMove + 1; // сразу после хода ученика
      const opp = br.ucis[oppIndex] ?? null;
      if (opp) {
        try {
          const from = opp.slice(0, 2);
          const to = opp.slice(2, 4);
          let promotion = opp.length > 4 ? opp[4] as any : undefined;
          
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

      // перейти к следующему ШАГУ ученика (0,1,2...)
      this.state.studentIndex += 1;

      const nextStudentHalfMove = this.studentStart + this.state.studentIndex * 2;
      const branchFinished = nextStudentHalfMove >= br.ucis.length;
      let modeTransition: "GUIDED_TO_TEST" | "COMPLETED" | undefined;
      
      if (branchFinished && this.state.mode === 'GUIDED') {
        this.resetToStart('TEST');
        modeTransition = "GUIDED_TO_TEST";
      } else if (branchFinished && this.state.mode === 'TEST') {
        this.handleBranchCompleted();
        modeTransition = "COMPLETED";
      }
      
      // Обновляем комментарий для следующего шага
      if (this.state.currentBranch) {
        this.state.currentComment = this.getStepComment(this.state.currentBranch, this.state.studentIndex);
        this.state.showHint = this.state.learningMode === 'withHints';
      }
      
      this.updateState();
      
      // Добавляем uiMessage для переходов
      let uiMessage: { kind: "success" | "info"; text: string; ttlMs?: number } | undefined;
      if (modeTransition === "GUIDED_TO_TEST") {
        uiMessage = {
          kind: "info",
          text: "Ветка пройдена. Теперь повтор без подсказок.",
          ttlMs: 900,
        };
      } else if (modeTransition === "COMPLETED") {
        uiMessage = {
          kind: "success",
          text: "Ветка освоена! Переходим к следующей…",
          ttlMs: 1200,
        };
      }
      
      return {
        accepted: true,
        opponentUci: opp,
        branchFinished,
        modeTransition,
        fenAfterUser,
        fenAfterBoth: opp ? fenAfterBoth : fenAfterUser,
        uiMessage,
      };
      
    } catch (error) {
      console.error('Error applying user move:', error);
      return { accepted: false, errorMessage: "Ошибка применения хода" };
    }
  }

  // НОВЫЙ: приватный метод для сброса к началу ветки
  private resetToStart(nextMode: StudyMode) {
    this.state.mode = nextMode;
    this.state.studentIndex = 0;
    this.state.errors = 0;
    this.state.stage = 0; // Сбрасываем stage при переходе в TEST
    
    if (this.state.currentBranch) {
      this.state.currentFen = this.getStartFen(this.state.currentBranch.startFen);
      this.state.currentComment = this.getStepComment(this.state.currentBranch, this.state.studentIndex);
      this.state.showHint = nextMode === 'GUIDED' && this.state.learningMode === 'withHints';
    }
    
    this.chess = new Chess(this.state.currentFen);
    
    // ВАЖНО: если учимся за чёрных — прокрутить белые ходы до первого хода ученика
    this.prerollToStudentTurn();  // вернёт массив uci, уже применённых в this.chess
    
    this.updateState();
  }

  // ── ожидаемый ход ученика в текущей позиции ───────────────────────────────────
  /** Ход, который должен сделать УЧЕНИК на текущем шаге. */
  public currentExpectedUci(): string | null {
    const br = this.state.currentBranch;
    if (!br || !br.ucis?.length) return null;
    // ученик ходит на полуходах: studentStart (0 для белых, 1 для чёрных), затем через каждые 2
    const idx = this.studentStart + this.state.studentIndex * 2;
    return br.ucis[idx] ?? null;
  }

  // НОВЫЙ: текущий ожидаемый ответ соперника
  currentOpponentUci(): string | null {
    const br = this.state.currentBranch;
    if (!br) return null;
    const idx = this.studentStart + this.state.studentIndex * 2 + 1;
    return br.ucis[idx] ?? null;
  }

  // ── getAllowedMoves: карта ходов только для expectedUci ───────────────────────
  public getAllowedMoves(): Map<string, string[]> {
    const exp = this.currentExpectedUci();
    if (!exp) return new Map();
    const from = exp.slice(0, 2);
    const to = exp.slice(2, 4);
    return new Map([[from, [to]]]);
  }

  /** Преролл: сыграть РОВНО ОДИН первый полуход соперника, если сейчас не очередь ученика (идемпотентно). */
  public prerollToStudentTurn(): string[] {
    if (!this.state.currentBranch) return [];
    const student = this.getStudentColor() === 'white' ? 'w' : 'b';
    // работаем с "истинным" движком, а не с временной копией
    if (this.chess.turn() === student) return []; // уже очередь ученика
    const uci = this.state.currentBranch.ucis?.[0];
    if (!uci) return [];
    const legal = new Set(this.chess.moves({ verbose: true }).map(m => m.from + m.to + (m.promotion ?? '')));
    if (!legal.has(uci)) return [];
    const from = uci.slice(0, 2), to = uci.slice(2, 4);
    let promotion = uci.length > 4 ? (uci[4] as any) : undefined;
    if (!promotion && this.isPawnPromotion(from, to)) promotion = 'q';
    this.chess.move({ from, to, promotion });
    this.state.currentFen = this.chess.fen();
    return [uci];
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
    
    // 2. Добавляем все ученические ходы с позиционными ключами
    if (this.state.mode === 'TEST') {
      // после успешного повтора добавляем все ходы ветки как освоенные (по позициям)
      const keys: string[] = [];
      let fen = this.getStartFen(this.state.currentBranch.startFen);
      
      this.state.currentBranch.ucis.forEach((uci, uciIndex) => {
        // ученик ходит на полуходах с индексом %2 === studentStart (0 — белые, 1 — чёрные)
        const isStudentMove = (uciIndex % 2) === this.studentStart;
        
        if (isStudentMove) {
          keys.push(this.buildMoveKey(fen, uci));
        }
        fen = this.applyUciToFen(fen, uci);
      });
      
      this.progressManager.addLearnedMoves(debutId, keys);
    }
    
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
      mode: this.state.mode,
      nextReviewAt: dueAt,
      nextStage
    });
  }

  // 2.1 Перечитать прогресс из ProgressManager после resetDebut
  public reloadProgressForCurrentDebut(): void {
    if (!this.state.currentDebut) return;
    const pm = ProgressManager.getInstance();
    const progress = pm.getDebutProgress(this.state.currentDebut.id);
    // Обновляем learnedMoves из прогресса
    this.state.learnedMoves = new Set(Object.keys(progress.learnedMoves || {}));
  }

  // 2.2 Полный сброс текущей ветки на старт в GUIDED
  public hardResetCurrentDebutToFirstBranch(): void {
    if (!this.state.currentDebut) return;
    
    // сброс внутренних счетчиков
    this.state.mode = "GUIDED";
    this.state.errors = 0;
    this.studentStart = this.state.currentDebut.side === "white" ? 0 : 1;
    this.state.studentIndex = 0; // номер шага УЧЕНИКА, всегда с нуля

    // первая ветка дебюта
    const first = this.state.currentDebut.branches[0];
    this.state.currentBranch = first;

    // чистая позиция
    this.chess.reset();

    // если тренируемся за чёрных — «прокручиваем» первый белый ход
    if (this.studentStart === 1 && first.ucis?.length) {
      const whiteUci = first.ucis[0]; // белый первый ход
      const from = whiteUci.slice(0, 2);
      const to = whiteUci.slice(2, 4);
      let promotion = whiteUci.length > 4 ? whiteUci[4] as any : undefined;
      this.chess.move({ from, to, promotion });
      // У ученика теперь первый шаг (0) ещё впереди, индекс шага НЕ меняем
    }

    this.state.currentFen = this.chess.fen();
    this.updateState();
  }

  // НОВЫЙ: получить ID следующей ветки для изучения
  getNextBranchId(): string | null {
    if (!this.state.currentDebut) return null;
    
    const debutId = this.state.currentDebut.id;
    return this.progressManager.getNextBranchId(debutId, this.state.currentDebut.branches);
  }

  // НОВЫЙ: загрузить ветку по ID
  loadBranchById(branchId: string): void {
    if (!this.state.currentDebut) return;
    
    const branch = this.state.currentDebut.branches.find(b => b.id === branchId);
    if (branch) {
      this.loadBranch(branch);
    }
  }

  // НОВЫЙ: построить ключ хода по позиции
  private buildMoveKey(fenBefore: string, uci: string): string {
    return `${fenBefore}#${uci}`;
  }

  // НОВЫЙ: получить FEN до хода ученика
  private getCurrentFenBeforeUser(): string {
    // Возвращаем FEN до текущего хода ученика
    // Для простоты используем текущий FEN, но в реальности нужно откатить автоответ
    return this.state.currentFen;
  }

  // НОВЫЙ: применить UCI к FEN
  private applyUciToFen(fen: string, uci: string): string {
    try {
      const tempChess = new Chess(fen);
      const from = uci.slice(0, 2);
      const to = uci.slice(2, 4);
      let promotion = uci.length > 4 ? uci[4] as any : undefined;
      
      if (!promotion && this.isPawnPromotion(from, to)) {
        promotion = 'q';
      }
      
      tempChess.move({ from, to, promotion });
      return tempChess.fen();
    } catch (error) {
      console.error('Error applying UCI to FEN:', error);
      return fen;
    }
  }

  // НОВЫЙ: найти индекс UCI в массиве ветки
  private uciIndexOf(uci: string): number {
    return this.state.currentBranch?.ucis.indexOf(uci) ?? -1;
  }


  // НОВЫЙ: проверка, изучен ли ход
  isMoveLearned(uci: string): boolean {
    if (!this.state.currentDebut) return false;
    const debutId = this.state.currentDebut.id;
    const fen = this.getCurrentFenBeforeUser();
    const key = this.buildMoveKey(fen, uci);
    const learned = this.progressManager.getLearnedMoves(debutId);
    return !!learned && learned.includes(key);
  }

  // НОВЫЙ: установить режим изучения
  setMode(mode: StudyMode): void {
    this.state.mode = mode;
    this.updateState();
  }

  /** Текущая ветка, если загружена */
  getCurrentBranch() {
    return this.state?.currentBranch;
  }

  /** Получить цвет ученика */
  getStudentColor(): 'white' | 'black' {
    return this.state.currentDebut?.side || 'white';
  }

  /** Запустить дебют, если он ещё не загружен */
  async startDebutIfNeeded(debutId: string): Promise<void> {
    if (this.state.currentDebut?.id === debutId) {
      return; // уже загружен
    }
    // В текущей реализации дебют передается напрямую в useStudyEngine
    // Этот метод пока что заглушка для совместимости с новым API
  }

  private updateState(): void {
    if (this.stateChangeCallback) {
      this.stateChangeCallback();
    }
  }
}

// Singleton экземпляр
export const studyEngine = new StudyEngine();
