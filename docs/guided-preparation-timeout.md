# Guided preview preparation deadline

Selected-value preparation now has its own 30-second deadline. It clears any
scheduled preparation continuation and rejects the preview without starting a
worker, accepting partial rows or changing a report or study. The existing dialog
shows the error, releases its busy state and permits an explicit fresh retry.

The preparation deadline is removed once the worker is ready to receive its input.
The existing separate 30-second calculation timeout is unchanged. Both timers are
cleared on completion, cancellation or error; late queued preparation callbacks
cannot resume a finished job. No automatic retry or synchronous fallback is added.

These are event-loop timers, not hard CPU deadlines. Initial synchronous validation,
a synchronous preparation batch or a blocked main thread cannot be interrupted.
Browser throttling can delay timer delivery. The deadline limits yielded preparation
after initial selection validation; total job time may approach 60 seconds plus
validation/scheduling delays. Native/background-tab behavior remains unverified.
Goal15 remains partial. No writer, engine, schema, backend, publication or deployment
changes are included.
