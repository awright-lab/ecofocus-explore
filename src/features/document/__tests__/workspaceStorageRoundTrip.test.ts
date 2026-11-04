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
    // Rows live once at workspace level, rather than in each report/snapshot.
    expect(loaded.reports[0].draft.importedDatasets).toEqual([]);
    expect(loaded.publishedSnapshots[0].dashboard.importedDatasets).toEqual([]);
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
});
