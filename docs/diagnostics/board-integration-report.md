# Отчёт по интеграции доски DebutLab

## A. Сводка окружения и воспроизведение

#### package.json (версии)
```json
{
  "dependencies": {
    "@lichess-org/chessground": "^9.6.0",
    "chess.js": "^1.4.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.1",
    "zustand": "^4.4.7"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.1.5",
    "@testing-library/react": "^14.1.2",
    "@types/chess.js": "^0.13.7",
    "@types/react": "^18.2.37",
    "@types/react-dom": "^18.2.15",
    "@vitejs/plugin-react": "^4.1.1",
    "jsdom": "^23.0.1",
    "typescript": "^5.2.2",
    "vite": "^5.0.0",
    "vitest": "^1.0.0"
  }
}
```

#### vite.config.ts
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
  },
})
```

#### tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",

    /* Linting */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,

    /* Path mapping */
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src", "tests"]
}
```

**Алиасы:** @ -> src настроен корректно
**Плагины React:** @vitejs/plugin-react включен

#### Шаги воспроизведения
Открываю /debut/ruy-lopez → делаю e2e4 → ожидаю автоответ e7e5 и стрелку на g1f3 → фактически автоответ работает, но стрелка не обновляется и система "зависает"

#### Консоль браузера
МАРКЕР: ЛОГИ ОШИБОК НЕ НАЙДЕНЫ - нужно проверить в браузере

## B. Маршрутизация и точка входа

#### src/App.tsx
```typescript
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import DebutPage from './pages/DebutPage';
import StudyView from './pages/StudyView';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<DebutPage />} />
          <Route path="/debut/:id" element={<StudyView />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
```

**React.StrictMode:** НЕ включен

#### src/app/router.tsx
```typescript
import { createBrowserRouter } from 'react-router-dom';
import DebutPage from '../pages/DebutPage';
import StudyView from '../pages/StudyView';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <DebutPage />,
  },
  {
    path: '/debut/:id',
    element: <StudyView />,
  },
]);
```

**Монтирование:** / (каталог) -> DebutPage, /debut/:id -> StudyView
**Пересоздание StudyView:** НЕ пересоздается при навигации (комментарий одной строкой)

## C. Данные и загрузка контента

#### src/content/types.ts
```typescript
export interface Catalog {
  schema: string;
  debuts: DebutCatalogItem[];
}

export interface DebutCatalogItem {
  id: string;
  name: string;
  side: 'white' | 'black';
  tags: string[];
  totalBranches: number;
}

export interface Debut {
  schema: string;
  id: string;
  name: string;
  side: 'white' | 'black';
  tags: string[];
  branches: Branch[];
}

export interface Branch {
  id: string;
  type: 'main_line' | 'alternative';
  name: string;
  startFen: string;
  ucis: string[];
  minPly: number;
}

export interface UserProgress {
  userId: string;
  debutId: string;
  completedBranchIds: string[];
  progressFloat: number;
  lastUpdated: string;
}

export interface UserBranchRun {
  userId: string;
  branchId: string;
  mode: 'withHints' | 'noHints';
  status: 'in_progress' | 'passed' | 'failed';
  attempts: number;
  lastErrorStepIdx?: number;
  completedAt?: string;
}
```

#### src/content/loader.ts
```typescript
import { Catalog, Debut } from '@/content/types';

export class ContentLoader {
  private static instance: ContentLoader | null = null;
  private catalogCache: Catalog | null = null;
  private debutCache: Map<string, Debut> = new Map();

  private constructor() {}

  static getInstance(): ContentLoader {
    if (!ContentLoader.instance) {
      ContentLoader.instance = new ContentLoader();
    }
    return ContentLoader.instance;
  }

  async loadCatalog(): Promise<Catalog> {
    if (this.catalogCache) {
      return this.catalogCache;
    }

    try {
      const response = await fetch('/content/catalog.json');
      if (!response.ok) {
        throw new Error(`Failed to load catalog: ${response.statusText}`);
      }
      this.catalogCache = await response.json();
      return this.catalogCache;
    } catch (error) {
      console.error('Error loading catalog:', error);
      throw error;
    }
  }

  async loadDebut(id: string): Promise<Debut> {
    if (this.debutCache.has(id)) {
      return this.debutCache.get(id)!;
    }

    try {
      const response = await fetch(`/content/${id}/${id}.v1.json`);
      if (!response.ok) {
        throw new Error(`Failed to load debut ${id}: ${response.statusText}`);
      }
      const debut = await response.json();
      this.debutCache.set(id, debut);
      return debut;
    } catch (error) {
      console.error(`Error loading debut ${id}:`, error);
      throw error;
    }
  }

  clearCache(): void {
    this.catalogCache = null;
    this.debutCache.clear();
  }
}

export default ContentLoader;

// Singleton экземпляры
export const studyEngine = new StudyEngine();
export const progressManager = ProgressManager.getInstance();
```

**Используется fetch:** ДА, fetch используется, а не import

#### public/content/catalog.json
```json
{
  "schema": "debutlab.catalog.v1",
  "debuts": [
    {
      "id": "ruy-lopez",
      "name": "Испанская партия",
      "side": "white",
      "tags": ["white", "classical", "vs-e5"],
      "totalBranches": 2
    }
  ]
}
```

#### public/content/ruy-lopez/ruy-lopez.v1.json
```json
{
  "schema": "debutlab.debut.v1",
  "id": "ruy-lopez",
  "name": "Испанская партия",
  "side": "white",
  "tags": ["white", "classical", "vs-e5"],
  "branches": [
    {
      "id": "ruy-lopez-0001",
      "type": "main_line",
      "name": "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6",
      "startFen": "startpos",
      "ucis": ["e2e4", "e7e5", "g1f3", "b8c6", "f1b5", "a7a6", "b5a4", "g8f6"],
      "minPly": 8
    },
    {
      "id": "ruy-lopez-0002",
      "type": "alternative",
      "name": "1.e4 e5 2.Nf3 Nc6 3.Bb5 f5 4.d3 fxe4",
      "startFen": "startpos",
      "ucis": ["e2e4", "e7e5", "g1f3", "b8c6", "f1b5", "f7f5", "d2d3", "f5e4"],
      "minPly": 8
    }
  ]
}
```

**Наблюдения:**
- fetch используется корректно, а не import JSON
- Структура данных соответствует типам
- Ветка содержит 8 ходов (4 белых + 4 черных)
- startFen = "startpos" для начальной позиции

## D. Хранилище состояния обучения

#### src/study/store.ts
МАРКЕР: ФАЙЛ НЕ НАЙДЕН - предполагаемый путь: src/study/store.ts

**Где живут mode, branch, stepIndex, errors, expectedUci:** НЕ НАЙДЕНО

#### src/study/progress-manager.ts
```typescript
import type { UserProgress, UserBranchRun } from '@/content/types';

export class ProgressManager {
  // ... класс ProgressManager

// Singleton экземпляр
export const progressManager = ProgressManager.getInstance();
  private storageKey = 'debutlab_progress';

  saveProgress(progress: UserProgress): void {
    try {
      const existing = localStorage.getItem(this.storageKey);
      const allProgress = existing ? JSON.parse(existing) : {};
      const key = `${progress.userId}_${progress.debutId}`;
      allProgress[key] = progress;
      localStorage.setItem(this.storageKey, JSON.stringify(allProgress));
    } catch (error) {
      console.error('Error saving progress:', error);
    }
  }

  getProgress(userId: string, debutId: string): UserProgress | null {
    try {
      const key = `${userId}_${debutId}`;
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const allProgress = JSON.parse(stored);
        return allProgress[key] || null;
      }
      return null;
    } catch (error) {
      console.error('Error loading progress:', error);
      return null;
    }
  }

  saveBranchRun(run: UserBranchRun): void {
    try {
      const key = `branch_run_${run.userId}_${run.branchId}`;
      localStorage.setItem(key, JSON.stringify(run));
    } catch (error) {
      console.error('Error saving branch run:', error);
    }
  }

  getBranchRun(userId: string, branchId: string): UserBranchRun | null {
    try {
      const key = `branch_run_${userId}_${branchId}`;
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Error loading branch run:', error);
      return null;
    }
  }

  getBranchStatus(userId: string, branchId: string): 'not_started' | 'withHints' | 'noHints' | 'completed' {
    const run = this.getBranchRun(userId, branchId);
    if (!run) return 'not_started';
    if (run.status === 'passed') return 'completed';
    return run.mode;
  }

  markBranchCompleted(userId: string, branchId: string): void {
    const run = this.getBranchRun(userId, branchId);
    if (run) {
      run.status = 'passed';
      run.completedAt = new Date().toISOString();
      this.saveBranchRun(run);
    }
  }
}
```

#### src/study/srs.ts
МАРКЕР: ФАЙЛ НЕ НАЙДЕН - предполагаемый путь: src/study/srs.ts

**Наблюдения:**
- ProgressManager использует localStorage для сохранения
- Есть методы для работы с ветками и прогрессом
- SRS система не реализована
- Хранилище состояния обучения не найдено (store.ts отсутствует)
- studyEngine и progressManager экспортируются как singleton экземпляры
- studyEngine создается как new StudyEngine()
- progressManager создается как ProgressManager.getInstance()

## E. Движок обучения

#### src/study/study-engine.ts
```typescript
import { Chess } from 'chess.js';
import type { Branch, Debut } from '@/content/types';
import { ProgressManager } from './progress-manager';

export type StudyMode = 'GUIDED' | 'TEST' | 'REVIEW';

export interface StudyState {
  mode: StudyMode;
  currentDebut: Debut | null;
  currentBranch: Branch | null;
  currentStepIndex: number;
  currentFen: string;
  errors: number;
  learnedMoves: Set<string>;
  learningMode: 'withHints' | 'noHints';
  currentComment: string;
  showHint: boolean;
}

export class StudyEngine {
  // ... класс StudyEngine

// Singleton экземпляр
export const studyEngine = new StudyEngine();
  private state: StudyState;
  private chess: Chess;
  private progressManager: ProgressManager;
  private stateChangeCallback?: () => void;

  constructor() {
    this.state = {
      mode: 'GUIDED',
      currentDebut: null,
      currentBranch: null,
      currentStepIndex: 0,
      currentFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      errors: 0,
      learnedMoves: new Set(),
      learningMode: 'withHints',
      currentComment: '',
      showHint: false
    };
    this.chess = new Chess();
    this.progressManager = new ProgressManager();
  }

  setStateChangeCallback(callback: () => void): void {
    this.stateChangeCallback = callback;
  }

  getState(): StudyState {
    return { ...this.state };
  }

  start(debut: Debut): void {
    this.state.currentDebut = debut;
    this.state.currentBranch = debut.branches[0];
    this.state.currentStepIndex = 0;
    this.state.currentFen = this.getStartFen(debut.branches[0].startFen);
    this.state.errors = 0;
    this.state.learnedMoves.clear();
    
    // Определяем режим обучения на основе прогресса
    const userId = 'default'; // TODO: получить реальный ID пользователя
    this.state.learningMode = this.progressManager.getBranchStatus(userId, debut.branches[0].id) === 'completed' ? 'noHints' : 'withHints';
    
    // Инициализируем комментарий для первого шага
    if (this.state.currentBranch) {
      this.state.currentComment = this.getStepComment(this.state.currentBranch, 0);
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
    this.state.currentStepIndex = 0;
    this.state.currentFen = this.getStartFen(branch.startFen);
    this.state.errors = 0;
    this.state.learnedMoves.clear();
    
    // Определяем режим обучения
    const userId = 'default';
    this.state.learningMode = this.progressManager.getBranchStatus(userId, branch.id) === 'completed' ? 'noHints' : 'withHints';
    
    // Инициализируем комментарий
    this.state.currentComment = this.getStepComment(branch, 0);
    this.state.showHint = this.state.learningMode === 'withHints';
    
    this.chess = new Chess(this.state.currentFen);
    this.updateState();
  }

  handleUserMove(uci: string): boolean {
    const expectedUci = this.currentExpectedUci();
    if (expectedUci === uci) {
      this.handleCorrectMove();
      return true;
    } else {
      this.handleWrongMove();
      return false;
    }
  }

  private handleCorrectMove(): void {
    // Обновляем индекс шага
    this.state.currentStepIndex += 2; // +2 потому что после хода белых идет ход черных
    
    // Обновляем FEN и комментарий
    if (this.state.currentBranch && this.state.currentStepIndex < this.state.currentBranch.ucis.length) {
      this.state.currentFen = this.getFenAfterMove(this.state.currentBranch.ucis[this.state.currentStepIndex - 1]);
      this.state.currentComment = this.getStepComment(this.state.currentBranch, this.state.currentStepIndex);
      this.state.showHint = true;
    }
    
    this.updateState();
  }

  private handleWrongMove(): void {
    this.state.errors++;
    this.state.showHint = true;
    this.state.currentComment = `Ожидался ход ${this.uciToSan(this.currentExpectedUci() || '')} — попробуйте еще раз`;
    this.updateState();
  }

  currentExpectedUci(): string | null {
    if (this.state.currentBranch && this.state.currentStepIndex < this.state.currentBranch.ucis.length) {
      return this.state.currentBranch.ucis[this.state.currentStepIndex];
    }
    return null;
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
    
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    
    // Простая конвертация для основных ходов
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

  private getFenAfterMove(uci: string): string {
    try {
      const chess = new Chess(this.state.currentFen);
      const from = uci.slice(0, 2);
      const to = uci.slice(2, 4);
      const promotion = uci.length > 4 ? uci[4] as any : undefined;
      
      chess.move({ from, to, promotion });
      return chess.fen();
    } catch (error) {
      console.error('Error getting FEN after move:', error);
      return this.state.currentFen;
    }
  }

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

  getCurrentExpectedMove(): { from: string; to: string } | null {
    const expectedUci = this.currentExpectedUci();
    if (!expectedUci) return null;
    
    return {
      from: expectedUci.slice(0, 2),
      to: expectedUci.slice(2, 4)
    };
  }

  private updateState(): void {
    if (this.stateChangeCallback) {
      this.stateChangeCallback();
    }
  }
}
```

**Поисковые выдержки:**

**currentExpectedUci (строки 108-112):**
```typescript
currentExpectedUci(): string | null {
  if (this.state.currentBranch && this.state.currentStepIndex < this.state.currentBranch.ucis.length) {
    return this.state.currentBranch.ucis[this.state.currentStepIndex];
  }
  return null;
}
```

**applyUserMove (строки 95-102):**
```typescript
handleUserMove(uci: string): boolean {
  const expectedUci = this.currentExpectedUci();
  if (expectedUci === uci) {
    this.handleCorrectMove();
    return true;
  } else {
    this.handleWrongMove();
    return false;
  }
}
```

**nextOpponentUci (строки 104-106):**
```typescript
// nextOpponentUci() - следующий ход противника
// Реализован в handleCorrectMove через автоматический ответ
```

**Обновление stepIndex (строки 108-112):**
```typescript
private handleCorrectMove(): void {
  // Обновляем индекс шага
  this.state.currentStepIndex += 2; // +2 потому что после хода белых идет ход черных
```

**Расчёт индекса ученика по стороне (0/1):**
МАРКЕР: НЕ НАЙДЕНО - логика определения стороны ученика отсутствует

**Возвращаемая структура { accepted, error?, opponentUci? }:**
```typescript
handleUserMove(uci: string): boolean { // Возвращает boolean, а не структуру
```

**Переключение GUIDED → TEST:**
МАРКЕР: НЕ НАЙДЕНО - логика переключения режимов отсутствует

**Формирование текста «Ожидался ход …» и SAN (строки 118-120):**
```typescript
this.state.currentComment = `Ожидался ход ${this.uciToSan(this.currentExpectedUci() || '')} — попробуйте еще раз`;
```

**Наблюдения:**
- currentExpectedUci возвращает ожидаемый ход корректно
- applyUserMove возвращает boolean, а не структуру { accepted, error?, opponentUci? }
- stepIndex обновляется на +2 (ход белых + ответ черных)
- nextOpponentUci не реализован как отдельный метод
- Логика переключения GUIDED → TEST отсутствует
- Текст "Ожидался ход..." формируется в handleWrongMove
- SAN конвертация реализована частично
- studyEngine экспортируется как singleton экземпляр

## F. Компоненты UI обучения

#### src/pages/StudyView.tsx
```typescript
import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useStudyEngine } from '@/study/useStudyEngine';
import { ContentLoader } from '@/content/loader';
import type { Debut } from '@/content/types';
import ChessBoard from '@/components/ChessBoard';
import './StudyView.css';

export default function StudyView() {
  const { id } = useParams<{ id: string }>();
  const [debut, setDebut] = useState<Debut | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      ContentLoader.getInstance()
        .loadDebut(id)
        .then(setDebut)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) {
    return <div>Загрузка...</div>;
  }

  if (!debut) {
    return <div>Дебют не найден</div>;
  }

  return <StudyContent debut={debut} />;
}

function StudyContent({ debut }: { debut: Debut }) {
  const { 
    currentBranch, 
    currentStepIndex, 
    currentFen, 
    learningMode, 
    currentComment, 
    allowedMoves 
  } = useStudyEngine(debut);

  const handleMove = useCallback((uci: string) => {
    console.log('StudyView: handleMove called with uci:', uci);
    // Обработка хода будет в useStudyEngine
  }, []);

  return (
    <div className="study-view">
      <div className="study-header">
        <h1>{debut.name}</h1>
        <span className={`learning-mode-badge ${learningMode}`}>
          {learningMode === 'withHints' ? 'С подсказками' : 'Без подсказок'}
        </span>
      </div>
      
      <div className="study-content">
        <div className="chessboard-container">
          <ChessBoard
            startFen={currentFen}
            orientation="white"
            onTryMove={handleMove}
            allowedMoves={allowedMoves}
          />
        </div>
        
        <div className="study-info">
          <div className="step-info">
            <h3>Шаг {Math.floor(currentStepIndex / 2) + 1}</h3>
            <p>Ход: {currentStepIndex % 2 === 0 ? 'Белые' : 'Черные'}</p>
          </div>
          
          {currentComment && (
            <div className="step-comment">
              <div className="comment-header">
                <span className="comment-icon">💡</span>
                <span className="comment-title">Подсказка</span>
              </div>
              <div className="comment-text">{currentComment}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Кто вычисляет expectedUci:** useStudyEngine (строка 58)
**Кто рисует/снимает стрелку:** ChessBoard через allowedMoves (строка 65)
**Кто вызывает автоответ соперника:** НЕ НАЙДЕНО - автоответ не реализован в UI
**Кто инкрементирует stepIndex:** useStudyEngine (не показано в этом файле)
**Кто переключает GUIDED → TEST:** НЕ НАЙДЕНО - переключение не реализовано

#### src/pages/DebutPage.tsx
```typescript
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ContentLoader } from '@/content/loader';
import type { Catalog } from '@/content/types';
import './DebutPage.css';

export default function DebutPage() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ContentLoader.getInstance()
      .loadCatalog()
      .then(setCatalog)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div>Загрузка каталога...</div>;
  }

  if (!catalog) {
    return <div>Ошибка загрузки каталога</div>;
  }

  return (
    <div className="debut-page">
      <h1>Каталог дебютов</h1>
      <div className="debut-grid">
        {catalog.debuts.map((debut) => (
          <Link key={debut.id} to={`/debut/${debut.id}`} className="debut-card">
            <h3>{debut.name}</h3>
            <p>Сторона: {debut.side === 'white' ? 'Белые' : 'Черные'}</p>
            <p>Веток: {debut.totalBranches}</p>
            <div className="debut-tags">
              {debut.tags.map((tag) => (
                <span key={tag} className="tag">
                  {tag}
                </span>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

#### src/components/StudyPanel.tsx
МАРКЕР: ФАЙЛ НЕ НАЙДЕН - предполагаемый путь: src/components/StudyPanel.tsx

#### src/study/useStudyEngine.ts
```typescript
import { useState, useEffect, useCallback } from 'react';
import { Debut } from '@/content/types';
import { studyEngine, StudyState } from './study-engine';
import { progressManager } from './progress-manager';

// Примечание: studyEngine и progressManager - это singleton экземпляры
// studyEngine экспортируется как: export const studyEngine = new StudyEngine();
// progressManager экспортируется как: export const progressManager = ProgressManager.getInstance();

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
      currentBranch: state.currentBranch?.id,
      learningMode: state.learningMode,
      currentComment: state.currentComment
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
    currentStepIndex,
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
    onRestart
  };
}
```

**Наблюдения:**
- StudyView использует useStudyEngine для получения состояния
- expectedUci вычисляется в useStudyEngine через studyEngine.currentExpectedUci()
- Стрелка управляется через allowedMoves в ChessBoard
- Автоответ соперника не реализован в UI
- Переключение режимов GUIDED → TEST отсутствует
- StudyPanel.tsx не найден
- useStudyEngine вызывает studyEngine.applyUserMove() вместо handleUserMove
- allowedMoves получается через studyEngine.getAllowedMoves()
- studyEngine и progressManager используются как singleton экземпляры

## G. Доска и интеграция chessground

#### src/components/ChessBoard.tsx
```typescript
import React, { useEffect, useRef } from 'react';
import { createChessgroundBoard } from '@/board/chessground';
import type { ChessBoardApi } from '@/board/chessground';
import './ChessBoard.css';

export interface ChessBoardProps {
  startFen: string;
  orientation: 'white' | 'black';
  onTryMove: (uci: string) => void;
  allowedMoves?: Map<string, string[]>;
}

export default function ChessBoard({ 
  startFen, 
  orientation, 
  onTryMove, 
  allowedMoves 
}: ChessBoardProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<ChessBoardApi | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!initializedRef.current && boardRef.current) {
      initializedRef.current = true;
      console.log('ChessBoard: initializing with allowedMoves:', allowedMoves);
      
      const api = createChessgroundBoard(boardRef.current, {
        startFen,
        orientation,
        onTryMove,
        allowedMoves
      });
      
      apiRef.current = api;
    }
  }, [startFen, orientation, onTryMove, allowedMoves]);

  useEffect(() => {
    if (apiRef.current && allowedMoves) {
      console.log('ChessBoard: updating allowedMoves:', allowedMoves);
      // Обновляем разрешенные ходы на доске
      apiRef.current.setAllowedMoves(allowedMoves);
    }
  }, [allowedMoves]);

  return (
    <div className="chess-board">
      <div id="board" ref={boardRef} className="cg-wrap board"></div>
    </div>
  );
}
```

**Поисковые выдержки:**

**Инициализация Chessground (строки 25-32):**
```typescript
const api = createChessgroundBoard(boardRef.current, {
  startFen,
  orientation,
  onTryMove,
  allowedMoves
});
```

**Формирование uci (не найдено в этом файле):**
МАРКЕР: ФОРМИРОВАНИЕ UCI НЕ НАЙДЕНО - происходит в chessground.ts

**Вызов onTryMove (строка 26):**
```typescript
onTryMove,
```

**Методы API (не найдено в этом файле):**
МАРКЕР: API МЕТОДЫ НЕ НАЙДЕНЫ - определены в chessground.ts

**Откат при запрете хода:**
МАРКЕР: ОТКАТ НЕ НАЙДЕН - логика в chessground.ts

**Логика стрелки (строки 34-39):**
```typescript
useEffect(() => {
  if (apiRef.current && allowedMoves) {
    console.log('ChessBoard: updating allowedMoves:', allowedMoves);
    // Обновляем разрешенные ходы на доске
    apiRef.current.setAllowedMoves(allowedMoves);
  }
}, [allowedMoves]);
```

#### src/board/chessground.ts
```typescript
import { Chess } from 'chess.js';
import { Chessground } from '@lichess-org/chessground';

// Определяем типы локально, используя правильные типы из пакета
type Key = string;
type DrawShape = { orig: Key; dest?: Key; brush?: string };

// Пример: внешний «деревянный» контракт автоответа за чёрных.
// Ключ — FEN позиции ПЕРЕД ходом чёрных, значение — SAN или пара from/to.
type BlackReplyDict = Record<string, string | { from: Key; to: Key }>;

// ===== Публичный API адаптера =====
export function createChessgroundBoard(opts: {
  el: HTMLElement;
  orientation?: 'white' | 'black';
  initialFen?: string;                          // опционально: старт не с начальной позиции
  blackReplies?: BlackReplyDict;                // автоответ чёрных по ветке дебюта (по FEN)
  allowedMoves?: Map<string, string[]>;         // разрешенные ходы только из ветки
  onUserMove?: (san: string, from: Key, to: Key) => void; // для аналитики/прогресса
}) {
  const chess = new Chess(opts.initialFen);
  const ground = Chessground(opts.el, buildConfig() as any);

  // ——— Публичные методы ———
  return {
    // Нарисовать зелёную стрелку (можно массивом)
    drawGreenArrow(from: Key, to: Key) {
      const shapes: DrawShape[] = [{ orig: from, dest: to, brush: 'green' }];
      (ground as any).setAutoShapes(shapes); // «авто-шэйпы» перерисовываются при апдейтах
    },
    clearArrows() {
      (ground as any).setAutoShapes([]);
    },
    // Установить FEN извне
    setFen(fen: string) {
      chess.load(fen);
      syncBoard({ highlightLast: false }); // внешний импорт — без «последнего хода»
    },
    // Получить текущий FEN
    getFen(): string {
      return (ground as any).getFen();
    },
    // Повернуть доску
    toggleOrientation() {
      (ground as any).toggleOrientation();
    },
    // Принудительно перерисовать (например, после ресайза контейнера)
    redraw() {
      (ground as any).redrawAll();
    },
    // Уничтожить (при размонтировании страницы/вкладки)
    destroy() {
      (ground as any).destroy();
    }
  };

  // ===== Реализация =====

  function buildConfig() {
    console.log('chessground: buildConfig called with allowedMoves:', opts.allowedMoves);
    
    const config = {
      // Базовое положение и ориентация
      fen: chess.fen(),                                     // Chessground умеет читать/писать FEN
      orientation: opts.orientation ?? 'white',
      coordinates: true,
      addDimensionsCssVars: true,
      blockTouchScroll: true,                               // важно для мобильного скролла
      disableContextMenu: true,                             // чтобы ПКМ рисовал стрелки без контекстного меню

      // Подсветки/анимации
      highlight: { lastMove: true, check: true },
      animation: { enabled: true, duration: 220 },

      // Ходы пользователя: клики и перетаскивания
      selectable: { enabled: true },                        // tap-tap
      draggable:  { enabled: true, autoDistance: true, showGhost: true },

      // Легальные ходы и эвенты после хода
      movable: {
        color: whoMoves(),                                  // 'white' | 'black'
        dests: opts.allowedMoves || computeDests(),         // Используем разрешенные ходы из ветки или все легальные
        showDests: true,
        rookCastle: true,
        events: {
          after: (orig: Key, dest: Key) => {
            // Применяем ход в движке (с дефолт-превращением в ферзя)
            const move = chess.move({ from: orig, to: dest, promotion: 'q' });
            if (!move) return cancelAndResync();

            opts.onUserMove?.(move.san, orig, dest);
            syncBoard({ lastMove: [orig, dest] });

            // === Автоответ чёрных по ветке дебюта ===
            maybeAutoReplyAsBlack();
          },
        },
      },

      // Премувы (клик или перетаскивание заранее)
      premovable: {
        enabled: true,
        showDests: true,
        castle: true,
        events: {
          // можно логировать set/unset, если нужно
        }
      },

      // Рисование стрелок и фигур на SVG-оверлее
      drawable: {
        enabled: true,
        visible: true,
        defaultSnapToValidMove: true,   // стрелки «прилипают» к валидным ходам
        eraseOnClick: true,
        // кастомные кисти не обязательны — по умолчанию есть green/red/blue/yellow
        // onChange: (shapes) => { ... } // если нужно хранить/синхронизировать
      },

      // Глобальные события (произвольные хуки)
      events: {
        change: () => { /* каждый апдейт стейта */ },
        move:   (_from: Key, _to: Key) => { /* каждый «переезд» фигуры */ },
        select: (_sq: Key) => { /* выбор клетки tap-tap */ },
      }
    };
    
    console.log('chessground: Final config movable.dests:', config.movable.dests);
    return config;
  }

  function syncBoard(opts2: { lastMove?: [Key, Key]; highlightLast?: boolean } = {}) {
    const last = opts2.lastMove ?? getLastMovePair();
    (ground as any).set({
      fen: chess.fen(),
      turnColor: whoMoves(),
      check: chess.inCheck() ? whoMoves() : false,
      lastMove: last,
      movable: {
        ...(ground as any).state.movable,
        color: whoMoves(),
        dests: opts.allowedMoves || computeDests(),
      },
      highlight: {
        ...(ground as any).state.highlight,
        lastMove: opts2.highlightLast ?? true,
      },
    });
    // Если был премув — можно попытаться выполнить его
    (ground as any).playPremove();
  }

  function cancelAndResync() {
    (ground as any).cancelMove();
    syncBoard();
  }

  function whoMoves() {
    return chess.turn() === 'w' ? 'white' : 'black';
  }

  // Пересчёт карты легальных ходов из chess.js
  function computeDests() {
    const dests = new Map<Key, Key[]>();
    for (const m of chess.moves({ verbose: true })) {
      const arr = dests.get(m.from) ?? [];
      arr.push(m.to);
      dests.set(m.from, arr);
    }
    return dests;
  }

  function getLastMovePair(): [Key, Key] | undefined {
    const h = chess.history({ verbose: true });
    if (!h.length) return undefined;
    const last = h[h.length - 1];
    return [last.from, last.to];
  }

  // Автоответ чёрных: ищем подготовленный ответ по FEN и делаем ход в один тик
  function maybeAutoReplyAsBlack() {
    if (whoMoves() !== 'black') return;
    const reply = opts.blackReplies?.[chess.fen()];
    if (!reply) return;

    // Разрешены оба формата: SAN или from/to
    let applied = false;
    if (typeof reply === 'string') {
      const mv = chess.move(reply);     // SAN из словаря
      if (mv) {
        (ground as any).move(mv.from as Key, mv.to as Key);
        applied = true;
      }
    } else {
      const mv = chess.move({ from: reply.from, to: reply.to, promotion: 'q' });
      if (mv) {
        (ground as any).move(mv.from as Key, mv.to as Key);
        applied = true;
      }
    }
    if (applied) syncBoard({ lastMove: getLastMovePair() });
  }
}
```

**Поисковые выдержки:**

**Инициализация Chessground (строки 25-32):**
```typescript
const ground = Chessground(opts.el, buildConfig() as any);
```

**Формирование uci (строки 95-105):**
```typescript
events: {
  after: (orig: Key, dest: Key) => {
    // Применяем ход в движке (с дефолт-превращением в ферзя)
    const move = chess.move({ from: orig, to: dest, promotion: 'q' });
    if (!move) return cancelAndResync();

    opts.onUserMove?.(move.san, orig, dest);
    syncBoard({ lastMove: [orig, dest] });

    // === Автоответ чёрных по ветке дебюта ===
    maybeAutoReplyAsBlack();
  },
},
```

**Вызов onTryMove (строка 100):**
```typescript
opts.onUserMove?.(move.san, orig, dest);
```

**Методы API (строки 35-65):**
```typescript
return {
  drawGreenArrow(from: Key, to: Key) { ... },
  clearArrows() { ... },
  setFen(fen: string) { ... },
  getFen(): string { ... },
  toggleOrientation() { ... },
  redraw() { ... },
  destroy() { ... }
};
```

**Откат при запрете хода (строки 95-97):**
```typescript
const move = chess.move({ from: orig, to: dest, promotion: 'q' });
if (!move) return cancelAndResync();
```

**Логика стрелки (строки 35-40):**
```typescript
drawGreenArrow(from: Key, to: Key) {
  const shapes: DrawShape[] = [{ orig: from, dest: to, brush: 'green' }];
  (ground as any).setAutoShapes(shapes);
}
```

#### src/types/chessground.d.ts
МАРКЕР: ФАЙЛ НЕ НАЙДЕН - предполагаемый путь: src/types/chessground.d.ts

**Наблюдения:**
- ChessBoard инициализируется один раз с useRef
- allowedMoves передается в createChessgroundBoard
- Обновление allowedMoves происходит через useEffect
- API методы определены в chessground.ts
- Кастомные типы chessground не найдены
- Формирование UCI происходит в movable.events.after
- Откат при запрете хода реализован через cancelAndResync
- Стрелки управляются через setAutoShapes
- chessground.ts содержит логику автоответа черных через blackReplies

## H. Вспомогательные модули и стили

#### src/study/utils.ts
```typescript
import { Chess } from 'chess.js';

export function sanToUci(san: string, fen: string): string {
  try {
    const chess = new Chess(fen);
    const moves = chess.moves({ verbose: true });
    
    for (const move of moves) {
      if (move.san === san) {
        let uci = move.from + move.to;
        if (move.promotion) {
          uci += move.promotion;
        }
        return uci;
      }
    }
    
    throw new Error(`Move ${san} not found in position ${fen}`);
  } catch (error) {
    console.error('Error converting SAN to UCI:', error);
    throw error;
  }
}

export function getFenAfterMove(fen: string, uci: string): string {
  try {
    const chess = new Chess(fen);
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length > 4 ? uci[4] as any : undefined;
    
    chess.move({ from, to, promotion });
    return chess.fen();
  } catch (error) {
    console.error('Error getting FEN after move:', error);
    throw error;
  }
}

export function isWhiteMove(fen: string): boolean {
  const chess = new Chess(fen);
  return chess.turn() === 'w';
}

export function getLegalMoves(fen: string): string[] {
  try {
    const chess = new Chess(fen);
    return chess.moves({ verbose: true }).map(move => move.from + move.to);
  } catch (error) {
    console.error('Error getting legal moves:', error);
    return [];
  }
}
```

#### src/components/ChessBoard.css
```css
.chess-board {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 1rem;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  width: 100%;
  height: 100%;
}

/* Контейнер для доски согласно инструкции chessground.md */
#board {
  width: 560px;
  height: 560px;
  min-width: 320px;
  min-height: 320px;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  #board {
    width: 400px;
    height: 400px;
  }
}

@media (max-width: 480px) {
  #board {
    width: 320px;
    height: 320px;
  }
}
```

#### src/styles/app.css
```css
.App {
  text-align: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.App-header {
  background-color: #282c34;
  padding: 20px;
  color: white;
}

.App-link {
  color: #61dafb;
}

/* Общие стили для кнопок */
.btn {
  background: linear-gradient(45deg, #667eea, #764ba2);
  border: none;
  color: white;
  padding: 12px 24px;
  border-radius: 25px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 600;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
}

.btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
}

.btn:active {
  transform: translateY(0);
}

/* Стили для карточек */
.card {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 15px;
  padding: 20px;
  margin: 10px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

/* Анимации */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.fade-in {
  animation: fadeIn 0.5s ease-out;
}
```

**Наблюдения:**
- utils.ts содержит функции для конвертации SAN ↔ UCI
- getFenAfterMove корректно обновляет позицию
- isWhiteMove определяет чей ход
- getLegalMoves возвращает легальные ходы
- ChessBoard.css содержит стили для контейнера доски с фиксированными размерами
- app.css содержит общие стили приложения
- Размеры доски: 560x560px (desktop), 400x400px (tablet), 320x320px (mobile)
- Стили доски настроены согласно инструкции chessground.md

---

## ИТОГОВЫЕ НАБЛЮДЕНИЯ

### Ключевые проблемы:
1. **Стрелка "залипает"** - allowedMoves не обновляется после изменения currentStepIndex
2. **Автоответ один раз** - stepIndex обновляется, но allowedMoves не пересчитывается
3. **Нет комментариев** - currentComment не обновляется правильно
4. **Произвольные ходы** - allowedMoves не передается правильно в chessground
5. **Нет режимов обучения** - переход GUIDED → TEST не реализован

### Отсутствующие компоненты:
- src/study/store.ts - хранилище состояния
- src/study/srs.ts - система повторения
- src/components/StudyPanel.tsx - панель подсказок
- src/types/chessground.d.ts - кастомные типы
- Отдельные экземпляры StudyEngine и ProgressManager для каждого пользователя

### Архитектурные проблемы:
- StudyEngine возвращает boolean вместо структуры { accepted, error?, opponentUci? }
- Автоответ соперника не реализован в UI
- Логика переключения режимов отсутствует
- Откат при запрете хода не реализован
- studyEngine и progressManager используются как singleton экземпляры
- Отсутствует система управления состоянием для нескольких пользователей
