# EcoFocus Explore

EcoFocus Explore is a separate analytics application for experimenting with query-driven survey exploration without changing the existing EcoFocus production portal.

The product principle is simple: every visualization starts as a structured query, is normalized by the backend, and is rendered dynamically by the frontend. This avoids static chart pages and keeps charts explorable, metadata-aware, and ready for future Snowflake-backed analytics.

## Current Stack

- Frontend: Vite, React, TypeScript
- Backend: Netlify Functions
- Shared contract: TypeScript interfaces in `shared/`
- Data source: mock provider for now, with a boundary ready for a future read-only Snowflake provider
- Deployment target: Netlify

Vite + Netlify Functions is intentionally lighter than Next.js for this internal MVP. It keeps the app fast to iterate on while preserving a real backend boundary for analytics queries.

## Project Structure

```text
.
├── netlify/
│   └── functions/
│       └── analytics-query.ts
├── docs/
│   └── snowflake-readiness.md
├── shared/
│   ├── analytics/
│   │   ├── providers/
│   │   ├── queryPlan.ts
│   │   ├── runAnalyticsQuery.ts
│   │   └── validation.ts
│   ├── metadata/
│   │   └── ecofocus2025.ts
│   ├── mock/
│   │   └── analytics.ts
│   └── types/
│       ├── analytics.ts
│       └── dashboard.ts
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── styles.css
│   └── lib/
│       ├── api.ts
│       └── metadata.ts
├── .env.example
├── netlify.toml
├── package.json
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
```

## Running Locally

Install dependencies:

```bash
npm install
```

Run the Netlify local environment, including functions:

```bash
npm run dev
```

The app will be available at the local URL printed by Netlify CLI. The frontend calls:

```text
/.netlify/functions/analytics-query
```

For frontend-only work, you can also run:

```bash
npm run dev:vite
```

Run backend contract tests:

```bash
npm test
```

## Environment Variables

Copy `.env.example` to `.env` when real integration work begins.

Current placeholders:

- `SNOWFLAKE_ACCOUNT`
- `SNOWFLAKE_USERNAME`
- `SNOWFLAKE_PASSWORD`
- `SNOWFLAKE_WAREHOUSE`
- `SNOWFLAKE_DATABASE`
- `SNOWFLAKE_SCHEMA`
- `SNOWFLAKE_ROLE`
- `ANALYTICS_DATA_PROVIDER`

Do not add production Snowflake credentials to the repo.

## Query Contract

Example request:

```json
{
  "dataset": "ecofocus_2025",
  "question": "Q_PACKAGING_TRUST",
  "breakBy": "GENERATION",
  "filters": [],
  "metric": "column_percent",
  "chartType": "grouped_bar"
}
```

The backend returns normalized render data:

- labels
- series
- values
- bases
- notes
- metadata references

The frontend renders from this response instead of receiving static chart HTML or images.

## Phased Roadmap

### Phase 0 - Project Foundation

- Create a separate Netlify-friendly React app.
- Add API/function structure.
- Add shared TypeScript contracts.
- Add environment placeholders and deployment config.
- Document project purpose and roadmap.

### Phase 1 - Internal MVP Shell

- Create a single Explore page.
- Add dataset, question, and banner selectors.
- Add a Run button.
- Add output regions for chart, table, notes, and query details.

### Phase 2 - Query Contract + Mock Analytics Backend

- Add the first analytics function.
- Validate the basic query shape.
- Return normalized mock crosstab/chart data.
- Keep business logic out of the frontend.

### Phase 3 - Metadata Layer

- Expand metadata for datasets, questions, options, dimensions, filters, chart rules, and survey wave details. Initial pass complete.
- Add metadata-driven selector constraints. Initial question, banner, metric, chart, and filter constraints are wired.
- Add base-size warnings and chart compatibility rules. Initial backend validation and warning fields are in place.
- Keep raw survey codes behind human-readable labels. Initial metadata labels are used in selectors and output.

Current metadata fields include source columns, question topics, question universes, default metrics, banner/filter dimension roles, chart compatibility, metric formatting, and minimum-base warning thresholds.

### Phase 4 - Frontend Rendering

- Add a frontend-native charting library. Initial Recharts integration complete.
- Render grouped bars, vertical bars, and tables from normalized responses. Initial table-first rendering complete.
- Add hover states, base labels, notes, and chart/table toggles. Initial view toggle, tooltips, bases, notes, weights, and annotations are wired.
- Keep charts query-driven and rerenderable. Charts now render from the normalized table/series response rather than static output.

Current Phase 4 scope includes a saved multi-binary variable set example for `Q15_TOP2_BRAND_PRIORITIES`, a `SUMMARY` breakout, weighted query metadata, and placeholder significance arrows.

### Phase 5 - Snowflake Readiness

- Add a provider interface for analytics queries. Initial provider boundary complete.
- Implement a read-only Snowflake provider behind the existing endpoint. Stub provider added; real execution intentionally not wired yet.
- Keep SQL generation server-side and metadata-aware. Initial provider-neutral query plan added.
- Add guardrails for allowed datasets, questions, filters, and metrics. Validation now lives in shared analytics code.
- Add backend confidence tests. Initial Vitest coverage added for validation, provider selection, query planning, and Q15 mock output.

See `docs/snowflake-readiness.md` for the expected Snowflake shape and next integration steps.

### Phase 6 - Documentation + Next Steps

- Document data contracts.
- Document Snowflake setup.
- Document trend support requirements.
- Add internal testing notes before client-facing rollout.

### Phase 7 - Dashboard Builder Foundation

- Add a dashboard draft model with query-driven tiles. Initial in-memory builder complete.
- Add dashboard canvas, data panel, and tile settings panel.
- Allow adding tiles from structured analytics queries.
- Allow tile-level display customization for title, visualization, palette, labels, table, bases, notes, and annotations.
- Add draft/published status toggle as a mock publishing workflow.

### Phase 7B - Multi-Page Dashboard Builder

- Add dashboard pages with their own ordered tile lists. Initial in-memory page model complete.
- Add page navigation, active page selection, new page, rename page, and delete page.
- Make tile creation and tile settings operate on the active page.
- Keep publishing at the dashboard level across all pages.

### Phase 7C - Freeform Canvas Builder

- Add PowerPoint-style freeform page canvas with draggable and resizable elements.
- Allow analytics tiles to be positioned anywhere on the page.
- Add basic insert tools for text, rectangles, circles, and image URL elements.
- Add element-level settings for text, image URL, fill, border, and font size.
- Keep analytics tiles query-driven while allowing visual layout customization.

### Phase 7D - Advanced Canvas Styling

- Add Canva-style styling controls for solid and gradient fills.
- Add rounded-corner, transparency, border, and shadow controls for shapes, images, text, and analytics tiles.
- Add layer ordering controls for moving selected items forward/backward or to front/back.
- Add chart tile styling controls for palette, background, borders, shadows, labels, bases, notes, annotations, and grid lines.

### Phase 7E - Advanced Chart Styling

- Add chart-level controls for bar fill mode, gradients, bar width, spacing, roundness, label position, label offset, label color, label size, axis color, axis size, and grid color.
- Add per-bar/per-series style targets so individual bars or grouped chart series can have custom colors, gradients, and roundness.
- Keep chart styling metadata on the tile so dashboards can preserve design decisions separately from analytics queries.

### Phase 8A - Saveable Design Workspace

- Persist dashboard state to local storage. Initial local persistence complete.
- Add reset dashboard, duplicate selected item, and delete selected item.
- Add keyboard shortcuts for Delete/Backspace, Cmd/Ctrl+D, Cmd/Ctrl+Z, and redo.
- Add basic undo/redo history for dashboard edits.
- Add local save status in the top toolbar.

### Phase 8B - Layer Panel And Arrange Tools

- Add a visible layer list for the active page.
- Support selecting layers from the panel, renaming layers, hiding/showing, and locking/unlocking.
- Locked items remain visible but cannot be dragged or resized.
- Hidden items are removed from the canvas but remain accessible from the layer panel.
- Add basic arrange controls for align left, center, right, top, middle, and bottom.
- Add direct X, Y, width, and height controls for selected items.

### Phase 8C - Canvas Grid And Typography

- Add page-level grid controls for grid visibility, grid size, and snap-to-grid behavior.
- Add keyboard nudging for selected canvas items with arrow keys and larger Shift+Arrow movement.
- Add richer text styling controls for font family, weight, italic, underline, alignment, line height, padding, color, and size.
- Preserve these page and element design settings in the dashboard draft model and local storage.

### Phase 8D - Page And Element Styling

- Add page-level solid and gradient background controls.
- Add richer element border controls for color, width, solid/dashed/dotted/none styles, and rounded corners.
- Add image fit controls for cover, contain, and stretch behavior.
- Keep page and element styling in the dashboard draft model so designed dashboards can be saved and published later.

### Phase 8E - Tool Tray Layout And Canvas Zoom

- Move layers into a focused left-panel tray that can be opened and closed instead of always occupying page space.
- Convert the right settings panel into a compact menu with focused Page, Arrange, Element/Tile, and Container tool views.
- Add zoom controls for the design canvas, including zoom buttons, a slider, and scaled drag/resize behavior.
- Lock the builder shell to the viewport so the design suite feels like an app workspace rather than a long scrolling page.

### Phase 8F - Premium Design Workspace Polish

- Add a Canva-inspired top app bar with project controls and a clearer publishing area.
- Add a vertical tool rail for Pages, Elements, Charts, and Layers so the left drawer stays focused.
- Center the canvas on a neutral stage with a floating quick-action toolbar.
- Add a bottom page strip for fast page switching and page creation.
- Keep overflow inside drawers and the canvas stage instead of scrolling the whole app.

### Phase 8G - Chart Labels, Tile Scroll, And Export Readiness

- Add chart axis label wrapping controls, label height, horizontal/vertical label offsets, rotation, and alignment.
- Add per-bar axis label text overrides with manual line breaks for cleaner chart exports.
- Make chart tiles draggable from their header while keeping tile contents scrollable.
- Add an export spec download that preserves page, canvas, query, and styling metadata as a bridge toward real PowerPoint export.

### Phase 8H - Expanded Chart Types

- Add horizontal bar and donut chart renderers for single-series summary charts.
- Add stacked bar and line chart renderers for multi-series crosstab charts.
- Expand chart metadata so selectors expose compatible chart types by question and breakout shape.
- Allow existing dashboard tiles to switch visualization type while preserving their normalized query response and design settings.

### Phase 8I - Navigation Density And Zoom Polish

- Slim the top navigation bar and left tool rail so the canvas gets more visual priority.
- Tighten drawer controls, page tabs, and bottom page thumbnails to reduce chrome weight.
- Give the zoom slider dedicated compact range styling so it no longer inherits large form-field dimensions.

## Product Notes

Displayr is useful as a benchmark for survey exploration expectations, especially crosstabs, filtering, segmentation, trends, and exports. EcoFocus Explore is not a Displayr clone. The differentiator is a simpler, modern, EcoFocus-specific experience where polished charts remain fully explorable because they are generated from structured analytics queries.
