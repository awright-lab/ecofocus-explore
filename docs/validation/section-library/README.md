# Section library validation

The gallery searches section names, descriptions and category names only. It mounts at most 12 previews per result page and one in the inspection view. Each preview is limited to 80 objects; larger sections, invalid geometry, ambiguous object identities, mismatched counts, non-square ellipses and excessive footprints are explained as unsupported. Preview-only limitations do not prevent insertion: for example, non-square ellipses and sections over 80 objects can still be inserted. Invalid insertion geometry and ambiguous identities remain blocked. Remote or unsupported images are replaced with a labelled placeholder and are not fetched. Rendered previews are deliberately labelled partial: text, effects and analytical marks can be simplified, and analytical previews use only cached stored results, not the selected study.

Inspection captures both the selected section and the destination page. Before an insertion or a management action, the current identity and content are revalidated. The existing insertion callback creates editable copies and updates the saved block's last-used time on confirmed insertion. It also normalizes some significance metadata and warnings on the inserted analysis; the stored block and analytical values remain intact. Equal stacking positions follow the report canvas's order, and the insertion copy is ordered accordingly. The existing interface supplies a page rather than a report identity, so the guard checks page identity, uniqueness and content; a hypothetical switch to a different report that reuses the very same page object cannot be independently distinguished here.

## Reproduce locally

Install the repository dependencies and a compatible Playwright Chromium. The runner launches the real App with a fresh temporary browser profile and synthetic local storage; it aborts every non-local request. To run with explicit paths:

```sh
PLAYWRIGHT_MODULE=/path/to/node_modules/playwright \
CHROMIUM_EXECUTABLE=/path/to/chrome \
node docs/validation/section-library/verify-browser.mjs
```

The runner exercises 3 curated and 497 saved synthetic blocks, the last match, source and category filters, duplicate names and opaque IDs, cached analysis, native 200% browser zoom, a narrow viewport, focus and keyboard handling, insertion, Undo/Redo, reload, save selection, edit and delete. It compares local draft, dataset and published-snapshot data around browsing and checks the inserted editable copy. Results and timings are recorded in `browser-results.json`; screenshots show desktop, narrow and native zoom. The accessibility tree and unnamed-control check are automated Chromium checks, not a test with a screen reader. Timing observations are single local runs, not performance guarantees.

Focused suite:

```sh
npm test -- src/features/builder/components/__tests__/SectionLibraryParent.test.tsx src/features/builder/components/__tests__/SectionLibrary.test.tsx src/features/builder/components/__tests__/sectionLibraryModel.test.ts src/features/builder/components/__tests__/SectionPreview.test.tsx src/features/document/__tests__/DocumentPreview.test.tsx src/features/document/__tests__/reportStarters.test.ts --maxWorkers=2 --testTimeout=20000
npm test -- --maxWorkers=2 --testTimeout=20000 --reporter=verbose
npm run typecheck
npm run build
git diff --check
```

The recorded Chromium 156 run opened the gallery in 291 ms and found the last match in 69 ms with 12 mounted previews. At 390 CSS pixels the dialog measured 372 pixels for both client and scroll width; at native 200% zoom it measured 622 for both. No browser page errors or network requests outside the local app were observed. These values depend on the machine and test fixture.

Validation run: focused suite 42 passed; full suite 5,596 passed and 2 skipped across 412 passed and 1 skipped files; typecheck and build passed. The skipped cases were the optional offline raster/document generation test and the opt-in live Snowflake integration. The build reported its large-chunk warning. No screen-reader testing or live-service testing was performed.

Follow-up regression checks: 46 focused tests passed, including insertion of an oval and an 81-object section despite unsupported previews; typecheck passed. The full suite and Chromium results above were recorded before this follow-up.
