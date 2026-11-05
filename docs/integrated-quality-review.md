# Integrated data, statistics and export review

Local integration on 2026-11-04, based on `7f76d4f`. No production data,
credentials, permissions, deployment or remote publication was changed.

## Reviewed patch stack

The following supplied patches applied cleanly in this order:

1. `workspace-storage-validation-7f76d4f.patch`
2. `workspace-study-conflicts-after-validation.patch`
3. `imported-analysis-accuracy-7f76d4f.patch`
4. `imported-analysis-context-after-accuracy.patch`
5. `statistical-safety-7f76d4f.patch`
6. `export-integrity-preserving-tools.patch`
7. `visual-export-review-fixes-after-preserving-tools.patch`

The export-disabling candidate was not applied. PDF and PPTX remain available.
The backup investigation is preserved in `backup-restore-design.md`; no restore
write feature or unvalidated replacement/merge was enabled. The conflicting-study
loading defect discussed by that historical investigation is now guarded before
normalization, while transactional restore and version-discrimination remain open.

Additional local integration work retained stricter numeric syntax: decimal point,
well-formed comma thousands groups, optional dollar sign, percentage points and
scientific notation. Partial numbers, malformed groups, hexadecimal and nonfinite
values are rejected. Inference and aggregation share the same parser. Stored raw
text is preserved. Numeric exclusions appear in the Analyze preview. Finite large
numbers no longer overflow during decimal rounding; aggregate overflow fails with
an explanation. Imported summaries state that no statistical test was performed,
without an impossible instruction to rerun that summary for significance.

## Independent local verification

The full combined suite passed 516 tests with one live integration test skipped.
The final build and TypeScript passed; the existing large-chunk warning remains.
Tests use synthetic fixtures. Optional actual raster/document tests were enabled
with `ECOFOCUS_EXPORT_RUNTIME` pointing to the already-installed bundled runtime;
no dependency was installed. `ECOFOCUS_EXPORT_ARTIFACTS` pointed inside this task's
writable directory. The initial three artifact-write failures were resolved by
removing the reviewer's hardcoded output directory from the test.

Native browser checks on an isolated localhost origin verified:

- Missing current imported-dataset collection, malformed current study and
  malformed v1 study enter the actual recovery screen. The diagnostic confirmed
  saved strings remain byte-for-byte equivalent before/after opening recovery.
- A valid legacy fixture loads 1,000 rows and 30 fields with exact sums: North
  12,250; South 12,500; East 12,750; West 13,000.
- A quality fixture changes one value to `12oops`, another to `$20`, and another
  to blank. Analyze excludes two values, includes the dollar value, and produces
  North 12,249; South 12,518; East 12,747; West 13,000. Cell bases are respectively
  249, 250, 249, 250. The table and notices survive a cold reopen.
- A requested missing study shows Study unavailable and disables Create table;
  another available study is not silently substituted.

The recovery download eventually completed at the browser's ordinary Downloads
location after a long pending tool wait. No further browser download acceptance
was attempted. Native PDF/PPTX download and Office rendering remain unverified.
The earlier isolated PowerPoint COM denial (0x80070005) was not retried or bypassed.

The local suite generated actual PDFs/PPTX and XLSX artifacts. All five independently
rendered PDF pages were visually inspected: a complete 12x6 table, 30-series bars,
signed horizontal bars, stacked bars and a signed line chart. PDF raster differences
against source JPEGs were approximately 0.19-0.40/255. PPTX package/XML checks retain
all 30 grouped and two stacked series. These checks do not establish Office layout
fidelity or pixel-identical browser capture.

## Practical limits

Complete context, labels and cells must fit. Compact existing tiles, dense charts,
long text or unavailable external images may now fail with an actionable error
instead of silently omitting content. This is a material export behavior change
to review before publication; the formats themselves remain enabled. PDF is a
raster analytical reconstruction. Native editable PPTX charts require Office
visual acceptance. The export UI's earlier error/retry handling remains in place.

Weighted/cached inference without validated variance or precision is suppressed.
Supported unweighted tests remain approximate and unadjusted, with sparse cases
declined. Complex survey variance, exact sparse tests and live Snowflake execution
are not verified. Remote filter lists with incomplete browser rows are blocked;
server-side complete filter discovery remains future work. Memory-only import
recovery, multi-tab transactions, safe versioned backup restoration and historical
snapshot dataset retention remain roadmap items.
