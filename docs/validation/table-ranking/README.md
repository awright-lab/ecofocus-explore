# Recorded-table ranking validation

The browser sorts and filters recorded numeric cells using the same availability and base rules as the cell display; it does not parse displayed text or recalculate values, bases or comparisons. Unavailable values sort after available values in both directions, while equal values retain recorded row order. Bounds are inclusive. Pinning removes selected columns from the paged remainder and adds them to every window; there are at most 25 rows and 8 columns in the rendered table. Schema or alias replacement resets exploration with a notice. All exploration state is local to the open browser.

## Reproduce

Install repository dependencies and a compatible Playwright Chromium. The runner starts the real local App with a temporary browser profile and a synthetic 1,000-answer by 40-column recorded table. It blocks non-local requests, checks sorting, pinning, validation, reset, bounded cells, keyboard focus and Escape, and compares the normalized saved report, datasets and snapshots before and after browsing.

```sh
PLAYWRIGHT_MODULE=/path/to/node_modules/playwright \
CHROMIUM_EXECUTABLE=/path/to/chrome \
node docs/validation/table-ranking/verify-browser.mjs
npm test -- src/features/builder/components/__tests__/tableExplorerModel.test.ts src/features/builder/components/__tests__/CompleteTableDialog.test.tsx src/features/builder/components/__tests__/tableExplorerParentWorkflow.test.tsx src/features/builder/components/__tests__/GuidedCompletePreview.test.tsx src/features/builder/components/__tests__/guidedCompletePreviewParent.test.tsx --maxWorkers=2 --testTimeout=30000
npm test -- --maxWorkers=2 --testTimeout=30000 --reporter=verbose
npm run typecheck
npm run build
git diff --check
```

Chromium 156 mounted 25 rows and 8 columns, opened in 385 ms in one local run, and had no dialog horizontal overflow at 390 CSS pixels or native 200% browser zoom. These figures are observations for this fixture and machine, not performance guarantees. The desktop, narrow and zoom screenshots were inspected. Automated keyboard checks do not substitute for screen-reader testing; no screen reader or live service was used. The temporary-preview and actual-App history/reopen cases are automated tests rather than a separate browser walkthrough.

Final validation: full suite 5,577 passed and 2 skipped across 408 passed and 1 skipped files; typecheck, build and diff checks passed. The skipped checks are optional offline raster/document generation and the opt-in live Snowflake integration. The build reported a large-chunk warning. A prior overlapping build and test run produced timeout failures under resource contention; it was stopped, and the isolated full run above passed. Focused runs passed 72 saved/preview/model tests and, after the focus-fallback addition, 49 model/dialog tests; the updated saved-result App test also passed separately.
