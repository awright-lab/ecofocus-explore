import { describe, expect, it } from "vitest";
import type { DashboardWorkspace, ImportedDatasetRecord } from "../../../../shared/types/dashboard";
import {
  buildWorkspaceDatasetSourceRegistry,
  datasetSourceRefForImportedDataset,
  normalizeDatasetSourceRefForImportedDataset
} from "../datasetSourceRegistry";

function importedDataset(overrides: Partial<ImportedDatasetRecord> = {}): ImportedDatasetRecord {
  return {
    id: "customers",
    title: "Customer survey",
    sourceType: "local_file",
    fileName: "customers.csv",
    fileType: "csv",
    importedAt: "2026-08-01T00:00:00.000Z",
    rowCount: 100,
    fieldCount: 12,
    fields: [],
    rows: [],
    previewRows: [],
    modelingStatus: "initial_model",
    notes: [],
    ...overrides
  };
}

describe("dataset source registry", () => {
  it("classifies local imported files as imported-file sources", () => {
    expect(datasetSourceRefForImportedDataset(importedDataset())).toMatchObject({
      id: "imported:customers",
      kind: "imported_file",
      provider: "local_file",
      label: "Customer survey",
      datasetId: "customers"
    });
  });

  it("classifies remote imported rows as workspace database sources", () => {
    const dataset = importedDataset({
      sourceType: "netlify",
      remote: {
        provider: "netlify",
        projectUrl: "postgres://netlify",
        bucket: "datasets",
        objectPath: "imports/customers.sav",
        recordId: "rowset_123",
        uploadedAt: "2026-08-01T00:00:00.000Z"
      }
    });

    expect(normalizeDatasetSourceRefForImportedDataset(dataset)).toMatchObject({
      id: "imported:customers",
      kind: "workspace_database",
      provider: "netlify",
      connectionId: "netlify:postgres://netlify",
      remoteRecordId: "rowset_123",
      objectPath: "imports/customers.sav"
    });
  });

  it("builds a workspace registry with seeded and imported sources", () => {
    const workspace: DashboardWorkspace = {
      id: "workspace",
      label: "Workspace",
      activeReportId: "report",
      importedDatasets: [importedDataset()],
      reports: [],
      publishedSnapshots: []
    };

    expect(buildWorkspaceDatasetSourceRegistry(workspace).map((source) => source.kind)).toEqual([
      "seeded_demo",
      "imported_file"
    ]);
  });
});
