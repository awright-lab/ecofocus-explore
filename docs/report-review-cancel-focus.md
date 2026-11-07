# Report-review cancellation focus correction

Ending a running selected-report review removed its focused Cancel button and left focus on the document body. The correction captures focus ownership before removal, whether caused by explicit cancellation, natural completion, failure or a changed queue. After React removes the button and re-enables Run, focus returns to Run selected report comparisons. If that action is unavailable, the persistent dialog itself is the fallback. Focus already placed on another connected control is preserved.

This changes only focus restoration when the Cancel control disappears. Review calculations, cancellation ownership, queue validation, saved workspaces, exports and source data are unchanged. It does not activate recovery or restore functionality.

Regression evidence:

- Before the correction, the new focused-Cancel test failed with the body as the active element; the other two cases passed.
- Component tests cover focused cancellation, cancellation activated while a different input owns focus, and focus moved to that input in the same event before the cancellation commit. Each checks that the dialog retains focus, cancellation is reported, no findings are accepted, the draft is unchanged and no fetch occurs.
- Follow-up regressions reproduced four further focus failures before the broader removal correction: completion, replacement queue, empty queue and failure. Each now runs with Cancel focused and with a different input focused. The completed run still accepts all three expected findings; invalidated/failed runs accept none. The empty queue uses the dialog fallback because Run is disabled. Other controls retain focus in all four scenarios.
- Existing queue and actual application save/reopen workflow tests remain part of the focused run.

These are jsdom checks, not native-browser, screen-reader, touch or visual acceptance. The existing native-browser/socket and Office restrictions remain in force. No remote publication, merge, deployment or security-setting change is included.
