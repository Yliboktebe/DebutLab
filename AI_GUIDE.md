# AI Assistant Guidelines for DebutLab

## Purpose
This document defines safe boundaries for AI-assisted code changes in the DebutLab project.

## What IS Allowed ✅

- **Formatting**: Applying consistent code style (indentation, spacing, line breaks)
- **Auto-fixes**: Safe linter auto-fixes that don't change behavior
- **Import cleanup**: Removing unused imports, organizing existing imports (no new aliases)
- **Dead code removal**: Only with "double signal" verification (see below)
- **Documentation**: Adding/updating comments and documentation files
- **Type improvements**: Only if behavior stays identical and tests pass

## What is NOT Allowed ❌

- **Behavior changes**: No modifications to application logic or UI behavior
- **Public API changes**: No changes to exported interfaces, function signatures, contracts
- **Data schemas**: No changes to data structures, schemas, or configuration formats
- **Protected directories**: NO modifications to:
  - `tools/etl/**`
  - `public/content/**`
  - Any content data files
- **Architectural changes**: No new folder structures, path aliases, or module reorganizations
- **"Creative improvements"**: No algorithmic rewrites, no "better" implementations
- **Assumptions**: If something is unclear, document it - don't change it

## Pull Request Policy

- **One type of change per PR**: Don't mix formatting with refactoring
- **Diff limit**: Maximum 300-400 lines of changes per PR
- **Required report**: Every PR must include audit report references
- **Tests required**: All changes must pass `build` and `test` before commit

## Dead Code Removal - "Double Signal" Rule

A file or export can ONLY be removed if ALL conditions are met:

1. ✅ Flagged as unused by `knip`
2. ✅ Flagged as unused by `ts-prune`
3. ✅ No dynamic references found (string paths in configs, route arrays, lazy imports)

If ANY condition fails → **DO NOT DELETE**, add to `suspects.md` instead

## Pre-commit Checklist

Before every commit:
```bash
npm install  # or pnpm/yarn
npm run build
npm run test
```

If tests don't exist, skip `npm run test` but don't add tests in cleanup PRs.

## Conflict Resolution

When uncertain:
1. **Don't touch the code**
2. **Document in audit report** (`tools/audit/out/suspects.md` or `risks.md`)
3. **Flag for manual review**

## Current Audit Cycle

This is a **safe cleanup cycle** only. Future improvements (architectural refactoring, new patterns, optimizations) will be separate, targeted PRs after this audit is complete.
