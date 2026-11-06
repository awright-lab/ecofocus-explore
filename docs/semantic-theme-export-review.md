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
