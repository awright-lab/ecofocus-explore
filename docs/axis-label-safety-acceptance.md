# Saved label dictionary safety

Supported saved-result IDs can have dictionary-like names such as `__proto__`, `constructor` and `toString`. They are valid distinct string identities. Direct lookup in an empty label-override object can return inherited objects or functions rather than authored text. Reproductions against the previous source returned JavaScript's Object function for constructor and caused a document thumbnail to throw on an inherited object.

A shared read-only helper now accepts only an own string override. Canvas row labels, table thumbnails, reconstructed PDF SVG labels, native PowerPoint categories/series, spreadsheet display labels and exported column-label context use it. Missing or nonstring entries fall back to source text. Explicit own overrides, including an own `__proto__` string, remain intact. No IDs, values, bases, queries, label maps or respondent rows are rewritten or migrated.

Existing blank-label policies are preserved: canvas/export paths retain explicit empty strings, while the thumbnail's existing empty-string fallback continues to show source text. Whitespace is not trimmed. The existing shared namespace for row and column overrides remains; this change does not introduce separate role namespaces or infer aliases. HTML/XML escaping remains in the existing rendering/export layers.

## Verification

Tests cover dictionary-like IDs, custom inherited text, null-prototype/shadowed/nonenumerable dictionaries, missing maps, nonstring values, authored empty/whitespace labels and escaped text. Real canvas/thumbnail/SVG paths are exercised. Compatible single-column bar fixtures and multi-column grouped/stacked/line fixtures retain the existing export constraints; near-coincident line value labels are explicitly turned off rather than bypassing fit guards.

An actual App test saves a supported cached-result fixture with dictionary-like IDs, opens its real table, then saves explicit overrides using the real workspace writer and cold-remounts twice. Its imported synthetic1,000-row by30-field study and recorded results remain exact. This is jsdom acceptance; it does not claim that the normal CSV engine generates these IDs (it ordinarily produces suffixed slugs), or that label editing was automated through its UI.

Generated fallback/explicit-override XLSX ZIPs, native chart descriptor XML, table SVG and numeric references are retained for independent standard-library ZIP/CRC/XML checks of source/display labels, series/categories, all six values and all six bases. These are semantic artifact checks, not native Office or browser rendering. Final focused/full/type/build and reference results are in the separate checkpoint packet.

Native browser, PowerPoint/Excel visual acceptance, PDF pixel fidelity and downloads remain unverified. Existing denied socket/upload/PR-description actions were not retried. The improvement is local; it does not complete the broader original goals or change publication/deployment state.
