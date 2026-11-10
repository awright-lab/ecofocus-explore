# Conservative statistical safety remediation

Patch base: exact `7f76d4f00a9da0c84d2f5ac59fac9c658153df07`. No dependency on the separate storage-validation, study-conflict or analysis-accuracy patches. All work is in an isolated archive; no main-worktree, production service, real respondent data, credentials or settings were changed.

## Resulting behavior

* Weighted estimates/counts remain available. Weighted significance is explicitly unavailable: a weighted population total cannot be treated as respondent sample size, and survey design/variance information is absent. Both column and wave inference are blocked. Weighted totals are labeled separately from sample n; base diagnostics decline to assess respondent sample quality from them.
* New unweighted Snowflake results retain full precision from SQL through inference. The SQL no longer rounds percentages before testing. Ordinary display formatting still controls visible decimal places. An explicit `unweighted_full_precision_v1` provenance marker allows the narrow approximate inference path; it is not a certification of the survey design.
* The pooled proportion approximation skips cells unless both observed and pooled expected success/failure counts are at least five, with finite percentages in [0,100] and positive safe-integer sample counts. It does not silently substitute an exact test. Sparse comparisons have no p-value, direction or significance marker.
* Displayed tests identify an independent-sample approximation and lack of multiplicity adjustment. Bare confidence labels are removed from unsupported chart/export contexts. This does not claim validation of independence, clustering, missingness, repeated-wave respondents or a complex survey design.
* Legacy/unverified cached results retain measurement tables/series but lose active significance claims in the load/presentation/export path until an eligible analysis is rerun. Mock aggregate percentages likewise do not receive real inference or placeholder arrows. No source objects or respondent rows are mutated by the safety wrapper; a later ordinary workspace save can persist the suppressed statistics and warnings.
* Live authored nets use one `SUM(CASE WHEN optionA OR optionB ... THEN weight ELSE 0 END)`, counting each respondent once. This works for counts and percentages, weighted or unweighted. Single-select nets retain their equivalent disjoint-category behavior.
* Marginal-only multi-response aggregation is blocked because overlap cannot be reconstructed. Reusing/transformation of a single-select aggregate invalidates the old inference marker and requires a fresh provider analysis, rather than carrying statistical claims from the previous rows.
* Multi-response donuts are removed from metadata/compatible choices and rejected by validation/provider support. The donut renderer also blocks saved multi-response charts, including count metrics, and incomplete percentage partitions (with allowance for aggregate one-decimal rounding error). The message directs the user to bars or tables; data and stored chart choice remain available for correction.

## Evidence and verification

The new `shared/analytics/__tests__/statisticalSafety.test.tsx` suite contains 14 independent synthetic safety checks. It executes the generated SQL against Node's in-memory SQLite after restricted dialect substitutions: the configured table name, cast functions and `100.0` for equivalent fractional division. This checks actual predicates/sums, not only SQL text. It is not Snowflake integration. The SDK is mocked and no connection/executor is invoked.

Fixtures cover weight scales 1/10/1000; an independent Python `math.erfc` pooled-z reference; the 38/104 rounding counterexample; the 0/2 versus 2/2 sparse case; direct executor provenance requirements; immutable cached-data suppression; unavailable inference in exports; overlapping response unions for count/percent; weighted union counts; and new/cached/incomplete-partition donut guards with server-rendered status evidence.

In particular:

* 50/100 versus 60/100 gives approximate p≈0.15521849 when unweighted; none of the common weight scalings produce an inferential claim.
* 38/104 versus 52/104 retains p≈0.05007951 and no significant direction instead of the earlier rounded false positive.
* 0/2 versus 2/2 is not tested by the approximation, avoiding the earlier p≈0.0455 claim (two-sided fixed-margin exact probability is 1/3).
* Three double-selections, one A-only, one B-only and five neither return count 5 and 50%, rather than count 8/80%. A double-selected respondent with weight 3 contributes 3 once.

Existing tests that previously asserted weighted/mock inference or invalid marginal top-box sums were revised to require suppression/blocking. Remaining execution/presentation coverage uses explicit unweighted provider-shaped fixtures; those invented aggregates are rendering tests, not evidence of statistical validity.

Final checks: **266 tests passed, 1 live integration skipped** on the standalone patch. **468 tests passed, 1 live integration skipped** when combined with the prior storage validation, study-conflict, imported accuracy and imported context patches. TypeScript and Vite production builds passed; all patch applications were clean. The combined stack was reconstructed in another isolated archive.

Commands:

```
$env:SNOWFLAKE_VERIFY_INTEGRATION='0'
node ../node_modules/vitest/vitest.mjs run --cache=false --maxWorkers=2
node ../node_modules/typescript/bin/tsc -b --pretty false
node ../node_modules/vite/bin/vite.js build
```

Tests use the available Node 24 runtime, including its experimental built-in SQLite; no production dependency was added. The existing large BuilderApp bundle warning remains.

## Limits and integration

This implements a conservative independent-binomial approximation only for newly verified unweighted provider output. It does not implement design-based variance, effective sample size, replicate weights, exact sparse tests, paired-wave tests or multiplicity correction. The count threshold is an intentionally conservative engineering gate, not proof that every remaining comparison satisfies all statistical assumptions. Source table rows must represent the intended independent respondent units. Weight validity, negative weights and duplicate respondent records remain separate data-quality concerns; this patch does not certify point-estimate validity for arbitrary source data.

The provenance marker records the application path that generated a result; it is not a cryptographic authenticity check for edited external JSON. Older unverified results require rerunning, not automatic recalculation from rounded percentages. Historical raw measurement data is preserved; old unsupported statistics may be removed when the next normal save/autosave occurs.

No remote Snowflake acceptance or native browser acceptance was performed. SQLite verifies the bounded synthetic SQL subset; server-rendered React checks verify the blocked donut message. Native browser interaction was previously blocked by desktop input access denial and an in-app localhost timeout, so no claim of native UI acceptance is made here.

## Primary methodological references

[NIST's pooled binomial proportion test](https://www.itl.nist.gov/div898/software/dataplot/refman1/auxillar/binotest.htm) specifies observation counts and recommends an exact alternative for small samples. This implementation declines sparse tests rather than inventing an exact/design-aware method.

[CDC's variance-estimation tutorial](https://wwwn.cdc.gov/nchs/nhanes/tutorials/varianceestimation.aspx) explains why survey design variables and appropriate variance methods matter for standard errors and inferential claims. The patch therefore suppresses weighted inference; it does not assert that EcoFocus shares the particular NHANES design.
