# New-wave source and recovery review correction — candidate

Addresses independent review of ea3e1d2. The original code accepted two synthetic same-dataset live-reference cases in the model; the failing reproduction log is retained outside the repository. No native incident or user-data loss was established.

## Source provenance

Before replay or field remapping, check every explicit tile, pending query, recorded query, imported identity and recorded metadata source reference against the selected local study. References must agree on local-file kind/provider, dataset ID and all recorded routing/identity properties. Descriptive labels may differ; omitted/undefined optional properties are equivalent. Missing legacy references remain allowed when the imported identity and complete local source are present. Live, managed, wrong-provider, different import IDs and extra connection/object routing refuse; nothing is stripped or substituted. Plain-data validation still precedes reference reads. This is routing consistency, not source authenticity or general tamper resistance.

## Original report record

Creation no longer upserts an already exact-matching original draft. Its entire record, including createdAt, updatedAt and lastOpenedAt, is retained. In the App, new-wave recovery captures an unchanged original without calling the timestamp-changing upsert; actual edits still use the existing save path. The capture rule is bounded to the original draft recorded for this copy operation. Advancing-clock tests cover creation and same-copy retry, with a simulated quota failure in the actual App, and compare the full source report record rather than only draft pages. A further actual-App regression edits the original after a failed copy and verifies that the title, draft status and real edit timestamp save correctly while the copied report, rows and published history remain intact.

## Embedded-source retry

Additive promotion of an already retained embedded study can legitimately change the root library. A private preview receipt now permits exactly the validated promoted library as well as its original binding. The UI uses that receipt to keep the review confirmation and same-copy retry available. Other additions, changed rows or metadata still invalidate the preview. The original record remains unchanged and the new report ID/review time remains stable across retry. This is an in-session defensive path, not a promise of replaying an ephemeral preview after process reload. Normal App load usually already establishes root studies.

## Verification and limits

Synthetic tests cover each reference location, kind/provider/identity conflicts, harmless label changes, actual App storage/reopen refusal, full original-record preservation under an advancing clock, exact promoted-library retry, changed/extra library refusal and UI confirmation retention. Input rows and conflicting metadata are preserved for explicit review. Final exact-tree full-suite and private backup evidence is in the accompanying checkpoint.

The new-wave workflow and goal 40 remain partial pending independent acceptance. No native browser, real quota/races, live source, Office, production build, publication, merge or deployment is established. The existing build EPERM and native/permission restrictions remain; no denied action was retried. No cloud credentials, security settings, production data or billing changed.
