# Snowflake Readiness

EcoFocus Explore is ready for a real Snowflake handoff at the architecture level, but it still uses mock analytics data by default.

The important thing is that the provider seam is now explicit and testable:

```text
Netlify function
  -> validateAnalyticsQuery
  -> createAnalyticsQueryPlan
  -> getAnalyticsProvider
  -> provider readiness check
  -> provider.runQuery
  -> normalized AnalyticsQueryResponse
```

The frontend still talks only to the analytics endpoint. It does not know whether the active provider is mock or Snowflake.

## Current Provider Status

Supported providers:

- `mock`
- `snowflake`

Current behavior:

- `mock` is fully functional for local MVP work
- `snowflake` validates configuration, exposes readiness status, and can execute the first live table-first query shapes against a configured Snowflake table/view
- unsupported Snowflake query shapes fail explicitly instead of silently falling back to mock data

That means the app is safe to configure for Snowflake readiness work while keeping live coverage honest and intentionally narrow.

## Required Environment Variables

When `ANALYTICS_DATA_PROVIDER=snowflake`, the provider expects:

- `SNOWFLAKE_ACCOUNT`
- `SNOWFLAKE_USERNAME`
- `SNOWFLAKE_PASSWORD`
- `SNOWFLAKE_WAREHOUSE`
- `SNOWFLAKE_DATABASE`
- `SNOWFLAKE_SCHEMA`
- `SNOWFLAKE_ROLE`

Optional:

- `SNOWFLAKE_AUTHENTICATOR`
- `SNOWFLAKE_ANALYTICS_TABLE` defaults to `SURVEY_RESPONSES`
- `SNOWFLAKE_QUERY_TIMEOUT_MS` defaults to `30000`

If required variables are missing, the backend now fails early with a clear message listing the missing env vars.

## Current Query Planning Shape

`shared/analytics/queryPlan.ts` currently produces provider-neutral execution intent for:

- dataset
- question / variable source
- breakout dimension
- filters
- metric
- weight
- confidence level
- comparison mode and datasets

That is the contract the Snowflake implementation should translate into SQL.

## Expected Snowflake Data Shape

For the current MVP features, a read-only Snowflake view or modeled table should expose fields equivalent to:

```text
respondent_id
survey_wave
generation
region
shopper_segment
weightvar
q_packaging_trust
q_sustainability_importance
Q15r1
Q15r2
Q15r7
Q15r8
Q15r9
```

The exact physical names can differ, but the metadata layer must keep mapping app IDs to Snowflake source columns.

## Current Live Snowflake Support

The first live provider path supports:

- table-first single-select questions
- table-first multi-binary variable-set questions
- summary and banner cuts represented by the current metadata
- dimension filters such as generation, region, and shopper segment
- one validated metadata-backed question filter per query
- weighted and unweighted `column_percent`, `percent_selected`, and `count` metrics
- normalized response parity with the frontend `AnalyticsQueryResponse` contract

The provider also preserves the existing significance metadata contract. Column-comparison significance can run for supported breakout percent results after Snowflake rows are normalized; wave significance remains a structured deferred/unsupported path.

## Operational Safety

The Snowflake path is intentionally read-only and constrained:

- generated SQL is `SELECT`-only and refused if it contains statement separators, comments, or mutating operation keywords
- configured database/schema/table/warehouse/role names are validated before SQL generation
- unsupported query shapes return explicit Snowflake provider errors rather than falling back to mock data
- query execution is wrapped in a provider timeout
- SDK execution failures are surfaced as structured Snowflake provider errors
- empty, duplicate, or unrecognized Snowflake result rows produce normalized warnings instead of silently disappearing

## Analytical Features The Provider Must Continue To Expand

The live Snowflake provider will need to support:

- broader saved/authored variable-set row execution
- wave comparison queries
- multiple simultaneous question filters
- production parity checks for weighted output conventions

## What Is Still Intentionally Not Implemented

- read-only role verification
- secure secret-management guidance for deployment environments
- connection pooling beyond per-query SDK execution
- Snowflake-backed wave comparison execution
- full production filter execution parity for multiple question filters
- broad statistical testing beyond the current narrow column-comparison path

## Recommended Next Integration Steps

1. Verify the configured Snowflake table/view exposes the expected metadata-backed columns.
2. Add provider-level integration tests against a safe non-production Snowflake target.
3. Verify weighted output conventions with EcoFocus stakeholders.
4. Expand live support for wave comparisons and question-filtered queries.
5. Add read-only role and warehouse/timeout hardening for production deployment.
