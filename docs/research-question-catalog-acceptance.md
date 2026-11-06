# Research question catalog — goal 10 acceptance

Original goal: let users find questions by topic, wording, or concept rather than knowing column codes.

Acceptance criteria:

1. A visible study-library entry opens a readable catalog. Users can search full question wording, declared topics/concepts and answer labels, filter by study/topic, inspect the source and start analysis with the exact selected field.
2. Local imported studies support user-declared topics and concepts. Discovery labels survive actual save/cold reopen without changing raw rows, field IDs, calculations or historical snapshots. Missing labels remain explicitly uncategorized; no inferred concepts or respondent-value search.
3. Sample questions are visibly distinguished and selecting one uses the sample engine even when imported studies exist. Identifiers/unmodeled fields cannot silently analyze another field.
4. Long catalogs paginate; empty searches have actionable recovery. Keyboard focus stays in the dialog, Escape closes it and restores the opener. Background authoring shortcuts cannot delete report objects.
5. End-to-end native acceptance uses only synthetic data through catalog, label editing, analysis preview/create, save and reopen. Automated tests cover search, source identity, persistence/failure, source selection and accessibility. Independent original-scope review is required before goal completion.

Scope: complete local imported-study metadata and the existing EcoFocus sample question set. Remote entries explicitly represent only browser-available metadata; remote topic/concept writes and complete server discovery remain unsupported and belong to goal 7. This is declared metadata search, not AI semantic inference. No live Snowflake claim.

Current status: implemented and tested review candidate; independent original-scope acceptance is pending.

## Verification

Final full suite: **1,607 passed, two skipped**; TypeScript and Vite production build passed. The existing roughly 783 kB Builder chunk warning remains.

- The final focused suite passed 82 tests across catalog metadata/search, persistence, UI and existing guided creation tests. Twenty-six new regressions cover declared-label search, absence of raw respondent indexing, ambiguous field IDs across studies, unsupported fields, sample mode, pagination, source disappearance, modal focus, acknowledgement failures, malformed stored metadata and preservation after quota rejection.
- Actual App/native browser journey at the guarded synthetic fixture used 1,000 rows and 90 fields. Full wording “where live” found Region. Applied topic “Audience geography” and concepts “location, market footprint”; actual local save acknowledged. Cold reload retained labels and search found the same field by “market footprint”.
- Create analysis opened the exact study/Region field, previewed four groups at 25%, created a table and saved it. Cold reload retained all 1,000 rows, 90 fields, source ID/field ID, four values of 25 and per-cell bases of 1,000.
- With the background analysis selected, Delete in the catalog preserved the report. Shift+Tab moved from dialog focus to its last control; Tab wrapped to Close; Escape restored the opener. Native pagination, empty-search recovery and topic selection were exercised. Sample question selection reached the correctly labeled sample preview with imported studies present; actual sample backend execution was not invoked or verified.
- Native topic rename under an active filter followed the new “Market geography” topic, retained the selected question and acknowledged saving. Final cold reopen retained that renamed topic, both concepts and the unchanged 1,000-row analysis.
- The native final save acknowledgement was checked after the final code reload. No browser errors were reported for that tab at final inspection. Automated failure tests cover explicit save refusal and unchanged prior persisted bytes; a real browser quota exhaustion was not induced.
- Native artifacts are outside the repository, prefixed `research-catalog-native-`, including concept search, cold-reopened analysis, keyboard preservation, sample handoff and final review screenshots. Full suite/build logs and exact published tree are recorded in the external publication proof after verification.

## Limits

No respondent values are indexed for discovery. Concepts are literal user declarations, with case/accent-insensitive all-term search, not synonym inference. Remote metadata completeness, remote annotation writes, live Snowflake and native Office acceptance are not established by this work. Existing save recovery remains available; restore/durable recovery stays inactive.
