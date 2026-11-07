# PowerPoint layer preservation

PowerPoint previously appended every native chart and editable text/shape after the page image. An authored backdrop behind a table could therefore cover that table in the exported file. In PresentationML, shape-tree order specifies back-to-front rendering ([Microsoft ShapeTree documentation](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.presentation.shapetree?view=openxml-3.0.1)).

Export now checks the same stable element-then-tile z-order as the complete page SVG. If splitting overlapping objects into raster content, native chart bodies and editable objects would reverse that order, the affected slide uses its complete rendered image. Preflight explains the tradeoff: objects remain editable in the builder, but that slide has no native editable PowerPoint objects. Unaffected slides retain their existing hybrid export. Native chart headers/context are raster, so overlapping native charts also require this protection.

The planner is read-only and bounded to 500 objects and 100,000 overlap comparisons. Invalid/unverified geometry uses the conservative complete-render route; existing analytical and SVG validation still runs and may reject export. It does not repair invalid results, move objects, change saved studies, or modify PDF/Excel export.

Regression coverage checks ordering, ties, hidden objects, touching edges, native chart context, bounds, preflight and mixed-page ZIP/XML routing. Actual synthetic artifacts compare an overlapping table backdrop before/after and require two unaffected files to remain byte-identical. Source data is synthetic. Structural test raster stubs do not establish rendering fidelity; actual artifact checks use Sharp.

This protects declared object geometry and renderer order. Shadows, painted extents outside declared bounds, font substitution, native PowerPoint rendering, application-menu downloads, browser rasterization and total export fidelity remain unverified. No denied Office/browser operation is retried. Goal 36 remains partial.
