# Beta readiness audit and improvement plan

Baseline: `4a7083b` on `main`, inspected November 3–4, 2026.

Michael's product goal is the most intelligent and intuitive online data analysis
and visualization tool. The existing roadmap remains the architectural guide:
query-driven analytical truth, document-first authoring, metadata-driven controls,
and progressive disclosure. Intelligence should make trustworthy analysis easier
to create, explain, and reuse.

## Verified source capabilities

| Area | Present in source | Verification boundary |
| --- | --- | --- |
| Analytics | Mock provider, imported-row analytics, Snowflake SDK executor, SQL planning, significance logic | Unit tests establish local behavior; they do not establish live Snowflake correctness. |
| Saving | Multi-report localStorage workspace, report duplication, imported study metadata | Browser-local persistence, not a shared cloud report repository. |
| Publishing | Versioned snapshots and hash routes | Viewer routes resolve from local workspace storage; a copied URL alone does not deliver a report to another browser. |
| Export | PPTX, PDF, XLSX, JSON; visual page rendering and native/editable PPTX reconstruction | Implemented, but full application-to-Office/browser export acceptance remains unverified in this audit. |
| Authoring | Modular workspace/builder, study explorer, analysis controls, composition tooling | Substantial implementation already exists; avoid rebuilding from the stale README status. |

No open GitHub PRs were returned at the start of this audit. The original
`F:\Documents\EcoFocus Explore` checkout was left untouched, including its modified
README and untracked roadmap and other files. Development uses an isolated clone
and branch `codex/beta-reliability-audit` based on fetched `origin/main`.
No repository AGENTS.md or SKILL.md files were found in the source checkout.

## First improvement: retain queryable imported data

Workspace compaction previously removed all respondent rows. Local CSV/SAV/XLSX
imports and Supabase imports still execute analytics in the browser, so saving
and reloading made their full rows unavailable. Supabase file upload does not
currently provide a runtime query path that replaces those browser rows.

Preserve complete rows once at workspace level for these imports. Continue
compacting Netlify imports because their runtime query path reads server data.
Report drafts and published snapshots continue to omit duplicate imported rows.
This prevents future loss during successful saves; it cannot recover rows already
discarded by an older save. Those studies must be imported again.

Verification:

- Before the fix: existing 202 tests passed, one live integration test skipped;
  two added local/Supabase save-and-reload tests reproduced empty saved rows.
- After the fix: `npm test -- --reporter=dot`: 206 passed, one skipped; 31 test
  files passed, one skipped. New tests cover CSV import, local/Supabase row
  retention, unchanged aggregate results after save/publish/reload, compact
  Netlify persistence, no input mutation, and quota failure preserving the
  previously saved workspace.
- `npm run build`: TypeScript and Vite passed. Existing bundle warning remains:
  BuilderApp is approximately 700 kB minified (196 kB gzip).
- Browser smoke at isolated `127.0.0.1:5174`: workspace loaded; a synthetic
  three-row, two-field CSV imported via local fallback after the expected missing
  Netlify endpoint response on the Vite-only server. After reload, Study library
  still showed the dataset as ready for analysis, with three rows and two fields.
  Aggregate equivalence is verified by tests, not a complete browser analysis flow.
- No live database queries, production changes, credentials, migrations, merges,
  deployments, or new paid services were used.

## Prioritized next batches

1. **Make saving dependable and explicit.** Surface failed saves consistently
   (several callers currently ignore the boolean result), add recovery/download
   options, and move large local studies to a transactional browser data store.
   Acceptance: quota failure never looks saved; full rows and reports survive
   reload, switching reports, and navigation. Avoid truncating rows to fit quotas.
2. **Verify the beta journey end to end.** Add repeatable browser coverage for
   import → modeled fields → analysis/table → chart → save/reopen → snapshot →
   export. Inspect PPTX/XLSX in Office and PDF in a viewer. Establish fixtures with
   missing values, weights, zero bases, filters, trends, and survey labels.
3. **Establish live provider parity.** With an explicitly approved safe target,
   compare Snowflake results with known fixture totals, weighted bases and
   significance expectations. Document supported/unsupported query behavior,
   timeouts, provenance and error recovery. Never infer live readiness from mock
   or executor-stub tests.
4. **Productize publishing.** Design durable report/snapshot storage, ownership
   and access boundaries before describing local hash routes as shareable online
   dashboards. Acceptance: an authorized second browser opens the same immutable
   published version, and an unauthorized viewer cannot access it.
5. **Make the common workflow intuitive.** Observe first-time study import and
   table/chart creation; reduce dead ends and scanning. Measure time to first
   correct visualization, task completion, and useful error recovery. Preserve
   advanced controls through progressive disclosure.
6. **Add explainable intelligence.** Build on the existing metadata and imported
   query recommendations: suggest compatible analyses/charts, explain bases and
   exclusions, and generate evidence-linked narrative drafts. Each suggestion
   must resolve to validated query contracts and cite its actual result; analysts
   retain control over changes and publication.

Keep each batch small enough to review, check current remote and active work
before editing, and record evidence and remaining limits. This audit does not
itself configure a recurring execution schedule.

## Follow-up: save failure reporting and recovery

The review confirmed that editor autosave, publishing and study import ignored
the persistence function's `false` result. Autosave could say "Saved just now"
after a quota error, and publishing could open a snapshot that had not been saved.

The browser session now retains failed writes in memory across workspace/editor
navigation and shows a persistent "Changes not saved" notice. Users can retry
the complete save or download a full workspace JSON backup, including respondent
rows. Failed publication retains the draft without adding a version or opening
the viewer; retry saves the draft, and the analyst explicitly publishes again.
Imports remain available in the tab and show a failure rather than a success
indicator. The editor flushes its debounce before home/hash/back navigation or
tab unload, and requests the browser's unload warning if the write fails.

Verification for this batch:

- `npm test -- --reporter=dot`: 210 passed, one live integration test skipped.
  Four new jsdom tests render the real editor/header/import handlers (canvas
  geometry is stubbed) and cover failed autosave, canceled unload, complete
  30-row backup data beyond the 25-row preview, successful retry, failed and
  successful publication, import failure/remount recovery, and hash navigation
  during the debounce. Previous saved storage is asserted unchanged on failure.
- `npm run build`: TypeScript and Vite passed; existing large-builder-chunk
  warning remains (approximately 701 kB minified).
- Browser smoke on isolated localhost with synthetic data and a test-only quota
  simulation showed the persistent notice and error save state; Share stayed in
  the editor. Restoring test storage and selecting Retry saving cleared the
  notice and showed "Saved locally". The temporary harness is excluded from the
  change.

Remaining limits: the memory buffer cannot survive a browser/process crash or
a forced reload; download a backup before leaving when storage remains blocked.
Browser unload prompts depend on browser policy. The downloaded JSON is a full
recovery artifact; a guided backup-restore UI is future work. These checks do not
validate live databases, multi-tab conflict handling, native unload dialogs, or
Office/PDF export acceptance.
