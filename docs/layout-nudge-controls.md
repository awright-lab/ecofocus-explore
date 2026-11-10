# Explicit movement controls for a selected item

The builder's existing Position, chart-options and object-options coordinate fields now include **Move selected item**. Native Move up/left/right/down buttons apply a chosen distance of 1, 10 or 100 page units through the existing layout command and Undo history. These controls complement the existing arrow shortcuts and typed coordinates; no global shortcut behavior is changed.

Distances are page-coordinate units, independent of canvas zoom and grid snapping. One move changes only X or Y; width, height and layer remain intact. Intentional negative positions remain supported, so a move can place an item partly or wholly outside the page. There is no implicit clamping, automatic reflow or arrangement of other objects. Existing export/layout review remains relevant.

## Typed edits, locks and feedback

Unfinished numeric entries disable movement until they are resolved with Enter, Escape or the existing blur behavior. Pointer activation on a blocked move keeps the unfinished field intact. If a valid numeric edit commits on blur in the same batch as a move activation, the typed edit is retained and that stale move is ignored; the next move uses the newly rendered position. Existing stale-field conflict checks remain.

New controls honor the selected item's rendered lock state and remain present when unavailable, avoiding removal of a focused move button. The existing keyed selection contract resets staged fields and the local move-distance preference when selecting another item. Distance selection alone changes no document state and is not stored as report metadata. Changing distance and activating a move in one batch uses the latest chosen value.

The model refuses unsupported distances/directions, nonfinite or out-of-range geometry, nonpositive dimensions and overflowing/no-op numerical results. It does not truncate, clamp or mutate the input. Newly calculated zero is normalized consistently with coordinate entry. Each ordinary activation issues one existing layout update; the controls do not introduce a new writer or asynchronous command protocol.

Current-position feedback is read from the actual layout prop, rather than an optimistic save claim. If a document command throws, feedback says the move could not be confirmed and asks the user to check the current position; it does not falsely claim that a possibly applied move was retained or undone. There is no automatic retry. Normal browser-save acknowledgement and recovery remain authoritative.

## Verification and remaining limits

Model tests cover all four directions at each distance, fractional/negative coordinates, signed zero, invalid inputs and numerical bounds. Integrated component tests cover no document edit on distance selection, focused controls, same-batch distance selection, unfinished entries, blur/stale-field protection, rendered locks, replacement selections and both unapplied/applied callback exceptions.

The actual App journey uses a synthetic 1,000-row/30-field study, an analysis, a text object and a historical snapshot. It exercises distance changes, moves despite grid snapping, negative placement, Undo/Redo, staged numeric edits, keyboard ownership, the existing Lock action, selection changes and failed-save/retry/reopen. It compares complete current drafts against the expected geometry-only edits and retains the original study, query/results and published snapshot.

Tests use simulated DOM. Native keyboard default activation, touch, screen reader, visual layout/scrolling, browser matrix and actual quota/crash/multi-tab behavior remain unverified. These controls do not certify every pointer/global-shortcut lock path, arbitrary external asynchronous commands or multi-object movement. They do not complete original accessible-authoring goal 16 or adaptive-layout goal 33. Production build remains unverified after the prior EPERM and is not retried. No publication, merge or deployment is included.
