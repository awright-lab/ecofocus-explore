# Preserve focus intent across export review cleanup

Independent review reproduced a race in Show object properties: explicit blur or outside focus in the same React batch was overwritten because modal cleanup restored the review trigger first. The builder then mistook that restoration for retained ownership and moved focus again.

The navigation request now records the focused action button. Blur revokes its handoff permission. An optional restoration predicate in the existing modal hook lets this particular workflow skip trigger restoration when ownership was revoked; callers without a predicate keep their previous behavior. The same original-owner permission is required for the builder's properties handoff, including when the user deliberately moved focus to the review trigger itself. Current focus and target validity checks remain in place.

Three actual App/jsdom regressions cover explicit blur, outside focus and deliberate trigger focus. Each verifies the desired focus, successful object selection/properties opening, unchanged history, exact saved workspace after a real autosave delay, no pending save and no network calls. The original normal-navigation, Delete/Backspace safety and 1,000-row by 30-field edit/save/cold-reopen workflow remains unchanged. Existing dialog callback assertions now additionally require the ownership callback argument.

This corrects the original focus-ownership claim; it is not completion of general authoring accessibility. Native browser automatic blur on unmount, fullscreen, screen readers, touch and visual acceptance remain unverified. No storage, export renderer, analysis, permission or security-setting change is included.
