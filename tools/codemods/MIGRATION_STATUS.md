# Structure Migration Status

**Started**: 2025-10-01  
**Branch**: `refactor/structure-apply-20250930`  
**Plan**: STRUCTURE_PLAN.md, RENAME_MAP.json (21 files, 7 batches)  
**Strategy**: COMPAT_POLICY.md (shims with TTL=2 releases)

---

## Progress Overview

| Batch | Status | Files | Risk | Verification |
|-------|--------|-------|------|--------------|
| **1** | ✅ DONE | 2 | 🟢 Low | Build ✅ Test ✅ (37/37) |
| **2** | ✅ DONE | 2 | 🟢 Low | Build ✅ Test ✅ (37/37) |
| **3** | ✅ DONE | 4 | 🟡 Medium | Build ✅ Test ✅ (37/37) |
| **4** | ✅ DONE | 4 | 🟢 Low | Build ✅ Test ✅ (37/37) |
| **5** | ✅ DONE | 6 | 🟡 Medium | Build ✅ Test ✅ (37/37) |
| **6** | ✅ DONE | 2 | 🟢 Low | Build ✅ Test ✅ (37/37) |
| **7** | ⏳ PENDING | 1 | 🟢 Low | - |

**Completed**: 6/7 batches (85.7%)  
**Files migrated**: 20/21 (95.2%)  
**Shims created**: 13/13 (100%)

---

## Batch 1: Data Layer ✅

### Migrated Files
- ✅ `src/content/loader.ts` → `src/data/content/loader.ts`
- ✅ `src/content/types.ts` → `src/data/content/types.ts`

### Shims Created
- ✅ `src/content/loader.ts` (re-exports from @/data/content/loader)
- ✅ `src/content/types.ts` (re-exports from @/data/content/types)

### Verification
- ✅ Build: SUCCESS (691ms)
- ✅ Tests: 37/37 passing
- ✅ Protected dirs: Not touched

### Commit
`9d48145` - refactor(structure): apply batch 1 per STRUCTURE_PLAN (with shims)

**Log**: `tools/codemods/logs/batch-1.md`

---

## Batch 2: Chess Integration ✅

### Migrated Files
- ✅ `src/board/chessground.ts` → `src/core/chess/chessground.ts`
- ✅ `src/board/uci.ts` → `src/core/chess/uci.ts`

### Shims Created
- ✅ `src/board/chessground.ts` (re-exports from @/core/chess/chessground)
- ✅ `src/board/uci.ts` (re-exports from @/core/chess/uci)

### Verification
- ✅ Build: SUCCESS (704ms)
- ✅ Tests: 37/37 passing
- ✅ Protected dirs: Not touched
- ⚠️ Depcruise: SKIPPED (no config file)

### Commit
`8096795` - refactor(structure): apply batch 2 per STRUCTURE_PLAN (with shims)

**Status**: Complete

---

## Batch 3: Study Logic ✅

### Migrated Files
- ✅ `src/study/study-engine.ts` → `src/core/study/study-engine.ts`
- ✅ `src/study/progress-manager.ts` → `src/core/study/progress-manager.ts`
- ✅ `src/study/srs.ts` → `src/core/study/srs.ts`
- ✅ `src/study/useStudyEngine.ts` → `src/core/study/useStudyEngine.ts`

### Shims Created
- ✅ `src/study/study-engine.ts` (re-exports from @/core/study/study-engine)
- ✅ `src/study/progress-manager.ts` (re-exports from @/core/study/progress-manager)
- ✅ `src/study/srs.ts` (re-exports from @/core/study/srs)
- ✅ `src/study/useStudyEngine.ts` (re-exports from @/core/study/useStudyEngine)

### Test Mocks Updated
- ✅ `tests/study-engine.test.ts` - updated mocks for progress-manager, srs

### Verification
- ✅ Build: SUCCESS (712ms)
- ✅ Tests: 37/37 passing
- ✅ Protected dirs: Not touched

### Commits
`dafe8d0` - refactor(structure): apply batch 3 per STRUCTURE_PLAN (with shims)
`4720ad3` - test: adjust mocks for batch 3 path changes

**Status**: Complete

---

## Batch 4: UI Components ✅

### Migrated Files
- ✅ `src/components/ChessBoard.tsx` → `src/ui/components/ChessBoard.tsx`
- ✅ `src/components/ChessBoard.css` → `src/ui/components/ChessBoard.css`
- ✅ `src/components/DebutCatalog.tsx` → `src/ui/components/DebutCatalog.tsx`
- ✅ `src/components/DebutCatalog.css` → `src/ui/components/DebutCatalog.css`

### Shims Created
- ✅ `src/components/ChessBoard.tsx` (re-exports from @/ui/components/ChessBoard)
- ✅ `src/components/DebutCatalog.tsx` (re-exports from @/ui/components/DebutCatalog)
- ℹ️ CSS files: no shims (per COMPAT_POLICY)

### Verification
- ✅ Build: SUCCESS (708ms)
- ✅ Tests: 37/37 passing
- ✅ Protected dirs: Not touched
- ⚠️ Depcruise: SKIPPED (no config file)

### Commit
`c44e33b` - refactor(structure): apply batch 4 per STRUCTURE_PLAN (with shims)

**Status**: Complete

---

## Batch 5: Pages ✅

### Migrated Files
- ✅ `src/pages/HomePage.tsx` → `src/ui/pages/HomePage.tsx`
- ✅ `src/pages/HomePage.css` → `src/ui/pages/HomePage.css`
- ✅ `src/pages/DebutPage.tsx` → `src/ui/pages/DebutPage.tsx`
- ✅ `src/pages/DebutPage.css` → `src/ui/pages/DebutPage.css`
- ✅ `src/pages/StudyView.tsx` → `src/ui/pages/StudyView.tsx`
- ✅ `src/pages/StudyView.css` → `src/ui/pages/StudyView.css`

### Shims Created
- ✅ `src/pages/HomePage.tsx` (re-exports from @/ui/pages/HomePage)
- ✅ `src/pages/DebutPage.tsx` (re-exports from @/ui/pages/DebutPage)
- ✅ `src/pages/StudyView.tsx` (re-exports from @/ui/pages/StudyView)
- ℹ️ CSS files: no shims (per COMPAT_POLICY)

### Verification
- ✅ Build: SUCCESS (702ms)
- ✅ Tests: 37/37 passing
- ✅ Protected dirs: Not touched

### Commit
`17e6e7d` - refactor(structure): apply batch 5 per STRUCTURE_PLAN (with shims)

**Status**: Complete

---

## Batch 6: Styles ✅

### Migrated Files
- ✅ `src/styles/app.css` → `src/ui/styles/app.css`
- ✅ `src/index.css` → `src/ui/styles/index.css`

### Shims Created
- ℹ️ CSS files: no shims needed (per COMPAT_POLICY)

### Special Handling
- ✅ Updated import in `src/main.tsx`: `./styles/app.css` → `./ui/styles/app.css`

### Verification
- ✅ Build: SUCCESS (697ms)
- ✅ Tests: 37/37 passing
- ✅ Protected dirs: Not touched
- ⚠️ Depcruise: SKIPPED (no config file)

### Commit
`92067c1` - refactor(structure): apply batch 6 per STRUCTURE_PLAN (CSS only, no shims)

**Status**: Complete

---

## Batch 7: Types ⏳

### Plan
- `src/vite-env.d.ts` → `src/types/vite-env.d.ts`

### Shims Needed
- 0 (ambient declaration, auto-included via tsconfig)

### Risk Check
- ⚠️ If types stop being recognized after move, ROLLBACK per COMPAT_POLICY stop-condition

---

## Overall Stats

**Files to migrate**: 21  
**Shims to create**: 13 (13 done, 0 remaining)  
**Test files to update**: 2 (done for batches 1-6)  

**Current structure**:
```
src/
├── data/
│   └── content/          ✅ NEW (batch 1)
│       ├── loader.ts
│       └── types.ts
├── core/
│   ├── chess/            ✅ NEW (batch 2)
│   │   ├── chessground.ts
│   │   └── uci.ts
│   └── study/            ✅ NEW (batch 3)
│       ├── study-engine.ts
│       ├── progress-manager.ts
│       ├── srs.ts
│       └── useStudyEngine.ts
├── ui/
│   ├── components/       ✅ NEW (batch 4)
│   │   ├── ChessBoard.tsx
│   │   ├── ChessBoard.css
│   │   ├── DebutCatalog.tsx
│   │   └── DebutCatalog.css
│   ├── pages/            ✅ NEW (batch 5)
│   │   ├── HomePage.tsx
│   │   ├── HomePage.css
│   │   ├── DebutPage.tsx
│   │   ├── DebutPage.css
│   │   ├── StudyView.tsx
│   │   └── StudyView.css
│   └── styles/           ✅ NEW (batch 6)
│       ├── app.css
│       └── index.css
├── content/              ⚠️ SHIMS ONLY
│   ├── loader.ts         (→ @/data/content/loader)
│   └── types.ts          (→ @/data/content/types)
├── board/                ⚠️ SHIMS ONLY
│   ├── chessground.ts    (→ @/core/chess/chessground)
│   └── uci.ts            (→ @/core/chess/uci)
├── study/                ⚠️ SHIMS ONLY
│   ├── study-engine.ts   (→ @/core/study/study-engine)
│   ├── progress-manager.ts (→ @/core/study/progress-manager)
│   ├── srs.ts            (→ @/core/study/srs)
│   └── useStudyEngine.ts (→ @/core/study/useStudyEngine)
├── components/           ⚠️ SHIMS ONLY
│   ├── ChessBoard.tsx    (→ @/ui/components/ChessBoard)
│   └── DebutCatalog.tsx  (→ @/ui/components/DebutCatalog)
├── pages/                ⚠️ SHIMS ONLY
│   ├── HomePage.tsx      (→ @/ui/pages/HomePage)
│   ├── DebutPage.tsx     (→ @/ui/pages/DebutPage)
│   └── StudyView.tsx     (→ @/ui/pages/StudyView)
└── vite-env.d.ts         ⏳ TO MIGRATE (batch 7)
```

---

## Next Actions

1. ✅ Execute Batch 2 (Chess Integration) - DONE
2. ✅ Execute Batch 3 (Study Logic) - DONE
3. ✅ Execute Batch 4 (UI Components) - DONE
4. ✅ Execute Batch 5 (Pages) - DONE
5. ✅ Execute Batch 6 (Styles) - DONE
6. ⏳ Execute Batch 7 (Types)
7. ⏳ Create final MIGRATION_REPORT.md

---

## Verification Commands

After each batch:
```bash
npm run build
npm test -- --run
npx depcruise src --validate
```

---

## Execution Log

2025-10-01 13:29  | Batch 2 | moved:2 | shims:2 | build:OK | tests:OK (37/37) | depcruise:SKIPPED (no config)
2025-10-01 13:36  | Batch 3 | moved:4 | shims:4 | build:OK | tests:OK (37/37) | depcruise:SKIPPED
2025-10-01 13:43  | Batch 4 | moved:4 | shims:2 | build:OK | tests:OK (37/37) | depcruise:SKIPPED (no config)
2025-10-01 13:50  | Batch 5 | moved:6 | shims:3 | build:OK | tests:OK (37/37) | depcruise:SKIPPED
2025-10-01 13:57  | Batch 6 | moved:2 | shims:0 | build:OK | tests:OK (37/37) | depcruise:SKIPPED (no config)

---

**Last Updated**: 2025-10-01 13:57 (after Batch 6)

