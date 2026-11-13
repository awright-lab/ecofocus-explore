# Correlation explorer validation

Correlation is a temporary descriptive view, using the selected numeric outcome and predictors symmetrically. The existing local-study, audience, field and numeric-range rules apply; the regression split seed is irrelevant. One common complete-case population feeds the whole matrix, every pair and the case table. Pearson values are centered and scaled before products; constant, insufficient or numerically unsupported measurements are unavailable. As with the model safeguards, absolute values above 1e12, variation below 1e-150 and variation too small relative to the observed magnitude are refused. No weights, significance tests, confidence intervals, automatic variable selection or exports are added.

Only selected numeric projections and imported row positions are sent to the correlation worker. The original dataset stays local. Before accepting and displaying results, the existing selected-value and audience checks are combined with exact study/field/row identity and row-content comparisons. Those comparisons run on the main thread and can be expensive for large studies; the full 25,000-row limit was measured in the follow-up below. Up to 300 points are drawn using deterministic sampling that preserves both axes' extremes; all complete cases determine coefficients and axis extents and remain reachable in 50-row pages.

## Reproduce

Install repository dependencies and a compatible Playwright Chromium. The local actual-App runner uses a temporary browser profile and synthetic study, blocks non-local requests, checks that correlation starts its own worker without fitting OLS, inspects the pair and last case, and verifies the saved study, report, published snapshot and an already fitted model remain unchanged. It also checks keyboard focus and Escape, narrow width and native 200% browser zoom.

```sh
PLAYWRIGHT_MODULE=/path/to/node_modules/playwright CHROMIUM_EXECUTABLE=/path/to/chrome node docs/validation/correlation-explorer/verify-browser.mjs
PLAYWRIGHT_MODULE=/path/to/node_modules/playwright CHROMIUM_EXECUTABLE=/path/to/chrome node docs/validation/correlation-explorer/verify-limit-browser.mjs
npm test -- src/features/models/__tests__/correlationMath.test.ts src/features/models/__tests__/correlationJob.test.ts src/features/models/__tests__/CorrelationExplorer.test.tsx src/features/models/__tests__/linearModelMath.test.ts src/features/models/__tests__/linearModelJob.test.ts src/features/models/__tests__/LinearModelExplorer.test.tsx --maxWorkers=2 --testTimeout=30000
npm test -- --maxWorkers=2 --testTimeout=30000 --reporter=verbose
npm run typecheck
npm run build
git diff --check
```

In one local Chromium 156 run, a synthetic 650-row study yielded 648 common complete cases. The matrix was available in 139 ms, 300 points and at most 50 case rows were mounted, and the last imported row was reachable. Browser long tasks reached 457 ms across App startup, interaction and a separate OLS fit; this is not a correlation-only measurement. No non-local requests or page errors occurred. Desktop, narrow and native 200% zoom screenshots were inspected. This is one machine and fixture, not a performance guarantee; no screen reader or live service was tested.

Final validation: 78 focused tests passed. The isolated full suite passed 5,746 tests across 425 files, with four skips: optional offline raster/document generation, two optional PowerPoint visual-generation tests and the opt-in live Snowflake integration. Typecheck, build and diff checks passed; the build reported a large-chunk warning.

## Symmetry and integration follow-up

For X = [1, 2, 3, 4, 5] and Y = [1, 2, 3, 4, 1], the previous independently computed halves were 0.24253562503633294 and 0.2425356250363329. The job validator correctly rejected the unequal cells. Each pair is now calculated once and mirrored, including unavailable reasons; the validator is unchanged. The independent reference is 1/√17. Tests cover imperfect positive and negative values, reordered fields, constants, missing cases and supported magnitudes, through the helper, job validator and UI.

The updated real-App runner uses the Tool Library's select-then-open flow. It gates the correlation worker to check cancellation and rejection after a synthetic source-row mutation, then restores the synthetic row. It exercises pair details, case pagination, focus and keyboard controls, narrow width and native 200% zoom. Saved reports, studies, snapshots and an independently fitted model's visible results are checked unchanged. The gate and mutation are test instrumentation; no live service was used.

A separate local Chromium 156 run used 25,000 fully populated synthetic rows and all seven supported selected fields. Review to matrix took 1,390 ms; five pair selections took 73–98 ms and five next-page actions took 35–73 ms, measured in-page through two animation frames. Each measured action made 50,000 calls to `JSON.stringify` on synthetic row objects—two full row serializations per interaction in this run—alongside the existing projection/currentness checks. The instrumentation itself adds overhead. Long tasks reached 438 ms across startup, review and interaction, not necessarily any one correlation operation. These are single-machine observations, not guarantees. A 300-point plot and 50 case rows were mounted. The checks remain synchronous on the main thread, so larger row text, slower hardware or repeated interactions may be noticeably less responsive; no stale-data safeguards or limits were removed. See `limit-results.json` for individual values.

Integration validation: original PR head `5cfe9ee4559ccf081206f4e45cc0b6bc0b45b935`; verified main `bd3b6b6dd352926f8ceafd8dd811104b0ed3f918`; merge commit `2e4a32ea38ab4744cb3305d6c8929761f64fb5b2`. The combined tree passed 87 focused correlation and existing linear-model tests; the full suite passed 5,769 with four skips (427 files passed, two skipped). Skips were optional offline raster/document generation, two optional PowerPoint visual tests and opt-in live Snowflake integration. Typecheck, build and CRLF-aware diff checks passed; build retained the large-chunk warning. The full suite used no Snowflake credentials or live integration and disabled the OCSP cache server. No actual screen reader or live service was tested.
