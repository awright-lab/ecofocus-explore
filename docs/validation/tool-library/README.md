# Tool Library validation

From the repository root, install dependencies and run:

```sh
PLAYWRIGHT_MODULE=/path/to/playwright CHROMIUM_EXECUTABLE=/path/to/chrome node docs/validation/tool-library/verify-browser.mjs
npm test -- src/features/builder/components/__tests__/studioWorkflows.test.tsx src/features/builder/components/__tests__/toolCatalog.test.ts
npm run typecheck
npm run build
```

The browser runner uses a temporary browser profile and two-row synthetic study, blocks non-local requests, and checks five task searches, keyboard selection, Escape and focus restoration, opening numeric relationships, responsive widths and native 200% zoom. It compares saved reports, studies and published snapshots before and after browsing. Screenshots and machine-readable results are alongside this file. It does not test a screen reader, live services, every command's effects, or in-memory undo/redo history.

## PR #14 follow-up

The runner additionally selects from the full, unfiltered library at 390 × 600 and native 200% zoom, checks keyboard focus reaches the visible launch action, and holds a selection across a real report-title autosave before opening Numeric Relationships. The two added screenshots show those selected states. The saved-data comparison happens before the deliberately synthetic title edit.

Selection revalidates the unique ID, label, group and callback source, then calls the current supplied callback. Recreated callbacks with the same implementation survive parent rerenders; removed, ambiguous, renamed or changed implementations are rejected. The callback contract has no revision or semantic identity token, so a changed closure with identical function source cannot be distinguished from an ordinary rerender; execution uses the current callback rather than a captured one.

The isolated full suite passed 5,733 tests with 4 skips (423 files passed, 2 skipped). It used two workers, unset Snowflake credentials and `SNOWFLAKE_VERIFY_INTEGRATION`, and set `SF_OCSP_RESPONSE_CACHE_SERVER_ENABLED=false`; it did not verify live Snowflake. The 18-test focused run, typecheck and build passed. The build emitted the existing large-chunk warning. No screen reader was tested.
