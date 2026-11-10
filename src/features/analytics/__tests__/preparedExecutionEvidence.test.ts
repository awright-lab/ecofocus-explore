// @vitest-environment jsdom
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { preparedEvidenceFixture } from "./preparedEvidenceFixture";
import { previewVersionedRefresh, applyVersionedRefresh, type VersionedRefreshContext } from "../versionedLocalRefresh";
import { verifyLocalExecution, validPreparedExecutionLineage } from "../../../../shared/analytics/localExecutionEvidence";
import { buildResultEvidence } from "../resultEvidence";
import { createReportRecord, normalizeDashboardWorkspace, saveDashboardWorkspace, loadDashboardWorkspace } from "../../document/workspacePersistence";
beforeEach(() => { vi.stubGlobal("crypto", webcrypto); localStorage.clear(); });
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });
const run = (context: VersionedRefreshContext, signal = new AbortController().signal) => previewVersionedRefresh(context, { signal });
it.each(["count", "percent_selected", "average", "sum"] as const)("records exact replayed preparation with unchanged %s arithmetic, persists it, and explains retained history", async metric => {
  const f = await preparedEvidenceFixture(metric), before = structuredClone(f.context), p = await run(f.context);
  expect(p.result.table).toEqual(f.tile.result.table); expect(p.result.columns).toEqual(f.tile.result.columns); expect(p.result.calculationInputs).toEqual(f.tile.result.calculationInputs); expect(await verifyLocalExecution(p.result)).toBe(true);
  expect(p.result.localExecution!.preparation).toEqual({ sourceTitle: f.original.title, recipe: f.prepared.preparation }); expect(JSON.parse(p.sourceText).preparation).toEqual(p.result.localExecution!.preparation); expect(f.context).toEqual(before);
  const draft = await applyVersionedRefresh(f.context, p), tile = draft.pages[0].tiles[0], facts = buildResultEvidence(tile, tile.result.table[0].optionId, tile.result.columns[0].id, true)!.facts;
  expect(facts.find(x => x.label === "Preparation source")!.value).toContain(f.original.id); expect(facts.find(x => x.label === "Preparation source version")!.value).toContain(f.prepared.preparation!.sourceFingerprint); expect(JSON.parse(facts.find(x => x.label === "Recorded preparation recipe")!.value)).toEqual(f.prepared.preparation);
  expect(saveDashboardWorkspace(normalizeDashboardWorkspace({ reports: [createReportRecord(draft)], importedDatasets: f.context.studies }))).toBe(true); const loaded = loadDashboardWorkspace(); expect(await verifyLocalExecution(loaded.reports[0].draft.pages[0].tiles[0].result)).toBe(true); expect(loaded.reports[0].draft.pages[0].tiles[0].result.localExecution).toEqual(p.result.localExecution); expect(loaded.importedDatasets.map(s => s.id).sort()).toEqual(f.context.studies.map(s => s.id).sort()); for (const expected of f.context.studies) { const found = loaded.importedDatasets.find(s => s.id === expected.id)!; expect(found.rows).toEqual(expected.rows); expect(found.fields).toEqual(expected.fields); expect(found.preparation).toEqual(expected.preparation); expect(found.importedAt).toBe(expected.importedAt); }
});
it.each(["missing-original", "duplicate-original", "original-value", "original-metadata", "prepared-value", "prepared-field", "fingerprint", "import-event", "live-reference", "nested-source", "oversize-recipe"] as const)("refuses %s lineage without substituting a different source or altering existing data", async change => {
  const f = await preparedEvidenceFixture();
  if (change === "missing-original") f.context.studies.shift(); if (change === "duplicate-original") f.context.studies.push(structuredClone(f.original)); if (change === "original-value") f.original.rows[0].Amount = "999"; if (change === "original-metadata") f.original.title = "Different source"; if (change === "prepared-value") f.prepared.rows[0].Amount = "999"; if (change === "prepared-field") f.prepared.fields[1].label = "Different meaning"; if (change === "fingerprint") f.prepared.preparation!.sourceFingerprint = "f".repeat(64); if (change === "import-event") f.prepared.preparation!.sourceImportedAt = "2030-01-01T00:00:00.000Z";
  if (change === "live-reference") f.original.sourceRef = { ...f.original.sourceRef!, kind: "live_connection", provider: "snowflake" }; if (change === "nested-source") f.original.preparation = structuredClone(f.prepared.preparation!);
  if (change === "oversize-recipe") f.prepared.preparation!.steps = Array.from({ length: 3 }, (_, i) => ({ ...f.prepared.preparation!.steps[1], id: `large-${i}`, from: Array.from({ length: 100 }, (_, n) => String(n).padEnd(512, "x")) }));
  const before = structuredClone(f.context); await expect(run(f.context)).rejects.toThrow(); expect(f.context).toEqual(before);
});
it.each(["original-unrelated-value", "prepared-unrelated-value", "original-reference"] as const)("refuses apply after %s changes even when displayed aggregates remain the same", async change => {
  const f = await preparedEvidenceFixture(), p = await run(f.context); if (change === "original-unrelated-value") f.original.rows[0].ID = "changed"; if (change === "prepared-unrelated-value") f.prepared.rows[0].ID = "changed"; if (change === "original-reference") f.original.sourceRef = { ...f.original.sourceRef!, label: "Changed source label" }; const changed = structuredClone(f.context); await expect(applyVersionedRefresh(f.context, p)).rejects.toThrow(); expect(f.context).toEqual(changed);
});
it("replays immutable source copies rather than transient live mutations across hashing", async () => {
  const f = await preparedEvidenceFixture(), before = structuredClone(f.context), expected = structuredClone(f.tile.result.table); let calls = 0;
  vi.stubGlobal("crypto", { subtle: { digest: async (...args: Parameters<typeof webcrypto.subtle.digest>) => { if (++calls === 1) { f.original.rows[0].Amount = "99999"; f.prepared.rows[0].Amount = "99999"; } if (calls === 2) { f.original.rows[0].Amount = "10"; f.prepared.rows[0].Amount = "10"; } return webcrypto.subtle.digest(...args); } } });
  const p = await run(f.context); expect(p.result.table).toEqual(expected); expect(await verifyLocalExecution(p.result)).toBe(true); expect(f.context).toEqual(before);
});
it("propagates cancellation through preparation replay and retains original analysis", async () => {
  const f = await preparedEvidenceFixture(), before = structuredClone(f.context), controller = new AbortController(); vi.stubGlobal("crypto", { subtle: { digest: async (...args: Parameters<typeof webcrypto.subtle.digest>) => { controller.abort(); return webcrypto.subtle.digest(...args); } } }); await expect(run(f.context, controller.signal)).rejects.toMatchObject({ name: "AbortError" }); expect(f.context).toEqual(before);
});
it.each(["source-title", "recipe-code", "recipe-fingerprint", "recipe-source", "step-kind"] as const)("rejects corrupted recorded %s instead of asserting recipe facts", async change => {
  const f = await preparedEvidenceFixture(), p = await run(f.context), r = p.result, line = r.localExecution!.preparation!;
  if (change === "source-title") line.sourceTitle = "Invented source"; if (change === "recipe-code") line.recipe.steps[1].to = "Invented category"; if (change === "recipe-fingerprint") line.recipe.sourceFingerprint = "f".repeat(64); if (change === "recipe-source") line.recipe.sourceDatasetId = r.localExecution!.datasetId; if (change === "step-kind") line.recipe.steps[0].kind = "unknown" as never;
  expect(await verifyLocalExecution(r)).toBe(false); const tile = { ...f.tile, result: r }; expect(buildResultEvidence(tile, r.table[0].optionId, r.columns[0].id)!.facts.some(x => x.label === "Recorded preparation recipe")).toBe(false);
});
it("bounds recorded lineage while leaving ordinary receipts compatible", async () => {
  const f = await preparedEvidenceFixture(); expect(validPreparedExecutionLineage({ sourceTitle: f.original.title, recipe: f.prepared.preparation })).toBe(true); expect(validPreparedExecutionLineage(null)).toBe(false); expect(validPreparedExecutionLineage({ sourceTitle: "", recipe: f.prepared.preparation })).toBe(false); expect(validPreparedExecutionLineage({ sourceTitle: "Source", recipe: undefined })).toBe(false);
});

it.each(["original", "prepared"] as const)("refuses an explicitly foreign %s source reference", async which => {
 const f = await preparedEvidenceFixture(), study = which === "original" ? f.original : f.prepared; study.sourceRef = { ...(study.sourceRef ?? { id: "local-ref", kind: "imported_file", provider: "local_file", label: study.title }), datasetId: "foreign-study" }; const before = structuredClone(f.context); await expect(run(f.context)).rejects.toThrow(); expect(f.context).toEqual(before);
});
it("retains recorded preparation facts when current library data is missing or changed, without claiming currentness", async () => {
 const f = await preparedEvidenceFixture(), p = await run(f.context), captured = structuredClone(p.result.localExecution!.preparation); f.original.title = "Later mutable name"; f.prepared.preparation!.steps[1].to = "Later recipe"; f.context.studies = []; expect(await verifyLocalExecution(p.result)).toBe(true); const tile = { ...f.tile, result: p.result }, view = buildResultEvidence(tile, p.result.table[0].optionId, p.result.columns[0].id, true)!; expect(JSON.parse(view.facts.find(x => x.label === "Recorded preparation recipe")!.value)).toEqual(captured!.recipe); expect(view.facts.find(x => x.label === "Preparation source")!.value).toContain(captured!.sourceTitle); expect(view.facts.find(x => x.label === "Preparation verification")!.value).toContain("does not recheck current studies"); await expect(applyVersionedRefresh(f.context, p)).rejects.toThrow();
});

import { preparationFingerprint } from "../../data-preparation/preparationModel";
import { allRespondentsGroupingField } from "../../data/numericSummaryScope";
import { resolveSavedImportedQuery } from "../../data/savedImportedQuery";
import { runImportedDatasetQuery } from "../../data/importedDatasetAnalytics";
it.each(["Amount", "Banner", "Filter", "Member"])("retains case-varied untransformed %s keys in prepared lineage and exact engine calculation", async role => {
 const f = await preparedEvidenceFixture();
 for (const study of [f.original, f.prepared]) study.rows = study.rows.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key === role ? key.toLowerCase() : key, value])));
 f.prepared.preparation!.sourceFingerprint = await preparationFingerprint(f.original); const before = structuredClone(f.context), p = await run(f.context); expect(p.result.table).toEqual(f.tile.result.table); expect(await verifyLocalExecution(p.result)).toBe(true); expect(f.context).toEqual(before);
});
it("supports an overall prepared numeric summary without inventing grouping exclusions", async () => {
 const f = await preparedEvidenceFixture(), config = resolveSavedImportedQuery(f.tile.result.query, f.context.studies), field = allRespondentsGroupingField(f.prepared), result = runImportedDatasetQuery({ ...config, field, groupingScope: "all_respondents" }); f.tile.result = result; f.tile.query = structuredClone(result.query); f.tile.source = { kind: "importedField", id: "overall-prepared", datasetId: f.prepared.id, fieldId: field.id, label: "All respondents" };
 const before = structuredClone(f.context), p = await run(f.context); expect(p.result.table).toEqual(result.table); expect(p.result.localExecution!.coverage.missingGrouping).toBe(0); expect(p.result.localExecution!.preparation!.recipe).toEqual(f.prepared.preparation); expect(await verifyLocalExecution(p.result)).toBe(true); expect(f.context).toEqual(before);
});
it("replays and records the complete50000-row prepared boundary without changing either study", async () => {
 const f = await preparedEvidenceFixture("count", 50000), before = JSON.stringify(f.context.studies), p = await run(f.context); expect(p.result.table).toEqual(f.tile.result.table); expect(p.result.localExecution!.coverage.sourceRows).toBe(50000); expect(await verifyLocalExecution(p.result)).toBe(true); expect(JSON.stringify(f.context.studies)).toBe(before);
}, 45000);
