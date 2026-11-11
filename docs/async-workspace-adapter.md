# Asynchronous workspace adapter preparation

This batch prepares application consumers for asynchronous persistence. It does
not change the active store, select a durable authority, migrate existing data,
or remove the current localStorage capacity limit. The IndexedDB groundwork
remains inactive. No cloud upload or cleanup is introduced.

## Application boundaries

- App awaits `loadAsync` before mounting Home or Builder. A generation guard
  rejects late startup/route replies after a newer route, explicit workspace
  change, or unmount. Load failures show recovery instead of falling back to a
  second reader. Builder receives the loaded workspace from App.
- Save callers await their own `saveAsync` acknowledgement before saved feedback
  or consequential navigation. Mutation ownership also checks current route,
  selection, edit version, or workspace identity as applicable. Cancellation
  revokes UI ownership; it cannot undo an already committed transaction.
- Destructive changes keep their pre-operation recovery workspace and apply to
  the screen only after acknowledgement. Failed writes do not authorize deleting
  the retained original.
- Route departure captures editor changes synchronously before the asynchronous
  save. Unload protection never relies on a newly started async write completing.
- Recovery retry and saved-copy inspection/download use asynchronous adapter
  boundaries. Ownership-token reads do not adopt a newer write baseline.
- Fast Refresh effect replay does not reopen an initialized route or clear
  pending operation owners on a preserved component. Real unmount and route
  changes still revoke UI ownership. Recovery mutations are unavailable
  during route loading, and the previous route's recovery revision is invalidated.

The production adapter still calls the existing synchronous legacy reader/writer
inside these async methods. Its exact-version stale-save guard and hot-refresh
memory remain unchanged. The synchronous methods are retained for compatibility
with existing tests and standalone Builder consumers, not for the main App route.

## Remaining activation work

Before changing the active store, finish the gates in
`safe-large-workspace-authority.md`: explicit authority and active-head selection,
immutable migration archives, recovery/conflict resolution, mixed-version
fencing, and native IndexedDB large-save/cold-reopen/crash/multi-tab acceptance.
The existing deferred-import/history recovery components also need a separate
review of their in-flight Fast Refresh lifecycle; this batch does not claim to
complete that pre-existing recovery workflow.
The durable adapter must expose pending work synchronously before its first await,
report saved only after authoritative commit, and preserve exact retry identity.
Its richer results must map explicitly: only `saved` acknowledges success;
staged, superseded, conflict, and uncertain outcomes must not become truthy
boolean success. The synchronous ownership-token API also requires an adapter
contract; it is not a fresh IndexedDB read or a replacement for transactional CAS.
JS DOM delayed-acknowledgement and actual React Refresh runtime tests do not
establish native-browser, disk, or crash durability.
