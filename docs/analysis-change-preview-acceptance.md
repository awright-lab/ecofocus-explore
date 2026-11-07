# Analysis change preview — original goal 13 local review candidate

Original goal: show how a proposed filter, measure or weight change affects results before replacing an analysis. This batch completes the local unweighted review surface; it does not establish remote or weight-edit acceptance and is not counted as an independently accepted original goal.

## Workflow

Select an imported analysis, open Data, edit its grouping, numeric measure, breakout, filter, audience removal, metric or output, then choose **Preview proposed edit**. The existing preview runs a query while leaving the canvas and saved report unchanged. **Review settings and all results** opens a larger dialog with focus containment and background keyboard isolation, rather than placing a complete matrix inside the narrow inspector.

The review identifies changed settings and permits expanding their recorded before/after context. Markers check recorded identities as well as labels, since different fields can have the same name. Search covers the complete answer union, pagination reaches every matching answer, and the column chooser reaches every result column. Each screen shows at most 25 answers and one selected column to keep the matrix readable. Each side retains its own value, valid cell base and availability. A category missing from one result is explicitly absent, never converted to zero.

Arithmetic differences are shown only for matching recorded study/import, grouping, breakout, measure and metric with consistent metadata, raw category identities and ordinary local unweighted context. Percentage differences use percentage points. Numeric sums and counts use their recorded units. Different meanings, ambiguous identities, absent cells, invalid bases, stale calculation inputs, weighted/remote/derived contexts and unsupported cached contexts withhold the difference. This is descriptive subtraction, not a significance test, causal effect or a matched-person change. Audience/filter edits change the population and its bases.

Close or Escape returns focus to the review trigger without dismissing the underlying preview. A source or option change invalidates an old preview through the existing request ownership checks. **Update imported result** remains the separate explicit write action and runs a fresh query; it never blindly applies a captured preview. Existing update-error preservation and Undo/Redo behavior remain in place. Preview is optional; this batch does not force a new approval flow on ordinary edits.

## Evidence and limits

The new regressions use actual imported-query modules and a 1,600-row study with 80 answer categories and 10 breakout columns. They cover full axes, raw-key matching after generated IDs change, repeated display labels, absent categories, missing/duplicate identities, changed study/import/grouping/breakout/metric/measure/weight, missing inputs, inconsistent metadata, percentage-point arithmetic, zero/invalid bases, search, pagination, tenth-column access and keyboard dismissal/focus return. Existing request-race, failed-update, explicit-write and stale-preview tests continue to run.

Actual App/native browser acceptance uses the same synthetic dimensions through the actual inspector, local runtime query and workspace writer. Answer 060 in Group 9 is 2 (base 160) before and 1 (base 79) after the Keep=Yes filter; difference -1. Answer 079 becomes absent rather than zero. Delete and Escape leave the saved source untouched; Escape returns to the trigger. Before/preview saved records are exactly equal, including the entire study. Explicit Update produces 79 rows; Undo restores the exact original 80-row page; Redo and cold reopen retain the exact applied result. The study's full stored structure remains equal through every capture, including all 1,600 rows and 4 fields.

Synthetic fixture: `src/features/document/__tests__/fixtures/analysisChangeWorkflow.html`. It refuses unrelated workspace data. Detailed logs, saved-state records and screenshot are in the external change-review packet. Full final test/build counts and publication identities are recorded there after verification.

This does not establish seeded/live Snowflake or weighted editing, source authentication, native Office/download behavior, persistent preview plans, full touch/screen-reader certification or a transactional product writer. The remote/weight portions of original goal 13 remain open unless separately verified. No merge or production deployment is implied.
