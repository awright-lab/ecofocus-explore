# Local CSV import focus continuity

The import dialog now hands focus to the parsed-study panel when a focused “Cancel import” control disappears after successful parsing. On failure or explicit cancellation, it hands focus to the enabled file chooser instead. Previously all three paths left focus on the document body.

A stable callback ref records whether the departing Cancel button owned focus before React removes it. The post-commit handoff runs only after import activity ends, only for that detached button, and only if focus has not moved to another connected element. Unrelated controls, the discard confirmation, deliberately cleared focus, and unmount/late-result behavior keep their existing ownership. Existing import, cancellation, duplicate checking, save and recovery handlers are unchanged.

Ten regression cases include three failures reproduced on the original component, successful real parser transport, worker failure, explicit cancellation, no focus theft, discard-confirmation ownership, late completion after cancellation/unmount, and an actual React App workflow importing a 1,000-row, 30-field synthetic CSV. The application case checks focus, no workspace changes before explicit addition, exact imported rows, unchanged reports/snapshots, saving and cold reopen. Existing quota/retry and duplicate-copy tests also remain in the focused suite.

These are React/jsdom and real in-process parser/transport checks. Native browser Worker/CSP, operating-system file dialogs, screen readers, touch and production behavior remain unverified. No original dataset, cached analytical result, workspace storage protocol, parser, worker or percentage-precision code is changed. This is a scoped accessibility correction, not completion of all accessible authoring work.
