# DebutLab Structure Refactoring Plan

**Generated**: 2025-09-30  
**Status**: PLANNING PHASE (no code changes yet)  
**Basis**: `tools/audit/out/dependency-graph.json`, `scan.json`, `orphans.md`, actual codebase analysis

---

## 1. Current Clusters (by Import Graph)

Analysis based on dependency-graph.json and real imports via `@/` alias:

### 1.1. **app** - Application Entry & Routing
- **Files**: `app/layout.tsx`, `app/router.tsx`, `main.tsx`
- **Role**: Application bootstrap, routing configuration, global layout
- **Dependencies**: → pages
- **LOC**: ~70 lines total
- **Status**: ✅ Well-defined, no issues

### 1.2. **pages** - Page Components
- **Files**: `pages/HomePage.tsx`, `pages/DebutPage.tsx`, `pages/StudyView.tsx` + CSS files
- **Role**: Top-level page components, orchestration of UI and business logic
- **Dependencies**: → study, content, components, board
- **LOC**: ~291 lines total
- **Issues**: 
  - ⚠️ 3 long functions (HomePage: 65 lines, DebutPage: 84 lines, StudyView.StudyContent: 89 lines)
  - Heavy orchestration logic mixed with rendering

### 1.3. **components** - Reusable UI Components
- **Files**: `components/ChessBoard.tsx`, `components/DebutCatalog.tsx` + CSS files
- **Role**: Presentational components, reusable UI widgets
- **Dependencies**: → board (ChessBoard only)
- **LOC**: ~123 lines total
- **Status**: ✅ Clean, well-isolated

### 1.4. **study** - Learning Logic (CORE DOMAIN)
- **Files**: `study/study-engine.ts`, `study/progress-manager.ts`, `study/srs.ts`, `study/useStudyEngine.ts`, ~~`study/utils.ts`~~ (orphan)
- **Role**: Core business logic - study session management, progress tracking, SRS algorithm
- **Dependencies**: → content (types only), board (types only)
- **LOC**: ~1178 lines total (largest cluster!)
- **Issues**:
  - ⚠️ `study-engine.ts`: 573 LOC (god module)
  - ⚠️ `useStudyEngine.ts`: 267 LOC with 254-line function
  - ⚠️ `utils.ts`: orphan, flagged for removal
- **Status**: ❗ Needs attention - high complexity

### 1.5. **content** - Data Loading & Types
- **Files**: `content/loader.ts`, `content/types.ts`
- **Role**: Content loading (debuts, catalog), data schemas, type definitions
- **Dependencies**: None (leaf module)
- **LOC**: ~167 lines total
- **Usage**: Heavy usage via `@/content/types` (10 import sites!)
- **Status**: ✅ Clean, well-defined domain

### 1.6. **board** - Chess Engine Integration
- **Files**: `board/chessground.ts`, `board/uci.ts`, ~~`board/black-replies.ts`~~ (orphan)
- **Role**: Integration with @lichess-org/chessground, UCI utilities, board state management
- **Dependencies**: → content (types only - for Branch type)
- **LOC**: ~325 lines total
- **Issues**:
  - ⚠️ `buildConfig`: 83-line function in chessground.ts
  - ⚠️ `black-replies.ts`: orphan, flagged for removal
- **Status**: ⚠️ Minor cleanup needed

### 1.7. **types** - Ambient Type Declarations
- **Files**: `types/chessground.d.ts`, `vite-env.d.ts`
- **Role**: Ambient type declarations for external libraries and build tools
- **Dependencies**: None
- **Status**: ✅ Standard practice, no changes needed

### 1.8. **styles** - Global Styles
- **Files**: `styles/app.css`, `index.css` (root level)
- **Role**: Global CSS, application-wide styling
- **Status**: ✅ Minimal, no issues

---

## 2. Proposed Target Structure

**Principle**: Group by domain and concern, not by technical layer.

```
src/
  ui/
    components/       # Reusable UI components (ChessBoard, DebutCatalog)
    pages/            # Page components (HomePage, DebutPage, StudyView)
    styles/           # Global styles (app.css, index.css moved here)
  
  core/
    study/            # Learning logic (study-engine, progress-manager, srs, useStudyEngine)
    chess/            # Chess engine integration (chessground, uci)
  
  data/
    content/          # Content loading and types (loader, types)
  
  app/                # Application entry (main.tsx, router.tsx, layout.tsx)
  
  types/              # Ambient type declarations (chessground.d.ts, vite-env.d.ts)
  
  assets/             # Static assets (react.svg)
```

**Total files to move**: ~27 files (excluding orphans, CSS follows TS/TSX)

---

## 3. Dependency Rules (Target)

### 3.1. Allowed Dependencies (Top → Bottom)

```
┌─────────────┐
│  ui/pages   │ ← Entry point for user interactions
└──────┬──────┘
       ↓
┌─────────────┬─────────────┐
│ ui/components│ core/study  │ ← Presentation & Business Logic
└──────┬──────┴──────┬──────┘
       ↓             ↓
┌─────────────┬─────────────┐
│ core/chess  │ data/content│ ← Integrations & Data
└─────────────┴─────────────┘
```

**Rules**:
1. ✅ `ui/pages` → `ui/components`, `core/study`, `data/content`
2. ✅ `ui/components` → `core/chess` (ChessBoard only)
3. ✅ `core/study` → `data/content` (types only), `core/chess` (types only)
4. ✅ `core/chess` → `data/content` (types only - for Branch)
5. ✅ `data/content/loader` → `data/content/types`
6. ✅ `app/` → `ui/pages`
7. ❌ NO CYCLES - strictly acyclic graph

### 3.2. Forbidden Dependencies

- ❌ `core/*` → `ui/*` (business logic should not depend on UI)
- ❌ `data/*` → `core/*` or `ui/*` (data layer is leaf)
- ❌ Any circular dependencies

---

## 4. Problem Zones (from Audit Reports)

### 4.1. God Modules (High Complexity)

| File | LOC | Issue | Action |
|------|-----|-------|--------|
| `study/study-engine.ts` | 573 | Largest module, complex state machine | ⚠️ Monitor, consider splitting in future (out of scope) |
| `study/useStudyEngine.ts` | 267 | Single 254-line function | ⚠️ Monitor (React hook pattern, acceptable) |
| `board/chessground.ts` | 275 | Large config builder (83-line function) | ⚠️ Monitor, low priority |

**Note**: These are NOT being refactored in this pass - only relocated.

### 4.2. Long Functions (>60 lines)

| Function | File | Lines | Status |
|----------|------|-------|--------|
| `useStudyEngine` | `study/useStudyEngine.ts` | 254 | ⚠️ React hook - acceptable pattern |
| `StudyContent` | `pages/StudyView.tsx` | 89 | ⚠️ Page component - orchestration logic |
| `DebutPage` | `pages/DebutPage.tsx` | 84 | ⚠️ Page component - orchestration logic |
| `buildConfig` | `board/chessground.ts` | 83 | ⚠️ Configuration builder |
| `HomePage` | `pages/HomePage.tsx` | 65 | ⚠️ Page component |

**Note**: Marking for future review, NOT refactoring in this pass.

### 4.3. Orphan Modules (Candidates for Removal)

| File | Status | Action |
|------|--------|--------|
| `board/black-replies.ts` | True orphan | ❓ Review usage before removal (out of scope) |
| `study/utils.ts` | True orphan | ❓ Review usage before removal (out of scope) |
| `content/loader.ts` | ❌ False positive (used via `@/` alias) | ✅ Keep and relocate |
| `content/types.ts` | ❌ False positive (used via `@/` alias) | ✅ Keep and relocate |
| `types/chessground.d.ts` | ❌ Ambient types | ✅ Keep and relocate |
| `vite-env.d.ts` | ❌ Build tool | ✅ Keep as-is |

**Decision**: Orphans (`black-replies.ts`, `utils.ts`) will NOT be moved in rename map. Review separately.

---

## 5. Migration Plan (Batches)

### Batch 0: Pre-flight Checks ✅
- ✅ Create this plan
- ✅ Create RENAME_MAP.json
- ✅ Create COMPAT_POLICY.md
- ✅ Verify no cycles
- ✅ Commit planning documents

### Batch 1: Data Layer (Leaf Modules) - LOWEST RISK
**Rationale**: No dependencies on other src/ modules, widely imported  
**Files**: 2  
**Risk**: 🟢 Low

- `content/loader.ts` → `data/content/loader.ts`
- `content/types.ts` → `data/content/types.ts`

**Verification**:
```bash
npm run build && npm test
npx depcruise src --validate
```

### Batch 2: Chess Integration - LOW RISK
**Rationale**: Depends only on content/types, used by components & study  
**Files**: 2 (excluding orphan)  
**Risk**: 🟢 Low

- `board/chessground.ts` → `core/chess/chessground.ts`
- `board/uci.ts` → `core/chess/uci.ts`
- ~~`board/black-replies.ts`~~ ← SKIP (orphan)

**Verification**:
```bash
npm run build && npm test
npx depcruise src --validate
```

### Batch 3: Study Logic (Core Domain) - MEDIUM RISK
**Rationale**: Depends on content & board, used by pages via hook  
**Files**: 4 (excluding orphan)  
**Risk**: 🟡 Medium (complex domain logic)

- `study/study-engine.ts` → `core/study/study-engine.ts`
- `study/progress-manager.ts` → `core/study/progress-manager.ts`
- `study/srs.ts` → `core/study/srs.ts`
- `study/useStudyEngine.ts` → `core/study/useStudyEngine.ts`
- ~~`study/utils.ts`~~ ← SKIP (orphan)

**Verification**:
```bash
npm run build && npm test
npx depcruise src --validate
```

### Batch 4: UI Components - LOW RISK
**Rationale**: Presentational components, minimal dependencies  
**Files**: 4 (2 TS + 2 CSS)  
**Risk**: 🟢 Low

- `components/ChessBoard.tsx` + `.css` → `ui/components/ChessBoard.tsx` + `.css`
- `components/DebutCatalog.tsx` + `.css` → `ui/components/DebutCatalog.tsx` + `.css`

**Verification**:
```bash
npm run build && npm test
npx depcruise src --validate
```

### Batch 5: Pages - MEDIUM RISK
**Rationale**: Orchestration layer, imports from all domains  
**Files**: 6 (3 TS + 3 CSS)  
**Risk**: 🟡 Medium (many dependencies)

- `pages/HomePage.tsx` + `.css` → `ui/pages/HomePage.tsx` + `.css`
- `pages/DebutPage.tsx` + `.css` → `ui/pages/DebutPage.tsx` + `.css`
- `pages/StudyView.tsx` + `.css` → `ui/pages/StudyView.tsx` + `.css`

**Verification**:
```bash
npm run build && npm test
npx depcruise src --validate
```

### Batch 6: Styles & Assets - LOW RISK
**Rationale**: Static files, minimal impact  
**Files**: 2  
**Risk**: 🟢 Low

- `styles/app.css` → `ui/styles/app.css`
- `index.css` → `ui/styles/index.css`

**Verification**:
```bash
npm run build && npm test
```

### Batch 7: App Layer & Types - LOW RISK
**Rationale**: Entry points and ambient types, final moves  
**Files**: 5  
**Risk**: 🟢 Low

- `app/layout.tsx` + `.css` → `app/layout.tsx` + `.css` (no change in path)
- `app/router.tsx` → `app/router.tsx` (no change, updates imports)
- `types/chessground.d.ts` → `types/chessground.d.ts` (no change)
- `vite-env.d.ts` → `types/vite-env.d.ts`

**Verification**:
```bash
npm run build && npm test
npx depcruise src --validate
```

---

## 6. Risks & Unknowns

### 6.1. Known Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking `@/` alias imports | 🔴 High | Compatibility shims in COMPAT_POLICY.md |
| Test mocks referencing old paths | 🟡 Medium | Update test imports in same PR |
| CSS imports breaking | 🟢 Low | CSS moves with TS/TSX files |
| Vite hot reload issues | 🟢 Low | Full restart after each batch |

### 6.2. Unknowns / Need Clarification

| Item | Status | Action |
|------|--------|--------|
| **Orphan modules** (`black-replies.ts`, `utils.ts`) | ❓ Unclear | NOT in rename map. Review separately before removal. |
| **Dynamic imports** (if any) | ❓ Need check | Search for `import()` - none found in scan |
| **Webpack/Vite aliases** beyond `@/*` | ❓ Need check | Only `@/*` found in tsconfig.json |

---

## 7. Success Criteria

After all batches:

1. ✅ All files in logical domain folders
2. ✅ `npm run build` succeeds
3. ✅ `npm test` passes (37/37 tests)
4. ✅ `npx depcruise src --validate` shows no violations
5. ✅ No circular dependencies
6. ✅ Compatibility shims in place (to be removed in future PR)
7. ✅ All `@/` imports still work
8. ✅ Hot reload functional
9. ✅ No behavior changes

---

## 8. Post-Migration Cleanup (Future PRs)

**NOT in this refactoring**:

1. Remove compatibility shims (after 2 releases)
2. Review and remove orphan modules (`black-replies.ts`, `utils.ts`)
3. Refactor long functions if needed
4. Split god modules if complexity grows

---

## 9. Files Excluded from Migration

### 9.1. Protected Directories (Per Requirements)
- ✅ `public/content/**` - NOT TOUCHED
- ✅ `tools/etl/**` - NOT TOUCHED (no such directory exists)

### 9.2. Orphan Modules (Deferred)
- ⏸️ `src/board/black-replies.ts` - Review usage first
- ⏸️ `src/study/utils.ts` - Review usage first

### 9.3. Root-Level Files
- ✅ `src/main.tsx` - Entry point, stays at root
- ✅ `src/vite-env.d.ts` - Will move to `types/` in Batch 7

---

## 10. Validation Checklist

Before starting Batch 1:

- [ ] All planning documents committed
- [ ] `RENAME_MAP.json` matches this plan
- [ ] `COMPAT_POLICY.md` reviewed
- [ ] No files from `public/content/**` in rename map
- [ ] All `from` paths in rename map exist
- [ ] Team reviewed and approved

---

**Next Step**: Review RENAME_MAP.json and COMPAT_POLICY.md, then commit all three documents.

