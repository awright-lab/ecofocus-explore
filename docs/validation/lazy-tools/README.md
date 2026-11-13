# Recoverable lazy-tool loading

The editor wraps its lazy analysis and design tools in an accessible loading/error surface. A pending tool can be closed; a later module resolution does not reopen an unmounted tool. The coordinator closes a pending or failed tool when another lazy tool takes ownership. Changing or replacing the report or entering viewer mode invalidates a pending or failed tool; a successfully opened tool retains its existing lifecycle. Existing tool implementations and save/recovery code are unchanged.

A rejected React.lazy import is cached, and browsers can also cache failed module fetches. The UI therefore does not offer a misleading import retry. It leaves the editor open and advises saving unsaved work if possible before a manual reload. A tool that fails during its initial render before any commit can be retried explicitly. Once a tool has committed, render errors offer Close instead of automatically remounting it, avoiding an automatic repeat of analytical effects. Error boundaries catch render/lifecycle failures, not errors in event handlers or asynchronous work.

Reproduce on a local Vite server with a compatible Chromium:

```sh
PLAYWRIGHT_MODULE=/path/to/playwright CHROMIUM_EXECUTABLE=/path/to/chrome node docs/validation/lazy-tools/verify-browser.mjs
npx vitest run src/features/builder/components/__tests__/LazyToolBoundary.test.tsx src/features/builder/components/__tests__/studioWorkflows.test.tsx src/features/quality/__tests__/localStudyJourney.test.tsx src/features/significance-review/__tests__/reportInsightParentWorkflow.test.tsx --maxWorkers=2 --testTimeout=30000
npm run typecheck
npm run build
```

The Chromium runner blocks non-local requests, seeds a synthetic study and reports, delays and rejects real Vite module requests, checks closure before completion, later successful tool opening, report/viewer changes, keyboard shortcuts and focus, and compares saved reports and studies. It captures desktop, narrow and native 200% zoom screenshots. This is a local development-server check, not a production deployment or live-service test. Automated checks do not replace screen-reader testing. The browser runner does not inject an actual tool render exception; that path and its retry distinction are covered by component tests.

Final validation on base `98f5544d7a9e6f1c3a80c68d0abe9c64a23c65a3`: The focused boundary, studio and actual-app journey run passed 21 tests. The final full suite passed 5,741 tests with four skips (424 files passed, two skipped). Skips were optional offline raster/document generation, two optional PowerPoint visual-generation tests and opt-in live Snowflake integration. Typecheck, build and CRLF-aware diff checks passed; build reported a large-chunk warning. Earlier full-suite attempts were stopped while invalidation, switching and loader-classification edges were addressed. No screen reader, live service, production build chunk failure, or actual browser render-exception injection was tested.
