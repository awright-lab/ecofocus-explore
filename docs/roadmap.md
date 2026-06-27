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

- Displayr for survey analysis, report authoring, variable logic, analytical workflows, and dashboard publishing
- Canva for page composition, brand/design systems, flexible layout, asset export, and polished visual authoring

## Vision Addendum: InsightCanvas Product Direction

EcoFocus Explore is not only a hybrid of Displayr and Canva. It is an **insight authoring workspace** designed to help teams move from raw data to analytical output, then from analytical output to narrative, presentation, dashboard, and shareable deliverable.

The target end state is:

```text
data -> analysis -> insight -> story -> dashboard/report/presentation
```

This means the product should be planned and evaluated not only as an analysis engine or a composition tool, but as a connected workflow for building insight-driven deliverables.

### Product Modes

The long-term product should support six connected modes over a shared document model:

- `Data`
  - source selection
  - variables/questions
  - filters
  - segments
  - banners
  - reusable analytical inputs and saved analytical artifacts

- `Design`
  - layout
  - composition
  - brand/style systems
  - reusable composition blocks
  - templates, starters, and visual refinement

- `Story`
  - insight blocks
  - KPI strips
  - commentary tied to analytical objects
  - section-building
  - narrative flow
  - suggested story arcs and section-level communication patterns

- `Dashboard`
  - interactive analytical consumption
  - published exploration
  - viewer-side filters, crosstabs, drilldown, and export where allowed

- `Report`
  - client-facing structured deliverables
  - page sequencing
  - master/template behavior
  - reusable sections
  - polished export and publishing workflows

- `Present`
  - presentation-oriented viewing and delivery
  - output optimized for communication and walkthrough
  - presentation-ready formatting and behavior distinct from dashboard exploration

These modes should share core document and analytical objects, while changing the workspace emphasis, controls, and assistant behavior based on user intent.

### Story Is First-Class

The product should explicitly treat **storytelling and insight communication as first-class workflows**, not as an afterthought after charts are created.

That means the roadmap should continue moving toward support for:

- insight callouts
- KPI summary sections
- chart + commentary pairings
- methodology note sections
- comparative takeaways
- section dividers and chapter openers
- structured story arcs across pages/slides
- narrative guidance tied to analytical context

Analytical objects are not the endpoint. They are inputs into story construction.

### Insight Objects Become First-Class Document Objects

Over time, the document model should support not only charts, tables, and design elements, but also richer insight-oriented objects such as:

- KPI/stat cards
- insight summary blocks
- methodology/context notes
- narrative commentary regions
- story-arc or implication blocks
- AI-assisted takeaways with human editing

These should behave as normal editable document objects, not as disposable overlays.

### The Right Panel Evolves Beyond a Generic Inspector

The long-term right-side workspace should evolve toward three connected authoring surfaces:

- `Style`
  - visual design
  - layout
  - typography
  - themes and composition settings

- `Data`
  - source/query
  - banner/filter/weight context
  - comparison setup
  - analytical object settings

- `Insight`
  - takeaways
  - narrative guidance
  - story suggestions
  - section-level communication support

This is not necessarily an immediate implementation requirement, but it is an important product-direction goal that should inform future phases.

### AI Is Embedded, Not Detached

AI should not live only as a later standalone feature. It should eventually be embedded in the core authoring experience where it is genuinely useful.

Target AI-assisted behaviors include:

- suggesting section layouts from analytical context
- recommending story arcs from page content
- proposing KPI summaries and narrative takeaways
- helping convert tables/charts into report-ready sections
- supporting insight drafting while preserving human editorial control

The product should still preserve typed contracts, deterministic rendering boundaries, and explicit analytical truth. AI assists the workflow; it does not replace the underlying model.

### Delivery Modes Must Stay Distinct

The roadmap should continue distinguishing among:

- `Dashboard`
  - interactive exploration and consumption

- `Report`
  - structured client-facing authored deliverable

- `Present`
  - presentation-oriented delivery mode optimized for communication

These should not collapse into one generic “published output” concept. They are related but different end-user experiences.

### Roadmap Implications

This vision implies several ongoing roadmap priorities:

- analytical depth should continue supporting insight-generation workflows, not only raw tabulation
- composition work should continue prioritizing storytelling sections, KPI patterns, and chart+narrative layouts
- publishing/export work should recognize dashboard, report, and presentation as distinct delivery targets
- AI-native work should be framed as embedded authoring assistance across data, design, and story workflows
- future product decisions should be evaluated against the full chain:
  - `data -> analysis -> insight -> story -> delivery`

### Design Standard

The product should feel like a **serious insight workspace**:
- analytical enough for research workflows
- visual enough for polished client communication
- structured enough for repeatable reporting
- intelligent enough to accelerate story construction without hiding the analytical truth

## Core Product Principles

### 1. Query-driven rendering stays non-negotiable

The architectural rule remains:

```text
query definition -> backend/provider response -> frontend rendering
```

Charts, tables, analytical callouts, and derived outputs must be derived from normalized analytical responses rather than hardcoded display artifacts.

### 2. Table-first analytical truth

Displayr-style workflows should treat the analytical table as the canonical object. Charts, summary cards, derived outputs, and presentation variants are usually derived from that canonical table or query result.

### 3. Document-first authoring

The final product is not only an analysis engine. It is also a document builder with pages, layers, reusable components, master pages, and publication/export workflows.

### 4. Metadata shields the UI from raw source structures

Questions, banners, filters, weights, segment definitions, comparison options, and chart compatibility should continue to flow through the shared metadata layer rather than leaking database or SPSS column details directly into the frontend.

### 5. Modular domains over monolithic app code

The product must continue to evolve through domain-level modules with explicit ownership and state boundaries rather than collapsing back into app-wide mixed logic.

### 6. Progressive disclosure over persistent clutter

The product should preserve analytical depth without keeping every control visible at all times. Complex controls should appear when context requires them, while the workspace stays readable and composition-first by default.

## Product Capability Pillars

### Analytical engine

This is the Displayr side of the system:

- dataset ingestion and provider integration
- question and variable metadata
- variable sets
- banners, filters, weights, and segments
- crosstabs and summary tables
- recodes, nets, top box, bottom box, and hidden rows
- trend and wave comparison
- statistical testing and significance annotation
- derived outputs, reusable analytical templates, and derived metrics
- advanced survey-analysis workflows over time

### Composition engine

This is the Canva side of the system:

- page builder and multi-page report structure
- freeform tile placement
- text, image, shape, chart, and table composition
- layers, locking, grouping, and arrangement
- master pages and templates
- brand kits, palettes, and typography systems
- reusable design blocks
- page, object, and asset exports
- export-friendly presentation layouts

### Application platform

This is the structural advantage over both categories:

- typed shared contracts
- provider-neutral backend execution
- normalized response shapes
- modular frontend architecture
- versioning, publishing, sharing, and export boundaries
- persistent report workspace and document management
- AI-assisted workflows over time

## Current State

The repository already has strong early foundations:

- shared analytics contract
- provider boundary with `mock` and `snowflake`
- metadata-driven analytical inputs
- trend-aware query shape
- dashboard/report draft model
- tile and canvas editing
- saved variable sets, banners, filters, weights, segments, templates, and derived definitions
- derived outputs and early significance execution scaffolding

The main current constraints are:

- live provider execution is still incomplete
- multi-document workspace behavior is not yet productized
- published dashboard delivery is still scaffold-level
- export behavior is still partial
- composition UX is improving but not yet Canva-class

## Roadmap Structure

Delivery should happen in structured phases that preserve architecture while steadily increasing product parity.

---

## Phase 1: Frontend Architecture Refactor

Goal: turn the MVP shell into a maintainable platform that can absorb Displayr-scale and Canva-scale features.

### Objectives

- split the app into domain modules
- separate document state from analytics state and UI state
- make placed objects first-class entities
- introduce stable component boundaries for future work

### Exit criteria

- `src/App.tsx` becomes a thin composition shell
- core builder flows are moved into feature modules
- document model and analytics model can evolve independently

---

## Phase 2: Displayr Core Parity

Goal: reach strong parity with the core report-authoring and table-building workflows users expect from Displayr.

### Required capabilities

- report/page tree with robust page management
- dataset explorer and variable explorer
- table-first analysis creation
- variable-set authoring and reuse
- banners, filters, weights, and segment save/reuse flows
- convert table to chart and keep-table-create-chart workflows
- in-place tile analysis editing
- page master behavior groundwork
- publish/share/export workflow scaffolding

### Exit criteria

- a user can build a report in the style of a Displayr dashboard/report without leaving the application

---

## Phase 3: Analytical Depth

Goal: expand beyond MVP analytics into serious survey-analysis authoring.

### Required capabilities

- recode editor
- authored nets
- top box and bottom box builders
- hidden-row and emphasis controls
- improved weighted/unweighted handling
- richer trend and comparison logic
- significance testing scaffolding and initial execution
- calculation-grid-like derived outputs
- summary tables and reusable analytical templates
- saved segment profiles and segment-based output creation
- derived definitions and reusable derived metrics

### Exit criteria

- EcoFocus analysts can reproduce their common reporting logic without fallback to another analysis tool

---

## Phase 4: Canva-Class Composition

Goal: make the report builder feel like a professional design environment rather than an analytics UI with formatting options.

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

### Exit criteria

- a user can create visually polished client-facing pages without exporting to another design tool

---

## Phase 4.1: Workspace Decluttering and Authoring Experience

Goal: reduce workspace clutter while preserving analytical depth.

### Required capabilities

- progressive disclosure for advanced analytical controls
- quieter default workspace chrome
- contextual floating toolbars for selected objects
- collapsible and mode-aware side panels
- clearer hierarchy between page tree, data explorer, canvas, and inspector
- reduced top-bar density and smarter status grouping
- dedicated authoring modes such as explore/compose/inspect behavior
- stronger spacing, hierarchy, and panel ergonomics

### Design rule

The product should feel powerful without looking fully expanded at all times.

### Exit criteria

- common authoring tasks require less scanning
- composition work feels focused rather than crowded
- analytical power remains accessible but no longer dominates the shell by default

---

## Phase 5: Live Data Providers

Goal: replace mock-first execution with real backend analytics execution while preserving the frontend contract.

### Required capabilities

- real Snowflake query execution
- read-only secure connection layer
- provider-level query planning to SQL translation
- normalized response parity with mock provider
- caching and response performance strategy
- provider-level integration tests
- live support for analytical workflows already present in the authoring UI

### Design constraint

The frontend should not need to care whether the provider is `mock` or `snowflake`.

### Exit criteria

- the same analytical authoring flows work against safe live Snowflake-backed data

---

## Phase 6: Export, Publishing, Collaboration, and Delivery

Goal: make the system operational as a reporting product rather than a local builder.

### Scope split

Phase 6 is intentionally divided into four delivery layers so publishing and export do not get treated as one undifferentiated feature.

---

### Phase 6.1: Publishing and Shareable Dashboards

Goal: turn reports into persistent, shareable published deliverables.

#### Required capabilities

- multi-document workspace/project model
- persistent report storage beyond local draft state
- draft vs published report distinction
- published snapshots and version labels
- shareable dashboard URLs
- polished published viewer mode
- dashboard routing and access boundaries
- report-level publish metadata
- basic collaboration-ready document identity and ownership model

#### Optional near-term additions

- simple publish history
- duplicate report/document workflows
- report archive state

#### Exit criteria

- a team can create multiple reports and publish a report to a stable shareable dashboard URL

---

### Phase 6.2: Core Document Exports

Goal: support the main business delivery formats expected in research reporting workflows.

#### Required capabilities

- export whole report to `PPTX`
- export whole report to `PDF`
- export whole report to `XLSX`
- export-aware presentation and table handling
- consistent branding/layout behavior across export targets
- export status and confirmation UX
- document-level export readiness checks

#### Design constraint

Exports must preserve the analytical-document model rather than flattening everything into disconnected screenshots unless the format requires it.

#### Exit criteria

- a complete report can be delivered as PowerPoint, PDF, or Excel from inside the platform

---

### Phase 6.3: Page and Object Exports

Goal: support Canva-style asset-level output in addition to report-level delivery.

#### Required capabilities

- page export to `PNG`
- page export to `JPG`
- page export to `PDF`
- object export to `PNG`
- object export to `SVG` where structurally supported
- table/object data export to `CSV`
- chart/object export behavior that respects transparency, sizing, and branding
- export scope controls: selected object, current page, full document where appropriate

#### Why this matters

This is the bridge between the Displayr side and the Canva side. Users need both full-report delivery and quick asset extraction for decks, email, social, and documents.

#### Exit criteria

- users can export a full report, a page, or a single object in the format most appropriate to the task

---

### Phase 6.4: Advanced Delivery and Explore Mode

Goal: extend published reports into interactive, distributable reporting products.

#### Required capabilities

- explore mode in published dashboards
- click-through analytical drilldown from published visualizations
- viewer-side filter application
- viewer-side crosstab creation where allowed
- export of viewer findings
- embedded dashboard delivery
- optional ZIP/package delivery for assets and data
- stronger access/sharing boundaries
- delivery context for public vs controlled dashboard sharing

#### Dependencies

This phase depends on Phase 5 being real enough that published exploration is backed by live or trustworthy provider execution.

#### Exit criteria

- published dashboards are not just static viewers; users can explore, filter, drill, and export their findings from the shared URL

---

## Phase 7: AI-Native Workflows

Goal: use AI as a productivity multiplier without making the product architecture dependent on brittle prompt hacks.

### Required capabilities

- create report/page structures from prompts
- recommend analyses from dataset metadata
- suggest variable sets, filters, and segment views
- generate draft narratives from analytical outputs
- propose visual layouts based on page intent
- automate repetitive reporting workflows safely
- preserve typed system boundaries and deterministic output contracts

### Exit criteria

- AI helps teams move faster without becoming the product’s source of truth

---

## Delivery Guidance

### Near-term priorities

- finish `Phase 4.1` before broadening composition further
- complete `Phase 5` before attempting true published explore mode
- treat `Phase 6.1` and `Phase 6.2` as the minimum viable reporting product
- treat `Phase 6.3` as the Canva-side export bridge
- treat `Phase 6.4` as the interactive dashboard maturity layer

### Product sequencing rule

Do not build advanced delivery UX on top of fake execution assumptions.  
Publishing, explore mode, and export quality should sit on top of stable provider behavior and stable document models.

### Final end state

The finished product should let a team:

- analyze survey data
- build reusable analytical assets
- compose polished pages
- manage multiple reports
- publish interactive dashboards
- export full reports and individual assets
- share findings without leaving the platform
