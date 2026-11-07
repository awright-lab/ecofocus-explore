# Semantic themes: export and override follow-up

Goal 34 remains open for independent acceptance against its original scope: brand styles and consistent category/audience colors throughout a report. This follow-up does not certify any of the forty goals complete.

## Corrections

- Shared chart paint resolves semantic category overrides for canvas and export. Explicit colors and gradients follow recorded source identity when imported result IDs change. Reconciliation also aligns editable raw styles with the new IDs, preventing stale ownership on subsequent edits. Individual-palette restoration materializes the current overrides.
- Authored imported option aliases retain recorded source identity; nets record the authored definition, row kind and contributing source keys. Legacy source rows without recorded keys remain ineligible rather than gaining guessed identities. This does not change or validate authored analytical membership across query reruns.
- Reconstructed SVG retains linear/radial stops and opacity, selected title placement/size/alignment, axis colors/type size, label styling and grid color. Text elements retain their chosen font family. Gradient IDs cannot collide through punctuation sanitization.
- Gradient bars use the existing complete-image PowerPoint fallback; they are not silently converted to solid native fills. Supported solid charts remain native/editable. Native axes and labels retain chosen colors/type size; single-series vertical charts omit a misleading Total legend.
- The wide-series completeness fixture explicitly chooses a readable 9px label size; the default 12px labels cannot fit that fixture. Dense exports still fail explicitly rather than silently reducing requested type size or dropping content.

## Verification

Final source: 1,506 tests passed, two skipped; TypeScript/Vite production build passed. Skips remain live Snowflake and optional raster runtime. Existing approximately 765kB Builder bundle warning remains. Logs include existing React act warnings and the host TLS-environment warning; no TLS settings were changed for this work.

Native browser acceptance used the real App, active localStorage writer and chart renderer with 1,000 fabricated rows and 30 fields. Selected North in the real color inspector and applied #39784d, removed the Region filter and reran the analysis. North changed from north_1 to north_2, retained #39784d and total 12,250; the other report page kept its own intended North color #00d17f. Cold reopen retained both pages, all 1,000 rows and those colors. No user-origin data was replaced.

A separate fixture constructs actual PDF/PPTX bytes through the frontend export pipeline without automatically downloading. Three pages cover an authored net with radial stops/opacity, a linear per-category override, and a solid native chart with selected typography. Three PDF pages were independently rasterized with PyMuPDF and visually inspected; rendering retained the gradients, title and axis styling. Final PDF raster error against browser source JPEGs was below 0.09 on the 0-255 channel scale. All PowerPoint package XML parsed; its single native chart retained four exact values of 250, axis colors/type size and no Total legend. Both gradient-page embedded JPEGs were byte-identical to their source browser images. Generated binary/source artifacts stay outside Git and contain synthetic data only.

## Remaining acceptance and limits

- Native PowerPoint application rendering remains unverified. Earlier COM rendering was denied (0x80070005); it was not retried or bypassed.
- An older App-menu PowerPoint download has an uncertain outcome and was not blindly repeated. The separate generated-byte fixture proves frontend construction, not OS download completion.
- Conic bar selection follows the existing canvas linear approximation; this follow-up does not implement true conic SVG paint. Font availability is not embedding/Office fidelity.
- Broader line/donut/table typography, all brand controls, imported authored membership across changed queries, individual opt-out/restore and new-analysis workflows need independent original-scope acceptance. New keys cannot recover already orphaned legacy overrides without evidence.
- Durable recovery and restore remain inactive. No merge, production deployment, production data, permission, credential or billing changes.

## Broader brand follow-up

Independent review confirmed the earlier identity/gradient corrections and identified fixed-size legend layout plus table/donut typography gaps. This follow-up sizes series legend columns/rows from the selected font, rejects oversized labels explicitly, and preserves donut names/value/base font sizes and label color. Wrapping retains the existing default donut without clipping its longest labels. Plot/legend surfaces retain chartBackground; native PowerPoint chart and plot backgrounds record it too.

Table header/row text now honors axisFontSize and labelColor in the actual renderer; values honor labelFontSize, and bases use the corresponding smaller type. Inline styles defeat the existing fixed-size/editor CSS without removing annotation/significance colors. Reconstructed tables use the same chosen type/color with explicit row/column fit checks. The first browser screenshot exposed an inherited-color conflict; the corrected native screenshot confirms selected magenta headers, labels, values and bases.

Acceptance uses a six-page, synthetic-only generated-byte fixture: radial authored bars, linear override, solid native chart with blue surface, donut with 19px names/23px values, line chart with selected type/surface, and table with 19px names/23px values. All six PDF pages were independently rasterized; channel error against frontend JPEGs was below 0.12 on a 0-255 scale. The new donut, line and table pages were visually inspected. All PPTX XML parses, both chart/plot backgrounds retain DCEAFB, and five complete-image pages are byte-identical to the browser source JPEGs. Native Office rendering remains unverified. Generated artifacts and full evidence stay outside Git under goal34-brand-artifacts/stable-breadth.

Actual App restoration acceptance: Restore individual palettes, autosave and cold reopen retained the explicit North override #39784d, both original palettes, both pages and all 1,000 rows. Theme inactive/zero slots is expected after restoration. Broader new-analysis, individual opt-out and original-scope independent acceptance still remain. Conic behavior and changed authored membership retain their previously disclosed limits. No new broad goal has been certified complete.

Final broader-brand source verification: 1,509 tests passed, two skipped, and TypeScript/Vite production build passed after the final table CSS-color correction. Tests cover the default donut regression, selected donut/table types/colors, table renderer inline styles, native chart backgrounds, multi-row legends at size28, and explicit oversized-text refusal. Goal34 remains open for independent original-scope acceptance.

## Paint safety and enlarged analytical labels

Conic bar fills are not implemented faithfully by the current SVG renderer. They now produce an actionable chart status and reject SVG/image, PDF and PowerPoint visual construction instead of silently substituting linear paint. The original result/style remain recorded. A conic setting on a solid fill is not blocked. Users can choose solid/linear/radial to recover; PDF/PPTX remain available for supported paint. True conic rendering remains an unsupported feature and goal34 stays open.

Native browser safety fixture verified all three conic construction errors and unchanged original analysis. Switching to linear restored actual PDF construction (183,993 bytes) and PowerPoint construction (189,268 bytes), with no automatic download, service call, workspace write or Office COM operation.

Bar/line value/base baselines now use the selected font sizes, with horizontal/stacked fit guards, reserved line headroom and clearance from axis tick labels. Selected 23px values and22px bases have28.6px baseline separation. Regression checks retain exact source values/bases and test vertical, horizontal and line variants. Visual review caught an additional line base/axis-tick collision, which was corrected before the final acceptance run.

The seven-page synthetic frontend artifact fixture includes enlarged bar/line labels. All seven actual PDF pages were independently rasterized against browser JPEGs (channel error below0.12 on0-255 scale); final line and bar pages visually inspected with clear value/base/axis separation. All PPTX XML parses. Native Office visual acceptance remains unverified; the existing COM denial was not retried or bypassed. Full local source tests/build are recorded in the local publication proof, not inferred from package validity. No original-goal completion certification, merge or production deployment.

## Wrapped category label follow-up

Independent review found that bar/line category wrapping still used fixed 11px line spacing at a selected axis size of 23px. Reconstructed vertical, horizontal, grouped and stacked bars and lines now estimate character capacity from the selected type size, use 1.45 times that size for category baselines, reserve the full wrapped-label block below the plot, and center horizontal label blocks within their row. Oversized labels or inadequate plot/row space are rejected with a layout error rather than overlapping or silently truncating.

Six regressions cover all five chart types and an overcrowded horizontal rejection. An independent PyMuPDF renderer converted the five actual generated SVGs and measured both wrapped words' font bounds: North and Growth do not overlap in any case. Horizontal, vertical and line artifacts were visually inspected; source result data remained unchanged. A fresh browser tab restored verification access: the committed category-wrapping fixture rendered all five actual SVGs, native DOM text bounds did not overlap, and the visible wrapped labels were checked. These are reconstructed-SVG checks, not a new PDF-builder or Office acceptance run. The prior Office COM denial was not retried. Goal 34 remains open for independent acceptance.

## Native individual-chart palette acceptance

The actual editor's preserved synthetic report had three pages, 1,000 study rows and report-wide Ocean colors. The second chart had no explicit override; choosing Aurora through its Theme and type controls changed only that chart (East #16c9c3, North #00d17f). Report colors remained Ocean with one individual-palette chart. The first chart retained its explicit North #39784d override, the third chart retained its report colors, and all exact analytical values and study rows were unchanged. Autosave and cold reopen retained the same opt-out count, palettes and values. Raw accessibility snapshots and a screenshot are kept outside Git as theme-optout-*. This closes that specific native workflow check; native Office rendering, the older uncertain App-menu download and other original-scope gates remain unverified. No Office COM retry or original-goal completion claim.
