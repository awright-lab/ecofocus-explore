# EcoFocus Explore

EcoFocus Explore is a separate analytics workspace for EcoFocus: part survey analysis studio, part report/presentation builder.

The product is intentionally being built as a parallel environment so the team can experiment safely without touching the existing EcoFocus production portal.

Its core rule is:

```text
query definition -> backend/provider response -> frontend rendering
```

That means charts and tables are not static report artifacts. They are query-driven, metadata-aware outputs that can be explored, restyled, reused, and eventually backed by Snowflake.

## Current Stack

- Frontend: Vite + React + TypeScript
- Rendering: Recharts
- Backend boundary: Netlify Functions
- Shared contract: TypeScript interfaces and analytics utilities in `shared/`
- Current provider: mock analytics provider
- Ready-for-handoff provider: Snowflake provider boundary with explicit readiness checks

## What The App Does Today

### Builder / design suite

- multi-page report canvas
- drag/drop tile and element placement
- text, image, rectangle, and circle elements
- chart and table tiles
- layer ordering and arrange controls
- page, tile, chart, and element styling
- published report mode

### Analytical authoring

- table-first workflow
- convert table to chart
- keep table and create chart copy
- saved variable sets
- saved banners
- saved filters
- saved weights
- in-place tile analysis editing
- save tuned tile analysis back into the library
- authored variable-set rows:
  - option rows
  - nets
  - top box / bottom box
  - hidden rows
  - summary vs detail emphasis

### Trend support

- reusable wave comparison queries
- current mock waves:
  - EcoFocus 2025
  - EcoFocus 2024
  - EcoFocus 2023
- trend-aware saved variable sets
- comparison-aware tile editing
- trend metadata included in export/package output

## Project Structure

```text
.
├── netlify/
│   └── functions/
│       └── analytics-query.ts
├── docs/
│   ├── architecture.md
│   └── snowflake-readiness.md
├── shared/
│   ├── analytics/
│   │   ├── __tests__/
│   │   ├── providers/
│   │   ├── queryPlan.ts
│   │   ├── runAnalyticsQuery.ts
│   │   ├── validation.ts
│   │   └── variableSets.ts
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
├── README.md
└── netlify.toml
```

## Running Locally

For a proof of concept without cloud credentials, create a `.env` file with:

```dotenv
ANALYTICS_DATA_PROVIDER=mock
VITE_DATASET_IMPORT_PROVIDER=local
```

After installing dependencies, run `npm run demo` and open
`http://localhost:8888`. In Codespaces, open port **8888** from the Ports tab.
This starts both the frontend and local analytics functions without signing in
to Netlify. Port 5173 serves only the frontend.

Start with **Explore an example** on the home screen for a complete, editable
EcoFocus report with query-backed charts. **New report** creates an empty page.

- Use **Create** to build a table or chart.
- Select any object to open its properties; close either side panel for more canvas space.
- Use **Data → Advanced analysis** for source authoring, query setup, variable sets,
  recodes/nets, templates, derived outputs, segments, banners, filters, and weights.
- Use **Design** for themes, reusable story sections, assets, and typography.
- Press **Ctrl/⌘ K** to find a tool, create an object, switch delivery modes, or export.
- Use **Preview**, **Share**, and **Export** for delivery.

Built-in EcoFocus studies use mock data. The included example’s charts and summary
values are generated from those analytical responses. Existing saved reports are
preserved. CSV/XLSX/SAV imports and report drafts stay in this browser when using
the local configuration; published viewer links also depend on that browser’s
saved workspace.

Install dependencies:

```bash
npm install
```

Run the full local app with Netlify Functions:

```bash
npm run dev
```

For frontend-only work:

```bash
npm run dev:vite
```

Run tests:

```bash
npm test -- --run
```

Build locally:

```bash
npm run build
```

## Environment Variables

Use `.env.example` as the starting point.

Current provider selection:

```text
ANALYTICS_DATA_PROVIDER=mock
```

Available provider IDs:

- `mock`
- `snowflake`

Snowflake env placeholders:

- `SNOWFLAKE_ACCOUNT`
- `SNOWFLAKE_USERNAME`
- `SNOWFLAKE_PASSWORD`
- `SNOWFLAKE_WAREHOUSE`
- `SNOWFLAKE_DATABASE`
- `SNOWFLAKE_SCHEMA`
- `SNOWFLAKE_ROLE`
- `SNOWFLAKE_AUTHENTICATOR` (optional)

The Snowflake provider currently validates readiness and exposes clearer runtime errors, but it does not execute live queries yet.

## Key Docs

- [Architecture overview](docs/architecture.md)
- [Snowflake readiness](docs/snowflake-readiness.md)

## Current Status By Phase

### Phase 0 — Foundation

Done.

### Phase 1 — Internal MVP shell

Done.

### Phase 2 — Query contract + mock analytics backend

Done.

### Phase 3 — Metadata layer

Done for MVP and already fairly deep, with more analytical modeling still possible.

### Phase 4 — Frontend rendering

Done for MVP and now fairly robust.

### Phase 5 — Snowflake readiness

Substantially improved:

- provider boundary is in place
- provider selection is env-driven
- Snowflake readiness is explicitly validated
- provider-neutral query planning exists
- tests cover provider selection and Snowflake config parsing

Still left:

- actual Snowflake execution
- secure live credential wiring in deployment
- integration tests against a safe non-production Snowflake target

### Phase 6 — Documentation + next steps

Improved in this pass:

- architecture doc
- Snowflake readiness doc
- README updated to current product reality

Still left:

- future operator/deployment runbook once real Snowflake execution exists
- PowerPoint export implementation notes once export moves beyond the presentation package

## What’s Next

The biggest remaining product work is now:

- deeper analytical logic and recoding
- richer trend/statistics workflows
- real Snowflake execution
- real PowerPoint export
