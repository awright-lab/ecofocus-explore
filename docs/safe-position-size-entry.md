# Safer position and size entry

The existing Position, chart-options and object-options panels now share guarded numeric fields. Previously, every keystroke called the report layout writer directly: clearing an entry wrote zero, partial edits generated intermediate saved layouts, and negative dimensions passed through unchanged.

Entries now remain temporary while typing. Enter or leaving the field applies one completed change. Escape restores the current report value. Blank, nonfinite, out-of-supported-range and nonpositive dimension entries retain the report's current geometry and explain why the entry was not applied. Equivalent numeric spellings, including signed zero, do not create an extra document change. Newly applied zero positions use positive zero. X/Y retain support for negative positions and all fields retain decimal precision; this does not silently clamp or move authored content onto the page.

If the same value changes elsewhere while the field is being edited, the old entry cannot overwrite the newer value: the field shows the current value and asks for a new edit. An unrelated coordinate change does not invalidate the pending entry. Field state belongs to a particular selected item. Locked items have disabled numeric fields; this does not change other existing layer or arrange commands.

The controls use full labels, shared keyboard instructions and associated error messages. Existing history, save, canvas dragging, layout presets and export paths remain unchanged. This is a targeted input-safety and usability correction, not completion of accessible authoring or adaptive report layouts. Intermediate field text is not persisted as a report draft, and this does not add crash recovery.

Verification includes the actual application with a synthetic 1,000-row, 30-field study and a wide cached result: incomplete/invalid entry preservation, single applied edit, Undo/Redo, Escape, input ownership against canvas shortcuts, object positioning, save and cold reopen. Component cases cover all three existing inspector surfaces, locking, stale edits, selection replacement, finite-range validation and numeric equivalence.

Native browser, assistive-technology, touch and visual acceptance remain unverified because the existing native-browser restriction is still in force. No attempt was made to bypass it. No remote publication, production change, merge, deployment, permission or security-setting change is included.
