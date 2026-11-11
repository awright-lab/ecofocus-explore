# Synthetic cloud-save protocol lab

**Status: isolated, memory-only prototype. Not a Supabase integration or production feature.**

This lab lets two simulated devices explicitly save a synthetic cloud copy and
restore a separate synthetic copy. It provides executable protocol tests before
real data, credentials, hosted schema changes or production integration are considered.

## Run locally

Use the repository's installed dependencies (or `npm ci`), then:

```sh
npm run dev:vite -- --host 127.0.0.1
# Open http://127.0.0.1:5173/prototypes/cloud-save/index.html
npx vitest run src/features/cloudSavePrototype/__tests__
npm run typecheck
npm run build
```

The standalone HTML entry is **not** an input to the normal production build.
Nothing imports the prototype from `App.tsx`, the document subsystem or the
existing workspace save/recovery UI. There are no environment variables,
Supabase SDK dependencies, migrations or deployment changes in this prototype.

## Boundaries

- Only exact, canonical snapshots from the deterministic fixture generator are
  accepted. A `synthetic` label alone is insufficient. Extra fields, arbitrary
  respondent rows, duplicate JSON keys and changed titles are rejected.
- No files, free-text survey data, existing browser workspace, IndexedDB,
  localStorage, sessionStorage, production API or real Supabase project is read.
- The simulator uses in-memory maps and fake session tokens. It makes no
  cloud requests. The HTML restricts connections to its own origin and local
  Vite WebSocket endpoints. This is defense in depth, not a security proof.
- Everything disappears on reload. `MemoryDevice` can be reused to simulate a
  controller restart, but **does not establish browser-crash durability**.
- Demo identity selection is not authentication. The fake server checks a token
  registry, ownership and expiry so behavior can be exercised. Its sequential
  tokens and maps must never be used as a real auth/storage implementation.
- The exact-fixture restriction intentionally means this is **not a complete
  DashboardWorkspace backup**. No real reports, imported datasets, source bytes,
  historical study versions, image assets or remote connections are included.

## Protocol modeled

1. On explicit **Save cloud copy**, capture a frozen fixture, owner, workspace,
   unique operation ID, expected head and SHA-256 digest. Keep that intent in the
   simulated device journal before upload. Newer local edits do not alter it.
2. Upload immutable bytes to an owner/workspace/operation path in private object
   storage. An exact retry is allowed; replacing bytes at the same path is not.
   An upload failure cannot advance the published head.
3. In **one server-side transaction**, verify the complete uploaded object,
   reconcile a matching existing operation receipt, otherwise compare the
   expected head, insert the immutable revision/receipt and advance the head.
   The fake server models this with one synchronous critical section.
4. Mark the specific copy acknowledged only after receiving a matching revision
   receipt under the same active account/session. If newer local edits exist,
   say they still need a cloud copy. Do not change the active local snapshot.
5. If the upload or publication acknowledgement is lost, retry the **same**
   intent before creating an operation for newer changes. A receipt can reconcile
   an earlier success even after another editor has advanced the head.
6. A competing expected head yields a conflict. Keep the pending local version
   and remote revision. Do not silently adopt the server head or overwrite it.
7. **Restore separate copy** reads an authenticated head and private object,
   verifies checksum and fixture schema, then allocates a fresh local copy ID.
   It never modifies the original, its pending intent, expected head or remote
   head. Duplicate concurrent clicks collapse into one request; a later deliberate
   restore creates another separate copy.

A save always requires an explicit button click. Signing in or returning online
never starts a background upload. Local/cloud authority selection remains out
of scope. Do not infer authority because a backend contains data, or switch
away from local storage because it fails.

## Exercise the lab

- Sign both devices in as Alice. Save from A, then from B: B conflicts. Restore
  a separate copy on B and confirm its active local version remains unchanged.
- Reset, choose **Lose publication acknowledgement**, then save. The simulator
  has one revision but the client reports interruption. Retry: still one revision.
- Lose the acknowledgement, make another edit, then retry. Only the older frozen
  version is reconciled. Click Save again to publish the newer version.
- Switch to Bob: Alice's cloud head and private object are unavailable. Pending
  intents and expected heads are scoped by account and workspace.
- Go offline or expire sessions. Local synthetic edits remain available; failed
  saves keep pending intent and do not report new cloud durability.
- Corrupt or interrupt a download: no partial restored copy is created.

## Planned Supabase contract, not applied SQL

A future reviewed implementation should use:

- A **private** bucket, never public URLs. Object paths include the verified
  authenticated owner, workspace and unique immutable upload ID. Use the Storage
  API, `upsert: false`, and restrictive INSERT/SELECT policies. Do not grant
  object UPDATE/DELETE to normal clients for published revisions. Signed URLs
  are bearer access and require a deliberate policy if introduced.
- Owner-scoped workspace heads, immutable revisions and operation receipts with
  RLS and narrowly scoped privileges. Every exposed table needs RLS. `TO
  authenticated` alone is not ownership. Apply `USING` and `WITH CHECK` where
  appropriate. Do not trust caller `owner_id`, editable user metadata or a
  browser-supplied `authenticated` flag.
- One transactional publication RPC that derives identity from validated auth,
  verifies object identity/size/checksum and completion, checks receipt identity,
  and locks/compares the head before atomically inserting a revision/receipt and
  advancing the head. A unique owner/workspace/operation key handles concurrent
  initial saves and replay. Never emulate this using separate client-side
  INSERT/UPDATE requests. Do not use SECURITY DEFINER merely to bypass RLS;
  privilege design and direct-write prevention need an explicit review.
- Storage and Postgres publication are **not one distributed transaction**.
  Interrupted uploads can leave unreferenced objects. Garbage collection needs
  a safe retention window, retry/receipt awareness, no deletion of referenced
  objects and real storage-level testing. Nothing deletes objects in this lab.
- Real token validation/expiry, revocation expectations and account switching.
  No service-role/secret key may appear in browser code. Confirm policies using
  two real test users and an unauthenticated client, not just admin queries.
- A durable pending-operation journal, stable operation identity, bounded
  queue/retry behavior, receipt retention and crash recovery. Integrate with the
  independently developed local durability adapter only after its authority
  contract is accepted. Keep current and historical dataset versions distinct;
  never substitute previews or truncated rows for complete source data.

Do not apply hosted changes, create users, issue persistent credentials, upload
real work, enable sync, merge or deploy on the strength of this prototype.
Those steps require a separately scoped implementation and authorization.

## Verification and remaining gates

Verified locally on this branch:

- 41 focused tests passed: 38 protocol tests and 3 React/jsdom UI tests.
- TypeScript project check passed.
- Normal production app build passed with its existing large-chunk warning.
- Standalone lab bundle build passed; it is not included in the normal app build.
- Independent code review completed; its canonical-JSON allowlist finding was
  fixed and covered by a regression test.

The full repository suite is **incomplete**: a run with SDK cloud-platform
metadata detection disabled was interrupted by execution-environment loss
before producing a result. Browser visual QA is also **unverified** because a
local Chromium launch was unavailable and the separate browser could not reach
the local preview. React/jsdom tests verify UI behavior, not rendered appearance.
No live Supabase integration or RLS test was run.

For an aggregate local run that avoids the existing Snowflake SDK's platform
metadata probes, use:

```sh
SNOWFLAKE_DISABLE_PLATFORM_DETECTION=true AWS_EC2_METADATA_DISABLED=true npm test -- --maxWorkers=2
```

Tests model upload and publication interruptions, concurrent first saves,
immutable-object reuse, receipt replay, account/session changes, offline state,
newer local edits, checksum rejection and non-destructive separate restore.

Before real data migration, still required:

1. Reviewed isolated test-project provisioning and schema/privilege design.
2. Real RLS/Storage negative tests (cross-user reads/listing/writes/deletes,
   unauthenticated and anonymous users, forged owners and direct table writes).
3. Real simultaneous RPC calls, constraint/transaction rollback, proxy timeout,
   retry/lost ACK, partial upload, session refresh/revocation and outage tests.
4. Durable local journal + explicit local/cloud authority and migration UX.
5. Complete versioned workspace/asset/source manifest, size limits, multipart or
   resumable upload, checksum verification, retention and orphan cleanup.
6. Review real-data recipients/consent, access policy, recovery/rollback and costs.

**Passing simulator tests does not verify live Supabase RLS, security,
transactionality, durability, backup completeness or large-workspace capacity.**

## Current documentation consulted

Reviewed the Supabase changelog and relevant docs for this design:

- https://supabase.com/changelog.md
- https://supabase.com/docs/guides/storage/buckets/fundamentals
- https://supabase.com/docs/guides/storage/security/access-control
- https://supabase.com/docs/guides/storage/schema/design

The latest CLI v3 defaults and TLS changes do not affect this credential-free
simulator. Recheck current SDK/CLI and auth/database documentation when
implementing an actual adapter; this lab deliberately adds none.
