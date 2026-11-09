# Zero-overlay PowerPoint label correction

The preflight composition label now distinguishes a hybrid-layer plan with zero native overlays from a page that actually has editable chart bodies or text/shapes. Tables, dot plots, image-only and empty pages can retain hybrid policy while emitting only their slide image. The label uses actual eligible overlay counts; complete-image fallbacks retain their existing explanation. No exporter or stored data behavior changed.

Four generated-PPTX regression cases inspect the image-only slide XML, with a structural raster stub rather than native rendering. The existing dialog page-switch test now checks the empty-page label. Native UI, accessibility, Office and production-build acceptance remain open. Goal 36 remains partial.
