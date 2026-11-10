# Workspace backup restore investigation

Status: design and executable read-only investigation; **no production restore UI or write API is enabled**.

Base: commit `7f76d4f00a9da0c84d2f5ac59fac9c658153df07` plus `workspace-storage-validation-7f76d4f.patch`. This investigation adds only this document and `workspaceBackupInvestigation.test.ts`. The analysis accuracy/context patches are independent and were not needed for these checks. All datasets are fabricated.

## Existing behavior and reproduced risks

* `WorkspaceSaveRecovery.tsx:downloadBackup` downloads an untagged JSON workspace, including pending in-memory data. `WorkspaceLoadRecovery:downloadStoredWorkspace` downloads the exact stored string. Neither download identifies its storage schema version. A malformed v2 workspace missing `importedDatasets` has the same shape as a historically valid v1 workspace. Trying v2 then falling back to v1 is unsafe. The new test demonstrates rejection as v2 and acceptance as v1 of identical bytes.
* `workspacePersistence.ts:normalizeDashboardWorkspace` calls `mergeImportedDatasets`. A synthetic top-level study and a report-embedded study with the same ID but different respondent values become one study; the report-embedded values win. Validation alone therefore does not prove a lossless restore. This is a passing characterization test of a remaining defect, not a fix.
* `compactImportedDatasetForWorkspace` can omit remote Netlify rows and most fields. A valid synthetic remote backup declares 100 rows but has zero full browser rows. A preview must disclose this dependency; restoration must not claim the file contains all respondents or query a remote service automatically.
* Pending workspace edits, deferred imports, ongoing imports and other tabs can save after a restore. The current save session has no cross-tab transaction or lock. Current localStorage writes plus a separate checkpoint write do not provide an atomic transaction across both keys, and older app tabs would not honor a new lock.
* The existing loader normalizes defaults and does not validate every nested tile/query/connection/reference. Its successful return is necessary but insufficient evidence for allowing an external backup to replace active data.

These findings make a production replacement or merge unsafe under the requirement to preserve all data. Nothing in this patch writes storage, alters current downloads, migrates existing data or enables automatic restoration.

## Proposed user flow

1. Choose **Inspect workspace backup**. Check `File.size` before reading. Initial proposed ceiling: 10 MiB of original bytes; reject empty, oversized or changed-length reads without truncation. The limit is a policy proposal, not an assertion that larger backups are invalid. Show an explanation and retain the original file for offline recovery. A production implementation needs measured memory budgets, cancellation, and bounds on expanded rows/cells/nesting in a worker as well as this byte limit.
2. Retain the original `ArrayBuffer` independently of parsing. Decode strict UTF-8, accept BOM, reject malformed encoding/JSON. Never use a normalized or reserialized object as the original recovery download. A parse error leaves the active workspace untouched and permits downloading the unchanged input bytes.
3. New portable downloads use a recognized envelope, e.g. `{kind:"ecofocus-workspace-backup",version:1,format:"workspace-v2",payload:"<original workspace JSON>"}`. Version and payload format are separate, required discriminators. Reject unsupported versions, malformed envelopes and conflicting format selections. Never retry a failed v2 payload as legacy.
4. Existing untagged downloads require explicit format selection: **Current workspace (v2)**, **Legacy workspace (v1)** or **Legacy single report**. Show why version cannot be determined from the file alone. File names and extensions are hints only. Mark legacy compatibility and all defaults/upgrades in the preview; never silently downgrade validation.
5. Validate outside active storage. Extract a pure parser from persistence before production implementation; do not insert a candidate into localStorage in order to call the loader. The test harness mocks reads only to exercise the existing loader. It is deliberately private to the test and returns summary counts, not a writable workspace.
6. Before normalization, check every collection and identity/reference, including report/draft IDs, page/tile IDs, snapshot references, imported query source/field IDs and complete nested model shapes. Reject conflicting dataset records sharing IDs. Identical repeated legacy copies may be unified only after a proven semantic comparison. Preserve unknown extension data in the original artifact, and refuse versions whose semantics cannot be represented. Compare source and candidate counts/rows/cell values and report every migration/default before accepting.
7. Preview report/study/snapshot counts, names, active report, available versus declared rows and fields, remote dependencies, missing/dangling references, schema/version and migration effects. Render strings through text nodes. Do not render imported HTML or fetch remote connections during preview.
8. Safe first release choices: **Download original copy**, **Cancel**, and, only after losslessness checks pass, **Download converted copy** with a clear migration report. Downloads do not imply the active workspace was restored. The original buffer remains available until dismissal. This investigation does not implement the converted download because the existing normalizer can silently collapse studies.

## Copy versus replacement

**Restore as separate workspace** is the preferred future default, but currently unsupported. The app has one local workspace, so renaming the workspace object does not create isolation. Add named workspace persistence and routing first. Create a separate immutable namespace; retain source IDs within that namespace. Test editor/query IDs are scoped correctly. Do not merge reports into the current workspace by shallow concatenation or regenerate IDs without remapping every reference.

**Replace current workspace** must remain unavailable until all writers use a coordinated persistence layer. Before the final explicit replacement confirmation:

* Require all pending saves, pending/deferred imports and active imports to be resolved; snapshot the complete current in-memory state and preserve all original legacy/current stored values, including damaged or empty raw strings.
* Acquire an exclusive writer transaction honored by all tabs; re-read a revision and reject if state changed since preview. A BroadcastChannel notice alone is insufficient. Older app versions using localStorage require an explicit compatibility strategy; a new Web Lock would not stop them.
* In a transactional store (for example IndexedDB), atomically write an immutable checkpoint and a new candidate revision with an active pointer. On quota/read/write/verification failure, abort the transaction; leave the original pointer and keys unchanged. Do not call the current compactor, which can remove remote field/row data. If the checkpoint cannot fit, fail without replacement.
* Verify stored contents, then update UI/session state from the committed revision. Handle reload/process termination at every boundary. Keep the checkpoint accessible through **Undo restore** and a byte-preserving download after reload. Undo must preserve any edits made after restoration as another checkpoint, rather than overwrite them.
* Never delete checkpoints automatically in the initial implementation. Show storage usage and require explicit management later. Never remove current/v1/single-report keys as incidental cleanup.

The final confirmation should name the current and incoming workspace, counts, remote-data caveats and checkpoint identity, with **Keep current workspace** focused by default. Use the established modal keyboard guard/focus restoration. No replacement action should be offered based only on the read-only harness passing.

## Executable evidence and remaining acceptance

`workspaceBackupInvestigation.test.ts` contains 28 bounded synthetic tests. It checks no writes/removals/clears during preview; explicit v1/v2/single-report formats; damaged JSON/shape and incomplete studies; size rejection before read and exact 10 MiB acceptance; truncated reads and malformed UTF-8; original bytes including BOM/CRLF/unicode; future/malformed envelope versions; compact row decoding and damaged/future row formats; report-embedded legacy studies; and the conflicting-ID/remote-row blockers above. Oversize is a synthetic size/read callback check; it does not allocate an enormous file.

The envelope, limit and inspection function exist only in the test harness as design experiments. These tests do not establish a production restore feature. Existing strict storage-validation tests additionally cover original stored-byte recovery and legacy migrations.

Before enabling writes, add failure-injection tests for all transaction boundaries, quota, blocked storage, revision changes, two current tabs and an older writer, pending imports and navigation races, duplicate/cross-document IDs, all real historical fixture shapes, oversized expanded rows/cells/deep nesting, cancellation, remote-unavailable previews, save/reopen/undo and keyboard/focus behavior. Run native browser acceptance. Earlier native UI testing was blocked by desktop input access denial and an in-app localhost timeout; no native restore acceptance is claimed.


## November 5: portable download implemented; restore remains unavailable

New workspace downloads now use the version-1 `ecofocus-workspace-backup` envelope, with the required `format: "workspace-v2"` discriminator, creation time and a string `payload` containing the complete in-memory workspace JSON. `pendingImportsPayload` separately captures JSON for completed imports retained in the deferred-import buffer. These strings capture the values at download creation. No normalization, compaction, deduplication, validation downgrade or active-storage write occurs during backup creation. Imports whose asynchronous work has not finished cannot be captured.

The inventory lists each study occurrence by workspace/report/snapshot/pending-import scope, declared versus stored rows/fields, preview availability and remote provider. It marks partial/inconsistent row coverage, missing field metadata and configured remote-service dependencies. It never fetches missing data or calls a live service. Conflicting records retain their separate source values; the inventory does not prove they can safely be merged or restored.

A download is available from the workspace header and the failed-save recovery banner. The failed-save copy prefers pending in-memory edits. The UI explicitly states that restore is unavailable and warns about missing data and connected-service dependencies. The damaged-save recovery action still downloads its exact original stored bytes, without an envelope or reserialization. Existing untagged downloads remain valid recovery artifacts but require explicit format selection in a future inspection flow.

This resolves format ambiguity for new portable downloads and provides proactive access. It does not implement inspection, validated conversion, transactional restore, old-tab coordination, automatic backup retention or a remote-data backup service. All replacement/merge safeguards above remain required.
