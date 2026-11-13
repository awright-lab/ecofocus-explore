# Responsive header validation

## Current integration review

Integrated PR17 main `21b7cb05362767ff66b79c7948c042761ac69008` into the PR18 branch, retaining the shared export-job lock, progress, cancellation, and terminal-notice dismissal. The compact header also places `.export-job-status` in normal flow with normal stacking so it cannot sit above centered menus as a bottom-fixed overlay. Five added component regressions check that menu Escape preserves each shared status and its export locks/callbacks.

The revised runner uses shared status, exercises running/canceling/canceled/error/complete notices at 390×400 and native 200% zoom, and hit-tests enabled menu actions in addition to checking bounding boxes. New output defaults to `docs/validation/responsive-header/integrated/` (override with `HEADER_OUTPUT_DIR`) to keep the historical captures below intact. The revised runner has passed syntax checking but **has not been executed on this integrated revision**: the earlier cloud browser-launch denial remains in effect and was not retried. The old screenshots/results do not verify the combined header/export behavior.

Focused integration tests: **79 tests passed in 8 files**. Broad integration suite: **5,731 passed, 3 skipped; 425 files passed, 1 skipped; 358.79 seconds**, using two workers and excluding the six `**/snowflake*.test.ts` files. This is not an unrestricted full-suite pass. Typecheck, production build (existing large-chunk warning), CRLF-aware diff checks and runner syntax checks passed. Independent source review found no blocker. No new Snowflake tests or live-provider checks. Dependencies for these independent runs used exact direct versions from the existing lockfile in a separate temporary installation, excluding unused Netlify CLI; this is not full npm-ci/transitive-lock validation.

## Historical standalone evidence

Historical base: `41e85bf6f9ce734c102a62aba14bd78f06e47e56`. The original PR18 revision `ffe50a3e910be2847fd8a8ded41a56d37d5eb151` did not include PR17. The following captures and totals apply to that standalone revision, not the current integrated branch. The compact editor header uses bounded, wrapping rows; its document, preview and export menus are mutually exclusive, stay within the viewport, and close on Escape with focus returned to their trigger. Export confirmation and errors flow in the header at compact widths instead of covering actions. The viewer header wraps its copy and controls. Desktop layout rules above 1100 CSS pixels are retained.

Run the revised integrated checks using local dependencies and Chromium:

```sh
npm run build
PLAYWRIGHT_MODULE=/path/to/playwright CHROMIUM_EXECUTABLE=/path/to/chrome node docs/validation/responsive-header/verify.mjs
```

The runner serves the production build locally, seeds a synthetic report and published snapshot, blocks non-local requests, and uses a temporary Chromium extension to set native browser zoom. `before-narrow.png` and `before-zoom-200.png` were captured from the unchanged base; `after-*` captures the modified editor and viewer. The baseline at 390 CSS pixels placed Export's right edge at x=527. The new 390-pixel layout keeps measured header actions in bounds, including the export confirmation. The compact header is taller (154 CSS pixels before a notice), trading canvas height for reachable controls.

The automated browser check covers 390×600, 390×400, 1440×900, native 200% zoom in a 1280×900 window, editor and viewer navigation, header menu bounds and Escape focus restoration, Tab from the brand to document menu, Tool Library focus restoration, mutually exclusive menus, JSON download initiation and unchanged local workspace bytes during export. It checks screenshots and control rectangles; it does not prove that a user saved the downloaded file. `results.json` contains the measured rectangles and browser version. It does not test all zoom levels, all browsers, screen readers, every viewport or a live service. Native details grouping depends on browser support; Chromium was tested.

Historical standalone validation: 16 focused header/navigation tests and 44 export/preflight tests passed. The full non-live suite passed 5,770 tests across 427 files; 4 tests in 2 files were skipped, including the live Snowflake integration. Typecheck, production build and diff checks passed. The build reported the existing large-chunk warning. No screen-reader, live Snowflake or Office verification was performed.
