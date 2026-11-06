# Evidence-linked narratives: goal 28 acceptance

Original goal: connect written claims to their source results and flag the text when underlying numbers change. This implementation connects authoring, recorded source cells, document commands, persistence, local snapshots, viewer warnings and formatted exports. Independent re-review accepted the original goal at `a076b1e1df86a645d80485b5980e78f3813183ed` within the recorded-evidence scope described below.

## Connected workflow and acceptance criteria

Select an authored text object, open its Element properties and use Evidence for this text. Choose a source analysis on any report page, a result row and a result column. Linking records the current written claim and immutable snapshots of all linked cells. The panel states that adding a link records review of all existing links too. Up to twelve unique cells can support one text object. Source analysis, row and column IDs identify the binding; labels are never used to silently select a replacement cell.

The snapshot records exact value and base, source labels and study references, metric, executed query, metadata, calculation inputs when available, weighting, inference context, notes and warnings. It describes recorded evidence, not independently authenticated data or proof that a conclusion is true. A claim depending on several numbers must link all of them; unlinked changes and the correctness of the prose are not inferred.

Changing the written claim, linked value/base/labels, source metadata or analytical context requires review. Pending source settings, unavailable cells, removed sources/rows/columns, ambiguous identities and damaged links also require review. Cosmetic chart changes do not. The canvas and saved-browser-snapshot viewer show an evidence warning. The properties panel shows old/current values and context; Open source navigates to the linked analysis. Explicit review captures the current text and current linked results without rewriting the claim. Removing a link stops its checks and is undoable; deleting a source preserves its orphaned evidence and imported-study dependency.

Optional evidence metadata is validated before saved-workspace normalization. Damaged metadata leaves raw recovery unchanged. Saving/reopening, report duplication and snapshots retain links and reviewed evidence. Snapshots retain needed study rows even when the remaining reference is an orphaned claim. Source references remain scoped to the report; copied objects do not guess new source bindings.

Reusable composition blocks/starters also validate stored claim evidence and retain its study dependencies. A regression removes all page objects while keeping only a saved layout, then verifies snapshot row retention, save/reopen and damaged-library recovery without overwriting raw data.

## Export behavior

PDF/SVG and editable PowerPoint text contain the authored claim plus visible recorded citations. Excel adds an evidence sheet containing text, review time, citations and the complete evidence definition. Formatted builders reject stale/orphaned links before rasterization, require source pages in a subset export, and reject linked text outside the page. Linked-text wrapping reserves padding, uses conservative character capacity and line spacing, and refuses text that cannot fit; original unlinked text behavior is retained. JSON/portable recovery retains original text and metadata.

Actual-file inspection found an out-of-page synthetic text position that the earlier general export path allowed to clip. The linked-text boundary guard was added, reproduced through the real frontend construction path, and tested before correcting the synthetic position through normal editor coordinates. Earlier clipped artifacts were retained separately as superseded evidence. The final regenerated PDF contains complete source results and a complete, wrapped claim/citation; PowerPoint XML and Excel sheets retain their exact content.

## Verification evidence

The new tests exercise exact cells, multiple links, changed values/bases/source/wording/metric/weights/inference, cosmetic changes, malformed metadata, unavailable/ambiguous/missing sources, persistence, duplication, snapshot retention, Undo/Redo, memoized canvas warning updates, explicit review/unlink/navigation, stale export rejection, citations in SVG/PPTX/XLSX and layout refusal. Seeded and cached live-shaped synthetic contexts are covered without making network calls. Weighted bases are recorded as totals and are not labeled respondent counts. Full-suite/build results are recorded in the publication evidence.

Native browser acceptance uses the actual App, active local writer and document commands on a guarded, isolated localhost origin with 1,000 synthetic rows, 30 fields and two pages:

1. Link North's 25% result (base 1,000; calculation inputs 250/1,000) to an authored claim on another page; autosave and cold reopen preserve current evidence and all rows.
2. Edit/rerun the source to Number of responses. The stored result becomes 250 while the claim and old 25% evidence remain; authoring and the saved snapshot viewer show review warnings. Actual formatted construction rejects the stale claim.
3. Revise the text to “North has 250 responses” and explicitly review. Undo restores old evidence/warnings; Redo restores the current snapshot. Open source navigates across pages.
4. Remove the source through the editor. The claim, evidence and all 1,000 study rows remain, with an orphan warning. Undo restores the source and current evidence.
5. Correct the synthetic text box through normal position controls after exercising the boundary rejection. Construct actual PDF/PPTX/XLSX bytes from acknowledged saved state. Two PDF pages were independently rasterized and visually inspected; independent glyph bounds put the full claim/citation inside the page. Every PPTX/XLSX XML part parses; PowerPoint retains editable claim/citation text, and Excel retains the evidence sheet and context.

Raw browser snapshots, screenshots, generated files and independent inspection are kept outside Git under narrative-export-artifacts and narrative-native-*. The committed workflow fixture makes the guarded synthetic journey reproducible and never automatically downloads a file or calls a live service.

## Limits

- Twelve linked cells per text object; recorded context is bounded to 128 KiB per link. Very dense context, insufficient text space or Excel cell-format limits produce explicit errors rather than truncation.
- Changes are checked against stored results and recorded metadata. This does not authenticate a data source, detect an external database update before refresh, validate a causal/statistical claim, or add a new inference method.
- Cached/live-shaped tests do not establish live Snowflake correctness. No approved live dataset or query-cost allowance was used.
- Native Office application rendering and OS download completion remain unverified. The prior Office COM denial and older uncertain download were not retried or bypassed. Source-based semantic-theme membership and goal 34 remain separate review gates.
- Transactional saves, mixed-version tabs, cloud identity/ownership, restore and durable recovery remain separate goals. Restore/recovery stay inactive. No merge, production deployment, production data, credentials, permissions or billing changes were made.

## Independent integrity review correction

Independent review found that altering only a snapshot's cached displayValue could leave it marked current and render a false citation. Stored display text is now checked against its finite numeric value and recorded metric format; unsupported/missing formats and inconsistent values are rejected before saved-workspace normalization. Currentness also compares the display field, and citations derive their displayed number from the numeric value and format after validation.

Stored studyIds are checked against all imported-study identities and eligible references in the recorded query/metadata context. Missing, unrelated or duplicate convenience references are rejected rather than silently accepted. The dependency collector also reads every readable context reference alongside explicit stored IDs, so a damaged convenience list cannot discard those study dependencies in memory.

Eight added regressions cover altered display strings, changed/unsupported formats, altered study lists, state/rendering/export guards and unchanged raw recovery. The committed workflow fixture has explicit in-memory clone probes. Native browser checks changed a cloned display value to 999999% or cleared its study references: both became stale, PDF/PPTX/XLSX construction rejected them, the false citation was suppressed, the saved workspace stayed byte-equivalent at the document level, and all 1,000 rows remained. The correction subsequently passed independent original-scope re-review, recorded below.
## Independent acceptance

Independent re-review accepted original goal 28 at remote commit `a076b1e1df86a645d80485b5980e78f3813183ed`. Seven corruption variants passed validation, rendering, formatted-export refusal and reopen checks; cached display text and inconsistent study references no longer appear current. The goal is complete within recorded-evidence scope. This does not verify live Snowflake, external data changes before refresh, claim truth, native Office rendering or operating-system download completion.
