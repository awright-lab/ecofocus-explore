# Numeric relationship exploration - original goal 22 review candidate

Original goal: examine relationships and build models with clear diagnostics, distinguishing association from causation. This is a bounded temporary local OLS workflow; independent original-goal acceptance is pending. It does not complete complex-survey inference, model persistence, model exports, remote execution or causal analysis.

## Application workflow

In a report, open **Find a tool → Analyze → Explore numeric relationships**. Choose a complete local-file study, a quantitative numeric outcome and one to six numeric predictors. The initial study prefers a study used by the report. Identifier/system fields are excluded. Field labels and exact raw columns are visible; a number used as a category code is not automatically a quantitative measurement. Optional saved audiences retain their source import identity. Search matches measurement labels and raw columns, shows up to 200 matches and retains selected fields.

Review the explicit method, units and limitations, then fit. Complete-case preparation yields to the UI every 500 rows; fitting runs in a module worker. Cancel terminates pending work; failures preserve choices and support retry. Settings/source changes invalidate pending or completed diagnostics. A replaced import requires an explicit review/reset. Closing or reloading clears the temporary model. No report, study, analysis, recovery storage or backend is written by this tool.

## Method and diagnostics

- At most 25,000 source rows, one to six distinct numeric predictors, at least 50 complete audience cases and three distinct complete outcome values. These product bounds do not establish statistical reliability.
- Complete-case exclusion, with audience excluded/unknown counts and per-field blank/non-numeric counts. No zero imputation. Existing import numeric parsing handles supported currency/thousands/percentage/scientific forms; percentages are percentage points. Values beyond absolute 1e12 are refused explicitly.
- Reproducible xorshift32/Fisher–Yates shuffle with an integer seed 1–4294967295, approximately 80% training/20% holdout. Centering/scaling and Householder QR include an intercept; constant/near-resolution columns and dependent designs fail explicitly. No normal equations or automatic predictor selection.
- Original-unit slopes, standardized training associations and VIF describe the fitted conditional associations. They are not causal effects or driver-importance rankings. No p-values or confidence intervals are produced.
- Training and held-out R², RMSE, mean absolute error and training-mean baseline RMSE are separate. Adjusted R² is training-only. R² uses each split's own outcome mean; negative scores stay negative and constant split outcomes show unavailable R². The baseline always uses the training mean.
- Residual-versus-predicted, actual-versus-predicted and residual-versus-import-position views use all cases for axis extents, display up to 500 cases with extrema and disclose subsampling. Every numeric case is accessible in a paginated table, sortable by absolute error. Training leverage is clearly distinct from actual influence; holdout rows have no training leverage. Outside-training-range cases are counted.

Weights, survey design, clustered/repeated observations, time-dependent splitting, inference, causal identification, external validation and general model families remain unsupported. Repeatedly tuning against a holdout risks overfitting it. Residual plots do not certify normality, independence or constant variance.

## Integrity and verification

The worker receives only selected numeric cases and a split seed. Exact selected raw strings, field/study metadata, audience definition and membership are checked before accepting results and while displaying them. This detects ordinary source/configuration drift; it does not authenticate the dataset or defend against a compromised runtime. Excluded rows' unselected values do not affect the fitted cases.

Numeric reference tests compare an independently generated original-unit NumPy SVD fit, deterministic split, coefficients, standardized associations, VIF and split metrics. An analytically generated [NIST Wampler1 reference](https://www.itl.nist.gov/div898/strd/lls/data/Wampler1.shtml) is checked at documented binary64 tolerances. This is not NIST certification or proof for every dataset. Numerical guards also cover scaling/permutation/offset invariance, rank/finite failures, negative/undefined holdout scores and the 25,000-row/six-predictor boundary. The [NIST residual-analysis guidance](https://itl.nist.gov/div898/handbook/pmd/section4/pmd44.htm) informed the diagnostics.

Fifty-two focused numerical, real-job and component tests passed. The final full suite passed 1,893 tests with two existing skips; exact logs and source backup checks are recorded in the private review packet. TypeScript and production build passed, including emitted worker assets. Existing large-chunk warning remains.

Actual App/native browser acceptance imported and saved a fabricated 1,000-row/30-field study, opened the real command, fitted through the real worker, inspected 800/200 training/holdout diagnostics, changed to a saved 500-row audience, invalidated old results and fitted 400/100 rows. Delete/Escape and cold reopen preserved the entire saved study, report pages, audiences and snapshots exactly: 493,267-byte inspection JSON matched before/after/reopen. The temporary model reset as disclosed. Cancellation, worker refusal/retry and in-place source drift are covered by component/job tests; this does not claim native-browser acceptance of every injected failure, all browsers, remote/live Snowflake or Office/download paths. Independent acceptance remains pending.
