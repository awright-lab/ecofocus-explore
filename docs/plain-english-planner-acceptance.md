# Plain-English analysis planning — original goal 25 review candidate

Original goal: translate a plain-English question into a visible, editable analysis plan before running it, rather than inventing results. This candidate provides a bounded local grammar, integrated with the accepted question-to-insight workflow. It is a rules-based planner over declared metadata, not a general language model or a conversational research assistant. Independent original-scope acceptance remains pending.

## Complete workflow

Open **Start with a business question** from Analyze or command search. Enter a question, title and study. **Suggest analysis plan** translates supported explicit requests for response counts, response percentages, numeric means or totals. For example:

- `What percentage of [response field] by [comparison field]?`
- `How many responses to [response field]?`
- `Average [number] by [grouping field] for [saved audience]?`
- `Total [number] by [grouping field] for all respondents?`

Use actual field wording, a raw column name or an exact declared concept, omitting brackets. Counts/percentages may omit a comparison; a numeric request must name its grouping. `column [raw name]` explicitly disambiguates a raw column. Supported examples and the rule-based boundary are visible in the product.

The proposal shows the selected study, grouping, measure/comparison, calculation, audience and table output, with a reason for every choice. No query runs. An unstated audience visibly defaults to all respondents. An explicitly requested saved audience must match uniquely and retain valid import provenance; ambiguous names, duplicated identities and an `All` audience-name collision require clarification.

**Use editable plan** fills the existing controls. The user can change fields, metric, audience and output before the separate **Preview analysis** action. The deliverable title remains required. Preview computes from the local study; choosing an exact available cell, authoring the interpretation and explicitly reviewing the resulting pages precede the single report write. Undo, Redo, saving and reopening follow the existing document workflow. Closing preserves adopted choices in this tab's unfinished draft cache; proposals themselves are not persisted. No model/provider configuration, credential, service call or paid dependency is added.

## Refusal and scope

Unknown or ambiguous fields/concepts, unsupported conditions, weights, trends, significance and causal requests do not produce partial plans or guessed filters. Broad business questions such as “Which regions should we investigate for growth?” require an explicit manual analysis choice. Users can continue manually. The grammar does not support arbitrary paraphrases, named answer-value filters, free-form formulas, multiple numeric measures, general linguistic inference or separator words embedded ambiguously inside field/audience names. Unique raw-column wording or manual controls provide a fallback.

Changing the question, relevant metadata or audience invalidates an existing proposal; acceptance repeats translation against current context. Missing/partial/remote studies, invalid import events, conflicting field identities, stale audiences and studies above 50,000 rows are refused. Final preview and page creation independently revalidate source context through the existing workflow. These are recorded import checks, not immutable content authentication.

## Verification

41 new model/UI regressions cover supported language, metadata concepts, quoted fields and punctuation, explicit raw-column disambiguation, all-respondent defaults, unsupported/ambiguous requests, source and audience failures, stale proposals, no network/query/write before explicit adoption/preview, editable controls, title gating and the complete two-page creation workflow. Calculations and page-building use actual local modules. Final full-suite/type/build counts are recorded in the external review packet.

Actual App/native browser acceptance: 1,000 fabricated rows and 30 fields. The broad growth question requested clarification. “What is the average expenditure by Region for Growth audience?” matched declared concept `expenditure` to Spend, Region to grouping and the saved audience to its original import. The visible proposal had no results. Adopting the plan, editing sum/average and output, cancelling and command-based resumption left the exact saved page and entire study unchanged. Separate Preview produced means East51, North49, South50, West52, each with valid base125, among500 audience rows. The reviewed analysis and story pages were added in one edit with four current evidence links. Undo restored one original page; Redo/cold reopen restored three pages. Full saved study structure and original page remained exactly equal across all captures.

Actual browser builders produced PDF/PPTX/XLSX. Three complete PDF page rasters were decoded and visually inspected, with page count and cross-reference offsets checked; this was not rendering by an independent PDF interpreter. Office package CRC/XML/relationships/internal targets passed, and the native chart retained all four values/categories and base125 labels. All formats retained the question, authored text, scope and methodology. Native Office rendering and OS downloads remain unverified; earlier Office automation denial was not retried.

Reproducible fixture: `src/features/document/__tests__/fixtures/plainEnglishWorkflow.html`; it refuses unrelated workspace data. Evidence, hashes, complete saved-state comparisons, logs and limitations are in the external review packet. This does not establish remote/weighted/live Snowflake execution, cloud collaboration, broad AI question answering, source truth, full accessibility certification or production readiness. No merge or production deployment is implied.
