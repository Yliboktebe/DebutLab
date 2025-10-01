# Orphan Modules Analysis

Generated: 2025-09-30  
Based on: `dependency-graph.json` (regenerated)

## Summary

dependency-cruiser reports 5 orphan modules. However, most are **false positives** due to path alias `@/*` not being tracked by the tool.

## Detailed Analysis

| File | Orphan Status | External Usage Found? | Note |
|------|--------------|----------------------|------|
| `src/board/black-replies.ts` | ✅ Yes | ❌ No | Flagged by knip as unused. No active imports found. Candidate for removal. |
| `src/content/loader.ts` | ⚠️ False Positive | ✅ Yes | **Active usage via `@/content/loader`** in: StudyView.tsx, DebutPage.tsx, HomePage.tsx, tests/loader.test.ts. Not truly orphaned. |
| `src/content/types.ts` | ⚠️ False Positive | ✅ Yes | **Heavy usage via `@/content/types`** in: progress-manager, study-engine, StudyView, DebutPage, HomePage, loader, black-replies, DebutCatalog, etc. Not truly orphaned. |
| `src/study/utils.ts` | ✅ Yes | ❌ No | Flagged by knip as unused. Cleanup report shows unused functions already removed. No active imports found. Candidate for removal or repurposing. |
| `src/types/chessground.d.ts` | ⚠️ Ambient Types | N/A | Ambient declaration file (`.d.ts`) for chessground library. Does not require explicit imports. Used by TypeScript compiler automatically. |
| `src/vite-env.d.ts` | ⚠️ Build Tool | N/A | Standard Vite environment types file. Automatically included via `tsconfig.json`. Does not require explicit imports. |

## Root Cause: Path Alias Not Tracked

The project uses path alias `@/*` → `src/*` (defined in `tsconfig.json`).  
`dependency-cruiser` cannot resolve these aliases without additional configuration.

**Evidence:**
- `@/content/loader` → 3 active imports in `src/pages/`
- `@/content/types` → 9 active imports across `src/`
- No imports found using relative paths (e.g., `../content/loader`)

## True Orphans (Action Required in Next Cycle)

### 1. src/board/black-replies.ts
- **Status**: Unused
- **Evidence**: 
  - Flagged by knip
  - ts-prune shows: `buildBlackRepliesFromBranch (used in module)` + `buildBlackRepliesFromDebut`
  - No active imports in codebase
- **Recommendation**: Review for removal or document future usage

### 2. src/study/utils.ts
- **Status**: Potentially unused
- **Evidence**:
  - Flagged by knip
  - Cleanup report mentions unused functions already removed
  - No active imports found
- **Recommendation**: Verify if file still serves purpose; consider removal if empty/minimal

## False Positives (No Action Needed)

### 1. src/content/loader.ts
- **Status**: Actively used via `@/` alias
- **Action**: None

### 2. src/content/types.ts
- **Status**: Heavily used via `@/` alias
- **Action**: None

### 3. src/types/chessground.d.ts
- **Status**: Ambient types, automatically used
- **Action**: None

### 4. src/vite-env.d.ts
- **Status**: Build tool types, automatically included
- **Action**: None

## Next Steps

1. ✅ **This document recorded** - current state frozen
2. 🔜 **Future cycle**: Review true orphans (black-replies.ts, utils.ts)
3. 🔜 **Optional**: Configure dependency-cruiser to resolve `@/*` aliases for accurate future scans

## Configuration Note

To fix false positives in future scans, add to `.dependency-cruiser.js`:

```javascript
{
  options: {
    tsConfig: {
      fileName: './tsconfig.json'
    }
  }
}
```

This will enable path alias resolution.

