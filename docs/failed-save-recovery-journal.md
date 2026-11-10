# Failed-save recovery journal

This slice is recovery protection, not the authoritative IndexedDB writer or a storage migration. The existing localStorage save outcome, stale-version guard, pending memory and retry behavior remain authoritative and unchanged.

## Product behavior

When the browser save session cannot save, or explicitly remembers unsaved edits, it immediately serializes the full recovery workspace and asynchronously stages that captured copy in a separate `ecofocus-failed-workspace-recovery-v1` IndexedDB database. Successful main saves do not create recovery copies. Failed destructive operations retain their supplied pre-operation recovery workspace, not the destructive target. No journal operation changes localStorage, commits an authoritative workspace head, or clears another editor's draft.

The existing failure notice distinguishes retaining, retained and failed recovery. Retained is shown only after the stage transaction completes with strict durability requested. The main save continues to be failed. A capture is not protected against tab loss before that acknowledgement. Browser eviction, clearing site data, unavailable storage or device loss can still lose a copy; it is local and unencrypted, not a cloud backup.

Each editor lifetime receives an independent random identity; capture sequence prevents an older stage from replacing newer same-editor content. Old completions cannot describe newer captures as retained. Retry uses the exact original draft identity and payload. Stalled storage holds at most one in-flight capture and the latest captured payload; intermediate edits are coalesced rather than queued as unbounded full copies. JSON serialization preserves the complete original workspace, including unknown extensions and current/historical rows, inside the validated envelope. Capture time is additional envelope metadata. No respondent content is logged.

The recovery-only database holds at most 50 unresolved editor/workspace drafts and 16 Mi UTF-16 code units of payload text in aggregate (roughly 32 MiB for the string contents, excluding implementation overhead). Limits are checked inside the same write transaction. A later same-editor capture may replace that editor's older copy; no other copy is evicted. At capacity or quota failure the latest full workspace remains in session memory and the UI offers a direct backup and recovery retry. Copies are not silently removed after a successful main retry because newer tabs may still need them. There is intentionally no automatic retention cleanup or destructive management in this slice.

At startup the existing recovery dock discovers pending copies across all workspace IDs, even if the legacy workspace cannot load. It never chooses or restores a candidate. Downloads preserve the exact pending record and opaque payload, including a valid-metadata record whose workspace payload cannot be decoded. Invalid record metadata or inaccessible storage causes an inspection error, not a false empty inventory. An earlier successfully inspected list remains available after a refresh failure. Downloads are recovery archives, not an automatic restore workflow.

## Verification and remaining gates

Synthetic tests exercise failed primary writes, conflicts, safe pre-removal recovery, capture mutation, full 1000-row data and historical/unknown content, retry identity, stale acknowledgement, bounded repository requests and transaction completion, read-only discovery and exact downloads. Repository event tests deliberately probe event ordering; they are not an IndexedDB emulator and do not establish browser disk persistence or native multi-tab atomicity.

Before broad beta acceptance, use the permitted hosted browser preview to verify actual IndexedDB transaction completion, tab close/reopen, two simultaneous editors, unavailable/quota storage, download bytes and an older preview running alongside the new version. A recovery-only database avoids changing the authoritative format, so older versions neither read nor overwrite these copies. Do not infer that a browser test on one engine proves every engine's durability implementation.

Authoritative migration remains a separate gate: async initial boot and route ownership, the remaining synchronous BuilderApp and WorkspaceHome writes, retry and beforeunload handling, explicit conflict/recovery resolution, mixed-version write fencing, and native browser acceptance must all be completed together. This slice does not claim goals 1-3 complete or enable dormant migration code.
