# Local CSV background import — goal 15 candidate

## Behavior

Workspace Home offers **Import local CSV** separately from the established configured **Import data** route. The new route reads an immutable file in a module worker, uses the existing CSV parser and inference, and reviews the complete study before an explicit addition. It makes no upload or backend request. Existing CSV/Excel/SPSS configured imports are unchanged.

Reading and parsing have phase labels, not invented percentages. Received rows have a known total and progress indicator. Delivery is capped at 500 rows and 256 Ki characters per packet, with one acknowledged packet in flight. Header metadata is capped at 2 Mi characters. The job rejects malformed, incomplete, out-of-order or oversize transfers and exposes no partial study. Cancellation, route unmount, timeout and worker failures terminate the worker. There is no synchronous fallback that could freeze the page.

The complete study is added through the actual workspace save session. Storage failure retains the additive candidate in pending session recovery, reports the failure, and leaves global Retry/backup controls available. Parsing completion is separate from durable saving. The original file and unrelated workspace content are preserved.

## Limits and compatibility

The new local CSV route accepts files up to 16 MiB, one million rows, 5,000 fields, two million rectangular cells and 128 Ki characters per raw value. A single serialized row must fit the delivery budget. CSV padding and widened ragged rows count toward cells before normalization. These are import limits, not promises that browser storage or subsequent analyses support that size. Full local analysis and active workspace serialization still use their existing paths.

Follow-up amplification guard: the complete expanded row JSON must also fit 16 Mi UTF-16 characters, counting repeated normalized field names, punctuation and escaped values before row objects are constructed. The receiver independently caps aggregate delivered row text. Small input files can therefore be rejected when very long headers would expand excessively. Workspace backup serialization separately counts every raw workspace, report, snapshot, preview and pending copy before allocating payload strings; see `serialization-amplification-guards.md`. These bounds address the reported repeated-key path; they are not a guarantee against platform memory exhaustion or a complete performance/backup architecture.

Parser limits are optional; existing callers without limits retain established behavior. Optional SAV guards cover physical record width, fields, declared/unknown row counts, cells and value width, and propagate budget errors instead of returning a misleading metadata-only success. SAV is not enabled in this new worker route; it retains its configured route. The SAV guards alone are not a complete malformed-file/resource audit.

## Verification

Automated tests cover parser boundaries, parser parity, prototype-like headers, backpressure, transport rejection, lifecycle failures, cancellation before/during reading/parsing/delivery, and the real App workspace session through quota failure, Retry and cold reopen. The recovered study produces the expected local means. Source rows, fields and previews are compared in full; optional undefined properties are omitted in JSON transport, consistent with persistence.

A separate reproducible Node worker_threads check bundles the production worker and receiving job, sends actual immutable files across threads, checks every cell plus metadata/preview parity, records a main-thread heartbeat, and verifies termination after cancellation. Its synthetic studies are 1,250 × 7 and 50,000 × 30. It uses no network connection. Node worker behavior and timing do not establish native browser/CSP behavior or browser performance.

## Open acceptance

Goal 15 remains **partial**. Native browser loading, CSP, cancellation responsiveness, visual/focus acceptance and platform memory/storage limits remain unverified while the prior denied loopback operation is unresolved. Independent review is pending. Full background analysis, XLSX/SAV worker import, responsive large result tables and the complete million-row import/analysis/save/export workflow remain outstanding. Existing profile-worker acceptance does not close these gaps.
