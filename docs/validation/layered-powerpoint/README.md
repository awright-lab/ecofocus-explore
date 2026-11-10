# Layer-preserving PowerPoint export validation

Base: `codex/beta-reliability-audit` at `f9b32129bfba62a9d42fb5a0e17db5802a3ee919`.
The separate report-refresh PR was neither merged nor cherry-picked. The original
workspace and its uncommitted changes were left in place. The target branch later advanced to recovery commit `0d155ff`. This export branch
remains based on `f9b32129`; combined recovery/export behavior was not tested.

## Behavior and bounds

The planner follows the renderer's stable ascending z-index order, with elements
before tiles at equal positions and original array order within each kind. The
background is emitted first. Supported text and shapes become DrawingML objects;
unsupported elements and tables become transparent PNG layers. Each native chart
has its own raster context immediately before its editable chart body. Pictures,
shapes and charts share one ordered slide object tree and one unique ID allocator.

An immutable export snapshot prevents edits during rasterization from changing a
partially generated deck. Export performs no report, study, history or undo writes.
Existing analytical/evidence validation still runs before rendering.

Pages above 500 objects or 64 raster layers, ambiguous visible identities, or
unverifiable layer geometry/eligibility retain the complete-slide image policy.
Invalid content still blocks export rather than producing a partial slide.
Injected PowerPoint rasterizers must return PNG data URLs; opaque JPEG layers
are rejected. The normal browser path uses an alpha-preserving PNG canvas without
painting a white background. PDF keeps its existing JPEG canvas path.

Preflight uses the same plan as export, lists individual editable/image objects,
counts raster layers, and explains fallback pages and raster chart context.

## Automated checks

- Focused export suite: 293 passed, 2 optional checks skipped (33 files).
- Full suite: 5,533 passed, 3 skipped; 405 files passed, 2 files skipped (407 total).
  Command: `npm test -- --maxWorkers=2 --testTimeout=20000 --reporter=verbose`.
  The longer timeout accommodates the existing recovery stress test under CPU
  contention; no recovery code or recovery tests were edited. That test passed
  in 3.6 seconds in the final full run.
  Skips: opt-in live Snowflake, legacy optional offline raster integration, and
  the new optional real-raster check (which passed separately).
- `npm run typecheck` and `git diff --check`: passed.
- Package tests inspect object order, unique shape/relationship IDs, relationship
  targets, exact signed chart values and category order, hidden content, equal
  positions, multiple pages, read-only snapshots and bounded fallbacks. The synthetic
  native chart retains A/X = -20, A/Y = 10, B/X = 0 and B/Y = 20 exactly.
- Browser encoder tests verify PNG selection without a white canvas fill.
- The optional real-raster integration test generated actual PNG layers and
  verified alpha at a pixel outside each object. Tiny PNGs in ordinary package
  tests are routing probes, not image-fidelity evidence.

To reproduce the real-raster check, install `sharp` in a separate temporary npm
prefix, then run:

```sh
ECOFOCUS_PPTX_SHARP=/tmp/ecofocus-pptx-validation/package.json \
  npm test -- src/features/export/__tests__/pptxLayerVisual.test.ts
```

Set `ECOFOCUS_PPTX_ARTIFACTS` to change the artifact directory (default:
`/tmp/ecofocus-layered-pptx`). No survey files or production data are used.

## Actual compatibility rendering

LibreOffice Impress 24.2.7.2 opened the generated four-slide deck and exported it
to PDF. The PDF pages were rasterized with PyMuPDF and visually inspected against
SVG references. [Comparison image](comparison.png): SVG references on the left,
LibreOffice output on the right.

1. A translucent editable backdrop, native chart, overlapping table and foreground
   editable text retain their intended stacking. The text is above the table.
2. Equal z-index positions retain source order, so later tiles cover earlier text.
3. Transparent page/tile/chart backgrounds do not introduce opaque image boxes.
4. The 501-element fallback retains the full composition as one image.

The native chart's axes, legend, tick choices and text metrics differ from SVG.
This check verifies composition and visibility, not pixel identity. LibreOffice
successfully rendered native text and chart parts; extracted PDF text independently
confirmed their presence. This was a headless compatibility-render inspection,
not an interactive editing session.

Microsoft PowerPoint desktop/web was unavailable. Office-specific rendering,
interactive chart-data editing, font substitution on other machines, and a manual
browser download were not verified. There was no merge, deployment or production
write. No saving/recovery code, App.tsx, dashboard schema or report-refresh files
were changed.
