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
│       └── analytics.ts
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

## Product Notes

Displayr is useful as a benchmark for survey exploration expectations, especially crosstabs, filtering, segmentation, trends, and exports. EcoFocus Explore is not a Displayr clone. The differentiator is a simpler, modern, EcoFocus-specific experience where polished charts remain fully explorable because they are generated from structured analytics queries.
