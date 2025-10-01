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
| **5** | ⏳ PENDING | 6 | 🟡 Medium | - |
| **6** | ⏳ PENDING | 2 | 🟢 Low | - |
| **7** | ⏳ PENDING | 1 | 🟢 Low | - |

**Completed**: 4/7 batches (57.1%)  
**Files migrated**: 12/21 (57.1%)  
**Shims created**: 10/13 (76.9%)

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

## Batch 5: Pages ⏳

### Plan
- `src/pages/HomePage.tsx` + `.css` → `src/ui/pages/`
- `src/pages/DebutPage.tsx` + `.css` → `src/ui/pages/`
- `src/pages/StudyView.tsx` + `.css` → `src/ui/pages/`

### Shims Needed
- 3 shims (TS/TSX only, CSS no shims)

**Risk**: 🟡 Medium (orchestration layer)

---

## Batch 6: Styles ⏳

### Plan
- `src/styles/app.css` → `src/ui/styles/app.css`
- `src/index.css` → `src/ui/styles/index.css`

### Shims Needed
- 0 (CSS files, no shims per COMPAT_POLICY)

### Special Handling
- Update import in `src/main.tsx`: `./styles/app.css` → `./ui/styles/app.css`

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
**Shims to create**: 13 (10 done, 3 remaining)  
**Test files to update**: 2 (done for batches 1-4)  

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
│   └── components/       ✅ NEW (batch 4)
│       ├── ChessBoard.tsx
│       ├── ChessBoard.css
│       ├── DebutCatalog.tsx
│       └── DebutCatalog.css
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
├── pages/                ⏳ TO MIGRATE (batch 5)
├── styles/               ⏳ TO MIGRATE (batch 6)
└── vite-env.d.ts         ⏳ TO MIGRATE (batch 7)
```

---

## Next Actions

1. ✅ Execute Batch 2 (Chess Integration) - DONE
2. ✅ Execute Batch 3 (Study Logic) - DONE
3. ✅ Execute Batch 4 (UI Components) - DONE
4. ⏳ Execute Batch 5 (Pages)
5. ⏳ Execute Batch 6 (Styles)
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

---

**Last Updated**: 2025-10-01 13:43 (after Batch 4)

