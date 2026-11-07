import { expect, it } from "vitest";
import { formulaFixture } from "./formulaFixture";
import { commitCellFormula, planFromFormula, previewCellFormula } from "../cellFormulaCommands";
import { assertSavedCellFormulas, buildCellFormulaResponse, formulaCacheIssue, formulaSourceIssue, makeCellFormulaSpec } from "../cellFormulaModel";
import { assertExportResultsCurrent } from "../../export/exportIntegrity";
import { formatValue } from "../../builder/components/CanvasRenderers";
import { buildAnalyticalTemplateFromTile } from "../../builder/components/libraryReuseModel";
import { captureNarrativeCell } from "../../narratives/narrativeEvidence";
import { buildDerivedOutputDetailView } from "../../builder/components/derivedOutputModel";
import { buildInspectorTileSummary } from "../../builder/components/inspectorTileSummaryModel";
it("describes calculated provenance without lead-row, query-rerun or inherited survey-weight instructions", async () => {
  const { draft, plan } = await formulaFixture(), preview = previewCellFormula(draft, plan);
  const result = commitCellFormula(draft, plan, preview.token, "create").draft.pages[1].tiles[0];
  const view = buildInspectorTileSummary(result);
  expect(view.sourceKind).toBe("Calculated formula"); expect(view.editCue).toContain("Review and refresh formula");
  expect(JSON.stringify(view)).not.toMatch(/lead row|Imported query|dataset default|EcoFocus respondent weight/);
});
it("builds a reusable ratio/index on a shared response universe and preserves exact source", async () => {
  const { draft, plan } = await formulaFixture(), original = structuredClone(draft), preview = previewCellFormula(draft, plan);
  expect(preview.response.table[0].values.summary).toBe(300 / 700 * 100); expect(preview.metadata.formula!.input.base).toBe(1000); expect(preview.response.metric.id).toBe("calculated");
  expect(formatValue(3 / 7, "number", "calculated")).toBe("0.4286");
  const saved = commitCellFormula(draft, plan, preview.token, "create", { pageId: "metric-page", tileId: "metric-result" });
  expect(saved.draft.pages).toHaveLength(2); expect(saved.draft.pages[0]).toEqual(original.pages[0]); expect(saved.draft.importedDatasets).toEqual(original.importedDatasets); expect(draft).toEqual(original);
  expect(saved.draft.analysisLibrary.derivedDefinitions[0].source.kind).toBe("importedField"); expect(formulaCacheIssue(saved.draft.pages[1].tiles[0])).toBeNull(); expect(() => assertExportResultsCurrent(saved.draft.pages)).not.toThrow();
});
it("uses full-precision percentages instead of dividing rounded table percentages", async () => {
  const { draft, plan, source } = await formulaFixture(17, 13, true); plan.expression = "A / B";
  expect(source.result.table[0].values.summary).toBe(76.5); const preview = previewCellFormula(draft, plan);
  expect(preview.metadata.formula!.input.a.value).toBe(13 / 17 * 100); expect(preview.response.table[0].values.summary).toBeCloseTo(13 / 4, 14);
  expect(preview.response.table[0].values.summary).not.toBe(76.5 / 23.5);
});
it.each(["unequal bases", "zero base", "missing cell", "missing column", "same row", "ambiguous rows", "overlap", "weighted", "weight identity", "invalid audience", "pending", "changed import", "remote", "authored", "missing raw identity", "conflicting study"])("refuses incompatible %s without source mutation", async kind => {
  const { draft, plan, source } = await formulaFixture();
  if (kind === "unequal bases") source.result.table[1].bases.summary = 999;
  if (kind === "zero base") source.result.table.forEach(row => { row.bases.summary = 0; });
  if (kind === "missing cell") delete source.result.table[0].values.summary;
  if (kind === "missing column") plan.columnId = "absent";
  if (kind === "same row") plan.comparedRowId = plan.rowId;
  if (kind === "ambiguous rows") source.result.table.push(structuredClone(source.result.table[0]));
  if (kind === "overlap") source.result.table.forEach(row => { row.values.summary = 800; });
  if (kind === "weighted") source.result.weighting.applied = true;
  if (kind === "weight identity") source.result.weighting.id = "weightvar";
  if (kind === "invalid audience" && source.result.query.sourceIdentity?.kind === "imported") { source.result.query.sourceIdentity.audience = { version: 1 } as never; source.query = structuredClone(source.result.query); }
  if (kind === "pending") source.query.filters = [{ field: "GENERATION", values: ["x"] }];
  if (kind === "changed import") { const good = previewCellFormula(draft, plan); plan.expectedBinding = good.metadata.formula!.binding; if (source.result.query.sourceIdentity?.kind === "imported") source.result.query.sourceIdentity.datasetImportedAt = "2020-01-01T00:00:00Z"; }
  if (kind === "remote" && source.result.query.sourceIdentity?.kind === "imported") source.result.query.sourceIdentity.sourceRef!.kind = "workspace_database";
  if (kind === "authored") source.query.authoredVariableSet = { id: "x" } as typeof source.query.authoredVariableSet;
  if (kind === "missing raw identity") delete source.result.table[0].sourceCategoryKey;
  if (kind === "conflicting study") source.result.query.sourceRef!.datasetId = "another";
  const before = structuredClone(draft); expect(() => previewCellFormula(draft, plan)).toThrow(); expect(draft).toEqual(before);
});
it("requires current percentage inputs and refuses inconsistent rounded cells", async () => {
  const { source, plan } = await formulaFixture(17, 13, true); const config = { ...plan, formula: { expression: plan.expression, label: plan.label } };
  source.result.table[0].values.summary = 77; expect(() => makeCellFormulaSpec(source, config)).toThrow("disagree"); source.result.table[0].values.summary = 76.5;
  source.result.calculationInputs = undefined; expect(() => buildCellFormulaResponse(source, config)).toThrow("full-precision");
});
it("protects preview ownership and loaded saved bindings, then permits explicit rebinding", async () => {
  const { draft, plan, source } = await formulaFixture(), preview = previewCellFormula(draft, plan);
  source.result.table.find(row => row.optionId === plan.rowId)!.values.summary = 299; source.result.series.find(row => row.id === plan.rowId)!.values[0] = 299; expect(() => commitCellFormula(draft, plan, preview.token, "save")).toThrow("changed since preview"); source.result.table.find(row => row.optionId === plan.rowId)!.values.summary = 300; source.result.series.find(row => row.id === plan.rowId)!.values[0] = 300;
  const saved = commitCellFormula(draft, plan, preview.token, "save").draft, loaded = planFromFormula(saved, saved.analysisLibrary.derivedDefinitions[0]);
  saved.pages[0].tiles[0].result.table.find(row => row.optionId === plan.rowId)!.sourceCategoryKey = '"replacement"'; expect(() => previewCellFormula(saved, loaded)).toThrow("meaning changed");
  loaded.expectedBinding = ""; expect(previewCellFormula(saved, loaded).metadata.formula!.input.a.sourceCategoryKey).toBe('"replacement"');
});
it("refreshes only the chosen output after a source value change and preserves its layout", async () => {
  const { draft, plan } = await formulaFixture(); let current = commitCellFormula(draft, plan, previewCellFormula(draft, plan).token, "create", { pageId: "metric-page", tileId: "metric-result" }).draft;
  const output = current.pages[1].tiles[0], layout = structuredClone(output.layout), source = current.pages[0].tiles[0]; source.result.table.find(row => row.optionId === plan.rowId)!.values.summary = 200; source.result.series.find(row => row.id === plan.rowId)!.values[0] = 200;
  expect(formulaSourceIssue(output.derivedOutput!, source)).toContain("changed"); expect(() => assertExportResultsCurrent(current.pages)).toThrow("changed");
  const loaded = planFromFormula(current, current.analysisLibrary.derivedDefinitions[0], output.id), preview = previewCellFormula(current, loaded), beforeSource = structuredClone(source);
  current = commitCellFormula(current, loaded, preview.token, "refresh").draft;
  expect(current.pages[1].tiles[0].result.table[0].values.summary).toBe(200 / 700 * 100); expect(current.pages[1].tiles[0].layout).toEqual(layout); expect(current.pages[0].tiles[0]).toEqual(beforeSource); expect(() => assertExportResultsCurrent(current.pages)).not.toThrow();
});
it.each(["result", "base", "label", "value label", "expression", "input", "method note", "inference", "row identity", "removed metadata"])("rejects altered stored formula %s in validation and exports", async kind => {
  const { draft, plan } = await formulaFixture(), current = commitCellFormula(draft, plan, previewCellFormula(draft, plan).token, "create").draft, output = current.pages[1].tiles[0];
  if (kind === "result") output.result.table[0].values.summary = 999;
  if (kind === "base") output.result.table[0].bases.summary = 42;
  if (kind === "label") output.result.table[0].label = "false";
  if (kind === "value label") output.derivedOutput!.valueLabel = "999";
  if (kind === "expression") output.derivedOutput!.formula!.expression = "A+B";
  if (kind === "input") output.derivedOutput!.formula!.input.a.value = 400;
  if (kind === "method note") output.result.notes[0] = "proven causal effect";
  if (kind === "inference") output.result.statistics.significance.status = "tested";
  if (kind === "row identity") output.result.table[0].sourceCategoryKey = '"wrong"';
  if (kind === "removed metadata") output.derivedOutput = undefined;
  expect(formulaCacheIssue(output)).toBeTruthy(); expect(() => assertSavedCellFormulas(current.pages, current.analysisLibrary.derivedDefinitions)).toThrow(); expect(() => assertExportResultsCurrent(current.pages)).toThrow();
});
it("keeps recorded query and input snapshots independent of mutable source metadata", async () => {
  const { draft, plan } = await formulaFixture(), current = commitCellFormula(draft, plan, previewCellFormula(draft, plan).token, "create").draft;
  const output = current.pages[1].tiles[0], original = structuredClone(output), definition = structuredClone(current.analysisLibrary.derivedDefinitions[0]), source = current.pages[0].tiles[0];
  if (source.result.query.sourceIdentity?.kind !== "imported" || source.query.sourceIdentity?.kind !== "imported") throw Error("fixture");
  source.result.query.sourceIdentity.datasetImportedAt = "2020-01-01T00:00:00Z"; source.query.sourceIdentity.datasetImportedAt = "2020-01-01T00:00:00Z";
  expect(output).toEqual(original); expect(current.analysisLibrary.derivedDefinitions[0]).toEqual(definition); expect(formulaCacheIssue(output)).toBeNull(); expect(formulaSourceIssue(output.derivedOutput!, source)).toBeTruthy(); expect(() => assertExportResultsCurrent(current.pages)).toThrow();
});
it("does not invent source context when exporting an isolated metric page", async () => {
  const { draft, plan } = await formulaFixture(), current = commitCellFormula(draft, plan, previewCellFormula(draft, plan).token, "create").draft;
  expect(() => assertExportResultsCurrent([current.pages[1]])).toThrow("source is missing");
});
it("does not overwrite a saved definition changed after preview", async () => {
  const { draft, plan } = await formulaFixture(), saved = commitCellFormula(draft, plan, previewCellFormula(draft, plan).token, "save").draft;
  const loaded = planFromFormula(saved, saved.analysisLibrary.derivedDefinitions[0]), preview = previewCellFormula(saved, loaded);
  saved.analysisLibrary.derivedDefinitions[0].description = "Newer change"; expect(() => commitCellFormula(saved, loaded, preview.token, "save")).toThrow("changed since preview"); expect(saved.analysisLibrary.derivedDefinitions[0].description).toBe("Newer change");
});
it("keeps formulas out of ordinary query templates and withholds evidence when their upstream source changed", async () => {
  const { draft, plan } = await formulaFixture(), current = commitCellFormula(draft, plan, previewCellFormula(draft, plan).token, "create").draft, output = current.pages[1].tiles[0];
  expect(() => buildAnalyticalTemplateFromTile(output)).toThrow("saved calculation definitions");
  const ref = { tileId: output.id, rowId: "calculated_cell", columnId: "summary" }; expect(captureNarrativeCell(current.pages, ref).snapshot.value).toBe(300 / 700 * 100);
  const source = current.pages[0].tiles[0]; source.result.table.find(row => row.optionId === plan.rowId)!.values.summary = 200; source.result.series.find(row => row.id === plan.rowId)!.values[0] = 200;
  expect(() => captureNarrativeCell(current.pages, ref)).toThrow("changed");
});
it("uses semantic input equality for readiness across harmless serialized key reordering", async () => {
  const { draft, plan } = await formulaFixture(), current = commitCellFormula(draft, plan, previewCellFormula(draft, plan).token, "create").draft, source = current.pages[0].tiles[0], output = current.pages[1].tiles[0];
  source.result.query = Object.fromEntries(Object.entries(source.result.query).reverse()) as typeof source.result.query; source.query = structuredClone(source.result.query);
  expect(buildDerivedOutputDetailView(output, current.pages.flatMap(page => page.tiles))?.readinessStatus).toBe("current");
});
