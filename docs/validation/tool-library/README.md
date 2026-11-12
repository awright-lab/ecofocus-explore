# Tool Library validation

From the repository root, install dependencies and run:

```sh
PLAYWRIGHT_MODULE=/path/to/playwright CHROMIUM_EXECUTABLE=/path/to/chrome node docs/validation/tool-library/verify-browser.mjs
npm test -- src/features/builder/components/__tests__/studioWorkflows.test.tsx src/features/builder/components/__tests__/toolCatalog.test.ts
npm run typecheck
npm run build
```

The browser runner uses a temporary browser profile and two-row synthetic study, blocks non-local requests, and checks five task searches, keyboard selection, Escape and focus restoration, opening numeric relationships, responsive widths and native 200% zoom. It compares saved reports, studies and published snapshots before and after browsing. Screenshots and machine-readable results are alongside this file. It does not test a screen reader, live services, every command's effects, or in-memory undo/redo history.
