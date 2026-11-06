# Guided story builder — original goal 35

Original goal: assemble selected findings into an editable narrative with evidence, implications and methodology.

Status: implemented and tested **review candidate**. Independent original-scope acceptance is required before calling the goal complete.

## Acceptance criteria and implementation

1. A visible Story tool and searchable command open a guided workflow. Choose one to six exact recorded cells across report pages, using labeled analysis/answer/group choices and bounded searches. Ambiguous identities, pending results and inconsistent metric, weighting or source context are refused.
2. Write an editable story title, takeaway and implication for each finding; reorder or remove findings. Recorded evidence and methodology remain inspectable. No business interpretation, causal conclusion or statistical significance is invented. Preview each new page before creation; clipped text/citations fail visibly.
3. Review the wording and evidence explicitly. Creation rechecks every source against its captured snapshot and adds all story pages as one document edit. Original analyses, pages and respondent data stay in place. New text objects remain editable, with source links available through Properties.
4. Both takeaways and implications use the existing recorded-evidence contract. Later edits or changed/missing results require review and block formatted export. Before creation, an explicit evidence update keeps authored wording, displays old/new recorded values and resets review; missing or ambiguous sources never silently rebind. Drafts are isolated by report.
5. Closing the dialog retains unfinished wording in this tab and reopening requires review again. This is memory-only convenience: create pages to save the story before reloading or closing the tab. It is not durable crash recovery or cloud synchronization.
6. Created pages survive Undo/Redo, saving, cold reopen and local snapshot viewing. PDF/PPTX retain supported page content and citations. XLSX retains source tables and evidence definitions plus a Narrative text worksheet for headings, authored implications and methodology. Long text is split losslessly across numbered parts within Excel cell/line-feed limits, preserving Unicode.

Source charts stay on their original pages. Each new page focuses on one authored finding, its recorded evidence, an implication and methodology. This builder organizes recorded results; it does not authenticate source data or validate the truth of an interpretation. Unconfirmed cached sources are labeled accordingly. Live execution, real wave comparability, complex-survey validation, secure online sharing and general adaptive layouts remain separate goals.

## Verification

Final full suite: **1,681 passed, two skipped**; TypeScript and Vite build passed. Thirty-one new tests cover immutable source preservation, exact references/order, source drift and corruption, report ownership, missing sources, explicit updates that keep wording, required review, duplicate prevention, retry, identifier collisions, clipping, weighted-total labels, persistence/snapshots, export guards and lossless XLSX text retention. Unit raster injection checks document containers and editable text only; real browser artifact verification below supplies actual rendering evidence. The existing approximately 801 kB Builder chunk warning remains.

Actual App/writer/commands acceptance used only 1,000 fabricated rows and 30 fields:

- Selected North / Total = 25%, base 1,000, from a regional distribution and North / Total = 49, base 250, from average Spend by Region. Authored two takeaways and implications; inspected recorded methodology, reordered them and reset review.
- Delete within the dialog preserved a selected background analysis. Escape/close retained unfinished wording in this tab, and reopening restored it with review unchecked. Shift+Tab/Tab stayed inside the dialog. A 375-pixel viewport check found the dialog within bounds without horizontal overflow; this does not certify full touch or screen-reader authoring.
- Created two new pages as one edit. Undo restored the exact two original source pages; Redo restored exact page/object identities and content. Saving and cold reopening retained four pages, all four linked text objects current, and all 1,000 rows/30 fields. Model/persistence tests compare complete source row arrays.
- Edited the takeaway through normal Properties, observed required evidence review, reviewed it, and saved a local snapshot. The cold-opened viewer retained the authored takeaway, implication, citations and methodology. It is explicitly a browser-local snapshot, not online publishing.
- Reran the source from percentages to counts: North changed from 25% to 250. The two dependent text objects visibly required review and export was refused; the other finding stayed current. Undo restored the source and all links. A separate unfinished-draft probe explicitly updated 25% to 250 while preserving both authored text fields and resetting review, then removed that temporary finding and undid the source change.
- Final saved state: four pages, one local snapshot, all evidence current, both source pages exactly equal to the initial normalized baseline, preflight clear, 1,000 rows/30 fields retained.

Native raw proof and screenshots are retained outside Git as `guided-story-native-*`. The existing synthetic origin had source page orders 0 and 1; these legacy fixture values were preserved in acceptance rather than rewriting its data. New fixture initialization uses 1-based orders. This is not a claim that all legacy page-numbering behavior was fixed.

## Actual artifact evidence and limits

The guarded fixture generated PDF (654,479 bytes), PPTX (305,777 bytes) and XLSX (50,554 bytes) through the real browser export functions, with real browser rasterization and no OS download. Complete transfers were checked against exact byte counts; initial truncated transfers were overwritten. Files are `guided-story-browser-actual.pdf/.pptx/.xlsx` outside Git.

All four actual PDF-embedded browser-rendered JPEGs decoded successfully and were visually inspected: both source tables and both story pages retain complete values, authored text, implications, citations and methodology. PDF header/page count were checked, but no independent PDF interpreter was available. PPTX/XLSX ZIP CRC and every XML part parsed; four slides, complete authored content, citations and methodology were verified, including the XLSX Narrative text sheet. Evidence and SHA256 values are in `guided-story-artifact-inspection.json`.

These checks do not establish native Microsoft Office rendering, OS download completion or pixel-identical canvas/PDF layout. Linked-text export wrapping is deliberately conservative. The prior Office COM denial and older uncertain download were not retried. No live Snowflake/remote service was called, no real respondent data used, and no merge, production deployment, credentials, permissions, billing or production-data changes occurred. Restore and durable recovery remain inactive.

Formatted linked-story exports currently require source pages in the export scope, following the existing evidence guard. Standalone story-only packages are not claimed; dense or unready source layouts can still need existing preflight adjustments.
