# Numeric precision in analysis reviews

Small stored nonzero values and descriptive changes could render as 0 or -0 in compact edit previews and complete change reviews. Both surfaces now use the same scientific formatting for small/large magnitudes, normalize signed zero for display, and offer a keyboard-accessible Full numeric precision toggle. Bases use full numeric display. Unavailable values stay unavailable; overflowing arithmetic remains not comparable. Calculations, result values, queries and saved content are not rewritten by either mode.

Full mode preserves the stored binary64 value; it does not recover original decimal-source precision, previously rounded results, survey uncertainty or measurement precision. In particular, existing local percentage results can already contain one-decimal rounding. A formatter cannot recover their discarded digits. This limitation remains separate analytical accuracy work. Arithmetic differences are descriptive floating-point calculations and retain the existing comparability/weighting guards.

Reviews also use shared own-property base validation rather than inheriting a denominator through a JavaScript prototype. Valid weighted fractional bases remain visible as recorded totals; this is not validation of a survey-weighted method. The prototype case is defensive runtime hardening, not an established persisted-JSON or external attack path.

Verification covers nonzero extremes, full-display binary64 round trips, signed/genuine zero, unavailable bases, arithmetic overflow, toggle focus, original comparability and pagination, plus an actual App preview/update/save/reopen workflow with synthetic data. Native browser, screen-reader, visual rendering and live backend acceptance remain unverified. Goal13 remains partial.
