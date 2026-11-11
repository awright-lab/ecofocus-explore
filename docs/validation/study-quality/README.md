# Study-quality review validation

The review accepts only a complete local imported snapshot with unique field identities and source mappings. Because the workspace does not expose a reliable revision for in-place row and schema mutations, each render and field navigation still performs the exact snapshot comparison. To bound that work, review is unavailable above **20,000 cells, 200 fields or 20,000 rows**, or when captured row text or raw values exceed 1,000,000 characters or field metadata exceeds 128,000 characters. These bounds are intentionally conservative; the earlier 10,000-by-100 sparse demonstration is no longer supported. A source modified in place to contain unusually large values after capture can still make the next check slow.

A single worker processes one captured column at a time. Schema, row identities, row contents and profiled values are verified; replaced or ambiguous sources and late replies fail closed. The displayed result is a verified snapshot, not continuous monitoring. Blank means empty or whitespace. Numeric parsing and categorical interpretation reuse existing import/profile paths. Counts are unweighted review prompts, not error verdicts. No result is persisted or used to recode, exclude or create an analysis.

## Reproduce

Install repository dependencies and a compatible Playwright Chromium. The local actual-App runner uses a fresh temporary profile, blocks non-local requests and exercises cancellation, retry, refresh, keyboard focus, paging, search, exact field navigation and state preservation. Both fixtures below contain 20,000 populated cells:

```sh
PLAYWRIGHT_MODULE=/path/to/node_modules/playwright CHROMIUM_EXECUTABLE=/path/to/chrome node docs/validation/study-quality/dense-followup/verify-browser.mjs
QUALITY_ROWS=200 QUALITY_FIELDS=100 PLAYWRIGHT_MODULE=/path/to/node_modules/playwright CHROMIUM_EXECUTABLE=/path/to/chrome node docs/validation/study-quality/dense-followup/verify-browser.mjs
npm test -- src/features/data/__tests__/studyQuality.test.ts src/features/builder/components/__tests__/StudyQualityDialog.test.tsx src/features/builder/components/__tests__/studyQualityParent.test.tsx src/features/data/__tests__/numericProfileJob.test.ts src/features/data/__tests__/categoricalProfileJob.test.ts src/features/data/__tests__/importedNumericProfile.test.ts src/features/data/__tests__/importedCategoricalProfile.test.ts --maxWorkers=2 --testTimeout=30000
npm test -- --maxWorkers=2 --testTimeout=30000 --reporter=verbose
npm run typecheck
npm run build
git diff --check
```

One local Chromium 156 run measured 100 rows × 200 fields: 879 ms for review after retry, 22–29 ms per key for five typed characters, and 54 ms for paging. Another measured 200 × 100: 411 ms, 24–29 ms per key and 44 ms for paging. These per-key and paging timings include Playwright automation overhead. The browser recorded long tasks up to 371 ms and 451 ms, respectively, across application startup and review; these are not isolated interaction-only measurements. Each run mounted at most 20 field cards, with no external requests or page errors. Narrow and native 200% zoom screenshots were inspected. These single-machine observations are not performance guarantees; no screen reader or live service was tested. Previous screenshots and results in the parent directory document the earlier, less restrictive implementation and are historical only.

Follow-up validation: 68 focused tests passed. The isolated full suite passed 5,731 tests across 425 files, with four skips: the optional offline raster/document generation test, two optional PowerPoint visual-generation tests and the opt-in live Snowflake integration. Typecheck, build and diff checks passed; the build reported a large-chunk warning. These checks ran on the PR branch's original `ba9ea970` base, not an integrated checkout of current `main`.
