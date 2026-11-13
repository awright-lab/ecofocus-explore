# Responsive header validation

Base: `41e85bf6f9ce734c102a62aba14bd78f06e47e56` (origin/main). This branch does not include PR #17. The compact editor header uses bounded, wrapping rows; its document, preview and export menus are mutually exclusive, stay within the viewport, and close on Escape with focus returned to their trigger. Export confirmation and errors flow in the header at compact widths instead of covering actions. The viewer header wraps its copy and controls. Desktop layout rules above 1100 CSS pixels are retained.

Reproduce using local dependencies and Chromium:

```sh
npm run build
PLAYWRIGHT_MODULE=/path/to/playwright CHROMIUM_EXECUTABLE=/path/to/chrome node docs/validation/responsive-header/verify.mjs
```

The runner serves the production build locally, seeds a synthetic report and published snapshot, blocks non-local requests, and uses a temporary Chromium extension to set native browser zoom. `before-narrow.png` and `before-zoom-200.png` were captured from the unchanged base; `after-*` captures the modified editor and viewer. The baseline at 390 CSS pixels placed Export's right edge at x=527. The new 390-pixel layout keeps measured header actions in bounds, including the export confirmation. The compact header is taller (154 CSS pixels before a notice), trading canvas height for reachable controls.

The automated browser check covers 390×600, 390×400, 1440×900, native 200% zoom in a 1280×900 window, editor and viewer navigation, header menu bounds and Escape focus restoration, Tab from the brand to document menu, Tool Library focus restoration, mutually exclusive menus, JSON download initiation and unchanged local workspace bytes during export. It checks screenshots and control rectangles; it does not prove that a user saved the downloaded file. `results.json` contains the measured rectangles and browser version. It does not test all zoom levels, all browsers, screen readers, every viewport or a live service. Native details grouping depends on browser support; Chromium was tested.

Validation on this branch: 16 focused header/navigation tests and 44 export/preflight tests passed. The full non-live suite passed 5,770 tests across 427 files; 4 tests in 2 files were skipped, including the live Snowflake integration. Typecheck, production build and diff checks passed. The build reported the existing large-chunk warning. No screen-reader, live Snowflake or Office verification was performed.
