# Comparison dot-plot layouts

These are saved presentation choices under Format > Dot layout. They reuse the recorded dot-plot result, without rerunning analysis, altering query identity, changing the imported study or rewriting historical caches. All layouts retain their previous drawing when intervals are off.

Small multiples repeat every answer in one panel per recorded group. All panels use the same zero-anchored numeric domain (0-100 for percentages, symmetric for mixed signs). Up to six groups and 30 answer rows are supported. The grid adapts to actual label/value width; the canvas scrolls a complete drawing when needed.

Slope charts require exactly two recorded groups. Each answer has a true quantitative endpoint on each side and a connector only when both values are available. Full labels are independently packed on each side with leader lines to the original endpoints. Label packing does not move the data. Coincident endpoints may overlap; marker shapes, titles and the complete-values table identify them. Lines do not establish time order, respondent pairing, significance or causation.

Both layouts retain complete aliases, solid semantic colors, chosen type sizes, missing-value distinctions and validated bases. Value-label visibility follows the author's existing setting; SVG titles and the complete-values table retain the cells. Available zero differs from unavailable values. Weighted totals use W rather than respondent n. Small multiples now support individual 95% Wilson intervals after an explicit independent, unweighted respondent declaration. Paired dots support the same intervals, using separate group lanes so each whisker, estimate and value label remain aligned. Slope charts still refuse retained interval declarations explicitly; the author must turn them off or return to a supported layout. No layout switch silently discards a declaration.

Canvas, thumbnails and visual exports use the same renderer. Fixed-page PDF/PPTX refuse if all cells, labels or context cannot fit; they do not truncate. PPTX retains these charts as image underlays, not editable native chart objects. Analytical Excel values/bases remain unchanged by the presentation choice. These layouts alone do not establish full original goal 31 completion: native browser/assistive-technology/Office/download acceptance, broad chart recommendations and persistence for the existing numeric-distribution workflow remain separate scope.

Verification is recorded in the local review packet. No live Snowflake or external respondent data is used; no production deployment, merge or publication is part of this batch.

## Individual interval model and safeguards

Separate series, paired dots and small multiples use the existing individual,
two-sided 95% Wilson score calculation without continuity correction. Only
ordinary local percentages with consistent exact recorded integer numerators and
valid respondent bases are eligible. Rounded-only summaries, weighted or remote
results, derived/authored results and transient intersections are refused with
an explanation. A valid base of zero has neither a point nor an interval and is
reported as unavailable. An observed zero or all-success rate still has an
uncertainty range. Valid bases below 30 receive an explicit caution.

The author must explicitly declare independent, unweighted respondents without
a complex survey design. Counts alone do not establish that assumption.
Intervals are individual, not simultaneous intervals or intervals for a group
difference. Overlap is not a significance test. Connecting group estimates does
not establish paired respondents, time order, change over time or a test of the
difference. The method does not account for clustering, nonresponse bias, survey
weights or complex-survey variance.

The declaration binds to the current analytical query and recorded source,
provenance, execution evidence (when present), exact counts, series and result
metadata. Changes require explicit off/on review after refreshing the analysis;
no stale declaration is automatically renewed. Pure presentation switches among
supported layouts retain the declaration. Existing declarations made with the
older, narrower binding may require a fresh explicit review on upgrade. This is
a check of the recorded analysis snapshot, not continuous monitoring of an
external source; remote workflows remain unsupported.

SVG titles/descriptions and the keyboard-reachable HTML interval disclosure
retain full category/series aliases, bounds, events and valid bases even when
visual value labels or sample-size labels are off. Visible interval labels retain
n when ordinary sample-size labels are hidden. Canvas drawings can scroll; fixed
visual outputs must fit all values and context or refuse the drawing. Retained
intervals in a non-dot visualization also cause an explicit visual-output refusal.
Analytical Excel retains the original values/bases, not the visual interval
layer; this distinction is stated alongside the declaration control.

The shared SVG renderer carries the same intervals to thumbnails and existing
visual outputs. No PowerPoint planner, native-chart or packaging code was changed.

[Validation, reference-vector provenance and real Chromium screenshots](validation/comparison-dot-intervals/README.md).
