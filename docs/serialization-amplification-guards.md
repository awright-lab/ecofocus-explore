# Expanded data and backup serialization limits

## Problem and behavior

A small CSV can expand dramatically when a long header becomes an object key in every response. Packet-size limits do not bound the whole transfer. A raw workspace backup can repeat those keys again in previews, report copies, snapshots and pending imports. Counting only input file bytes, rows or cells misses this amplification.

The optional parser budget now counts the expanded compact row JSON before building row objects: normalized keys, escaped string values, punctuation, padding and all rows. The local CSV worker applies a 16 Mi-character limit; its receiver independently counts the aggregate received text, including inter-packet delimiters. An over-limit study produces an error without importing a partial study. Existing configured imports without this optional budget retain their existing parser behavior. SAV callers that explicitly opt into the expanded budget receive the same guard rather than a metadata-only success.

Worker metadata and each field are also measured against the remaining header budget before native JSON serialization. Duplicate-header notes can repeat long names independently of the row payload; a post-serialization length check alone would allocate that expansion before rejecting it.

Raw backup creation now measures the complete workspace and pending-import collection before native JSON serialization. Every alias/copy is counted, including previews and conflicting scoped studies; no identity-based deduplication is used. The combined raw representation is limited to 16 Mi UTF-16 characters, two million visited values/properties and 96 levels of nesting. The final compact version-1 envelope, including inventory and escaped payload strings, is separately limited to 32 Mi characters. The download uses that compact envelope rather than unbudgeted pretty printing.

Within those limits the backup payloads retain their existing exact native JSON representation and format/version. No rows, metadata, scope conflicts or pending imports are truncated, normalized, merged or compacted. The size check emits no JSON output and does not run accessors or custom serialization methods. Unsupported non-JSON objects, cycles and excessive nesting/work are refused. String sizing handles JSON escapes and well-formed surrogate serialization without allocating escaped strings; repeated property-name sizes are cached within a bounded cache.

Oversized backups now fail explicitly before a download is prepared. Stored workspace data and session recovery remain unchanged. Keep the current tab, original study files and prior backups. This safeguard can refuse workspaces whose raw backups previously had no limit. It does not add splitting, streaming, compact recovery formats or restoration. Raw damaged-save downloads remain a separate byte-preserving path.

## Verification and limits

Regressions use a roughly 112 KB CSV with a 100,000-character header and 6,000 short rows. Its theoretical repeated-key output exceeds 600 million characters. The parser/worker refuses it before row-object creation/delivery. Existing-workspace backup tests construct small object/reference fixtures and replace native serialization with a throwing sentinel: the oversized case must fail before native JSON is called, so regression failures cannot accidentally allocate the giant string. Aggregate report, snapshot, preview and pending scopes and inventory-only scope amplification are tested separately.

A seeded plain-data oracle checks the size counter against native JSON on small fixtures, including aliases, sparse arrays, undefined omissions, special keys, controls, Unicode and lone surrogates. Boundary tests verify exact-limit success and one-character overflow. Component checks confirm failed backup creation prepares no URL/download and preserves pending recovery. Existing lossless backup, import, inspection and save/reopen tests continue to apply.

These are explicit work/output bounds for supported plain JSON data, not a universal browser memory guarantee. The counters and backup creation remain synchronous and can still take time near their limits. UTF-8 file bytes can differ from UTF-16 character counts, and the backup inspector retains its existing file-size limit. Full browser worker/CSP/performance, low-memory devices, native downloads and broader large-study lifecycle acceptance remain open. Goal 15 remains partial.
