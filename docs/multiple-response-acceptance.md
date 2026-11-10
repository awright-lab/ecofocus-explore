# Multiple-response analysis — original goal 18 candidate

Original goal: calculate overlaps and combined responses at the respondent level without double-counting people. This candidate adds a complete local workflow under **Find a tool → Analyze → Analyze multiple-response overlaps**. Independent original-goal acceptance remains pending.

Choose a complete local-file study (1–50,000 rows), an explicit respondent identifier and 2–12 separate answer indicator fields. Set exact selected/not-selected codes and confirm their meanings. IDs must be unique and nonblank across the entire import; repeats cause an error rather than silent deduplication. Codes are case-sensitive strings with whitespace trimmed; 1 and 1.0 differ. A visible 1/0 shortcut requires an explicit click. Examples never assign meanings automatically.

The optional saved audience is bound to its study/import and field mappings. Unknown audience membership is reported separately. Every mapped indicator must be known for a respondent to enter the common complete-case base. Blank/unmapped values exclude that person from all results; they are never silently classified as not selected. Subset combinations retain that same common base across all mapped fields.

Results include answer reach, pairwise intersections, arbitrary checked-answer union/intersection/none, number-of-answers distribution and exclusive answer patterns. Each person contributes once to a union and once to their exact pattern. Percentages may total over 100% across answers; this is explained next to the results. Missing-response details and denominators remain visible.

Counting yields between 500-row chunks, supports cancellation and retries, and checks selected raw source values, identities, field metadata, audience membership and mappings before accepting results. Changed inputs hide obsolete results. Study replacement requires explicit reset. The lazy-loaded dialog uses focus containment, Escape, background inertness, readable tables and narrow-screen layout. It never edits studies, report content, library or snapshots.

## Verification

- 31 model/job tests: missing/unmapped codes, duplicate/blank IDs including outside the audience, audience unknowns, source/mapping/import drift, cancellation, exact text semantics, independent respondent-set oracle across all subsets, and a 50,000-row/12-answer boundary.
- Six actual-component/job tests: real import and calculations, subset base preservation, required confirmation, duplicate-ID error, cancel/retry, obsolete-result hiding, replacement reset, mapping edits and modal focus/Escape.
- Full suite: **2,023 passed, two existing skips**. TypeScript and production build pass; existing large-chunk warning remains.
- Real App command-menu browser workflow on a fabricated 1,000-row/30-field CSV: base 989, 11 incomplete, answer counts 500/500, union 750, intersection 250, none 239. A single-answer subset keeps base 989 and yields 500/500/489. Pair percentages are 50.6%/25.3%. Saved Core audience: base 500, counts 500/250, union 500, intersection 250, none 0. Nonunique Segment ID correctly refuses the run.
- Captured studies, pages, audiences, library and snapshots are exactly equal before, after closure and after a new document reload (481,853 JavaScript characters). Delete/Escape in the dialog leaves those captured contents unchanged. Narrow 375px viewport has body width 375 and dialog width 359, without horizontal overflow in its scroll area.

This is temporary descriptive exploration: closing/reloading clears results. Remote/live Snowflake, weights/inference, repeated-person longitudinal data, string-list checkbox columns, persistence and exports are unsupported here. Existing server multi-binary union behavior is retained; these checks do not establish live backend correctness. No actual respondent data, cloud save or crash-recovery activation was involved.

Independent review confirmed the respondent-row oracle and 50,000-row case, then reproduced unsafe suggestion labels for raw codes named __proto__, constructor and toString. Suggestion labels now use only own properties of the value-label dictionary; otherwise they render the raw code. Three actual-component regressions cover those codes, explicit own labels and the real calculation path. Focused 40 tests pass; the full suite passes 2,026 tests with two existing skips, with TypeScript and production build passing. Publication of this correction is the remaining review condition reported by the coordinator.
