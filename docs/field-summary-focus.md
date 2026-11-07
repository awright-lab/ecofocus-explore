# Keep keyboard focus after background field summaries

Numeric and categorical summaries replace their Cancel control when a background job finishes. Previously, a keyboard user focused on that control could lose focus to the document body. In the builder, that also exposed the selected canvas object to global keyboard commands.

Both summaries now capture focus ownership before removing Cancel and hand focus to the named summary region after removal. This happens only if the departing control owned focus and focus has not moved elsewhere. Error and cancellation states retain the existing Retry button and its focus; stale job completions do not move focus. Replacing a source with an incomplete study focuses the unavailable summary when necessary.

The shared hook adds no tab stops and does not change calculations, worker preparation, cancellation, retry, source values, or persistence. The categorical summary gains a named region; unavailable content retains its status semantics.

## Verification

- Fourteen component regressions use actual profile preparation and calculation with a controlled Worker. They cover completion, deliberate blur, unrelated focus, error/retry, cancellation/retry, stale completion, unmount, and incomplete-source replacement. Eight cases fail against the original components.
- One actual App regression opens the field browser for a synthetic 5,000-row study, completes numeric and categorical summaries, checks focus and Delete-key safety with a selected report object, and verifies save/cold-reopen preservation of source rows, fields, report content and the existing snapshot. The numeric mean is 2 and both category counts are 2,500.
- Existing numeric/category Worker and ambiguous-source UI regressions remain part of the focused checks.

The App regression runs in jsdom with dialog and Worker substitutes; it is not native browser, assistive-technology or native Worker acceptance. Goal 16 remains partial. No report data or historical cache is migrated, and no deployment or publication is included.
