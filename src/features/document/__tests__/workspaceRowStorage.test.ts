import { afterEach, describe, expect, it, vi } from "vitest";
import { decodeImportedRows, encodeImportedRows } from "../workspaceRowStorage";
import { createReportRecord, legacyWorkspaceStorageKey, loadDashboardWorkspace, normalizeDashboardWorkspace, readStoredWorkspaceCopy, saveDashboardWorkspace, upsertWorkspaceImportedDataset, workspaceStorageKey } from "../workspacePersistence";
import { storageKey } from "../../builder/builderConstants";
import { initialDashboard } from "../documentSeeds";
import { syntheticStudy, syntheticStudySums } from "./fixtures/syntheticStudy";
import { importedDatasetHasQueryableRows } from "../../data/importedDatasetAnalytics";

describe("lossless respondent storage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("round trips raw strings, Unicode, blanks, missing cells and unusual column names without mutation", async () => {
    const { dataset } = await syntheticStudy(1000, 30);
    dataset.rows[0] = Object.fromEntries([["zero", "0"], ["empty", ""], ["unicode", "é 🌿"], ["__proto__", "answer"], ["quoted", 'a,"b"\nnext']]);
    const before = structuredClone(dataset);
    const packed = encodeImportedRows(dataset);
    expect(packed.rows).toEqual([]);
    expect(decodeImportedRows(JSON.parse(JSON.stringify(packed))).rows).toEqual(dataset.rows);
    expect(dataset).toEqual(before);
  });

  it("rejects a damaged encoding instead of fabricating missing values", async () => {
    const { dataset } = await syntheticStudy(1000, 30);
    const stored = encodeImportedRows(dataset);
    stored.rowStorage!.values[0].pop();
    expect(() => decodeImportedRows(stored)).toThrow("unsupported or damaged");
  });

  it("reads the v1 workspace and writes v2 without deleting the original", async () => {
    const { dataset } = await syntheticStudy(1000, 30);
    const original = normalizeDashboardWorkspace({ reports: [createReportRecord(structuredClone(initialDashboard))], importedDatasets: [dataset] });
    const old = JSON.stringify(original);
    const storage = new Map([[legacyWorkspaceStorageKey, old]]);
    vi.stubGlobal("window", { localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) } });
    expect(loadDashboardWorkspace().importedDatasets[0].rows).toEqual(dataset.rows);
    expect(saveDashboardWorkspace(loadDashboardWorkspace())).toBe(true);
    expect(storage.get(legacyWorkspaceStorageKey)).toBe(old);
    expect(JSON.parse(storage.get(workspaceStorageKey)!).importedDatasets[0].rowStorage.version).toBe(1);
    expect(syntheticStudySums(loadDashboardWorkspace().importedDatasets[0])).toEqual(syntheticStudySums(dataset));
  });

  it("does not analyze a legacy preview as if it were the complete study", async () => {
    const { dataset } = await syntheticStudy(1000, 30);
    const partial = { ...dataset, rows: [], previewRows: dataset.previewRows.slice(0, 25) };
    expect(importedDatasetHasQueryableRows(partial)).toBe(false);
    expect(() => syntheticStudySums(partial)).toThrow("complete respondent data");
    expect(() => syntheticStudySums({ ...partial, rows: dataset.rows.slice(0, 30) })).toThrow("complete respondent data");
  });

  it.each([workspaceStorageKey, legacyWorkspaceStorageKey, storageKey])("preserves damaged saved data at %s instead of opening a replacement workspace", (key) => {
    for (const raw of ["{damaged", "", JSON.stringify({ reports: [], importedDatasets: [{ id: "valuable-study" }] }), JSON.stringify({ reports: [{}] })]) {
      const storage = new Map([[key, raw]]);
      const write = vi.fn();
      vi.stubGlobal("window", { localStorage: { getItem: (name: string) => storage.get(name) ?? null, setItem: write } });
      expect(() => loadDashboardWorkspace()).toThrow();
      expect(readStoredWorkspaceCopy()).toBe(raw);
      expect(storage.get(key)).toBe(raw);
      expect(write).not.toHaveBeenCalled();
    }
  });

  it("fails closed when storage reads are blocked", () => {
    vi.stubGlobal("window", { localStorage: { getItem: () => { throw new Error("Access denied"); } } });
    expect(() => loadDashboardWorkspace()).toThrow("Access denied");
  });

  it("still migrates a valid legacy single report with complete rows", async () => {
    const { dataset } = await syntheticStudy(1000, 30);
    const draft = { ...structuredClone(initialDashboard), importedDatasets: [dataset] };
    const raw = JSON.stringify(draft);
    vi.stubGlobal("window", { localStorage: { getItem: (key: string) => key === storageKey ? raw : null } });
    expect(loadDashboardWorkspace().reports[0].draft.title).toBe(draft.title);
    expect(loadDashboardWorkspace().importedDatasets[0].rows).toEqual(dataset.rows);
  });

  it("replaces a same-id study without dropping unrelated studies or mutating the old workspace", async () => {
    const { dataset } = await syntheticStudy(1000, 30);
    const original = normalizeDashboardWorkspace({ reports: [createReportRecord(structuredClone(initialDashboard))], importedDatasets: [dataset, { ...dataset, id: "unrelated" }] });
    const replacement = { ...dataset, title: "Recovered complete study", rows: dataset.rows.map((row) => ({ ...row, Spend: "123.456" })) };
    const next = upsertWorkspaceImportedDataset(original, replacement);
    expect(next.importedDatasets).toHaveLength(2);
    expect(next.importedDatasets.find((item) => item.id === dataset.id)?.rows).toEqual(replacement.rows);
    expect(next.importedDatasets.find((item) => item.id === "unrelated")?.rows).toEqual(dataset.rows);
    expect(original.importedDatasets.find((item) => item.id === dataset.id)?.title).toBe(dataset.title);
  });
});
