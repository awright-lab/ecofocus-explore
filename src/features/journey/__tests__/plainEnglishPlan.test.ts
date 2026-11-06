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

function quotedStudy() {
  const study = structuredClone(dataset);
  const make = (id: string, label: string, sourceColumn: string, numeric = false) => ({ ...structuredClone(study.fields[numeric ? 2 : 0]), id, label, sourceColumn, researchConcepts: undefined });
  study.fields.push(make("quoted-by", "Region by Segment", "QuotedBy"), make("quoted-for", "Region for Growth audience", "QuotedFor"), make("quoted-number", "Spend by Segment", "QuotedSpend", true));
  study.fieldCount = study.fields.length;
  study.rows.forEach(row => { row.QuotedBy = row.Region; row.QuotedFor = row.Region; row.QuotedSpend = row.Spend === "" ? "" : String(Number(row.Spend) * 10); });
  return study;
}
it.each(['Count "Region by Segment"', 'Count "Region for Growth audience"', 'Count \u201cRegion by Segment\u201d', 'Count column "QuotedBy"'])("keeps quoted operators inside an exact field name: %s", question => {
  const study = quotedStudy(), original = structuredClone(study), proposal = suggestLocalQuestion(question, study, [audience]);
  expect(proposal.status).toBe("ready"); if (proposal.status !== "ready") throw Error(proposal.message);
  expect(proposal.plan).toMatchObject({ purpose: "responses", metric: "count", bannerId: "", audienceId: "", fieldId: question.includes(" for ") ? "quoted-for" : "quoted-by" });
  const draft = { ...structuredClone(initialDashboard), importedDatasets: [study], savedAudiences: [audience] }, setup = { reportId: draft.id, question, headline: "Quoted field", ...proposal.plan };
  const preview = prepareJourney(draft, [study], setup); expect(preview.result.columns).toHaveLength(1); expect(preview.population.included).toBe(40); expect(study).toEqual(original);
});
it("separates quoted measure/group/audience names only at unquoted grammar boundaries", () => {
  const study = quotedStudy(), namedAudience = { ...structuredClone(audience), label: "Growth for Region by Segment" };
  const question = 'Average "Spend by Segment" by "Region for Growth audience" for "Growth for Region by Segment"';
  const proposal = suggestLocalQuestion(question, study, [namedAudience]); expect(proposal.status).toBe("ready");
  if (proposal.status !== "ready") throw Error(proposal.message);
  expect(proposal.plan).toMatchObject({ fieldId: "quoted-for", measureId: "quoted-number", audienceId: audience.id, bannerId: "", metric: "average" });
  const draft = { ...structuredClone(initialDashboard), importedDatasets: [study], savedAudiences: [namedAudience] };
  expect(prepareJourney(draft, [study], { reportId: draft.id, headline: "Quoted mean", question, ...proposal.plan }).result.table.map(row => row.values.summary)).toEqual([100, 300]);
});
it.each(['Count "Region by Segment"', 'Count "Region for Growth audience"', 'Count "Region by Segment', 'Count \u201cRegion by Segment"', "Count 'Region by Segment'", 'Count Region by Segment by Income', 'Count Region for Growth audience for everyone', 'Count "Region\\" by Segment"'])("clarifies absent, malformed or unsupported quoted grammar rather than silently changing meaning: %s", question => {
  const proposal = suggestLocalQuestion(question, dataset, [audience]); expect(proposal.status).toBe("clarify"); expect(proposal).not.toHaveProperty("plan");
});
it("binds raw-column mappings even when labels, IDs and import event remain unchanged", async () => {
  const imported = await importDatasetBuffer(new TextEncoder().encode("Region,Spend\nNorth,10\nNorth,30\nSouth,20\nSouth,40\n").buffer, "synthetic-binding.csv"), study = imported.dataset!;
  study.rows.forEach(row => { row.AlternateSpend = String(Number(row.Spend) * 10); });
  const question = "Average Spend by Region", proposal = suggestLocalQuestion(question, study);
  if (proposal.status !== "ready") throw Error(proposal.message);
  const draft = { ...structuredClone(initialDashboard), importedDatasets: [study] }, setup: JourneySetup = { reportId: draft.id, headline: "Mapping", question, ...proposal.plan };
  expect(prepareJourney(draft, [study], setup).result.table.map(row => row.values.summary)).toEqual([20, 30]);
  const oldSnapshot = structuredClone(proposal.sourceBindings); study.fields[1].sourceColumn = "AlternateSpend";
  expect(proposal.sourceBindings).toEqual(oldSnapshot); expect(() => confirmLocalQuestionSuggestion(proposal, question, study, [])).toThrow("changed");
  const fresh = suggestLocalQuestion(question, study); if (fresh.status !== "ready") throw Error(fresh.message);
  const matchingRenderedSummary = { ...structuredClone(proposal), summary: fresh.summary };
  expect(() => confirmLocalQuestionSuggestion(matchingRenderedSummary, question, study, [])).toThrow("changed");
  expect(fresh.sourceBindings.measure?.sourceColumn).toBe("AlternateSpend");
  expect(prepareJourney(draft, [study], { ...setup, ...confirmLocalQuestionSuggestion(fresh, question, study, []) }).result.table.map(row => row.values.summary)).toEqual([200, 300]);
});
it.each(["grouping", "comparison", "value labels", "source reference"])("invalidates changed %s source bindings", kind => {
  const study = structuredClone(dataset); study.sourceRef ??= { id: `imported:${study.id}`, kind: "imported_file", provider: "local_file", label: study.title, datasetId: study.id }; study.rows.forEach(row => { row.Alternate = row.Region; });
  const question = "Count Region by Segment", proposal = suggestLocalQuestion(question, study); if (proposal.status !== "ready") throw Error(proposal.message);
  if (kind === "grouping") study.fields[0].sourceColumn = "Alternate";
  if (kind === "comparison") { study.rows.forEach(row => { row.Alternate = row.Segment; }); study.fields[1].sourceColumn = "Alternate"; }
  if (kind === "value labels") study.fields[0].valueLabels = { North: "Different meaning" };
  if (kind === "source reference" && study.sourceRef) study.sourceRef.id += "-replacement";
  expect(() => confirmLocalQuestionSuggestion(proposal, question, study, [])).toThrow("changed");
});

it('retains adopted raw bindings through preview and page creation until explicitly reviewed',()=>{
 const study=structuredClone(dataset);study.rows.forEach(row=>{row.AlternateSpend=row.Spend===''?'':String(Number(row.Spend)*10);});const question='Average Spend by Region',proposal=suggestLocalQuestion(question,study);if(proposal.status!=='ready')throw Error(proposal.message);const draft={...structuredClone(initialDashboard),importedDatasets:[study]},setup:JourneySetup={reportId:draft.id,headline:'Bound fields',question,...confirmLocalQuestionSuggestion(proposal,question,study,[])};const preview=prepareJourney(draft,[study],setup);study.fields[2].sourceColumn='AlternateSpend';expect(()=>prepareJourney(draft,[study],setup)).toThrow('mappings or metadata changed');const row=preview.result.table[0],column=preview.result.columns[0];expect(()=>buildJourneyPages(draft,[study],preview,{rowId:row.optionId,columnId:column.id,takeaway:'Recorded mean',implication:'Review context'})).toThrow('mappings or metadata changed');
});
