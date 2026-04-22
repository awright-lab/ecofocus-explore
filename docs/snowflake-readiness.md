# Snowflake Readiness

EcoFocus Explore is prepared for Snowflake through a provider boundary. The app still uses mock data by default, but the serverless function no longer calls mock analytics directly.

## Provider Selection

Set `ANALYTICS_DATA_PROVIDER`:

```text
ANALYTICS_DATA_PROVIDER=mock
```

Supported values:

- `mock`
- `snowflake`

The Snowflake provider currently validates configuration and then returns a not-implemented error. This is intentional until real read-only Snowflake credentials and table/view names are available.

## Current Backend Flow

```text
Netlify function
  -> validateAnalyticsQuery
  -> createAnalyticsQueryPlan
  -> getAnalyticsProvider
  -> provider.runQuery
  -> normalized AnalyticsQueryResponse
```

The frontend should not know which provider is active.

## Query Plan

`shared/analytics/queryPlan.ts` converts a validated query into provider-neutral execution intent:

- dataset
- row variable or variable set
- column/breakout dimension
- filters
- metric
- weight

This is the shape the Snowflake provider should eventually translate into SQL.

## Expected Snowflake Shape

For the current MVP features, Snowflake should expose a read-only analytical view with columns like:

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

The exact names can differ, but metadata must map EcoFocus Explore IDs to Snowflake source columns.

## Weighting

Weighted percentages should be calculated backend-side.

For a binary selected/not-selected variable:

```text
sum(weight where selected)
/
sum(weight where eligible)
```

For unweighted output:

```text
count(selected respondents)
/
count(eligible respondents)
```

We still need confirmation on EcoFocus reporting conventions for whether displayed bases should be weighted, unweighted, or both.

## Not Implemented Yet

- Snowflake driver dependency
- SQL generation
- connection pooling/reuse
- read-only role verification
- real significance testing
- real filter application in mock provider
- trend/wave comparison
