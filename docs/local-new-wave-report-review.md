# Reviewed local new-wave report drafts — candidate

Goal 40 remains partial. This candidate adds one end-to-end local workflow through the tool menu: **Refresh a report with a new wave**. It does not activate cloud sharing, replace studies, publish or deploy anything.

## Behavior

- Preview every supported analysis before creating a separate report. Compare raw category identities, show original and new values and sample bases, and distinguish absent answers from zero. Differences are descriptive, not significance tests.
- Match physical source columns exactly and compare question metadata, variable roles, answer labels, source format and declared research metadata. Generated field IDs and profile counts may differ. Conflicting or ambiguous mappings refuse instead of substituting fields.
- Recalculate the old study and require the recorded table, chart series, metric and source context to agree. A stale or older rounded cache needs explicit refresh in the original report first. Pending query edits also refuse.
- Bind the preview to the entire bounded report and source library; reject mutations, copied/edited previews, intervening authoring and changed sources. Immutable snapshots are used for calculations. Cancellation is checked between analyses; one synchronous calculation cannot be interrupted.
- Retain authored text, layout, design and original-wave library definitions. Existing evidence snapshots stay recorded against the original source and become stale when the new-wave results replace their source cells. Existing export guards require linked evidence review; this candidate adds a new-wave-specific snapshot guard at the writer and App boundary. Older ordinary reports keep their existing snapshot behavior. Unlinked claims cannot be checked automatically; the review includes all retained text and a comparability declaration.
- Record the originating report, both import versions, exact field mappings and review time in the new report. Both study IDs are retained by the study-use inventory. Repeated refreshes refer to the preceding report; they do not rewrite prior report history.
- Require the original report to be saved at the previewed version; refuse deleted, archived or newer stored originals instead of resurrecting or replacing them.
- Save the full additive candidate as its own recovery copy before navigating. A failed save retains both reports. Retry uses the same new report ID; it does not add a second copy. Existing pending work is used as the base and a pending different-report owner refuses. Embedded studies must be promoted without collisions before draft copies are removed.

## Explicit limits

The workflow supports 1–20 ordinary, unweighted analyses from one original complete local CSV, XLSX or SAV study, with 1–50,000 rows per study and at most 5,000 cells per result and combined report preview. Preview tables show 50 cells per page without dropping the rest. Both waves must use the same file format. Counts, percentages, numeric means/sums, explicit local filters, breakouts and overall numeric grouping use the existing engine. The aggregate expanded JSON input is bounded at 16 MiB; this may refuse a large workspace even when the selected studies alone would fit.

Applied audiences, derived/authored results, prepared studies, remote/live sources, ambiguous metadata, incompatible charts and category-bound overrides/themes or recorded chart intervals refuse. Those require explicit migration workflows. Existing features and original reports are retained. New report inference metadata uses the existing conservative inference-safety normalization; no hypothesis test is claimed. Extreme finite before/after values with an unrepresentable difference show a numeric-range message.

This is not the full original goal: reusable cross-wave mapping authoring, weighted/remote pipelines, broad schema changes, automatic claim rewriting, native acceptance and production readiness remain open. Comparability is a recorded human declaration, not inferred proof about sampling or populations. The preview is session-only and must be rerun after reload.

## Verification plan and boundaries

Synthetic model checks cover all four calculations, physical-column remapping, changed metadata, stale tables/chart caches, explicit filter/breakout and overall summary, source changes, cancellation, review requirements, original-wave library retention, import-version dependency recording, 50,000 rows, failed-save retry and save/reopen. Component checks cover review gating, currentness, one in-flight request, failure feedback, cancellation, Escape, focus and stable fullscreen portal placement. Native fullscreen remains unverified. Actual App checks use the real save session, writer and codec to create the new draft, simulate quota failure, retry, navigate and remount; they preserve original report pages, full studies and published snapshots.

These are automated jsdom/in-process tests; there is no new native browser, Office, live service, process-crash or simultaneous-tab acceptance. The production build remains unattempted after the previously reported EPERM; no alternate output route or security setting change was attempted. Final exact-tree test and backup evidence belongs in the accompanying checkpoint, not an assumed success here.
