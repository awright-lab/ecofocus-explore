# Calculated metrics — original goal 21 review candidate

Original goal: reusable formulas, indices and ratios with incompatible-base and invalid-calculation checks. This candidate extends the existing saved calculation library and derived results. Independent goal acceptance is pending; it is not counted among accepted goals.

## Supported workflow

Open **Find a tool → Analyze → Build a calculated metric**. Choose an original local-file categorical response analysis, one recorded column and two different response categories. Counts and response percentages with recorded full-precision numerator/denominator inputs are supported. Choose a ratio, index, relative difference or pair-average starting point, or edit an arithmetic expression using A, B, numbers, +, −, *, / and parentheses.

Preview shows exact unrounded inputs, expression and the common source response universe. Review is explicit. Save a reusable definition alone, save it and create a result page, copy a definition, or explicitly refresh one recorded result. Removing a definition retains its existing results. Report changes are undoable; the editor's ordinary browser-save status remains authoritative. There is no new cloud save or durable-recovery activation.

Definitions retain the original study import, query, row/category and column meanings. Changed source bindings require explicit review. Source values or bases changing make recorded results stale; formatted exports and new linked narratives require a current original source. Ordinary query editing cannot silently turn a formula result back into its source response analysis. Results on other pages retain their own recorded recipes, even when a reusable definition is edited.

## Calculation contract

- Both A and B are required. No JavaScript evaluation or arbitrary functions. Expressions are bounded to 256 characters, 64 tokens and 12 nested levels.
- One original unweighted categorical result and column, disjoint category identities and equal positive integer response universes. Missing values are refused, never silently replaced with zero. A base is the original response universe, not a pooled sample, algebraic denominator or effective sample size.
- Source table, series, query, source metadata and percentage calculation inputs must agree. Pending edits, duplicate identities, missing sources, unsupported weighted/remote/numeric/wave/authored/temporary linked contexts fail explicitly.
- Binary64 arithmetic; constants are zero or magnitude 1e-150–1e12, inputs at most magnitude 1e12, intermediate results at most magnitude 1e15. Division by zero, nonfinite values and unsupported underflow are refused. This is not arbitrary-precision arithmetic.
- Results use a distinct calculated metric type. Source significance and annotations do not transfer; no confidence interval, significance test or causal conclusion is produced. An average of two percentages is not a respondent-union net.
- Up to 5,000 recorded source cells and 100 saved formulas per report. This calculates from recorded cells, not directly from respondent fields. It does not independently authenticate or rerun raw source data; source changes must first be reflected in the original analysis.

## Persistence, rendering and export

Saved definitions, formula snapshots and calculated result caches are validated before workspace normalization. Damaged formula values, labels, bases, bindings or inference context fail closed while preserving original saved bytes. Duplicates, snapshots and reusable layouts retain formula metadata and study dependencies through existing document paths.

Supported table/bar results retain decimal values. PDF/SVG, PowerPoint and Excel include formula and exact operand context, with the source response-universe qualification. Formatted exports require original source pages, so an isolated formula-page export fails explicitly rather than losing its provenance. Raw backup remains available. Native Office visual fidelity and OS download completion are not verified.

## Verification and open acceptance gates

Automated model, arithmetic, command, component and real local-writer persistence tests cover invalid calculations, compatible bases, full-precision percentages, altered caches, stale previews and definitions, explicit rebindings, copying, atomic page creation, individual refresh, Undo/Redo, save/reopen, duplicate/snapshot retention, narrative currentness and formatted export guards. The final full suite passed **1,976 tests with two existing skips**, including 76 new calculation tests. TypeScript and production build pass; the existing large Builder chunk warning remains.

Actual App browser checks used a fabricated 1,000-row/30-field study. An index 300/700×100 and relative gap (300−700)/700×100 were created; a reusable ratio was saved independently. Creation and Undo/Redo preserved the entire study and original page exactly. A controlled synthetic source change to A=200/B=800 made both results stale and blocked formatted exports. Explicit individual refresh produced 25 and −75 while preserving the other result. Exactly 100 Answer cells changed intentionally; the other 29 fields and all field metadata were unchanged.

Actual three-page PDF, PowerPoint and Excel blobs were generated without an OS download. All PDF pages were independently rasterized and visually inspected; PowerPoint/Excel ZIP and XML content, expressions, inputs, values and base qualifications were checked. PowerPoint application rendering remains unverified.

A later development cold reopen returned the exact pre-change synthetic revision, despite a newer acknowledged readback. The investigation reproduced a save-guard replacement defect using a real Vite hot update and the actual App: React retained the older mounted state while the replacement session adopted the newer stored version as its baseline. A subsequent autosave wrote the old revision. This is a development hot-reload failure, not evidence of a failed arithmetic/cache check.

The proposed guard retains its expected version, pending copy, failure status and subscriptions in Vite hot-module memory immediately. A dispose-only implementation failed the native control because dependencies may be reevaluated without their own disposer running. The corrected native control preserves the newer saved bytes through repeated module updates and displays the normal stale-save recovery warning. A fresh document opens A=200/index=25; complete encoded study data, formula pages and calculation library remain exact. Cold normalization changes only recorded source inference safeguards and the report timestamp in this dedicated fixture.

Separately, the original three-page actual-App study now passes the frozen-code save/cold-reopen check: its complete 515,016-byte inspection content, including all study rows/fields, pages, definitions and results 25/−75, remains byte-for-byte unchanged. Navigation from the retained stale tab also preserves that newer copy. Browser-control access was restored by resetting the stale automation session; no firewall or security settings were changed.

**Independent review of the guard correction and original-goal acceptance remain open.** See [hot-reload investigation](workspace-hot-reload-investigation.md). These tests do not establish atomic simultaneous-tab writes, crash recovery, production cloud authorization, live Snowflake/backend correctness or universal browser behavior. Existing development tabs created before the correction must preserve their copies and cold-open the current saved revision; the fix cannot reconstruct a guard already discarded by old code. No real respondent data was used.
