# Bounded XLSX archive and decoded-part reads

The browser XLSX path now has explicit limits before building a study:

| Scope | Default maximum |
| --- | --- |
| Input archive | 32 MiB |
| ZIP entries | 4,096 |
| One consumed decoded part | 32 MiB |
| All consumed decoded parts | 64 MiB |

These are deliberate compatibility limits: a valid workbook above them can now be refused. The error explains that no study was imported and the original file was kept. Split oversized workbooks or use a smaller exported sheet. Limits can be lowered by an internal caller, never raised above these ceilings through the import API. The effective configuration is captured before awaiting a file read. Other CSV/SAV callers retain their existing behavior; there is no automatic fallback that bypasses these limits.

File size is checked before reading when present and independently checked against the returned buffer. A reported size mismatch fails. Entry count is checked before enumerating ZIP records. Compressed entry ranges must fit the available archive, and entries retain read-only views instead of copying each compressed payload. Selected-part declared sizes are checked against individual and cumulative allowances before decoder construction.

Deflated data is collected into one bounded buffer using stream-reader pulls, replacing whole-response arrayBuffer collection. Actual chunks must fit the declared size; overflow, early EOF and decoder errors reject the import. Failure requests reader cancellation immediately and releases the lock; a rejected or never-settling cancellation does not strand error handling. Stored parts are checked against their actual available byte length too. Existing decoded-size/CRC and duplicate selected-part checks remain in effect. Valid stored/deflated data-descriptor ZIPs and existing row-number compatibility remain tested.

The implementation uses the standard [ReadableStream reader](https://streams.spec.whatwg.org/#default-reader-class) and [DecompressionStream](https://compression.spec.whatwg.org/#decompression-stream). The bounds cover application-owned archive reads, decoded buffers and accepted part totals. They do not bound opaque decoder queues, browser allocation overhead, XML DOM amplification, result/row objects, CPU time or storage capacity. Native cancellation responsiveness, CSP/decoder behavior and low-memory browser acceptance remain unverified. CRC is not source authentication. Goal15 remains partial; this does not enable background XLSX analysis, streaming XML or transactional saves.

Tests use a902-byte synthetic archive containing131,330decoded worksheet bytes and small configurable limits, avoiding large test allocations. The old path collected the complete forged-size worksheet and reached decoder construction for an oversized declaration. New checks cover exact/over-limit boundaries, actual/declared file sizes, aggregate budgets, captured configuration, cross-realm byte chunks, cancellation/read errors, EOF and lock release. Actual App/Home tests reject bad declarations without changing saved/input bytes or pending state, then import a valid1,000x30study, compute means499/500 with base500each, and cold-reopen exact studies and prior reports without a network call.

Full verification, artifacts and backups are recorded in the separate local review packet. Nothing is published, merged or deployed by this correction; native/browser/Office gates remain open.
