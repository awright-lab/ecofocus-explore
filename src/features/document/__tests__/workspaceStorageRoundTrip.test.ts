import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ImportedDatasetRecord } from "../../../../shared/types/dashboard";
import { importDatasetBuffer } from "../../data/datasetImportModel";
import { runImportedDatasetQuery } from "../../data/importedDatasetAnalytics";
import {
  createPublishedSnapshot,
  createReportRecord,
  loadDashboardWorkspace,
  normalizeDashboardWorkspace,
  saveDashboardWorkspace,
  workspaceStorageKey
} from "../workspacePersistence";
import { syntheticStudy, syntheticStudySums, expectedSyntheticSums } from "./fixtures/syntheticStudy";
import { initialDashboard } from "../documentSeeds";

describe("workspace storage round trip", () => {
  let stored: Map<string, string>;

  beforeEach(() => {
    stored = new Map();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => stored.get(key) ?? null,
        setItem: (key: string, value: string) => { stored.set(key, value); }
      }
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  async function importedDataset() {
    const csv = new TextEncoder().encode("Segment,Spend\nCore,10\nCore,20\nGrowth,5\n");
    const result = await importDatasetBuffer(csv.buffer, "customers.csv");
    expect(result.error).toBeUndefined();
    return result.dataset!;
  }

  function workspaceWithDataset(dataset: ImportedDatasetRecord) {
    const draft = { ...structuredClone(initialDashboard), importedDatasets: [dataset] };
    return normalizeDashboardWorkspace({
      reports: [createReportRecord(draft)],
      importedDatasets: [dataset]
    });
  }

  it.each(["local", "supabase"] as const)("preserves all %s rows and analysis after saving and publishing", async (provider) => {
    const dataset = await importedDataset();
    if (provider === "supabase") {
      dataset.remote = {
        provider: "supabase", projectUrl: "https://example.supabase.co",
        bucket: "imports", objectPath: "customers.csv", uploadedAt: dataset.importedAt
      };
    }
    const query = (input: ImportedDatasetRecord) => runImportedDatasetQuery({
      dataset: input, field: input.fields[0], measureField: input.fields[1],
      bannerField: null, filter: null, chartType: "vertical_bar", metric: "sum"
    });
    const before = query(dataset);
    const workspace = workspaceWithDataset(dataset);
    const published = createPublishedSnapshot(workspace, workspace.reports[0].draft);
    const original = structuredClone(published.workspace);

    expect(saveDashboardWorkspace(published.workspace)).toBe(true);
    const loaded = loadDashboardWorkspace();
    expect(loaded.importedDatasets[0].rows).toEqual(dataset.rows);
    expect(query(loaded.importedDatasets[0]).table).toEqual(before.table);
    expect(loaded.publishedSnapshots[0].versionLabel).toBe("v1");
    // Drafts share workspace data; snapshots retain their historical study copy.
    expect(loaded.reports[0].draft.importedDatasets).toEqual([]);
    expect(loaded.publishedSnapshots[0].dashboard.importedDatasets[0].rows).toEqual(dataset.rows);
    expect(query(loaded.publishedSnapshots[0].dashboard.importedDatasets[0]).table).toEqual(before.table);
    expect(published.workspace).toEqual(original);
  });

  it("keeps server-queryable Netlify datasets compact", async () => {
    const dataset = await importedDataset();
    dataset.remote = {
      provider: "netlify", projectUrl: "", bucket: "", objectPath: "customers.csv",
      uploadedAt: dataset.importedAt, recordId: "customers"
    };
    expect(saveDashboardWorkspace(workspaceWithDataset(dataset))).toBe(true);
    const loaded = loadDashboardWorkspace().importedDatasets[0];
    expect(loaded.rows).toEqual([]);
    expect(loaded.rowCount).toBe(3);
    expect(loaded.remote?.recordId).toBe("customers");
    expect(dataset.rows).toHaveLength(3);
  });

  it("reports a full-storage failure without replacing the last saved workspace", async () => {
    const dataset = await importedDataset();
    const workspace = workspaceWithDataset(dataset);
    expect(saveDashboardWorkspace(workspace)).toBe(true);
    const lastSaved = stored.get(workspaceStorageKey);
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new DOMException("Full", "QuotaExceededError");
    });
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      expect(saveDashboardWorkspace({ ...workspace, label: "Unsaved edits" })).toBe(false);
      expect(stored.get(workspaceStorageKey)).toBe(lastSaved);
      expect(workspace.importedDatasets[0].rows).toEqual(dataset.rows);
    } finally {
      vi.restoreAllMocks();
    }
    expect(warning).toHaveBeenCalled();
  });

// Historical copies deliberately share IDs with current studies but not their values.
it.each(["changed", "removed"] as const)("retains a 1000-row snapshot after its current study is %s", async (action) => {
  const { dataset } = await syntheticStudy(1000, 30);
  const result = runImportedDatasetQuery({ dataset, field: dataset.fields[1], measureField: dataset.fields[3], metric: "sum", chartType: "table" });
  const draft = { ...structuredClone(initialDashboard), importedDatasets: [] };
  draft.pages[0].tiles = [{ ...draft.pages[0].tiles[0], query: result.query, result, source: { kind: "importedField", id: dataset.id, label: "Region", datasetId: dataset.id, fieldId: dataset.fields[1].id } }];
  const workspace = normalizeDashboardWorkspace({ reports: [createReportRecord(draft)], importedDatasets: [dataset] });
  workspace.importedDatasets.push({ ...structuredClone(dataset), id: "unrelated-study" });
  const published = createPublishedSnapshot(workspace, workspace.reports[0].draft);
  expect(published.snapshot.dashboard.importedDatasets).toHaveLength(1);
  expect(published.snapshot.dashboard.importedDatasets[0].rows).toEqual(dataset.rows);
  const current = structuredClone(dataset); current.rows[0].Spend = "99999"; current.fields[3].label = "New measure label";
  published.workspace.importedDatasets = action === "removed" ? [] : [current];
  published.workspace.reports[0].draft.importedDatasets = [];
  const before = structuredClone(published.workspace);
  expect(saveDashboardWorkspace(published.workspace)).toBe(true);
  const loaded = loadDashboardWorkspace();
  const historical = loaded.publishedSnapshots[0].dashboard.importedDatasets[0];
  expect(historical.rows).toEqual(dataset.rows); expect(historical.fields).toEqual(dataset.fields);
  expect(syntheticStudySums(historical)).toEqual(expectedSyntheticSums(1000));
  expect(loaded.publishedSnapshots[0].dashboard.pages[0].tiles[0].result.table).toEqual(result.table);
  expect(loaded.importedDatasets).toHaveLength(action === "removed" ? 0 : 1);
  if (action === "changed") expect(loaded.importedDatasets[0].rows[0].Spend).toBe("99999");
  expect(published.workspace).toEqual(before);
  expect(saveDashboardWorkspace(loaded)).toBe(true);
  expect(loadDashboardWorkspace().publishedSnapshots[0].dashboard.importedDatasets[0]).toEqual(historical);
});

  it("keeps historical remote metadata and available rows without applying mutable-workspace compaction", async () => {
    const { dataset } = await syntheticStudy(100, 90);
    dataset.remote = { provider: "netlify", projectUrl: "", bucket: "", objectPath: "synthetic.csv", uploadedAt: dataset.importedAt };
    const workspace = workspaceWithDataset(dataset);
    const published = createPublishedSnapshot(workspace, workspace.reports[0].draft);
    expect(saveDashboardWorkspace(published.workspace)).toBe(true);
    const loaded = loadDashboardWorkspace();
    expect(loaded.importedDatasets[0].fields).toHaveLength(80);
    expect(loaded.importedDatasets[0].rows).toEqual([]);
    expect(loaded.publishedSnapshots[0].dashboard.importedDatasets[0].fields).toEqual(dataset.fields);
    expect(loaded.publishedSnapshots[0].dashboard.importedDatasets[0].rows).toEqual(dataset.rows);
  });

  it("does not fabricate historical studies for older stripped snapshots", async () => {
    const dataset = await importedDataset(); const workspace = workspaceWithDataset(dataset);
    const published = createPublishedSnapshot(workspace, workspace.reports[0].draft);
    published.workspace.publishedSnapshots[0].dashboard.importedDatasets = [];
    expect(saveDashboardWorkspace(published.workspace)).toBe(true);
    expect(loadDashboardWorkspace().publishedSnapshots[0].dashboard.importedDatasets).toEqual([]);
  });

  it("rejects a snapshot that exceeds storage quota without replacing the saved draft", async () => {
    const { dataset } = await syntheticStudy(1000, 30); const workspace = workspaceWithDataset(dataset);
    expect(saveDashboardWorkspace(workspace)).toBe(true); const lastSaved = stored.get(workspaceStorageKey)!;
    const published = createPublishedSnapshot(workspace, workspace.reports[0].draft); const before = structuredClone(published.workspace);
    vi.spyOn(window.localStorage, "setItem").mockImplementation((_key, raw) => {
      if (raw.length > lastSaved.length + 1000) throw new DOMException("Full", "QuotaExceededError");
      stored.set(_key, raw);
    });
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      expect(saveDashboardWorkspace(published.workspace)).toBe(false);
      expect(stored.get(workspaceStorageKey)).toBe(lastSaved);
      expect(loadDashboardWorkspace().publishedSnapshots).toEqual([]);
      expect(published.workspace).toEqual(before);
      expect(warning).toHaveBeenCalledOnce();
    } finally { vi.restoreAllMocks(); }
  });

  it("retains two independently queryable snapshot versions of the same study", async () => {
    const dataset = await importedDataset(); const workspace = workspaceWithDataset(dataset);
    const first = createPublishedSnapshot(workspace, workspace.reports[0].draft);
    const changed = structuredClone(dataset); changed.rows[0].Spend = "100";
    first.workspace.importedDatasets = [changed];
    const second = createPublishedSnapshot(first.workspace, first.dashboard);
    expect(saveDashboardWorkspace(second.workspace)).toBe(true);
    const loaded = loadDashboardWorkspace();
    expect(loaded.publishedSnapshots.map(snapshot => snapshot.versionLabel)).toEqual(["v2", "v1"]);
    const [latest, original] = loaded.publishedSnapshots.map(snapshot => snapshot.dashboard.importedDatasets[0]);
    expect(latest.id).toBe(original.id); expect(latest.rows[0].Spend).toBe("100"); expect(original.rows[0].Spend).toBe("10");
    for (const [study, total] of [[latest, 120], [original, 30]] as const) {
      const result = runImportedDatasetQuery({dataset: study, field: study.fields[0], measureField: study.fields[1], metric: "sum", chartType: "table"});
      expect(result.table.find(row => row.label === "Core")?.values.summary).toBe(total);
    }
  });

});
