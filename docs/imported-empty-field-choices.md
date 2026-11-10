# Distinguish empty imported-field choices from real IDs

A valid restored field can have ID `none`. Previously optional field selectors used that same string for No filter, No group and the numeric placeholder. That could block an unfiltered analysis, show a numeric placeholder instead of its real field, and silently drop an explicitly selected `none` filter after metadata removal.

Guided creation and imported-result editing now represent empty optional selections as null in UI state. A DOM-only empty option value is chosen to avoid all current field IDs and any retained missing ID; ordinary non-colliding selectors keep their previous DOM value. Field IDs in data, query objects and saved results stay unchanged. No storage migration or field renaming occurs. Actual `none` references must resolve uniquely; removal, ambiguity and unavailable filter values block preview/update until the user replaces or explicitly clears the constraint.

Tests cover real and candidate-looking reserved strings, metadata insertion/removal, selecting/clearing filters and breakouts, numeric display, stale selections and original-source preservation. Real App create/save/reopen checks verify raw IDs and exact counts. Empty-string optional references are malformed (saved fields require nonempty IDs) and refuse safely. The synthetic all-respondents grouping identifier and sample-library selectors are outside this change.

This is a local analysis-authoring correctness/usability fix. It does not complete remote field enumeration, native browser accessibility, background computation or transactional save goals. No live service, production data or permission change.
