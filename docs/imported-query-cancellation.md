# Cancel a pending imported query

While **Preview proposed edit** or **Update imported result** is waiting, the Data editor offers **Cancel imported request**. Cancel stops waiting in this editor, clears that pending preview and prevents its result from being applied. The current recorded analysis and source data remain unchanged. A fresh request can be started explicitly afterward.

The browser's abort signal is passed to the existing imported-query request. It is checked before local work, before sending, before reading a response body and before accepting a parsed response. Settings changes, superseding requests, editor context replacement and unmount also abort owned pending requests. Request ownership remains the final guard if a transport ignores abort or a late response arrives. Older request completion cannot clear a newer request's loading state or controller.

**Cancel does not establish that a server or database job stopped.** The server may continue working, and no server-side cancellation or billing reduction is claimed. There is no new automatic retry or waiting deadline. Synchronous local calculations cannot be interrupted while they occupy the main thread. If browser abort support is unavailable, logical cancellation still stops this editor from applying the result; it cannot stop that HTTP request.

Focus moves from an owned request trigger to its Cancel control while waiting, then returns to the corresponding action when the control disappears. A successful update can remount the editor; a conditional parent handoff restores focus to the replacement action. Newer focus elsewhere and deliberate blur are respected. Pending controls do not take focus when a request starts from an unowned trigger.

The signal and cancellation notices are temporary UI state; they are not saved in the workspace or sent as analytical query data. Existing response validation, numerical calculations, unsupported-query restrictions, writer and recovery behavior are unchanged. Without a supplied signal, existing transport options and payloads are retained.

Synthetic checks cover fetch/body races, ignored abort, supersession, context changes, close/unmount, fallback support and focus ownership. Actual App tests use a complete1,000×30 synthetic study with a mocked remote-query route, cancel both action types, reject a late response, explicitly retry, verify50%/base1,000 results, Undo/Redo and cold reopen while preserving source rows/fields and published history. Existing field-catalog reads on reopen are mocked separately; no live service is contacted.

Native browser/assistive-technology behavior, real network abort, server/database cancellation and live Snowflake correctness remain unverified. This is request-lifecycle progress, not completion of background processing or the broader performance goal.
