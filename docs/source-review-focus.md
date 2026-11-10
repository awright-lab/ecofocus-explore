# Source-evidence review focus recovery

The source-evidence review previously removed its Cancel source review button when a preview or apply ended. If that button owned keyboard focus, focus fell to the document body even though the dialog remained open.

The dialog now records ownership before removing that control, then returns focus to the persistent Preview versioned calculation button after it is enabled again. If the selected analysis is no longer available, focus returns to the dialog itself. This runs after explicit cancellation, completion, failure and source invalidation, including asynchronous apply. A user who has moved focus elsewhere keeps that focus.

This does not change calculation, source binding, receipts, cancellation epochs, apply/save commands, close/unload protection or stored report content. Regression coverage reproduces the old failure, checks guarded apply/rejection and tests real App save/reopen preservation. The synthetic unload event invokes the existing application save flush; tests allow only its report updatedAt timestamp change and retain exact source/report-draft checks. Native browser, screen-reader, touch and fullscreen acceptance remain separate; this is scoped accessibility work rather than completion of goals14 or16.
