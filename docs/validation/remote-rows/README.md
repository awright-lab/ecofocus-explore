# Remote row inspector: adapter boundary and validation

This is a reusable, read-only component, not a production integration. No production provider or route is installed. Without an injected supported provider, the inspector explains that remote inspection is unavailable. The existing complete-local inspector and remote field catalog are unchanged. The isolated SQLite prototype branch `feat/synthetic-large-dataset-slice-20261112` was not advertised by origin and commit `12d68ed` was not present in the local object database at implementation time. Its contract could not be inspected, so this interface does **not** claim compatibility with its cursors, revisions or responses.

An adapter supplies `schema` and `rows` methods. Each receives dataset ID, dataset revision, schema revision, an opaque cursor, limit, byte limit and abort signal; row requests additionally specify exact ordered field IDs. Responses echo the source, request cursor, next cursor, and bounded items; rows also echo the exact ordered columns. Missing properties, empty strings, `null` and finite numbers remain distinct. Each row must carry a stable unique row identity (`position`) separate from its selected values; it is not inferred from those values. A real SQLite-prototype adapter must map the prototype’s schema pages into this field-page contract, bind and map cursors to both dataset/schema revisions and the requested query, preserve that independent row identity, and enforce the byte cap **before decoding** the response. The UI checks the decoded payload again; that second check cannot prevent a nonconforming provider from downloading or allocating an oversized response. Real adapters must be reviewed for streaming/transport limits and service-specific authorization before use.

The inspector displays at most 25 rows and eight chosen fields; a schema page holds at most 40 fields. It keeps at most three cached row pages and ten cursor positions per navigation history. It never fetches all pages, promises totals, searches respondent values, sorts, exports, saves, or changes reports and analyses. A source revision or provider change invalidates visible results and selections. This is a cursor-based bounded viewer; after history eviction, an earlier cursor is no longer available until refresh. Limits are client policy, not a backend capacity claim.

The synthetic provider is imported only by tests and the development-only harness. It produces requested slices on demand. The Chromium run in `results.json` used a logical 1,000,000 rows by 10,000 fields, generated at most 25 rows and 40 fields per request, requested one field, and rendered 25 rows. The three-page cache and ten-cursor history are implementation limits; the test suite checks eviction. These are simulated client bounds, not a measurement of a server or real-data capacity.

To reproduce with local dependencies and Chromium:

```sh
PLAYWRIGHT_MODULE=/path/to/playwright CHROMIUM_EXECUTABLE=/path/to/chrome node docs/validation/remote-rows/verify-browser.mjs
npx vitest run src/features/data/remote-rows/__tests__ --maxWorkers=1
npm run typecheck
npm run build
```

Chromium tested the standalone development harness, paging, empty-string inspection, keyboard activation and Escape/focus restoration, narrow layout and native 200% zoom, with non-local requests blocked. Screenshots are included. It did not test a real service, the actual production app integration, or a screen reader.

Final checks on main `98f5544d7a9e6f1c3a80c68d0abe9c64a23c65a3`: 17 focused tests passed; the full suite passed 5,750 with four skips (425 files passed, two skipped); typecheck, build and diff checks passed. The skips were optional offline raster/document generation, two optional PowerPoint visual tests, and opt-in live Snowflake integration. The build emitted a large-chunk warning. For the full run Snowflake credentials and `SNOWFLAKE_VERIFY_INTEGRATION` were unset and `SF_OCSP_RESPONSE_CACHE_SERVER_ENABLED=false`; no live Snowflake verification was performed.

The selected-field list exposes a remove control for every selected field even after its schema page falls out of the bounded history. Synchronous provider exceptions are converted into retryable errors. Integration with the separate SQLite prototype remains untested; no compatibility is claimed.

Follow-up validation: 20 focused tests passed; 72 focused and local-row app tests passed across five files. The isolated full suite passed 5,753 tests with four skips (425 files passed, two skipped). Typecheck, build and diff checks passed; build retained the large-chunk warning. Chromium reran the standalone synthetic harness, not a real server or screen reader. The first full-suite attempt ended without a summary; the monitored rerun produced the totals above. Live Snowflake remained disabled and no Snowflake tests were added.
