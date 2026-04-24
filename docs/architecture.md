# Architecture Overview

EcoFocus Explore is built around one core rule:

```text
query definition -> backend/provider response -> frontend rendering
```

That rule applies to tables, charts, and trend comparisons. Design settings live on top of query results; they do not replace the analytical contract underneath.

## Current System Shape

### Frontend

- Vite
- React
- TypeScript
- Recharts for chart rendering

The frontend is responsible for:

- builder and published report UX
- authoring flow
- canvas/page/tile design
- rendering normalized analytics responses

The frontend is not responsible for analytics business logic.

### Backend Boundary

- Netlify Functions
- shared analytics contract in `shared/analytics`
- env-driven provider selection

Current backend responsibilities:

- validate the incoming analytics query
- convert it into a provider-neutral query plan
- select the active provider
- return normalized analytics output

### Shared Metadata

The metadata layer drives:

- datasets
- questions
- banners
- filters
- weights
- chart compatibility
- wave comparison availability

This is what keeps raw source columns from leaking into the UI.

## Analytical Authoring Layers

The app now has three meaningful layers of analytical authoring:

1. **Source selection**
   - questions
   - saved variable sets

2. **Analysis setup**
   - banner
   - metric
   - weight
   - filter
   - comparison mode
   - comparison datasets

3. **Reusable analytical objects**
   - variable sets
   - banners
   - filters
   - weights

## Current Rendering Modes

The app currently supports:

- table
- vertical bar
- horizontal bar
- grouped bar
- stacked bar
- line chart
- donut

It also supports:

- authored table rows
- trend / multi-wave output
- in-place tile analysis editing
- published report mode
- presentation package export

## Where The Architecture Is Still Growing

The biggest unfinished architecture work is:

- real Snowflake provider execution
- stronger statistical layer
- richer recode/net/top-box modeling
- real PowerPoint export instead of the current presentation package
