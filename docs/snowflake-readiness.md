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
- `snowflake` validates configuration, exposes readiness status, and throws a deliberate not-implemented error instead of pretending to run

That means the app is safe to configure for Snowflake readiness work without implying that live execution is already finished.

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

## Current Analytical Features The Provider Must Support

The live Snowflake provider will need to support:

- single-select summary and banner cuts
- multi-binary variable-set style questions
- saved/authored variable-set rows
- weighted and unweighted metrics
- wave comparison queries
- normalized table-first responses for the frontend

## What Is Still Intentionally Not Implemented

- Snowflake driver dependency
- connection lifecycle / pooling
- SQL generation from query plans
- read-only role verification
- secure secret-management guidance for deployment environments
- real statistical testing
- full production filter execution parity

## Recommended Next Integration Steps

1. Add the Snowflake SDK dependency and connection utility.
2. Translate `AnalyticsQueryPlan` into read-only SQL.
3. Return the same normalized `AnalyticsQueryResponse` shape as the mock provider.
4. Verify weighted output conventions with EcoFocus stakeholders.
5. Add provider-level integration tests against a safe non-production Snowflake target.
