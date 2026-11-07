# Document commands, history and pending analyses

The editor owns its document through `useDocumentCommandState`. Commands compute a next document once against the latest command value. React receives the resulting value; command callbacks that create IDs or record history run once. `useBuilderDocumentSessionCommands` records history and clears Redo in the commit's changed callback. An identical return skips history and save-state changes.

All document replacements use the same commit path. Concrete replacements, including report navigation, snapshots and Undo/Redo, advance an immediate replacement version. Page and viewer transitions also advance the editor context before React renders. Each transition clears the old loading state immediately, including an A → B → A batch whose final value equals the previously rendered value.

Pending analyses capture that context version and a report/page generation. Context checks cover response handling, errors, loading and document commits. Creators return a tile ID and select it only after the document commit is accepted. Refreshes additionally retain a latest-request token per tile. Ordinary functional edits within the same report/page preserve pending queries.

Verification covers StrictMode one-edit/one-Undo behavior, multiple edits, branching Redo, same-tick commands, captured IDs, rejected updates, and navigation before a React rerender. Ownership checks protect report/page/snapshot changes, return visits, unmount, late errors and concurrent requests. Browser and live-service acceptance remain separate from these component/state tests.
