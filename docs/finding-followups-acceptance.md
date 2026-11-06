# Suggested follow-up questions — goal 27 acceptance

Original goal: help users investigate a finding further, such as whether a difference also appears across generations or study waves.

Required acceptance:

1. From a selected analysis, choose the exact recorded answer and group. Suggested questions name that finding and use available, compatible source fields or audiences.
2. Each suggestion exposes its rationale, changed setting and preserved study/metric/weight/filter context. Replacing an audience or breakout is explicit; it never silently removes a filter. Sample-wave suggestions require matching declared populations and answer codes and stay clearly illustrative.
3. Preview the complete supported calculation before creating a separate analysis on a new page. Preserve the original source analysis, authoring history and all respondent data. Keep the follow-up question and recorded origin in saved result notes.
4. Pending edits, ambiguous/unavailable cells, missing/replaced sources, legacy unversioned imports, unsupported derived/authored results and remote workflows fail visibly without writing anything. Saved audience versions cannot silently rebind. Late previews/creation after cancellation or changed context must not replace work.
5. Native real-App synthetic checks cover grouping and saved-audience follow-ups through preview, creation, save/cold reopen and preserved source. Automated regression tests cover calculation/source correctness, failures, context ownership and persistence. Independent original-scope review is required before completion.

Status: implemented and tested review candidate. Independent original-scope review is pending; the goal is not yet marked complete.

## Verification

Final full suite: **1,633 passed, two skipped**; TypeScript and Vite production build passed. Twenty-six new regressions cover chosen-finding calculations, unchanged filters, audience and import versions, unsupported/missing/ambiguous sources, metric/weight consistency, selected-answer visibility beyond the preview window, missing answers, data quality notices, cancellation, stale operation ownership and separate-page provenance. The existing large Builder chunk warning remains.

Actual App/native acceptance used only 1,000 fabricated rows and 30 fields in a guarded browser origin:

- Select North / Total: 25%. Review the plan to compare by Segment, including fixed source import, metric, weight, filter and audience. Preview shows Core and Growth at 25% with recorded bases of 500. Closing the preview adds no page.
- Create the follow-up on a new page, save and cold reopen. The original page remains identical in captured JSON: four values of 25%, each with base 1,000; all 1,000 rows and 30 fields remain.
- From the original, choose the saved Growth audience, inspect its actual rules and preview the four regional percentages at 25% with base 500. Creation uses a separate third page. Undo removes the new page as one edit; Redo restores it. A final-code recreation retains the exact origin analysis/answer/group IDs in saved notes.
- Upgrade acceptance used the older 1,000-row/90-field catalog report: follow-ups initially refused its unversioned result. An explicit native rerun recorded the original import event and enabled the Segment follow-up; restoring the percentage metric and cold reopening retained all four 25% values, bases of 1,000 and the Market geography discovery labels. Earlier locator-only clicks did not activate the rerun; the native button action succeeded, so no application fix was needed.
- Save a browser snapshot and cold reopen its viewer. All three pages remain available, including the audience result with bases of 500. The snapshot is explicitly local, not an online publication.
- With the original selected, Delete in the dialog preserves the report; Shift+Tab/Tab wrap inside it and Escape restores the opener. A final preview highlights North without changing saved data.

Native raw evidence and screenshots are outside Git under `finding-followups-native-*`. JSON comparisons against the captured baseline verify source preservation, values/bases, audience/query version, exact origin reference and snapshot count. The committed fixture uses the real App, writer and document commands, refuses unrelated workspaces, and never automatically calls live services. Its route guard was corrected so snapshot reload actually remains in the viewer. A fixture-only duplicate-createRoot HMR warning occurred while editing the harness; cold reload and subsequent acceptance succeeded.

## Honest limits

Local complete-study grouping and audience workflows were tested end-to-end. Sample rules/wave metadata were exercised in tests with explicitly tagged sample records; existing unidentified sample results are gated, and native sample/backend execution was not invoked. Filtered sample follow-ups are blocked because the sample preview engine does not apply those filters. Real study-wave comparisons require separate mapping and comparability work. No live Snowflake or remote execution claim is made.

Cancellation discards late delivery and prevents creation; it does not promise interruption of synchronous local calculation. Large-study background performance remains goal 15. Preview includes at most eight answers/four groups and keeps the selected answer visible when uniquely identified; missing/ambiguous answers are never inferred as observed zero. Full results and quality notes are retained in the separate analysis.

Old unversioned analyses remain readable and explicit reruns remain supported. A matching recorded import event is required for follow-ups; this is not a cryptographic content version or source authentication. The existing explanation now exposes the import event separately and explicitly says no immutable content version is recorded. Goal 14 remains open.

No restore/recovery activation, production data changes, credentials, permissions, billing, merge or production deployment were performed.

Scope: complete local imported studies and explicitly identified illustrative sample metadata. Real cross-wave harmonization, live Snowflake, remote follow-up execution, causal explanations and statistical validation remain separate gates. An import timestamp identifies an import event; it does not authenticate source data or prove an immutable content hash. Existing unversioned analyses remain readable and can explicitly rerun; follow-ups require a matching recorded import version.
