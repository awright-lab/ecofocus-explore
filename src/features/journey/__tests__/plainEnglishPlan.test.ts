import { beforeAll, expect, it, vi } from "vitest";
import type { ImportedDatasetRecord } from "../../../../shared/types/dashboard";
import type { SavedImportedAudience } from "../../../../shared/types/audience";
import { importDatasetBuffer } from "../../data/datasetImportModel";
import { initialDashboard } from "../../document/documentSeeds";
import { buildJourneyPages, prepareJourney, type JourneySetup } from "../questionJourneyModel";
import { confirmLocalQuestionSuggestion, suggestLocalQuestion } from "../plainEnglishPlan";
let dataset: ImportedDatasetRecord, audience: SavedImportedAudience;
beforeAll(async () => {
  const rows = ["Region,Segment,Spend,Income", ...Array.from({ length: 10 }, () => "North,Growth,10,30\nNorth,Steady,20,40\nSouth,Growth,30,50\nSouth,Steady,,60")];
  const imported = await importDatasetBuffer(new TextEncoder().encode(rows.join("\n")).buffer, "synthetic-planner.csv");
  dataset = imported.dataset!; dataset.title = "Planner synthetic study"; dataset.fields[1].researchConcepts = ["customer group"]; dataset.fields[2].researchConcepts = ["expenditure"];
  audience = { version: 1, id: "growth-audience", label: "Growth audience", datasetId: dataset.id, importedAt: dataset.importedAt, expression: { kind: "category", fieldId: dataset.fields[1].id, sourceColumn: dataset.fields[1].sourceColumn, values: ["Growth"], exclude: false } };
});
it.each([
  ["How many responses to Region?", "responses", "count", 0, "", ""],
  ["Count Region by Segment?", "compare", "count", 0, "", "banner"],
  ["What percentage of Region across customer group?", "compare", "percent_selected", 0, "", "banner"],
  ["Show share of Region?", "responses", "percent_selected", 0, "", ""],
  ["What is the average expenditure by Region for Growth audience?", "measure", "average", 0, "measure", ""],
  ["Total Spend by Region for all respondents?", "measure", "sum", 0, "measure", ""],
  ["show me the number of Region", "responses", "count", 0, "", ""],
  ['Average "Spend" by "Region".', "measure", "average", 0, "measure", ""],
] as const)("translates supported question %s to explicit local controls without running a query", (question, purpose, metric, field, measure, banner) => {
  const original = structuredClone({ dataset, audience }), fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  try {
    const proposal = suggestLocalQuestion(question, dataset, [audience]);
    expect(proposal.status).toBe("ready"); if (proposal.status !== "ready") throw Error(proposal.message);
    expect(proposal.plan).toMatchObject({ datasetId: dataset.id, importedAt: dataset.importedAt, fieldId: dataset.fields[field].id, purpose, metric, measureId: measure ? dataset.fields[2].id : "", bannerId: banner ? dataset.fields[1].id : "", chartType: "table" });
    expect(proposal.summary.find(item => item.label === "Calculation")?.reason).toContain("Unweighted"); expect(fetch).not.toHaveBeenCalled(); expect({ dataset, audience }).toEqual(original);
  } finally { vi.unstubAllGlobals(); }
});
it("makes the all-respondent default visible instead of implying an unstated audience", () => {
  const proposal = suggestLocalQuestion("Count Region", dataset);
  expect(proposal.status).toBe("ready"); if (proposal.status === "ready") expect(proposal.summary.find(item => item.label === "Audience")).toMatchObject({ value: "All respondents", reason: expect.stringContaining("visible default") });
});
it("requires clarification for ambiguous aliases and supports explicit raw-column disambiguation", () => {
  const changed = structuredClone(dataset); changed.fields[3].researchConcepts = ["expenditure"];
  expect(suggestLocalQuestion("Average expenditure by Region", changed).status).toBe("clarify");
  const proposal = suggestLocalQuestion("Average column Spend by Region", changed);
  expect(proposal.status).toBe("ready"); if (proposal.status === "ready") expect(proposal.plan.measureId).toBe(changed.fields[2].id);
});
it.each(["Which regions should we investigate for growth?", "Is Spend significantly higher in North?", "Average Spend by Region where Income > 40", "Average Spend by Region in 2025", "Count Region excluding South", "Average unknown by Region", "Average Spend", "What percentage of Region for unknown people", "Weighted average Spend by Region", "Show the trend in Spend over time", "Count Region by Region", "Total Segment by Region"])("asks rather than inventing a plan for %s", question => {
  const proposal = suggestLocalQuestion(question, dataset, [audience]); expect(proposal.status).toBe("clarify"); expect(proposal).not.toHaveProperty("plan");
});
it.each(["partial", "remote", "large", "missing version", "duplicate field", "duplicate column"])("refuses %s study context", kind => {
  const changed = structuredClone(dataset);
  if (kind === "partial") changed.rows.pop();
  if (kind === "remote") changed.remote = { provider: "netlify", projectUrl: "https://example.invalid", bucket: "test", objectPath: "synthetic", uploadedAt: changed.importedAt };
  if (kind === "large") { changed.rowCount = 50001; changed.rows = Array.from({ length: 50001 }, () => changed.rows[0]); }
  if (kind === "missing version") changed.importedAt = "";
  if (kind === "duplicate field") changed.fields[1].id = changed.fields[0].id;
  if (kind === "duplicate column") changed.fields[1].sourceColumn = changed.fields[0].sourceColumn;
  expect(suggestLocalQuestion("Count Region", changed).status).toBe("clarify");
});
it.each(["wrong import", "wrong study", "duplicate name", "duplicate id", "all collision"])("refuses %s audiences without falling back to everyone", kind => {
  const changed = structuredClone(audience); let list = [changed], phrase = changed.label;
  if (kind === "wrong import") changed.importedAt = "2000-01-01T00:00:00.000Z";
  if (kind === "wrong study") changed.datasetId += "-other";
  if (kind === "duplicate name") list = [changed, { ...structuredClone(changed), id: "other" }];
  if (kind === "duplicate id") list = [changed, { ...structuredClone(changed), label: "Other label" }];
  if (kind === "all collision") { changed.label = "All"; phrase = "All"; }
  expect(suggestLocalQuestion(`Count Region for ${phrase}`, dataset, list).status).toBe("clarify");
});
it.each(["question", "metadata", "audience"])("does not adopt stale %s proposals", kind => {
  const question = "Average Spend by Region for Growth audience", proposal = suggestLocalQuestion(question, dataset, [audience]);
  if (proposal.status !== "ready") throw Error(proposal.message);
  const changed = structuredClone(dataset), changedAudience = structuredClone(audience);
  if (kind === "metadata") changed.fields[2].label = "A changed measure label";
  if (kind === "audience") changedAudience.expression.exclude = true;
  expect(() => confirmLocalQuestionSuggestion(proposal, kind === "question" ? "Total Spend by Region" : question, changed, [changedAudience])).toThrow("changed");
});
it("preserves source snapshots and requires fresh calculation in the adopted existing workflow", () => {
  const question = "Average Spend by Region for Growth audience", proposal = suggestLocalQuestion(question, dataset, [audience]);
  if (proposal.status !== "ready") throw Error(proposal.message);
  const draft = structuredClone(initialDashboard); draft.importedDatasets = [dataset]; draft.savedAudiences = [audience];
  const before = structuredClone({ draft, dataset }), plan = confirmLocalQuestionSuggestion(proposal, question, dataset, [audience]);
  const setup: JourneySetup = { reportId: draft.id, question, headline: "Regional spending", ...plan };
  const preview = prepareJourney(draft, [dataset], setup);
  expect(preview.population.included).toBe(20); expect(preview.result.table.map(row => row.values.summary)).toEqual([10, 30]); expect(preview.result.table.map(row => row.bases.summary)).toEqual([10, 10]);
  const row = preview.result.table[0], column = preview.result.columns[0];
  const pages = buildJourneyPages(draft, [dataset], preview, { rowId: row.optionId, columnId: column.id, takeaway: "Recorded regional spending", implication: "Investigate context before acting." });
  expect(pages).toHaveLength(2); expect(pages.flatMap(page => page.elements).filter(element => element.evidence)).toHaveLength(4); expect({ draft, dataset }).toEqual(before);
});
