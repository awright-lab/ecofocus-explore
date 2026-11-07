# Locate every detected PDF rendering failure

**Review before exporting** now reports each visible object's detected rendering failure by name. Use **Show object properties** beside a warning to select that text box, image or analysis. A background failure remains a page-level warning with **Show page properties**.

The diagnostic pass uses the same SVG renderers as export, once per visible object, and checks the page background. It continues after an object fails so other detected problems can be reviewed together. Hidden objects are excluded as before. A page with any rendering failure has no PDF preview; a partial drawing is never presented as a complete page. Fixing an object and reopening review removes its warning while retaining unresolved warnings for other objects. The complete preview returns when the rendering failures are resolved.

Review is read-only: it does not resize, move, recalculate, save, download or remove anything. The existing navigation and focus-ownership safeguards still apply. Actual export retains its existing fail-fast behavior, error types/messages, filtering, layer order and SVG output for supported inputs. No export format has been disabled.

This reports failures detected by the current renderers. It is not a guarantee of native font metrics, image decoding, browser/Office fidelity or every possible clipping problem. Other analysis, image, layer, boundary and Excel checks remain separate, and final rendering still runs during export.

Synthetic checks reproduce the prior single page-level warning for two failing objects, verify individual navigation and background fallback, and compare valid SVGs and exceptions with the exact earlier implementation. An actual App workflow uses a1,000×30 source with two text failures and one analysis failure: review and locate each, explicitly repair only the requested dimensions, save and cold reopen while preserving cached values, source rows/fields and published history. Native browser/assistive technology, Office and OS downloads remain unverified.
