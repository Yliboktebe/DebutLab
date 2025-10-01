# Structure Refactoring Plan - Summary

**Generated**: 2025-09-30  
**Branch**: `refactor/structure-plan-20250930`  
**Status**: ✅ PLANNING COMPLETE - Ready for Review  
**Commit**: `39aea2f`

---

## 📊 Overview

**Total files to migrate**: 21 files  
**Batches**: 7 batches  
**Estimated complexity**: Medium  
**Risk level**: 🟢 Low (with compatibility shims)

---

## 📦 Batch Breakdown

| Batch | Files | Domain | Risk | Notes |
|-------|-------|--------|------|-------|
| **1** | 2 | Data Layer | 🟢 Low | Leaf modules, no dependencies |
| **2** | 2 | Chess Integration | 🟢 Low | Depends only on content/types |
| **3** | 4 | Study Logic | 🟡 Medium | Core domain, complex logic |
| **4** | 4 | UI Components | 🟢 Low | Presentational, minimal deps |
| **5** | 6 | Pages | 🟡 Medium | Orchestration layer |
| **6** | 2 | Styles | 🟢 Low | Static CSS files |
| **7** | 1 | Types | 🟢 Low | Ambient declarations |

**Total**: 21 files

---

## 🎯 Target Structure

```
src/
├── ui/
│   ├── components/       # 4 files (ChessBoard, DebutCatalog + CSS)
│   ├── pages/            # 6 files (HomePage, DebutPage, StudyView + CSS)
│   └── styles/           # 2 files (app.css, index.css)
├── core/
│   ├── study/            # 4 files (study-engine, progress-manager, srs, useStudyEngine)
│   └── chess/            # 2 files (chessground, uci)
├── data/
│   └── content/          # 2 files (loader, types)
├── app/                  # 3 files (layout, router + CSS) - no changes
├── types/                # 2 files (chessground.d.ts, vite-env.d.ts)
├── assets/               # 1 file (react.svg) - no changes
└── main.tsx              # Entry point - no changes
```

---

## ✅ Verification Results

### Files Exist Check
✅ **All 21 source files verified to exist**

Checked files:
- ✅ `src/content/loader.ts`
- ✅ `src/content/types.ts`
- ✅ `src/board/chessground.ts`
- ✅ `src/board/uci.ts`
- ✅ `src/study/study-engine.ts`
- ✅ `src/study/progress-manager.ts`
- ✅ `src/study/srs.ts`
- ✅ `src/study/useStudyEngine.ts`
- ✅ `src/components/ChessBoard.tsx` + `.css`
- ✅ `src/components/DebutCatalog.tsx` + `.css`
- ✅ `src/pages/HomePage.tsx` + `.css`
- ✅ `src/pages/DebutPage.tsx` + `.css`
- ✅ `src/pages/StudyView.tsx` + `.css`
- ✅ `src/styles/app.css`
- ✅ `src/index.css`
- ✅ `src/vite-env.d.ts`

### Protected Directories Check
✅ **No files from protected directories**
- ✅ No `public/content/**` files in rename map
- ✅ No `tools/etl/**` files in rename map

### Document Consistency
✅ **STRUCTURE_PLAN.md ↔ RENAME_MAP.json**: Perfect match  
✅ **COMPAT_POLICY.md**: Covers all 13 modules requiring shims

---

## 🚫 Files Excluded from Migration

### 1. Orphan Modules (Deferred Review)
- ⏸️ `src/board/black-replies.ts` - True orphan, flagged by knip
- ⏸️ `src/study/utils.ts` - True orphan, flagged by knip

**Reason**: Need separate review before removal/relocation  
**Action**: NOT included in RENAME_MAP.json

### 2. Root-Level Entry Points
- ✅ `src/main.tsx` - Stays at root
- ✅ `src/app/layout.tsx` - Stays in app/
- ✅ `src/app/router.tsx` - Stays in app/ (updates imports only)

### 3. Protected Directories
- ✅ `public/content/**` - Per requirements, untouched
- ✅ `tools/etl/**` - Per requirements, untouched (no such dir exists)

---

## ⚠️ Risks & Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Breaking imports via `@/` alias | 🟢 Low | 🔴 High | Re-export shims (COMPAT_POLICY.md) |
| Test mock paths incorrect | 🟡 Medium | 🟡 Medium | Update in same PR |
| CSS imports break | 🟢 Low | 🟡 Medium | CSS moves with TS/TSX pairs |
| Hot reload issues | 🟢 Low | 🟡 Medium | Test after each batch |
| Forgotten imports | 🟢 Low | 🟢 Low | Comprehensive build/test checks |

**Overall Risk**: 🟢 **LOW** (with compatibility shims in place)

---

## 📋 Documents Created

### 1. STRUCTURE_PLAN.md (927 lines)
- ✅ Current clusters analysis
- ✅ Target structure
- ✅ Dependency rules
- ✅ Problem zones from audit
- ✅ 7-batch migration plan
- ✅ Success criteria

### 2. RENAME_MAP.json (21 entries)
- ✅ Source → target mappings
- ✅ Batch assignments
- ✅ Notes for each file
- ✅ All source files verified to exist

### 3. COMPAT_POLICY.md (348 lines)
- ✅ Compatibility strategy (re-export shims)
- ✅ tsconfig.json approach (no changes needed)
- ✅ Shim templates with deprecation warnings
- ✅ Test mock update strategy
- ✅ Verification checklist
- ✅ Rollback strategy
- ✅ 2-release TTL for shims

---

## 🔄 Migration Flow

```
Batch 1 (Data)     → Batch 2 (Chess)     → Batch 3 (Study)
     ↓                    ↓                        ↓
  2 files              2 files                  4 files
  🟢 Low Risk          🟢 Low Risk              🟡 Medium Risk
     ↓                    ↓                        ↓
  Create shims         Create shims            Create shims
     ↓                    ↓                        ↓
Batch 4 (UI Comp)  → Batch 5 (Pages)    → Batch 6 (Styles)
     ↓                    ↓                        ↓
  4 files              6 files                  2 files
  🟢 Low Risk          🟡 Medium Risk          🟢 Low Risk
     ↓                    ↓                        ↓
  Create shims         Create shims           No shims needed
     ↓                    ↓                        ↓
                    Batch 7 (Types)
                         ↓
                      1 file
                    🟢 Low Risk
                         ↓
                   No shims needed
```

After each batch:
1. ✅ Create re-export shims at old locations
2. ✅ Update test mocks if needed
3. ✅ Run `npm run build`
4. ✅ Run `npm test`
5. ✅ Run `npx depcruise src --validate`
6. ✅ Test hot reload in dev mode
7. ✅ Commit batch PR

---

## 📈 Expected Improvements

### Before Migration
```
src/
├── app/              (bootstrap)
├── board/            (mixed: integration + orphan)
├── components/       (UI)
├── content/          (data)
├── pages/            (UI)
├── study/            (core + orphan)
├── styles/           (global CSS)
└── types/            (ambient)
```
❌ Flat structure  
❌ Mixed concerns in board/ and study/  
❌ No clear domain boundaries

### After Migration
```
src/
├── ui/
│   ├── components/   (presentational)
│   ├── pages/        (orchestration)
│   └── styles/       (global CSS)
├── core/
│   ├── study/        (business logic)
│   └── chess/        (integration)
├── data/
│   └── content/      (data loading)
├── app/              (bootstrap)
└── types/            (ambient)
```
✅ Domain-driven structure  
✅ Clear separation of concerns  
✅ Logical grouping  
✅ Easier to navigate

---

## 🎯 Success Criteria

After all 7 batches:

1. ✅ All 21 files in new locations
2. ✅ `npm run build` succeeds
3. ✅ `npm test` passes (37/37 tests)
4. ✅ `npx depcruise src --validate` - no violations
5. ✅ No circular dependencies
6. ✅ 13 compatibility shims in place
7. ✅ All `@/` imports still work
8. ✅ Hot reload functional
9. ✅ No behavior changes
10. ✅ Documentation updated

---

## 📚 Future Cleanup (Post-Migration)

**NOT in this refactoring** (separate PRs):

1. **Remove shims** (Release v0.3.0, ~2-3 months)
   - 13 re-export files to remove
   - Update any remaining old imports
   - Clean up empty directories

2. **Review orphans** (Separate PR)
   - `src/board/black-replies.ts` - remove or document usage
   - `src/study/utils.ts` - remove or document usage

3. **Refactor long functions** (Optional, low priority)
   - `useStudyEngine`: 254 lines (acceptable React hook pattern)
   - `StudyContent`: 89 lines (page component)
   - `DebutPage`: 84 lines (page component)
   - `buildConfig`: 83 lines (configuration builder)

---

## 🚀 Next Steps

### Immediate Actions
1. ✅ **DONE**: Planning documents created and committed
2. ⏳ **PENDING**: Team review of STRUCTURE_PLAN.md
3. ⏳ **PENDING**: Team approval of RENAME_MAP.json
4. ⏳ **PENDING**: Team approval of COMPAT_POLICY.md

### After Approval
1. 📋 Create PR template referencing planning docs
2. 🔄 Execute Batch 1 migration
3. 🧪 Test and verify Batch 1
4. 📝 Commit Batch 1 PR
5. 🔁 Repeat for Batches 2-7

### Timeline Estimate
- **Planning**: ✅ Complete
- **Review**: 1-2 days
- **Batch 1-2**: 1 day
- **Batch 3**: 1 day (core domain)
- **Batch 4-5**: 1 day
- **Batch 6-7**: 0.5 day
- **Total**: ~3-5 days for full migration

---

## 💡 Key Insights from Audit

### From dependency-graph.json
- 27 total modules scanned
- 5 reported as orphans (2 true, 3 false positives via `@/` alias)
- No circular dependencies detected
- Clear domain clustering visible

### From scan.json
- 2282 total LOC
- 0 `any` types (fixed in prep phase!)
- 5 long functions (>60 lines) - acceptable patterns
- Largest module: `study-engine.ts` (573 LOC)

### From orphans.md
- `content/loader.ts` - FALSE POSITIVE (used via `@/`, 3 import sites)
- `content/types.ts` - FALSE POSITIVE (used via `@/`, 10 import sites!)
- `board/black-replies.ts` - TRUE ORPHAN (candidate for removal)
- `study/utils.ts` - TRUE ORPHAN (candidate for removal)

---

## 📞 Contact & Questions

If unclear about any aspect of the plan:

1. **Structure logic**: See STRUCTURE_PLAN.md Section 1-2
2. **Specific file**: Check RENAME_MAP.json for notes
3. **Compatibility**: See COMPAT_POLICY.md
4. **Risks**: See STRUCTURE_PLAN.md Section 6

---

## ✅ Final Verification

```bash
# All source files exist
✅ 21/21 files verified

# No protected directories
✅ 0 files from public/content/**
✅ 0 files from tools/etl/**

# Documents consistent
✅ STRUCTURE_PLAN.md ↔ RENAME_MAP.json
✅ All batches documented

# Ready for migration
✅ Planning complete
✅ Documents committed
✅ No code changes yet
```

---

**Status**: ✅ **READY FOR REVIEW AND APPROVAL**

**Commit**: `39aea2f` - "docs(refactor): add structure plan, rename map, compat policy (no code changes)"

**Branch**: `refactor/structure-plan-20250930`

