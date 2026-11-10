# Ranked findings candidate — goal 26

The independent comparison review now offers a temporary ranked findings view for complete local, unweighted studies. It reuses the reviewed respondent counts and Fisher/Holm comparison family. It does not create a new statistical test or infer business importance.

## Workflow and ordering

Run the existing comparison review with its source, event, reference, exclusion and sampling declarations. Findings show signed percentage-point differences, numerator and valid denominator in both groups, missing/excluded counts, adjusted evidence and existing cautions. Inspecting a finding opens and focuses its original count detail.

The order is adjusted evidence category, explicit research priority, absolute unrounded gap, minimum valid base, target missing/excluded share, then original family order. Display defaults are a five-point absolute gap and a valid base of 30 in each group. Whole-number cutoffs can be changed. Exact count-derived rational comparisons determine gap cutoffs and ties; rounded display text never determines eligibility. Priorities cannot promote an above-threshold result over a below-threshold one. A base cutoff is not a precision, power or representativeness guarantee.

Filtering does not reduce the original Holm family. Empty or invariant comparisons remain visible in the original review and have an omission explanation in the findings view. The model checks count accounting, table consistency and full-family adjustment consistency before ranking. It does not replace the review's source validation or independently retest Fisher probabilities.

Source currentness is checked during rendering and inspection. A source change revokes the parent review's approval and hides the old results. Findings, priorities and display choices are temporary; closing discards them without changing the saved report or study.

## Verification

The candidate has 43 focused tests, including exact cutoff and rounding boundaries, priorities, missing/excluded bases, invalid/corrupt inputs, raw prototype-like codes, stale-source revocation and inspection focus. A real App test imports a synthetic 1,000-row, 30-field study, runs the complete review, changes priorities and cutoffs, inspects counts, closes and cold-remounts, and checks the persisted study and report are unchanged. It uses jsdom and real importer/review/storage modules; dialog browser methods are polyfilled for that environment. No live request is made.

Final whole-suite, TypeScript and production-build results are recorded in the separate checkpoint packet. Independent review accepted the single-family ranking as a partial implementation, not completion of goal26. This is a feed within one comparison review, not a persistent cross-report or cross-wave feed. Weighted, remote, live Snowflake, AI-generated interpretation, native browser/screen-reader acceptance, export and native Office acceptance are not established. The previously denied native browser socket was not retried.

Follow-up malformed-input hardening requires every position in groups, comparison families, count tables, warnings and priorities to exist as an own array property. Holes and inherited slots cannot bypass checks through JavaScript's skip-hole iteration. Very large sparse arrays are rejected by property count before walking their claimed length; extra named properties cannot substitute for positions. Sixteen additional regressions cover these boundaries and present nonenumerable own positions. Three isolated probes against the prior actual model reproduced sparse comparison, table and warning acceptance; the current implementation rejects all three. The ordinary UI producer does not create these malformed arrays.
