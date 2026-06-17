# Product Roadmap

EcoFocus Explore is being built toward a specific product target:

```text
Displayr-grade analytical authoring
+ Canva-grade composition and design UX
+ modern typed application architecture
```

This is not a generic dashboard project. It is a document-centric analytics studio where analytical objects, narrative content, and presentation design all live in the same system.

## Product Goal

The target product should let a team:

- ingest and model survey data
- build reusable analytical objects from that data
- compose those objects into report pages and presentation-style deliverables
- restyle, reuse, publish, and export those deliverables
- progressively replace mock data execution with real provider-backed analytics

The intended end state is a hybrid of:

- Displayr for survey analysis, report authoring, variable logic, and analytical workflows
- Canva for page composition, brand/design systems, flexible layout, and content presentation

## Core Product Principles

### 1. Query-driven rendering stays non-negotiable

The architectural rule remains:

```text
query definition -> backend/provider response -> frontend rendering
```

Charts, tables, and analytical callouts must be derived from normalized analytical responses rather than hardcoded display artifacts.

### 2. Table-first analytical truth

Displayr-style workflows should treat the analytical table as the canonical object. Charts, summary cards, and presentation variants are usually derived from that canonical table or query result.

### 3. Document-first authoring

The final product is not only an analysis engine. It is also a document builder with pages, layers, reusable components, master pages, and publication/export workflows.

### 4. Metadata shields the UI from raw source structures

Questions, banners, filters, weights, comparison options, and chart compatibility should continue to flow through the shared metadata layer rather than leaking database or SPSS column details directly into the frontend.

### 5. Modular domains over monolithic app code

The current MVP has proven product direction, but the codebase must move away from a single large app file toward domain-level modules with explicit ownership and state boundaries.

## Product Capability Pillars

The long-term product has three major engines.

### Analytical engine

This is the Displayr side of the system:

- dataset ingestion and provider integration
- question and variable metadata
- variable sets
- banners, filters, and weights
- crosstabs and summary tables
- recodes, nets, top box, bottom box, and hidden rows
- trend and wave comparison
- statistical testing and significance annotation
- advanced analysis workflows over time

### Composition engine

This is the Canva side of the system:

- page builder and multi-page report structure
- freeform tile placement
- text, image, shape, and chart/table composition
- layers, locking, grouping, and arrangement
- master pages and templates
- brand kits, palettes, and typography systems
- reusable design blocks
- export-friendly presentation layouts

### Application platform

This is the structural advantage over both categories:

- typed shared contracts
- provider-neutral backend execution
- normalized response shapes
- modular frontend architecture
- AI-assisted workflows
- versioning, publishing, sharing, and export boundaries

## Current State

The repository already has strong early foundations:

- shared analytics contract
- provider boundary with `mock` and `snowflake`
- metadata-driven analytical inputs
- trend-aware query shape
- dashboard/report draft model
- tile and canvas editing
- saved variable sets, banners, filters, and weights

The main current constraints are:

- `src/App.tsx` is too large and holds too much product logic
- backend execution depth is still MVP-level
- Snowflake is readiness-only, not live
- advanced analytical workflows are still shallow
- design tooling is promising but not yet Canva-class

## Roadmap Structure

Delivery should happen in seven major phases. These phases are ordered to preserve architectural integrity while steadily increasing product parity.

## Phase 1: Frontend Architecture Refactor

Goal: turn the current MVP shell into a maintainable platform that can absorb Displayr-scale and Canva-scale features.

### Objectives

- split the monolithic app into domain modules
- separate document state from analytics state and UI state
- make placed objects first-class entities
- introduce stable component boundaries for future work

### Recommended module boundaries

- `src/features/analytics/`
- `src/features/document/`
- `src/features/canvas/`
- `src/features/design-system/`
- `src/features/assets/`
- `src/features/export/`
- `src/features/assistant/`
- `src/components/`
- `src/hooks/`

### Recommended state boundaries

- document structure state: pages, master pages, tiles, elements, ordering
- analytical config state: query definitions, variable sets, filters, banners, weights
- render/result state: normalized query responses, loading, warnings, annotations
- design state: palettes, text styles, page themes, element and tile appearance
- UI session state: selection, modals, inspector panels, undo/redo, zoom

### Exit criteria

- `src/App.tsx` becomes a thin composition shell
- core builder flows are moved into feature modules
- document model and analytics model can evolve independently

## Phase 2: Displayr Core Parity

Goal: reach strong parity with the core report-authoring and table-building workflows that users expect from Displayr.

### Required capabilities

- report/page tree with robust page management
- dataset explorer and variable explorer
- table-first analysis creation
- variable-set authoring and reuse
- banners, filters, and weights with library save/reuse flows
- convert table to chart and keep-table-create-chart workflows
- in-place tile analysis editing
- page master behavior and layout inheritance
- publish/share/export workflow scaffolding

### Missing product behaviors to prioritize

- more explicit object insertion flows
- stronger page/object inspector surfaces
- more complete report navigation behavior
- better analytical object lifecycle management

### Exit criteria

- a user can build a report in the style of a Displayr dashboard/report without leaving the application

## Phase 3: Analytical Depth

Goal: expand beyond MVP analytics into serious survey-analysis authoring.

### Required capabilities

- recode editor
- authored nets
- top box and bottom box builders
- hidden-row and emphasis controls
- significance testing
- improved weighted/unweighted handling
- richer trend and comparison logic
- calculation-grid-like derived outputs
- summary tables and reusable analytical templates

### Future advanced capabilities

- diagnostics/data checking workflows
- segmentation outputs
- derived variables
- custom formula or scripting layer

### Exit criteria

- EcoFocus analysts can reproduce their common reporting logic without fallback to another analysis tool

## Phase 4: Canva-Class Composition

Goal: make the report-builder feel like a professional design environment rather than an analytics UI with formatting options.

### Required capabilities

- stronger layout tools
- snap guides and alignment/distribution tools
- grouping and multi-select editing
- master pages with reusable page regions
- richer text presets and style systems
- reusable design components
- asset/image library behavior
- background/image fills and better composition controls
- more polished page templates

### Experience targets

- editing should feel fast and visual
- non-analytical content should be first-class, not secondary
- themes and templates should be reusable across reports

### Exit criteria

- a user can create visually polished client-facing pages without exporting to another design tool

## Phase 5: Live Data Providers

Goal: replace MVP-only mock execution with real backend analytics execution while preserving the frontend contract.

### Required capabilities

- real Snowflake query execution
- read-only secure connection layer
- provider-level query planning to SQL translation
- normalized response parity with mock provider
- caching and response performance strategy
- provider-level integration tests

### Design constraint

The frontend should not need to care whether the provider is `mock` or `snowflake`.

### Exit criteria

- the same analytical authoring flows work against safe live Snowflake-backed data

## Phase 6: Export, Publishing, and Collaboration

Goal: make the system operational as a reporting product rather than a local builder.

### Required capabilities

- polished publish mode
- export to PowerPoint
- export to PDF
- export-friendly table handling
- version history and draft/published distinction
- sharing model and access boundaries
- report/package portability

### Exit criteria

- teams can create, review, publish, and distribute deliverables inside the platform

## Phase 7: AI-Native Workflows

Goal: use AI as a productivity multiplier without making the product architecture dependent on brittle prompt hacks.

### Required capabilities

- create report/page structures from prompts
- recommend analyses from dataset metadata
- generate first-pass narratives from analytical outputs
- propose variable sets, banners, and cuts
- assist with chart and layout styling
- help convert analytical outputs into presentation pages

### Design constraint

AI should operate on structured document, metadata, and analytical models whenever possible, not on unstructured screen scraping.

### Exit criteria

- the assistant can materially accelerate both analysis setup and report-building tasks using first-class product models

## Immediate Build Order

The next coding work should follow this order:

1. Refactor the frontend into domain modules before adding major new features.
2. Stabilize the document model for pages, tiles, elements, and master-page concepts.
3. Stabilize the analytical model for table-first authoring, saved objects, and query editing.
4. Build Displayr-core UI parity features on top of those models.
5. Add Canva-style composition upgrades after the document/editor boundaries are solid.
6. Implement live Snowflake execution only after the analytical contract is stable enough to avoid churn.

## Suggested First Implementation Milestones

These are the most sensible first coding milestones for the repo:

### Milestone A: App decomposition

- extract builder shell, sidebars, inspector, canvas, and modal systems from `src/App.tsx`
- move document seeds and library seeds into dedicated modules
- create feature-level types/helpers where current logic is too UI-coupled

### Milestone B: Document engine

- formalize master page support
- formalize selection model
- formalize object insertion and object inspector behavior
- formalize undo/redo boundaries by domain

### Milestone C: Analytical authoring engine

- formalize saved analytical object workflows
- improve tile query editing surfaces
- strengthen variable-set authoring and row logic
- prepare for recode and significance extensions

### Milestone D: Design system

- elevate themes, palettes, text styles, and presets into reusable editor systems
- add stronger layout tools and grouping behavior

### Milestone E: Provider execution

- implement real Snowflake execution against the existing query plan seam
- add integration tests

## Non-Goals For The Next Pass

To avoid thrash, the next implementation pass should not try to do everything at once.

Avoid combining all of these in one pass:

- frontend architecture refactor
- live Snowflake execution
- advanced statistics
- major Canva-style UX expansion
- export system rewrite

The first serious pass should focus on architecture and editor decomposition so later feature work does not compound the current monolith.

## Definition Of Success

This roadmap is successful if EcoFocus Explore becomes:

- analytically credible enough to replace common Displayr reporting workflows
- visually capable enough to avoid handoff into a separate design tool
- architecturally clean enough to keep extending without the app collapsing under its own complexity
