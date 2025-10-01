# Compatibility Policy for Structure Refactoring

**Status**: PLANNING PHASE  
**Target**: Zero breaking changes during migration  
**TTL**: 2 releases (~2-3 months), then remove shims

---

## 1. Strategy: Path Alias + Re-export Shims

### 1.1. Current State
All imports use `@/` path alias:
```typescript
import { Debut } from '@/content/types';
import { ContentLoader } from '@/content/loader';
import { useStudyEngine } from '@/study/useStudyEngine';
```

### 1.2. Migration Approach

**Phase A (Batch Migration)**:
1. Move files to new locations
2. Update `@/` alias in `tsconfig.json` to point to new structure
3. Create thin re-export shims at old locations for external/test imports

**Phase B (Deprecation)**:
1. Add `console.warn` in dev mode to old import paths
2. Update all internal imports gradually
3. Update documentation

**Phase C (Cleanup - Future PR)**:
1. Remove shim files after 2 releases
2. Clean up old empty directories

---

## 2. tsconfig.json Path Mapping

### 2.1. Current Mapping
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

### 2.2. Updated Mapping (After Migration)

**Option 1: Keep Simple (Recommended)**
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```
✅ No change needed - `@/` still resolves to `src/*`, new structure is transparent

**Option 2: Add Domain Aliases (Future Enhancement)**
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@ui/*": ["src/ui/*"],
      "@core/*": ["src/core/*"],
      "@data/*": ["src/data/*"]
    }
  }
}
```
⚠️ NOT in this PR - consider for future optimization

**Decision**: Use Option 1 - no tsconfig changes needed.

---

## 3. Re-export Shims (Temporary Compatibility Layer)

### 3.1. Purpose
- Maintain backward compatibility for external tools (tests, mocks, build scripts)
- Prevent breaking changes during migration
- Provide deprecation warnings in dev mode

### 3.2. Shim Structure

**Example for `src/content/types.ts` → `src/data/content/types.ts`:**

Create `src/content/types.ts` (shim):
```typescript
/**
 * @deprecated This file has been moved to src/data/content/types.ts
 * This shim will be removed in v0.3.0 (2 releases from now)
 * Update your imports:
 *   - Old: import { Debut } from '@/content/types'
 *   - New: import { Debut } from '@/data/content/types'
 */

if (import.meta.env.DEV) {
  console.warn(
    '[DEPRECATED] Importing from @/content/types is deprecated. ' +
    'Use @/data/content/types instead. ' +
    'This shim will be removed in v0.3.0'
  );
}

export * from '@/data/content/types';
```

### 3.3. Shims to Create (by Batch)

#### Batch 1: Content Data Layer
- `src/content/loader.ts` → re-export from `@/data/content/loader`
- `src/content/types.ts` → re-export from `@/data/content/types`

#### Batch 2: Chess Integration
- `src/board/chessground.ts` → re-export from `@/core/chess/chessground`
- `src/board/uci.ts` → re-export from `@/core/chess/uci`

#### Batch 3: Study Logic
- `src/study/study-engine.ts` → re-export from `@/core/study/study-engine`
- `src/study/progress-manager.ts` → re-export from `@/core/study/progress-manager`
- `src/study/srs.ts` → re-export from `@/core/study/srs`
- `src/study/useStudyEngine.ts` → re-export from `@/core/study/useStudyEngine`

#### Batch 4: UI Components
- `src/components/ChessBoard.tsx` → re-export from `@/ui/components/ChessBoard`
- `src/components/DebutCatalog.tsx` → re-export from `@/ui/components/DebutCatalog`

#### Batch 5: Pages
- `src/pages/HomePage.tsx` → re-export from `@/ui/pages/HomePage`
- `src/pages/DebutPage.tsx` → re-export from `@/ui/pages/DebutPage`
- `src/pages/StudyView.tsx` → re-export from `@/ui/pages/StudyView`

#### Batch 6 & 7: No shims needed
- CSS files: no imports
- `vite-env.d.ts`: ambient, auto-included
- `main.tsx`, `app/*`: root level, no shims

**Total shims**: ~13 files

---

## 4. CSS Import Handling

### 4.1. Current Pattern
```typescript
import './ChessBoard.css';
```

### 4.2. After Migration
CSS files move with their TS/TSX pairs:
```typescript
// In src/ui/components/ChessBoard.tsx
import './ChessBoard.css';  // Still works - relative path unchanged
```

✅ No compatibility issues - relative imports remain valid.

---

## 5. Test Mocks Update Strategy

### 5.1. Current Mocks
```typescript
// tests/study-engine.test.ts
vi.mock('../src/study/progress-manager', () => { /* mock */ });
vi.mock('../src/study/srs', () => { /* mock */ });
vi.mock('chess.js', () => { /* mock */ });
```

### 5.2. Update Approach

**Option A: Update mock paths immediately (Recommended)**
```typescript
vi.mock('../src/core/study/progress-manager', () => { /* mock */ });
vi.mock('../src/core/study/srs', () => { /* mock */ });
```

**Option B: Keep old paths temporarily**
```typescript
// Mock resolves via shim automatically
vi.mock('../src/study/progress-manager', () => { /* mock */ });
```

**Decision**: Option A - update test imports in same PR as batch migration.

---

## 6. Verification After Each Batch

### 6.1. Build Checks
```bash
# TypeScript compilation
npm run build

# Should succeed with no errors
```

### 6.2. Test Checks
```bash
# All tests should pass
npm test -- --run

# Expected: 37/37 tests passing
```

### 6.3. Dependency Graph Validation
```bash
# Check for cycles and violations
npx depcruise src --validate

# Should show no errors
```

### 6.4. Import Resolution Check
```bash
# Verify @ alias still works
grep -r "from '@/" src/ | wc -l

# Should match expected import count
```

### 6.5. Dev Server Check
```bash
# Start dev server
npm run dev

# Navigate to each page, check hot reload works
```

---

## 7. Deprecation Timeline

### Phase 1: Migration (Week 1)
- ✅ Move files batch by batch
- ✅ Create shims with deprecation warnings
- ✅ Update test mocks
- ✅ All builds and tests passing

### Phase 2: Adoption (Weeks 2-4)
- 📝 Update documentation
- 📝 Create migration guide for contributors
- ⚠️ Dev console warnings alert developers

### Phase 3: Grace Period (Releases v0.1.x - v0.2.x)
- ⏳ Shims remain active
- ⏳ Monitor usage of old paths (if logging added)
- ⏳ No breaking changes

### Phase 4: Cleanup (Release v0.3.0 - Future PR)
- 🗑️ Remove shim files
- 🗑️ Remove empty old directories
- 🗑️ Update any remaining old imports
- 📝 Release notes mention breaking change

**Total Timeline**: ~2-3 months from migration to cleanup

---

## 8. Rollback Strategy

If critical issues arise during migration:

### 8.1. Immediate Rollback
```bash
# Revert the batch PR
git revert <batch-pr-commit>

# Verify rollback
npm run build && npm test
```

### 8.2. Partial Rollback
```bash
# Revert specific files only
git checkout <previous-commit> -- src/path/to/file.ts

# Rebuild
npm run build
```

### 8.3. Prevention
- Small batches (≤30 files per batch)
- Test after each batch
- Keep PRs focused and atomic

---

## 9. Success Metrics

After full migration:

1. ✅ Zero test failures
2. ✅ Zero build errors
3. ✅ Zero linter violations
4. ✅ Zero runtime errors in dev/prod
5. ✅ Hot reload still functional
6. ✅ All imports resolve correctly
7. ✅ Documentation updated
8. ✅ Team understands new structure

---

## 10. Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Broken imports | Low | High | Re-export shims + tests |
| Test mocks fail | Medium | Medium | Update in same PR |
| Build tool issues | Low | High | Verify after each batch |
| Hot reload breaks | Low | Medium | Test in dev mode |
| Forgotten imports | Low | Low | Comprehensive grep search |

---

## 11. Communication Plan

### 11.1. Before Migration
- [ ] Review plan with team
- [ ] Approve STRUCTURE_PLAN.md
- [ ] Approve RENAME_MAP.json
- [ ] Approve this COMPAT_POLICY.md

### 11.2. During Migration
- [ ] Create PR for each batch
- [ ] Link to planning documents in PR description
- [ ] Run full test suite before merging
- [ ] Update CHANGELOG.md with migration notes

### 11.3. After Migration
- [ ] Update README.md with new structure
- [ ] Update CONTRIBUTING.md if exists
- [ ] Create "Migration Complete" announcement
- [ ] Schedule shim removal for v0.3.0

---

## 12. Edge Cases

### 12.1. Dynamic Imports
**Current State**: None found in codebase  
**Action**: No special handling needed

### 12.2. Build Tool Configs
**Files**: `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`  
**Action**: No changes needed - `@/` alias remains valid

### 12.3. Test Setup Files
**Files**: `tests/setup.ts`  
**Action**: Verify imports after Batch 1-3

---

## 13. Monitoring & Alerts

### 13.1. Dev Console Warnings
Shims will log deprecation warnings:
```
[DEPRECATED] Importing from @/content/types is deprecated.
Use @/data/content/types instead.
This shim will be removed in v0.3.0
```

### 13.2. Optional: Usage Tracking
Add counter in shims to track old import usage:
```typescript
if (import.meta.env.DEV) {
  const key = 'deprecated_imports';
  const count = parseInt(sessionStorage.getItem(key) || '0') + 1;
  sessionStorage.setItem(key, count.toString());
  
  if (count === 1) {
    console.warn('[DEPRECATED] @/content/types - see COMPAT_POLICY.md');
  }
}
```

---

## Appendix: Shim Template

```typescript
/**
 * COMPATIBILITY SHIM - WILL BE REMOVED IN v0.3.0
 * 
 * This file has been moved to: <NEW_PATH>
 * 
 * Migration:
 *   Old: import { ... } from '@/<OLD_PATH>'
 *   New: import { ... } from '@/<NEW_PATH>'
 * 
 * TTL: 2 releases (~2-3 months)
 */

if (import.meta.env.DEV) {
  const warned = '__compat_<MODULE_NAME>_warned';
  if (!(window as any)[warned]) {
    console.warn(
      `[DEPRECATED] Importing from @/<OLD_PATH> is deprecated.\n` +
      `Use @/<NEW_PATH> instead.\n` +
      `This shim will be removed in v0.3.0\n` +
      `See COMPAT_POLICY.md for details.`
    );
    (window as any)[warned] = true;
  }
}

export * from '@/<NEW_PATH>';
```

---

**Next Step**: Review all three documents, then commit to branch `refactor/structure-plan-20250930`.

