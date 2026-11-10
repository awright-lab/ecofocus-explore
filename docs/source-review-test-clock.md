# Source-review preservation test clock

Two full-suite runs failed the source-review focus test while the same file passed separately. Parsing the complete expected and received workspace JSON identified exactly one difference in each run: `reports[0].updatedAt`.

The builder schedules an acknowledged save on mount after 900 ms. `upsertDraftReport` records the current wall-clock time for that save even when report contents are unchanged. Slower module loading and rendering let this save complete inside the focus test. The test's original raw-byte assertion therefore depended on finishing before 900 ms.

The focus test now fixes only `Date` at a known instant. Native timeout scheduling, digest completion, React updates, cancellation, focus checks, and all original workspace-byte, study, report, pending-save and cold-reopen assertions remain intact. An added real 1,100 ms wait ensures the initial autosave occurs before the preview, and an extra exact raw-byte assertion checks it. This does not disable autosave or exempt metadata from the original assertions.

Separate scheduler/session/persistence tests advance the clock through 899 and 900 ms. They prove that both an unchanged draft and a genuine title edit receive the scheduled timestamp, and that all other workspace fields, source rows and historical snapshots are preserved exactly. This documents current product behavior; no production timestamp, storage, recovery or conflict policy changes are included.

The checks run in jsdom. Native browser acceptance remains open. A complete passing suite is required before reporting the suite green.
