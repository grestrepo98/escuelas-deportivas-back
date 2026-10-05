# tests-folder

Objective: move unit and integration tests out of `functions/src/` into `functions/test/{unit,integration}/`, mirroring `src/`.
Route: delegated writer (87 files + configs + docs). Trigger: 2+ non-trivial files.
Test-first exception: pure relocation, no behavior change; proof is identical test counts before/after.

## Tasks
- [x] T1 Record baseline (`npm run test:unit` count) and move tests with import rewrites
- [x] T2 Update vitest configs, ESLint overrides, path-based test helpers
- [x] T3 Docs: AGENTS.md, docs/arquitectura.md, docs/guias/agregar-caso-de-uso.md, functions/README.md, ADR 0012 (replicate docs/ to ../escuelas-front/docs and ../docs)

## Verification
typecheck, lint, format:check, test:unit (same count), test:integration, test:rules, build.

## Evidence
Baseline test:unit: 39 files / 709 tests; after: 39 / 709. test:integration: 24 files / 707 tests. test:rules: 2 files / 339 tests.
63 test files moved with git mv (39 unit, 24 integration); 0 *.test.ts left under functions/src.
typecheck, lint, format:check, build: pass. Path fixes: lint-boundaries (functionsRoot), player-indexes (indexes.json path), .eslintrc.js comment.
Docs: AGENTS.md, docs/arquitectura.md, docs/guias/agregar-caso-de-uso.md, functions/README.md, ADR 0012 (replicated to ../docs and ../escuelas-front/docs). ADR 0008 left untouched (not in allowed surface); ADR 0012 declares the amendment.
Not committed (parent commits).
