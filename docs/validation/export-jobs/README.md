# Shared export job validation

The header and Tool Library use the same in-memory job lock. A job captures a cloned report and ordered pages before any asynchronous work. Progress reports preparation, actual completed page counts for PDF/PPTX rendering, packaging and download initiation; no percentage is inferred. Cancellation and context invalidation are checked around asynchronous rasterization and before download. A synchronous clone, validation, serialization, archive or canvas operation cannot be interrupted until control returns to the event loop. While cancellation waits for an in-flight step, the UI says so and prevents another concurrent job.

A completed message means the browser download was initiated; it does not prove the user saved the file. The existing export format builders, result validation and JSON package schema remain in use. The job does not run analysis, save a workspace or modify the report.

Reproduce with local dependencies and a compatible Chromium:

```sh
PLAYWRIGHT_MODULE=/path/to/playwright CHROMIUM_EXECUTABLE=/path/to/chrome node docs/validation/export-jobs/verify-browser.mjs
npx vitest run src/features/export/__tests__/exportJobLifecycle.test.tsx src/features/export/__tests__/exportCooperativeCancel.test.ts src/features/export/__tests__/pptxLayerPlan.test.ts src/features/export/__tests__/exportIntegrity.test.ts src/features/export/__tests__/ExportPreflightDialog.test.tsx src/features/builder/components/__tests__/studioWorkflows.test.tsx --maxWorkers=2 --testTimeout=30000
npm run typecheck
npm run build
```

Chromium uses synthetic reports and study data, blocks non-local requests and delays browser image loading to exercise cancellation during rasterization. It tests a header export followed by a duplicate Tool Library launch, cancellation without download, JSON retry, editing during PowerPoint export, report and viewer navigation, keyboard cancellation, narrow width and native 200% zoom. The PowerPoint filename and completion label retain the captured report title; component tests verify captured page and report data. Unit checks compare representative PDF and PPTX bytes with and without export controls. This is not a screen-reader test, Office visual inspection, a live service test or proof that a user saved a file. Browser error/retry and all format/entry combinations were not individually exercised; error/retry and format builders have automated coverage.

Verified against main `bd3b6b6dd352926f8ceafd8dd811104b0ed3f918`: focused tests passed (60 tests in 6 files); full suite passed (426 files, 5,749 tests; 2 files and 4 tests skipped) using the existing offline Snowflake configuration; typecheck and production build passed. Chromium 156.0.8078.4 passed the scenarios recorded in `results.json`. The build reported the existing large-chunk warning. Normal tests do not verify a live Snowflake service.
