# Inspect affected workbook cells

Excel review findings now offer an Inspect affected cell action for an exact planned
cell. It selects the correct worksheet and bounded row/column windows, opens the
existing full-value inspector, and provides the existing Return to worksheet cell
action. A focused finding hands focus to the inspector; a deliberate blur, outside
focus, or unfocused activation does not steal focus.

The checker records zero-based sheet/row/column coordinates alongside its existing
human-readable address. Coordinates refer to the same checked workbook plan; no
address text is parsed or guessed. The action rechecks source currentness and bounds
before navigating. Worksheet-level findings retain their descriptive location rather
than pointing to an arbitrary cell. Existing issue counts, priorities and list budgets
are unchanged. Report data, planned values and export writers remain unchanged.

This is read-only navigation, not a repair, download or export approval. It retains
the existing 25-row/8-column display windows and inspection budgets. Native browser,
screen-reader and Excel acceptance remain open; goal36 remains partial. No persistence,
backend, publication or deployment changes are included.
