# Development hot reload and preserved workspace revisions

Status: verified local correction candidate, pending independent review. This does not activate transactional storage, durable recovery or restore.

## Reproduced defect

A calculated-metric acceptance run later read an older complete synthetic workspace. Both old and new copies were self-consistent; the older inspection was exactly the pre-source-change copy. Formula integrity checks correctly cannot decide which whole valid revision is latest.

An isolated test fixture mounts the actual App with a fabricated 1,000-row/30-field study and index. Its test controls write a newer synthetic revision through the real workspace writer, then ask a local test-only Vite helper to reload the save-session module. Storage instrumentation records successful revision writes and a document-instance token distinguishes hot replacement from full navigation. The helper is not a product endpoint and is not part of the application build.

| Control | Initial mounted state | Acknowledged foreign save | After real Vite dependency update |
| --- | --- | --- | --- |
| Published previous session code | A=300; index=42.857142857 | A=200; index=25 | Older A=300/index=42.857142857 overwritten into storage |
| Immediate retained guard | A=300; index=42.857142857 | A=200; index=25 | Newer saved bytes unchanged; old mounted state remains protected pending work |

The old-code control retained the same document instance and a navigation record of `navigate`; successful write history changed 300 → 200 → 300. The corrected control records 300 → 200 and no later stale write, including a repeated module update. This reproduces a development cause that matches the earlier regression; it does not exclude every possible production concurrency failure.

## Correction

The session's pending workspace, expected stored version, failure state and subscriptions share retained development memory. Vite hot data receives that memory immediately during evaluation. Retaining it only in a dispose callback was insufficient: Vite can reevaluate a dependency through accepted React boundaries without disposing that dependency. Updated modules create new writer/reader closures around the retained guard, rather than retaining obsolete validation functions.

Production and cold loads start ordinary fresh sessions. Unsupported test/SSR hot shims do not enable retention; incompatible retained memory fails explicitly without restarting saving. Existing tabs created before this correction cannot retroactively recover a discarded baseline. Preserve their copies and cold-open the reviewed saved workspace before continuing development.

## Verification and limits

Ten new regressions cover replacement with and without disposal, pending conflicts, subscriptions, repeated updates/retries, transient quota failure, own acknowledged versions, fresh cold sessions, disabled hot runtime, incompatible retained memory and complete newer study/formula/page preservation through the actual local writer. Existing concurrency tests remain applicable. Final full-suite and build results are recorded in the review packet.

Native old-code and corrected controls use the same real App and synthetic fixture on separate loopback origins. The corrected saved body is byte-identical before/after repeated hot updates. Fresh cold opening preserves the complete encoded study, formula pages and saved calculation library. The only raw cold differences are report update time and conservative normalization of the original response analysis's inference/warning context. Values, bases, source query, data, formula and layout do not regress.

The original three-page calculation workflow separately passed frozen-code cold reopen with exact entire inspection content and retained-stale-tab navigation protection. Independent review accepts f1bab737 within development-lifecycle scope after 13 checks and verification of corrected bytes and three frozen captures. These are sequential and development-lifecycle checks. The active localStorage writer still cannot atomically compare/write between simultaneous tabs, and pending memory still does not survive a browser crash. Native Office rendering, OS downloads, remote services and production cloud authorization are not implied. Goal21's original criteria are reconciled separately in its acceptance document; final original-goal acceptance remains for the coordinator. No merge or production deployment.
