# Question-to-insight workflow — original goal 9 scoped acceptance

Original goal: guide users from a business question through selecting an audience, reviewing results and creating a deliverable. This workflow connects those steps in one explicit workflow. Independent review accepted remote commit 23e6fe44 for complete local unweighted studies up to 50,000 rows.

## Product workflow

Open Analyze and choose **Start with a business question**, or find the same command through **Find a tool**. Enter the question and a report headline, choose a complete imported study, search its declared question metadata, and select a grouping field. Choose response distribution, comparison across groups or a numeric summary, its compatible fields, metric, audience and chart. The accepted goal9 flow uses explicit manual choices and a visible editable plan. Optional rule-based translation is a separate goal25 review candidate, documented in `plain-english-planner-acceptance.md`; it does not invent answers.

Preview runs the existing local query engine. It shows audience inclusion and unknown-membership counts, actual results, cell sample bases and assumptions. Select an exact available result cell, write a takeaway and an interpretation, then review two page previews. Explicit confirmation creates an evidence page and an editable story page together in one document edit. Undo removes both; Redo restores both. Existing pages and respondent rows are preserved. The source scope, takeaway, interpretation and methodology are evidence-linked so changed source results require review before formatted export.

Closing retains unfinished wording and choices for this report in this tab's memory. Reopening requires a fresh preview, result selection and confirmation. This is not durable draft recovery. Import remains available through the existing importer. Existing analysis and story tools remain usable.

## Safety and scope

- Complete local imported studies, unweighted calculations, at most 50,000 rows. Remote, partial or replaced imports, ambiguous identities and incompatible fields fail with an explanation. Audience provenance is checked against the selected import.
- Changes to the study, saved audience, report or calculated result invalidate the preview. The final document command repeats validation against the current shared study registry before appending either page. Failed creation retains authored wording. Double submission is blocked.
- The results preview displays at most 100 rows and 8 columns; exact-finding search reaches further answers. Selected options remain visible after search changes. Counts describe displayed limits explicitly.
- Page fit checks reject overflowing deliverables instead of truncating user text. Native testing exposed insufficient room for a normal interpretation and source citation; source scope and story interpretation layouts were adjusted and the exact wording retained in regressions. Existing saved page layouts are unchanged.
- Dialog focus containment, background Delete isolation, Escape, error retry and input-method composition are covered. Escape does not discard active IME composition. This is not full screen-reader or touch certification.
- No natural-language inference, live Snowflake, remote execution, survey-weighted inference, immutable content authentication, cloud sharing, production deployment or crash-resistant writer claim is made.

## Verification

35 new model/component regressions cover the complete steps, positive distribution/comparison/numeric deliverables, source and audience drift, data preservation, save/reopen, four evidence links, methodology drift, stale export refusal, cancellation, consent, retry, search and keyboard behavior. Full suite: **1,755 passed, 2 skipped**; TypeScript and production build passed. Existing bundle-size warnings remain.

Actual desktop browser acceptance used the actual App, renderer, command palette and local writer with 1,000 fabricated rows and 30 fields. Growth audience included 500 rows; each region was 25%, cell base 500. The workflow created two pages alongside the exact original page, with four current evidence links. Cancel preserved one original page; creation, Undo, Redo and cold reopen produced respectively 3, 1, 3 and 3 saved pages, preserving the exact original page and unchanged row/field counts. Model tests separately verify source equality. Closing and command-based reopening retained wording but required a new preview and consent. Both page previews were visually inspected.

Actual browser format builders produced a three-page PDF, three-slide PPTX and six-sheet XLSX from the saved report. PDF object offsets/page count and its three fully decoded embedded page rasters were checked; all three rasters were visually inspected for complete text, source context, values and layout. This is inspection of browser-generated PDF raster content, not rendering by an independent PDF interpreter. Office ZIP CRC, XML, relationships and internal targets passed inspection; the native chart retained all four categories and values 25 with labels 25% (n=500). Both packages retained the question, authored text, audience context and methodology. Native PowerPoint/Excel rendering, app-menu OS download and live services remain unverified. Earlier Office automation denial was not retried.

Reproducible synthetic fixture: `src/features/document/__tests__/fixtures/questionJourneyWorkflow.html`. The fixture refuses unrelated workspace data and exposes inspection and format-building controls. It is test-only; it does not enable recovery or restore in the product. Detailed logs, saved-state comparisons, screenshots, actual artifacts and hashes are in the external review packet.

Independent review subsequently rendered the actual PDF and verified the artifacts. Unfinished plans remain memory-only; remote/weighted, live Snowflake, native Office rendering and downloads are outside accepted scope.
