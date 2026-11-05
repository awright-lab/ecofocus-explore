# Saved analysis context and reuse

Normalization preserves source references, imported source identity, authored variable-set rows, explicit unweighted settings, and comparison operands in saved calculations. Seeded defaults apply only where settings are absent; imported/live settings are not coerced to seeded question capabilities.

Imported template reuse resolves the exact study and field IDs. Local data uses the imported browser engine; Netlify data uses the imported query endpoint, without uploading local respondent rows. Missing studies, missing fields, conflicting references, unsupported weights/authored rows/wave comparisons, or conflicting generic query settings produce an error before a tile is created. A literal filter value `all` remains a selected value.

The imported query identity records grouping, numeric measure, comparison field and filter. Generic seeded `filters` and `breakBy` must not silently override or broaden it. A legacy question label can be repaired from a surviving imported identity; an already-lost identity cannot be reconstructed safely from a template title. Recreate those templates from their original analytical result.

Covered verification includes save/reopen/query round trips, grouped and all-respondent means, exact filter preservation, saved dependency protection and actual tile-command integration. Remote contract tests use synthetic responses; they do not establish live Netlify or Snowflake correctness. Native browser acceptance of this batch remains unverified because an earlier disposable acceptance tab has a pending JavaScript confirmation that the automation connection could not dismiss.
