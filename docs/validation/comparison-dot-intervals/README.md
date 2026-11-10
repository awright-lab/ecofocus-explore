# Comparison dot-plot intervals: validation

Base verified from origin before work: `codex/beta-reliability-audit` at
`0d155ffc7919155e90036e8e90dd70533a5dfb04`. Worktree:
`/workspaces/ecofocus-intervals`, branch `feat/comparison-dot-intervals`.
The original uncommitted workspace, PR #2 and PR #3 were left in place.

## Automated checks

- Focused suite: **183 passed across 16 files**.
- Full suite: **5,615 passed, 2 skipped**, across 411 files (410 passed, one
  skipped). Command: `npm test -- --maxWorkers=2 --testTimeout=20000 --reporter=verbose`.
  The skips are the opt-in live Snowflake test and legacy optional offline-raster
  integration; the real Chromium flow described below ran separately.
- Typecheck and diff checks: passed. Source hashes were unchanged during the
  complete full-suite run.
- Independent reference vectors use 80-digit Python Decimal bisection of the
  binomial score equation `(k - n*p)^2 - z^2*n*p*(1-p) = 0`, on each side of `k/n`,
  for 250 iterations, with `z = 1.95996398454005423552`. They do not call or copy
  the production center/radius formula. References include 0/1, 1/1, 0/3, 3/3,
  1/3, 0/5, 5/5, 3/7, 50/100 and rare/extreme rates at n=50,000.
  [NIST method reference](https://www.itl.nist.gov/div898/handbook/prc/section2/prc241.htm).
- Both supported comparison layouts are checked for point/whisker alignment,
  identity and base association, independent bounds, missing versus observed
  zero, empty groups, category/series reordering and layout switching.
- UI tests exercise the actual Format controls, the explicit declaration,
  keyboard-reachable HTML values, full aliases, small-base cautions and stale
  source/query/result invalidation. Existing App tests retain Undo/Redo,
  read-only studies, publication history and reopen behavior.
- Shared rendered SVG tests require every interval and caution, or an explicit
  refusal for unsafe geometry, stale declarations and non-dot visual outputs.
  Analytical workbook values and bases remain unchanged.

## Actual browser verification

An isolated **Chromium 156.0.8078.4** browser exercised the actual App, using a
synthetic local CSV fixture (three valid all-success respondents and one valid
zero-success respondent in separate groups). Storage was seeded before App
startup in a new browser context. No production workspace or credentials were
used or changed.

Verified through real UI actions:

1. Intervals start off; selecting small multiples does not declare independence.
2. Explicitly checking the declaration draws all four intervals.
3. Switching small multiples → paired dots → separate series → small multiples
   retains the declaration and unchanged analytical result JSON.
4. HTML interval values can be opened; the complete-values dialog opens and
   closes with Escape.
5. Switching to slope displays an explicit refusal while retaining the checked
   declaration. Returning to paired dots restores the same supported drawing.
6. Explicitly turning intervals off removes the interval marks.

No page errors, console errors, external requests or backend API calls were
recorded. The local Vite server started successfully. The flow is local CSV →
recorded exact counts → explicit UI declaration → shared SVG/HTML rendering;
a database/API boundary is not involved.

These actual browser captures were visually inspected:

- [Paired dots](paired.png): each group's interval and marker share a lane;
  neutral connectors join point estimates, never interval endpoints.
- [Small multiples](small-multiples.png): each group keeps its own panel and
  valid n on the shared 0–100% scale. Zero and all-success observations retain
  nonzero uncertainty widths.

The chart region may scroll within a tile to retain the complete drawing and
axes. Captures are synthetic browser evidence, not visual snapshots from jsdom.

## Boundaries and gaps

The declaration checks the recorded source identity/provenance and available
execution fingerprints, current query and result evidence. It cannot establish
physical sampling independence or continuously observe a changed external
source; remote intervals are deliberately unsupported. An author must rerun an
analysis when its underlying study changes, then explicitly review its interval
declaration again.

Slope intervals, weighted/complex-survey/remote/derived/rounded-only inference,
simultaneous coverage and difference tests are unsupported. Browser tests cover
one Chromium build; actual screen-reader, other-browser, print/download and
Office acceptance were not performed. Fixed visual output fit/refusal and
analytical workbook invariance were checked automatically. PowerPoint-specific
files, workspace saving/recovery and report-refresh code were not edited. No
merge, deployment, production data or credential changes were made.
