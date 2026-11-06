import { afterEach, describe, expect, it, vi } from "vitest";
import { inspectWorkspaceBackupText, inspectWorkspaceBackupFile, maximumBackupInspectionBytes } from "../workspaceBackupInspection";
import { createWorkspaceBackup } from "../workspaceBackup";
import { initialDashboard } from "../documentSeeds";
import { createReportRecord, normalizeDashboardWorkspace, createPublishedSnapshot } from "../workspacePersistence";
import { importDatasetBuffer } from "../../data/datasetImportModel";
async function fixture() {
 const parsed = await importDatasetBuffer(new TextEncoder().encode("Answer,Spend\nYes,10\nNo,20\n").buffer, "synthetic.csv");
 const dataset = parsed.dataset!;
 const workspace = normalizeDashboardWorkspace({ reports: [createReportRecord(structuredClone(initialDashboard))], importedDatasets: [dataset] });
 return { workspace, dataset, backup: createWorkspaceBackup(workspace) };
}
const inspect = (value: unknown) => inspectWorkspaceBackupText(JSON.stringify(value));
afterEach(() => vi.unstubAllGlobals());
describe("read-only portable backup inspection", () => {
 it("recomputes inventory without changing either workspace or file", async () => {
  const { workspace, backup } = await fixture(), before = JSON.stringify(workspace), raw = JSON.stringify(backup);
  const result = inspectWorkspaceBackupText(raw, workspace);
  expect(result).toMatchObject({ reports: [{ pages: workspace.reports[0].draft.pages.length }], requiresSourceData: false, requiresRemoteAccess: false, currentOverlap: { sameWorkspaceId: true, differentStudyIds: [] } });
  expect(result.issues).toEqual([]); expect(result.studies[0]).toMatchObject({ storedRows: 2, coverage: "full_rows" });
  expect(JSON.stringify(workspace)).toBe(before); expect(JSON.stringify(backup)).toBe(raw);
 });
 it("does not trust a dishonest supplied inventory", async () => {
  const { backup } = await fixture(); backup.inventory.reports = 999;
  const result = inspect(backup); expect(result.reports).toHaveLength(1); expect(result.issues.some(issue => issue.scope === "inventory")).toBe(true);
 });
 it("keeps conflicting live copies and pending imports separate", async () => {
  const { workspace, dataset } = await fixture(); const other = structuredClone(dataset); other.rows[0].Answer = "Distinct";
  workspace.reports[0].draft.importedDatasets = [other];
  const result = inspect(createWorkspaceBackup(workspace, [dataset]));
  expect(result.studies).toHaveLength(3); expect(result.issues.some(issue => issue.scope === "workspace/reports")).toBe(true);
  expect(result.issues.some(issue => issue.scope === "pending-imports")).toBe(true);
 });
 it("allows historical snapshot data to differ from the live study", async () => {
  const { workspace, dataset } = await fixture(); const saved = createPublishedSnapshot(workspace, workspace.reports[0].draft).workspace;
  saved.publishedSnapshots[0].dashboard.importedDatasets = [structuredClone(dataset)];
  saved.publishedSnapshots[0].dashboard.importedDatasets[0].rows[0].Answer = "Historical";
  const result = inspect(createWorkspaceBackup(saved));
  expect(result.studies.some(study => study.scope.startsWith("snapshot:"))).toBe(true);
  expect(result.issues.some(issue => issue.scope === "workspace/reports")).toBe(false);
 });
 it("detects current-workspace conflicts without writing or fetching", async () => {
  const { workspace, dataset, backup } = await fixture(); dataset.rows[0].Answer = "Current edited"; workspace.importedDatasets = [dataset];
  const write = vi.fn(), fetcher = vi.fn(); vi.stubGlobal("window", { localStorage: { setItem: write } }); vi.stubGlobal("fetch", fetcher);
  const result = inspectWorkspaceBackupText(JSON.stringify(backup), workspace);
  expect(result.currentOverlap?.differentStudyIds).toEqual([dataset.id]); expect(write).not.toHaveBeenCalled(); expect(fetcher).not.toHaveBeenCalled();
 });
 it("discloses preview-only rows and missing fields conservatively", async () => {
  const { workspace, dataset } = await fixture(); dataset.rows = []; dataset.fieldCount = 5; workspace.importedDatasets = [dataset];
  const result = inspect(createWorkspaceBackup(workspace)); expect(result.requiresSourceData).toBe(true); expect(result.studies[0].coverage).toBe("preview_only");
 });
 it("keeps unreadable and duplicate records visible rather than normalizing them away", async () => {
  const { backup } = await fixture(); const payload = JSON.parse(backup.payload); const study = payload.importedDatasets[0];
  payload.importedDatasets.push(structuredClone(study), { id: "broken", title: "Broken", remote: { provider: "unknown" } }); backup.payload = JSON.stringify(payload);
  const result = inspect(backup); expect(result.studies).toHaveLength(3); expect(result.studies[2].coverage).toBe("unreadable"); expect(result.requiresRemoteAccess).toBe(true); expect(result.requiresSourceData).toBe(true);
  expect(result.issues.some(issue => issue.message.includes("Duplicate study ID"))).toBe(true);
 });
 it.each([{}, { kind: "ecofocus-workspace-backup", version: 2 }, { version: 1, format: "workspace-v1" }])("rejects untagged or unsupported formats without guessing %j", value => { expect(() => inspect(value)).toThrow(/not guessed/); });
 it("does not fabricate report defaults when raw collections are empty", async () => {
  const { backup } = await fixture(); const payload = JSON.parse(backup.payload); payload.reports = []; backup.payload = JSON.stringify(payload);
  const result = inspect(backup); expect(result.reports).toEqual([]); expect(result.issues.length).toBeGreaterThan(0);
 });
 it("rejects excessive nesting before decoding and handles quoted structural characters", async () => {
  expect(() => inspectWorkspaceBackupText("[".repeat(65) + "0" + "]".repeat(65))).toThrow(/budget/);
  const { backup } = await fixture(); const payload = JSON.parse(backup.payload); payload.label = 'Quotes \\" and {[ brackets'; backup.payload = JSON.stringify(payload);
  expect(inspect(backup).workspaceLabel).toBe(payload.label);
 });
 it("rejects oversized files before reading", async () => {
  const read = vi.fn(); await expect(inspectWorkspaceBackupFile({ size: maximumBackupInspectionBytes + 1, arrayBuffer: read })).rejects.toThrow(/10 MiB/); expect(read).not.toHaveBeenCalled();
 });
 it("rejects truncated reads and invalid UTF-8", async () => {
  await expect(inspectWorkspaceBackupFile({ size: 2, arrayBuffer: async () => new ArrayBuffer(1) })).rejects.toThrow(/incomplete/);
  await expect(inspectWorkspaceBackupFile({ size: 1, arrayBuffer: async () => new Uint8Array([255]).buffer })).rejects.toThrow(/UTF-8/);
 });
 it("preserves original bytes including BOM, whitespace and unknown extension data", async () => {
  const { backup } = await fixture(); const raw = "\uFEFF\r\n" + JSON.stringify({ ...backup, unknownExtension: { untouched: "é" } }) + "\r\n";
  const bytes = new TextEncoder().encode(raw); const result = await inspectWorkspaceBackupFile({ size: bytes.byteLength, arrayBuffer: async () => bytes.buffer });
  expect(new Uint8Array(result.originalBytes)).toEqual(bytes); expect(result.inspection.reports).toHaveLength(1);
 });
 it("cancels before reading or after an asynchronous read", async () => {
  const controller = new AbortController(), read = vi.fn(); controller.abort(); await expect(inspectWorkspaceBackupFile({ size: 0, arrayBuffer: read }, null, controller.signal)).rejects.toMatchObject({ name: "AbortError" }); expect(read).not.toHaveBeenCalled();
  const later = new AbortController(); await expect(inspectWorkspaceBackupFile({ size: 0, arrayBuffer: async () => { later.abort(); return new ArrayBuffer(0); } }, null, later.signal)).rejects.toMatchObject({ name: "AbortError" });
 });
});
