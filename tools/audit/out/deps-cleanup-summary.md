# Dependencies Cleanup Summary

## Changes Made

Based on: `knip-report.json` + codebase analysis

| Package | Was | Now | Basis |
|---------|-----|-----|-------|
| `p-limit` | dependencies | ❌ Removed | Not used anywhere in codebase (knip-report.json) |
| `zod` | dependencies | ❌ Removed | Not used anywhere in codebase (knip-report.json) |
| `zustand` | dependencies | ❌ Removed | Not used anywhere in codebase (knip-report.json) |
| `bottleneck` | dependencies | ✅ devDependencies | Used only in `tools/openings/lichess.ts` (build-time script) |
| `undici` | dependencies | ✅ devDependencies | Used only in `tools/openings/lichess.ts` (build-time script) |

## Kept Unchanged (Despite knip warnings)

| Package | Location | Reason |
|---------|----------|--------|
| `@testing-library/react` | devDependencies | ✅ Used in `tests/setup.ts` |
| `@types/chess.js` | devDependencies | ✅ Type definitions for chess.js (used in src/) |
| `dependency-cruiser` | devDependencies | ✅ Used in audit tooling |
| `fast-glob` | devDependencies | ✅ Used in `tools/audit/scan.ts` |
| `ts-prune` | devDependencies | ✅ Used in audit tooling |

## Verification

- ✅ `npm install` - lockfile updated, 3 packages removed
- ✅ `npm run build` - successful build
- ✅ `npm test` - same result as before (1 pre-existing test failure in study-engine.test.ts)

## Impact

- **Behavior**: No changes - removed packages were unused
- **Bundle size**: Reduced by ~3 packages in production dependencies
- **Build tools**: bottleneck and undici correctly categorized as devDependencies

