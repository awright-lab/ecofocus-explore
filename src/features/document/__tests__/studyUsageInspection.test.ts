import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { formulaFixture } from "../../metrics/__tests__/formulaFixture";
import { createPublishedSnapshot, createReportRecord, normalizeDashboardWorkspace } from "../workspacePersistence";
import { inspectStudyUsage } from "../studyUsageInspection";
import { previewPreparation } from "../../data-preparation/preparationModel";
beforeEach(() => vi.stubGlobal("crypto", webcrypto)); afterEach(() => vi.unstubAllGlobals());
async function fixture() { const f = await formulaFixture(40, 12); const workspace = createPublishedSnapshot(normalizeDashboardWorkspace({ reports: [createReportRecord(f.draft)], importedDatasets: [f.dataset] }), f.draft).workspace; return { ...f, workspace }; }
it("projects unsaved current references and preparation dependencies without changing report timestamps, rows or stored history", async () => {
  const f = await fixture(), draft = structuredClone(f.workspace.reports[0].draft), originalDraft = structuredClone(draft);
  draft.title = "Unsaved current report"; draft.pages[0].tiles[0].title = "Unsaved analysis title";
  const prepared = await previewPreparation(f.dataset, [{ id: "trim-test", fieldId: f.dataset.fields[0].id, sourceColumn: "Answer", kind: "trim", from: [], to: "" }], "Prepared dependent copy"); f.workspace.importedDatasets.push(prepared.dataset);
  const before = JSON.stringify(f.workspace), edited = JSON.stringify(draft), result = inspectStudyUsage(f.workspace, f.dataset.id, { reportId: draft.id, draft, history: [originalDraft], future: [], isLoading: false });
  expect(result.references).toEqual(expect.arrayContaining([expect.objectContaining({ reportTitle: draft.title, location: expect.stringContaining("Unsaved analysis title") }), expect.objectContaining({ reportTitle: "Study library", location: "Preparation history: Prepared dependent copy" })]));
  expect(result.references.some(item => item.location.endsWith(": Responses"))).toBe(false); expect(result.editorBlocker).toContain("Undo or Redo"); expect(result.copies).toHaveLength(1); expect(result.unknownDependencies).toBe(false); expect(result.context).toContain("unsaved"); expect(JSON.stringify(f.workspace)).toBe(before); expect(JSON.stringify(draft)).toBe(edited);
  draft.pages[0].tiles[0].title = "Later title"; f.workspace.publishedSnapshots[0].title = "Later snapshot title"; expect(result.references.some(item => item.location.includes("Later title"))).toBe(false); expect(result.copies[0].reportTitle).not.toBe("Later snapshot title"); expect(Object.isFrozen(result)).toBe(true); expect(Object.isFrozen(result.references[0])).toBe(true);
});
it("distinguishes snapshot-owned versions from legacy snapshots that still require the current study", async () => {
  const f = await fixture(); f.workspace.reports[0].draft.pages[0].tiles = [];
  let result = inspectStudyUsage(f.workspace, f.dataset.id); expect(result.references).toHaveLength(0); expect(result.copies).toHaveLength(1);
  f.workspace.publishedSnapshots[0].dashboard.importedDatasets = []; result = inspectStudyUsage(f.workspace, f.dataset.id); expect(result.references.some(item => item.location.startsWith("Snapshot "))).toBe(true); expect(result.copies).toHaveLength(0);
});
it("records unknown source safeguards instead of suggesting a complete empty dependency list", async () => {
  const f = await fixture(); f.workspace.reports[0].draft.pages[0].tiles = []; Object.assign(f.workspace.reports[0].draft, { insightReviewPlans: [{ unsupported: true }] }); const before = JSON.stringify(f.workspace), result = inspectStudyUsage(f.workspace, f.dataset.id);
  expect(result.unknownDependencies).toBe(true); expect(result.references).toHaveLength(0); expect(result.safeguards).toHaveLength(1); expect(result.safeguards[0].location).toContain("Unreadable saved insight plans"); expect(JSON.stringify(f.workspace)).toBe(before);
});
it.each(["missing", "ambiguous", "missing-report", "ambiguous-report", "draft-id", "metadata"])("refuses %s rather than substituting an alternate identity", async reason => {
  const f = await fixture(), draft = structuredClone(f.workspace.reports[0].draft);
  if (reason === "missing") f.workspace.importedDatasets = []; if (reason === "ambiguous") f.workspace.importedDatasets.push(f.workspace.importedDatasets[0]); if (reason === "ambiguous-report") f.workspace.reports.push(f.workspace.reports[0]); if (reason === "draft-id") draft.id = "different-report"; if (reason === "metadata") Object.assign(f.workspace.importedDatasets[0], { title: { invalid: true } });
  const before = JSON.stringify(f.workspace); expect(() => inspectStudyUsage(f.workspace, f.dataset.id, { reportId: reason === "missing-report" ? "missing" : f.workspace.reports[0].id, draft, history: [], future: [], isLoading: false })).toThrow(); expect(JSON.stringify(f.workspace)).toBe(before);
});
it.each(["reports", "snapshots", "studies", "references"])("refuses excessive %s without silently truncating the returned list", async kind => {
  const f = await fixture(); if (kind === "reports") f.workspace.reports = Array(501).fill(f.workspace.reports[0]); if (kind === "snapshots") f.workspace.publishedSnapshots = Array(1001).fill(f.workspace.publishedSnapshots[0]); if (kind === "studies") f.workspace.importedDatasets = Array(1001).fill(f.dataset); if (kind === "references") f.workspace.reports[0].draft.pages[0].tiles = Array(5001).fill(f.workspace.reports[0].draft.pages[0].tiles[0]);
  expect(() => inspectStudyUsage(f.workspace, f.dataset.id)).toThrow();
});
it("reports the running-analysis retention guard independently of recorded references", async () => { const f = await fixture(), draft = f.workspace.reports[0].draft; draft.pages[0].tiles = []; expect(inspectStudyUsage(f.workspace, f.dataset.id, { reportId: draft.id, draft, history: [], future: [], isLoading: true }).editorBlocker).toContain("running analysis"); });

it("reports mixed valid Responses and unknown plans separately with exact counts and preserved metadata", async () => {
  const f = await fixture(); f.workspace.reports[0].draft.pages[0].tiles[0].title = "Responses"; Object.assign(f.workspace.reports[0].draft, { insightReviewPlans: [{ unsupported: true }] }); const before = JSON.stringify(f.workspace), result = inspectStudyUsage(f.workspace, f.dataset.id);
  expect(result.references).toHaveLength(1); expect(result.references[0].location).toContain(": Responses"); expect(result.safeguards).toHaveLength(1); expect(result.safeguards[0].location).toContain("Unreadable"); expect(result.unknownDependencies).toBe(true); expect(result.copies).toHaveLength(1); expect(Object.isFrozen(result.safeguards[0])).toBe(true); expect(JSON.stringify(f.workspace)).toBe(before);
});
