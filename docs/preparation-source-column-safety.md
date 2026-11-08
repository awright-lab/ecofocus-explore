# Preparation source-column safety

The analytical reader supports exact-key-first, case-insensitive fallback. Version-1 preparation recipes address exact stored keys. A legacy study can therefore analyze correctly while a selected preparation column is absent under its exact spelling.

Before this correction, selecting a blank-value recode in that situation treated every fallback value as blank. A copy could gain a new exact key that shadows the original nonblank values. The original study remained available, but the copy and its preview could be misleading. A regression reproduces this after normal workspace normalization: three nonblank original answers are valid for analysis, yet the old preparation accepts a blank recode against all four rows.

New preparation refuses a selected field when a row lacks its exact key but contains a differently cased match. The editor explains the mapping issue, withholds false blank-code choices and disables the new-step preview. The model checks again for direct callers and replayed histories. Data is preserved; no column is renamed or overwritten automatically.

Exact keys keep precedence even if another case spelling exists. Genuinely absent keys without an alias remain missing and may be explicitly recoded. Other exact-mapped fields in the same study remain usable. Existing version-1 replay semantics are not changed to a new fallback interpretation: affected old copies remain stored, but unsafe histories cannot be verified or resumed. Review them against the original and create a separately imported source with matching headers when necessary. Previously affected copies/caches are not silently repaired or certified.

Tests cover the normalized legacy mapping, later-row and ambiguous aliases, exact-key precedence, genuine blanks, unrelated fields, retained old copies, editor refusal and real-App source/analysis preservation through cold remount. Normal exact-header native cleaning/combining/save/reopen acceptance is separate from this new local safeguard; native execution of the safeguard and independent review remain pending.

This is part of original goal 11's acceptance work, not a separate completed roadmap goal. It does not enable remote or numeric transformations, change storage formats, activate recovery, or establish crash/multi-tab durability.
