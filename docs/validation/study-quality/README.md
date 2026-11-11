# Study-quality review validation

The review accepts only a complete local imported snapshot with unique field identities and source mappings. Remote, partial and inconsistent studies are explicitly unavailable, as are studies exceeding 1,000,000 rows, 10,000 fields or 5,000,000 cells. It captures each raw column once, sends one column at a time to a single worker, and verifies the schema, row identities, row contents and profiled values before displaying results. The same exact check runs on rendering and before opening a field. The displayed result is a verified snapshot, not continuous monitoring; refresh checks for later changes. The final exact verification and subsequent checks run on the main thread and can cause noticeable pauses on large studies.

Blank means empty or whitespace. Numeric parsing, interpreted categories and their validation reuse the existing import/profile paths. Numeric distinct counts refer to parsed finite numbers; categorical counts use the existing response interpretation; other fields count distinct exact nonblank raw values. A constant indicator requires one verified distinct value and, for numeric fields, no invalid numeric values. The indicators are unweighted review prompts, not error verdicts. No result is persisted or used to recode, exclude or create an analysis.

## Reproduce

Install the repository dependencies and a compatible Playwright Chromium. The runner starts the actual local App with a temporary browser profile and a synthetic 10,000-row by 100-field study. The rows are sparse: the first field has blank, zero, invalid and numeric values; the remaining fields are blank. It blocks non-local requests and checks cancellation, retry, refresh, Escape and focus restoration, shortcut protection, field navigation, bounded mounted fields, and preservation of saved reports, source data and published snapshots.

```sh
PLAYWRIGHT_MODULE=/path/to/node_modules/playwright \
CHROMIUM_EXECUTABLE=/path/to/chrome \
node docs/validation/study-quality/verify-browser.mjs
npm test -- src/features/data/__tests__/studyQuality.test.ts src/features/builder/components/__tests__/StudyQualityDialog.test.tsx src/features/builder/components/__tests__/studyQualityParent.test.tsx src/features/data/__tests__/numericProfileJob.test.ts src/features/data/__tests__/categoricalProfileJob.test.ts src/features/data/__tests__/importedNumericProfile.test.ts src/features/data/__tests__/importedCategoricalProfile.test.ts --maxWorkers=2 --testTimeout=30000
npm test -- --maxWorkers=2 --testTimeout=30000 --reporter=verbose
npm run typecheck
npm run build
git diff --check
```

In one local Chromium 156 run, review after retry took 2,917 ms and mounted 20 field cards. The browser recorded long tasks up to 384 ms across application startup and review; this is not an isolated review-only latency measurement. The dialog had no horizontal overflow at 390 CSS pixels or native 200% browser zoom. Desktop, narrow and zoom screenshots were inspected. These observations do not establish performance for dense or larger studies. No screen reader or live service was tested.

Final validation: 62 focused profile and App tests passed; a separate 14-test model run included the empty-dimension limit. The full suite passed 5,726 tests across 425 files, with four skips: the optional offline raster/document generation test, two optional PowerPoint visual-generation tests and the opt-in live Snowflake integration. Typecheck, build and diff checks passed. The build reported a large-chunk warning.
