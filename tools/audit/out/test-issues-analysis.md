# Test Issues Analysis

## Summary

- ✅ **5/5 tests passing** in `loader.test.ts`
- ❌ **0/5 tests running** in `study-engine.test.ts`
- 📊 **Overall**: 5 passing, 1 suite blocked

---

## Issue #1: stderr Messages (False Alarm)

### What You See
```
stderr | tests/loader.test.ts > ContentLoader > should throw error for invalid catalog schema
Error loading catalog: Error: Invalid catalog schema: invalid.schema
```

### Root Cause
- `src/content/loader.ts:38` has `console.error()` in catch block
- Tests intentionally trigger error paths to validate error handling

### Impact
✅ **No impact** - this is expected behavior  
✅ **Tests pass** (5/5)  
✅ **Error handling works correctly**

### Fix Needed?
❌ **No** - Optional: Mock `console.error` in tests to silence stderr

---

## Issue #2: study-engine.test.ts Mock Error (Real Problem)

### What You See
```
Error: [vitest] No "ProgressManager" export is defined on the "../src/study/progress-manager" mock.
```

### Root Cause

**Test mock (incorrect)**:
```typescript
vi.mock('../src/study/progress-manager', () => ({
  progressManager: {  // ❌ Lowercase instance
    getLearnedMoves: vi.fn(() => []),
    // ...
  },
}));
```

**Actual code needs**:
```typescript
// src/study/study-engine.ts:3
import { ProgressManager } from './progress-manager';  // ❌ Class import

// src/study/study-engine.ts:58
this.progressManager = ProgressManager.getInstance(); // ❌ Calls .getInstance()
```

**Mismatch**:
- Mock exports: `progressManager` (object)
- Code imports: `ProgressManager` (class)
- Code calls: `ProgressManager.getInstance()` → **undefined.getInstance()** ❌

### Impact

**On Application**:
- ✅ **No impact** - app works fine in runtime
- ✅ **Build succeeds**
- ✅ **ProgressManager singleton functions correctly**

**On Testing**:
- ❌ **StudyEngine cannot be instantiated in tests**
- ❌ **0 tests execute** (all 5 tests in suite skipped)
- ❌ **No coverage for**:
  - GUIDED/TEST/REVIEW mode transitions
  - User move validation
  - SRS stage progression
  - Progress persistence

### What Doesn't Work

1. **Cannot test StudyEngine** - constructor fails
2. **No regression detection** for learning logic
3. **Progress tracking changes unvalidated**

### Fix (Correct Mock)

```typescript
vi.mock('../src/study/progress-manager', () => {
  const mockProgressManager = {
    getLearnedMoves: vi.fn(() => []),
    getDueBranches: vi.fn(() => []),
    getBranchStatus: vi.fn(() => 'New'),
    getBranchErrors: vi.fn(() => 0),
    updateBranch: vi.fn(),
    addLearnedMoves: vi.fn(),
    getNextBranchId: vi.fn((debutId: string, branches: any[]) => branches[0]?.id || ''),
    save: vi.fn(),
  };

  return {
    ProgressManager: {
      getInstance: vi.fn(() => mockProgressManager)
    },
    progressManager: mockProgressManager,
  };
});
```

**Key changes**:
- ✅ Export `ProgressManager` class with `getInstance()` method
- ✅ Mock returns the instance object
- ✅ Include all methods used by StudyEngine

---

## Recommendation

### Priority: Medium

**Why not critical**:
- App functionality unaffected
- Build pipeline healthy
- Only test coverage impacted

**Should fix because**:
- Test suite incomplete (45% of tests not running)
- Future changes to StudyEngine/ProgressManager unvalidated
- Mock pattern inconsistent with singleton usage

### Next Steps

1. **Fix study-engine.test.ts mock** (5 min)
2. **Verify all 5 tests pass** (1 min)
3. **Add mock helper** if pattern repeats elsewhere
4. **Optional**: Silence stderr in loader tests

---

## Related Files

- `tests/study-engine.test.ts` - broken mock
- `src/study/study-engine.ts` - uses singleton pattern
- `src/study/progress-manager.ts` - implements singleton
- `tests/loader.test.ts` - false alarm stderr


