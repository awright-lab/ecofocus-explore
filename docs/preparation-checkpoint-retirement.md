# Managing the eight preparation checkpoint slots

The preparation tool now offers **Free a checkpoint slot safely** next to its existing backup-file controls. Users can retire one browser checkpoint only after inspecting its matching backup file and explicitly checking the acknowledgement. Studies, saved reports, published snapshots, active preparation history and unapplied editor choices are not removed or marked saved.

## Workflow

1. Select a checkpoint and request its download. Confirm that the unencrypted file arrived and keep it private.
2. Select that file through **Checkpoint backup file**. File inspection does not import or apply anything automatically.
3. Acknowledge that the inspected file is retained and request **Remove backed-up browser checkpoint**.
4. The action validates the report, identity, format and exact current raw checkpoint bytes against that file immediately before removal. Another identity, changed contents, invalid file, missing or unreadable record refuses before removal.
5. On confirmed removal, the list refreshes and the selected checkpoint clears. A freed slot can hold a newly saved recipe or an explicitly imported backup. Import still creates a separate identity and enforces the existing eight-checkpoint limit. Restore still verifies the exact original study.

No checkpoint is evicted automatically. Unreadable records remain in storage and count toward capacity; this feature deliberately cannot delete them. A downloaded file alone is not sufficient acknowledgement: the file must be selected and read back through the inspector. Confirmation is bound to its exact inspected text and the current report/selection context, and is invalidated by another file or a selection round-trip.

Removal controls remain present while their availability changes, preserving focus. The acknowledgement and action are explicitly gated rather than deleting during file inspection, report navigation, restoration, saving or a selection change. Other checkpoints and workspace keys are untouched.

## Preservation and limits

This operation uses the existing synchronous localStorage model. The final comparison and removal are not a transaction across tabs or processes. Close other editing tabs first; no atomic compare-and-delete, crash durability, storage-capacity or browser-policy guarantee is claimed. Normal checkpoint writers use fresh immutable identities, but arbitrary external same-key writers are outside this protocol. The eight-slot admission checks remain unchanged; cross-tab simultaneous admission is not newly certified.

If removal or its acknowledgement fails, the tool reports that removal could not be confirmed, clears the acknowledgement and asks users to refresh the list. It does not automatically retry, overwrite or reconstruct a record under an existing identity. The inspected file remains available for explicit import. If the browser removal was confirmed but list refresh fails, the message distinguishes those two outcomes.

Checkpoint files contain unencrypted response codes and editor text, not complete study tables. Keep the original workspace backup and original study separately. This feature does not change that privacy model or activate transactional workspace recovery.

Synthetic model tests cover exact matching, refusal paths, lost/failed removal acknowledgement, recovery from the retained file and eight-slot reuse. Component tests cover consent binding, file replacement, changed browser contents, conditional focus and no automatic retry. The actual App journey fills eight slots, retires a backed-up copy, saves into the freed slot, refuses a ninth import, reimports the old recipe after another explicit backed-up removal, and restores it after same-process reopen while preserving the entire saved workspace and seven other original checkpoint byte strings.

Native file-picker/download, browser restart, assistive technology, quota/crash and real multi-tab acceptance remain unverified. Original goal 11 remains partial. The production build remains unverified after the earlier EPERM and is not retried. No publication, merge or deployment is performed.
