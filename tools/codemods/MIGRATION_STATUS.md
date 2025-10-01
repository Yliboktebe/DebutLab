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
| **2** | ⏳ PENDING | 2 | 🟢 Low | - |
| **3** | ⏳ PENDING | 4 | 🟡 Medium | - |
| **4** | ⏳ PENDING | 4 | 🟢 Low | - |
| **5** | ⏳ PENDING | 6 | 🟡 Medium | - |
| **6** | ⏳ PENDING | 2 | 🟢 Low | - |
| **7** | ⏳ PENDING | 1 | 🟢 Low | - |

**Completed**: 1/7 batches (14.3%)  
**Files migrated**: 2/21 (9.5%)  
**Shims created**: 2/13 (15.4%)

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

## Batch 2: Chess Integration ⏳

### Plan
- `src/board/chessground.ts` → `src/core/chess/chessground.ts`
- `src/board/uci.ts` → `src/core/chess/uci.ts`

### Shims Needed
- `src/board/chessground.ts` (re-export)
- `src/board/uci.ts` (re-export)

### Test Mocks to Update
- Check tests/ for any mocks referencing src/board/*

**Status**: Ready to execute

---

## Batch 3: Study Logic ⏳

### Plan
- `src/study/study-engine.ts` → `src/core/study/study-engine.ts`
- `src/study/progress-manager.ts` → `src/core/study/progress-manager.ts`
- `src/study/srs.ts` → `src/core/study/srs.ts`
- `src/study/useStudyEngine.ts` → `src/core/study/useStudyEngine.ts`

### Shims Needed
- 4 shims for study modules

### Test Mocks to Update
- `tests/study-engine.test.ts` - already has mocks for progress-manager, srs

**Risk**: 🟡 Medium (complex domain logic)

---

## Batch 4: UI Components ⏳

### Plan
- `src/components/ChessBoard.tsx` + `.css` → `src/ui/components/`
- `src/components/DebutCatalog.tsx` + `.css` → `src/ui/components/`

### Shims Needed
- 2 shims (TS/TSX only, CSS no shims)

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
**Shims to create**: 13 (2 done, 11 remaining)  
**Test files to update**: 2 (done for batch 1)  

**Current structure**:
```
src/
├── data/
│   └── content/          ✅ NEW (batch 1)
│       ├── loader.ts
│       └── types.ts
├── content/              ⚠️ SHIMS ONLY
│   ├── loader.ts         (→ @/data/content/loader)
│   └── types.ts          (→ @/data/content/types)
├── board/                ⏳ TO MIGRATE (batch 2)
├── study/                ⏳ TO MIGRATE (batch 3)
├── components/           ⏳ TO MIGRATE (batch 4)
├── pages/                ⏳ TO MIGRATE (batch 5)
├── styles/               ⏳ TO MIGRATE (batch 6)
└── vite-env.d.ts         ⏳ TO MIGRATE (batch 7)
```

---

## Next Actions

1. ⏳ Execute Batch 2 (Chess Integration)
2. ⏳ Execute Batch 3 (Study Logic)
3. ⏳ Execute Batch 4 (UI Components)
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

**Last Updated**: 2025-10-01 13:05 (after Batch 1)

