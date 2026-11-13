# Safe large-workspace persistence groundwork

## Scope and current product behavior

This batch does **not** activate IndexedDB as the product's authoritative store.
`App`, `BuilderApp`, `WorkspaceHome`, and the active localStorage save adapter are
unchanged. No automatic quota fallback, migration, restore, cleanup, cloud upload,
or authority-selection marker is introduced. Real workspaces are not touched by
the synthetic validation. The application's current localStorage size limit is
therefore not removed by shipping this groundwork alone.

## Explicit authority inspection

`inspectWorkspaceAuthority` requires an explicit legacy or durable-workspace
selection. Legacy selection reads only the winning legacy source and does not
inspect durable records. Durable selection reads only the named durable
workspace. Missing, corrupt, blocked, or pending-only durable storage never falls
back to a legacy/default workspace. Pending candidates require review even beside
a readable saved head. Returned payloads retain the original stored bytes;
decoded workspace values are an inspection view, not a replacement archive.

The module is not imported by the production application. Selection must later
come from an explicit, reviewed startup workflow. A copy existing in IndexedDB
is not permission to make it authoritative.

## Create-only migration copies

`createLegacyWorkspaceCopyCommitter` captures a validated source exactly once,
including its original key, whitespace, unknown fields, and opaque strings, into
the existing separate-ID migration envelope. Preparing does not write. Saving
the copy uses a unique editor lifetime, sequence 1, and expected revision null.
Existing destination heads or pending candidates block the initial attempt;
transactional revision checks handle a competing commit after inspection.

Source changes before staging or between staging and commit stop the operation
without deleting either source or staged copy. A source that changes or becomes
unreadable after a confirmed commit does not turn that known commit into a false
failure: the result reports `saved-copy` plus the source status at acknowledgement.
Lost acknowledgements reconcile the identical operation before newer source
checks. Concurrent calls share one request. Closing prevents subsequent work but
does not pretend to undo a transaction already committed.

Destination inspection is not an atomic reservation. A foreign pending draft can
appear during installation. Consequently, `saved-copy` is **not** `durable-ready`:
a fresh authority/recovery inspection is mandatory before any future activation.
No source deletion or selection occurs, and the current legacy copy stays intact.
Before enabling subsequent editing of a migration copy, the full original source
must also have an independently retained immutable archive; replacing the saved
head must not erase the only byte-preserving migration envelope.

## Bounded durable save session

The dormant durable session now retains at most one in-flight operation and the
newest pending capture. Intermediate pending callers resolve `superseded`, never
`saved`. Captures serialize synchronously before caller mutation. A saved result
follows authoritative transaction acknowledgement, not staging or queueing.
Unknown outcomes retry the identical editor/sequence/expected-revision/payload
before later work. Conflicts never silently adopt a competing revision.

`save(target, recoveryWorkspace)` supports a distinct pre-operation recovery
workspace for destructive changes. The target alone becomes the authoritative
head on success. Pending records carry optional `recoveryPayload`; inspection
exposes it separately as `preOperation` and never automatically selects either
candidate. Retention limits count both strings. Identity comparison and receipt
digests bind both payloads. Records without this field retain the exact original
two-element digest encoding and shape, including the active failed-save journal.
This is new-reader/old-record compatibility, not a claim that older writers
understand new recovery metadata. Mixed-version activation still needs fencing.

## Validation and limits

Synthetic coverage includes full current and historical same-ID study versions
beyond real jsdom localStorage quota, explicit authority selection, unavailable
and malformed records, source-change races, destination conflicts, lost stage
and commit acknowledgements, close/reentrant-subscriber races, bounded bursts,
pre-operation recovery identity, and legacy digest compatibility. The large-save
acceptance test uses real Web Storage quota enforcement with a deterministic
in-memory repository contract. It does **not** establish native IndexedDB disk,
eviction, crash, or multi-tab durability.

The native IndexedDB acceptance HTML fixture has additional recovery-payload
checks; those additions have not been executed in this environment. Native
Chromium launch was blocked by a socket permission error during the preceding
investigation. No alternative route was used to touch a real user's storage.

## Required activation batch

1. Async initial boot and route ownership across App and Builder, with explicit
   authority choice and a durable active-head transaction.
2. Every writer, destructive action, navigation guard, source-version check, and
   saved-status consumer must await its own acknowledgement. Current synchronous
   boolean call sites cannot simply be pointed at this session.
3. Fail-closed recovery/conflict review and an immutable migration-source archive,
   including raw-byte backup access and current/historical dataset preservation.
4. Already-running older tabs must not masquerade as writers of the same authority.
   A new marker alone cannot fence code that does not understand the marker.
5. Unload protects pending work; it cannot depend on a new async write finishing.
6. Native browser acceptance: large saves and cold reopen, transaction aborts,
   unknown outcomes, simultaneous current/older editors, blocked storage,
   downloads, and process loss. Only then consider a separately authorized rollout.
