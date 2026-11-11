# Correlation explorer validation

Correlation is a temporary descriptive view, using the selected numeric outcome and predictors symmetrically. The existing local-study, audience, field and numeric-range rules apply; the regression split seed is irrelevant. One common complete-case population feeds the whole matrix, every pair and the case table. Pearson values are centered and scaled before products; constant, insufficient or numerically unsupported measurements are unavailable. As with the model safeguards, absolute values above 1e12, variation below 1e-150 and variation too small relative to the observed magnitude are refused. No weights, significance tests, confidence intervals, automatic variable selection or exports are added.

Only selected numeric projections and imported row positions are sent to the correlation worker. The original dataset stays local. Before accepting and displaying results, the existing selected-value and audience checks are combined with exact study/field/row identity and row-content comparisons. Those comparisons run on the main thread and can be expensive for large studies; the full 25,000-row limit has not been benchmarked here. Up to 300 points are drawn using deterministic sampling that preserves both axes' extremes; all complete cases determine coefficients and axis extents and remain reachable in 50-row pages.

## Reproduce

Install repository dependencies and a compatible Playwright Chromium. The local actual-App runner uses a temporary browser profile and synthetic study, blocks non-local requests, checks that correlation starts its own worker without fitting OLS, inspects the pair and last case, and verifies the saved study, report, published snapshot and an already fitted model remain unchanged. It also checks keyboard focus and Escape, narrow width and native 200% browser zoom.

```sh
PLAYWRIGHT_MODULE=/path/to/node_modules/playwright CHROMIUM_EXECUTABLE=/path/to/chrome node docs/validation/correlation-explorer/verify-browser.mjs
npm test -- src/features/models/__tests__/correlationMath.test.ts src/features/models/__tests__/correlationJob.test.ts src/features/models/__tests__/CorrelationExplorer.test.tsx src/features/models/__tests__/linearModelMath.test.ts src/features/models/__tests__/linearModelJob.test.ts src/features/models/__tests__/LinearModelExplorer.test.tsx --maxWorkers=2 --testTimeout=30000
npm test -- --maxWorkers=2 --testTimeout=30000 --reporter=verbose
npm run typecheck
npm run build
git diff --check
```

In one local Chromium 156 run, a synthetic 650-row study yielded 648 common complete cases. The matrix was available in 139 ms, 300 points and at most 50 case rows were mounted, and the last imported row was reachable. Browser long tasks reached 457 ms across App startup, interaction and a separate OLS fit; this is not a correlation-only measurement. No non-local requests or page errors occurred. Desktop, narrow and native 200% zoom screenshots were inspected. This is one machine and fixture, not a performance guarantee; no screen reader or live service was tested.

Final validation: 78 focused tests passed. The isolated full suite passed 5,746 tests across 425 files, with four skips: optional offline raster/document generation, two optional PowerPoint visual-generation tests and the opt-in live Snowflake integration. Typecheck, build and diff checks passed; the build reported a large-chunk warning.
