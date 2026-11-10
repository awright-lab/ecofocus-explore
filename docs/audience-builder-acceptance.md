# Visual audience builder acceptance

Original goal 12: create reusable segments using nested conditions, ranges and exclusions, with a sample-size preview. Independent review accepted these requirements at published commit cc362a9098bb85c360ccad826ab7a2540e825cfa for complete local imported studies. The connected workflow includes report editing, actual calculations, persistence, snapshots and exports. Remote audience execution and cross-report reuse remain unsupported; this is not acceptance of all source types or any other original goal.

## Implemented workflow

The report toolbar opens Audiences. Users choose a complete imported study, combine nested AND/OR groups, select raw category values using searchable checkboxes, set inclusive numeric bounds, explicitly test blanks, and exclude conditions or whole groups. An exact, cancellable unweighted population preview is required before saving or applying. The preview separately reports matches, exclusions and unknown values. Blank or invalid numeric comparisons remain unknown through negation; they do not silently become matches.

Named audiences are reusable within the report. Users can select a compatible analysis on any page and save/apply its result atomically through the document command system. Library edits do not rewrite previously executed results: each analysis records its own audience definition. The analysis editor retains that definition when changing another query option and offers explicit removal. Removing a library entry preserves recorded analyses and is undoable. Study retention includes audience references, including snapshot-only references.

Definitions bind to the study ID, import timestamp and field identity/source column. Invalid or missing definitions, incompatible studies, incomplete previews and unsupported remote execution are rejected rather than silently analyzing the whole study. Workspace loading validates optional saved audience data before normalization. Failed/stale query application preserves the previous result and library. PDF, PowerPoint and Excel retain executed audience context and validate its consistency.

Independent review found that the first dialog implementation reconstructed a loaded definition with the current study timestamp, defeating the executor's stale-import guard when IDs were reused. The dialog now retains its original import timestamp separately from the current registry record, both for loaded definitions and for an audience already open when the source changes. A mismatch blocks preview/save/apply without changing the saved definition or results. Explicitly choosing New audience starts a distinct definition for the current import. Two UI regressions reproduce both replacement paths; the focused audience suite now has 30 passing tests. Native verification of this follow-up is recorded in the following paragraph; the earlier browser-access interruption was resolved.

A fresh browser tab subsequently restored access. The committed synthetic provenance fixture uses the actual AudienceControl and document command hook in memory. After replacing a study with the same IDs and a new import timestamp, loading the old audience displayed the mismatch and disabled preview/save/apply. Explicit New audience previewed the new population (three records) and saved a separate definition; the old timestamp, all rows and the original analysis result remained unchanged. This verifies the component path; it is not a claim of a new full-App replacement-import or live backend acceptance run.

## Reproducible verification

At the independently reviewed cc362a9 checkpoint, the full suite passed 1,550 tests with two skipped; the production build and TypeScript passed. Thirty audience model, execution/persistence and UI tests cover nested logic, ranges, exclusions, unknowns, literal/duplicate labels, cancellation, malformed/falsy inputs, complete-source checks, query reuse, immutable recorded definitions, failure/stale-operation preservation, snapshots, keyboard behavior and library removal. Skipped live/optional runtime tests do not establish live Snowflake correctness.

Native browser acceptance used the real App, document commands and local workspace writer on an isolated synthetic origin: 1,000 rows, 30 fields and three pages. Region cycles North/South/East/West, Segment alternates Core/Growth every four records, and Spend cycles 1 through 100. Independently calculated expected populations:

| Rules | Population | North | East |
| --- | ---: | ---: | ---: |
| (North OR East), Spend 40–60, exclude Growth | 50 | n=25, sum=1,225 | n=25, sum=1,275 |
| Same, Spend 40–50 | 25 | n=15, sum=675, 60% | n=10, sum=450, 40% |

The first definition was created visually, applied, saved, cold reopened and reused on another page. Updating the library to the second definition left both older results unchanged. Applying it on the third page produced 60%/40%; editing that analysis to counts produced 15/10 without losing its audience. Undo/Redo and saved acknowledgements were checked. A final cold reopen retained rules and results; current checkbox controls produced n=25. Removing the saved entry retained all three results and 1,000 source rows; Undo restored it. Tab/Escape and canvas Delete isolation were checked.

The committed audience export fixture constructs three actual PDF pages, a native PowerPoint count chart and Excel sheets with complete audience context. All PDF pages were independently rasterized and visually inspected; XLSX values/cell bases and all PPTX XML were inspected. The native count chart contains 15/10; tables contain the 1,275/1,225 sums or 60%/40%, with appropriate bases. These checks establish generated-file contents, not native PowerPoint rendering or operating-system download acceptance. Synthetic artifacts and raw browser evidence are retained outside the repository.

## Remaining limits and review gates

- Only complete local imported studies are supported. Netlify server-backed sources and partial previews are explicitly blocked; no live Snowflake audience execution is claimed. Seeded source support and cross-report libraries are outside this implementation.
- Population previews are unweighted. Existing analysis weighting/statistical safety rules still apply; no new survey variance method is asserted. Special source codes retain their original meaning and require explicit exclusions.
- Preview work yields in chunks and can be cancelled. Actual analysis uses the existing local executor; this does not complete the separate background large-study performance goal.
- Independent review accepted the stated local imported-study workflow, including the provenance correction. Mixed-version tab behavior and durable transactional saving remain separate storage acceptance gates. Restore and persistent recovery remain inactive.
- Native Office visual acceptance remains unverified after the earlier denied COM action; that action was not retried or bypassed. No merge, production deployment, real respondent data, production database, credentials, permissions or billing changes were made.
