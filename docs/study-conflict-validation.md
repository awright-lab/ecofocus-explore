# Conflicting saved study IDs

Base: `7f76d4f00a9da0c84d2f5ac59fac9c658153df07` plus `workspace-storage-validation-7f76d4f.patch` (SHA256 `74BD3EFDB5E077609650D5B250E7BBD28F259B414D51C38EC9CF380AA6A6AB3D`). This is an incremental patch; no dependency on the analysis patches or backup investigation patch. All work is isolated, with synthetic data only.

## Change

`parseSavedWorkspace` validates all live workspace-level and report-embedded study records, decodes row storage, then checks repeated IDs before calling `normalizeDashboardWorkspace`. Previously the normalizer's map replaced earlier studies with later records, discarding conflicting rows or metadata. Conflicts now throw into the existing recovery screen. No source storage key is written, removed or bypassed, and the existing recovery download retains its original raw UTF-8 bytes.

Equality compares decoded JSON values recursively. Object key order and compact/plain row representation do not matter; row/field/array order, every value and all supplied metadata (including unknown extension properties) do matter. It does not normalize first, guess which copy is newer, union respondents, invent missing fields or compare only declared row counts. A different optional/default metadata representation is conservatively a conflict, even if the current normalizer might produce equivalent values; recovery preserves both originals for examination.

## Proven safe compatibility

Identical copies created by the existing `duplicateReportRecord` workflow load and save/reopen successfully. Identical sparse v1 copies migrate. Equivalent compact/plain respondent storage and different object key ordering load successfully. Independent historical snapshot studies can legitimately have the same ID and different values: snapshot collections are not merged into live studies, so this check deliberately leaves them scoped separately. Existing per-collection uniqueness validation remains unchanged.

## Verification

* New suite: 31 tests. Both v1 and v2 are covered for conflicting respondent values/order, previews, value labels, field/study metadata, notes, remote identity and unknown extensions; conflicts between reports; no fallback to an older valid source; recovery across navigation/autosave timing; and exact original-byte download.
* Red check against the documented base without this fix: 24 tests failed, 7 safe compatibility tests passed.
* With this fix: all 217 tests across the eight document suites passed, including storage validation, row storage, round trips, save recovery, report starters, persistence and scale coverage.
* `node ../node_modules/vitest/vitest.mjs run src/features/document/__tests__ --cache=false --maxWorkers=2`
* `node ../node_modules/typescript/bin/tsc -b --pretty false` passed.

## Scope and limits

This protects loading existing saved workspaces. Intentional in-memory update helpers and the general normalizer are unchanged. It does not repair conflicting files automatically, enable backup restoration, or establish that arbitrary external backup schemas are safe. Published-snapshot compaction behavior is unchanged; the historical-snapshot test verifies load scoping, not full historical dataset retention after another save. Native browser acceptance was not performed for this patch; recovery is exercised in jsdom. No main-worktree edits, publication, real data, credentials or settings changes occurred.
