# Compare two groups with paired dots

Select a dot plot, open **Format**, and choose **Dot layout → Pair two groups**. The result must contain exactly two recorded groups. **Separate series** remains the default for existing and new dot plots. The layout is a saved appearance choice, with the existing Undo/Redo and save/reopen behavior.

For each answer, a circle identifies the first group and an outlined square identifies the second. Both use the existing shared numerical scale and semantic series colors. Equal values remain visible as a circle inside the larger square. Each displayed value/base line carries its own group marker in a separate gutter. Authored labels wrap at word boundaries where possible; full labels and cells are retained or the drawing refuses to fit rather than truncating them.

A neutral connector joins the two available recorded values within an answer. It shows a visual comparison; it does not establish matched respondents, time, change, statistical significance or causation. Missing observations have no plotted point, and a connector requires both values. Available zero values remain plotted. Existing weighted totals retain their `W=` label; no weighted inference or confidence interval has been added.

The layout does not recalculate or replace the analysis. The complete-values table remains available. If a later result has another number of groups, the paired view explains why it cannot draw and keeps every stored group. Choose Separate series or change the analysis explicitly. Unsupported saved layout values also show an error and can be repaired explicitly through the same control; stored data is not silently rewritten.

Canvas, report thumbnails and reconstructed visual exports share the same SVG drawing. PDF and PowerPoint use the existing rendered-page image path; PowerPoint dots are not native editable chart objects. Excel retains the same analytical values, bases and context as the separate-series layout. Fixed-page exports refuse unreadable or clipped drawings instead of dropping points or labels.

Synthetic verification covers shared-scale coordinates, equal and missing values, weighted base labels, full aliases, fit limits, focus recovery and the complete table. Actual App tests use a1,000×30 study through editing, Undo/Redo, simulated quota failure, Retry and cold reopen while preserving source rows and published history. Another App test verifies explicit repair of an unsupported setting with one group. Production PDF/PPTX/XLSX artifacts are inspected separately, including independent decimal geometry and rendered PDF pages.

Native browser layout, screen readers, touch/fullscreen, OS downloads and Office rendering remain unverified. No live service or Snowflake execution is claimed. This is one additional dot-plot layout, not completion of the broader chart-types goal; small multiples, slope charts and other acceptance gates remain open.
