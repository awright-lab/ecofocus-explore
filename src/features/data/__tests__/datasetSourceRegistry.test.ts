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
      datasetConnections: [],
      liveDatasetSources: [{
        connectionId: "connection_snowflake",
        objectType: "table",
        objectPath: "ANALYTICS.SURVEY.RESPONSES",
        label: "Snowflake responses",
        syncMode: "live_query",
        status: "needs_verification",
        statusLabel: "Needs verification",
        rowCountEstimate: 5000,
        fieldCount: 24,
        sourceRef: {
          id: "live:snowflake:responses",
          kind: "live_connection",
          provider: "snowflake",
          label: "Snowflake responses",
          datasetId: "responses",
          connectionId: "connection_snowflake",
          objectPath: "ANALYTICS.SURVEY.RESPONSES"
        }
      }],
      importedDatasets: [importedDataset()],
      reports: [],
      publishedSnapshots: []
    };

    expect(buildWorkspaceDatasetSourceRegistry(workspace).map((source) => source.kind)).toEqual([
      "seeded_demo",
      "imported_file",
      "live_connection"
    ]);
    expect(buildWorkspaceDatasetSourceRegistry(workspace).at(-1)).toMatchObject({
      provider: "snowflake",
      statusLabel: "Needs verification",
      rowCount: 5000,
      fieldCount: 24
    });
  });

  it("uses inspected live source metadata when available", () => {
    const workspace: DashboardWorkspace = {
      id: "workspace",
      label: "Workspace",
      activeReportId: "report",
      datasetConnections: [],
      liveDatasetSources: [{
        connectionId: "connection_snowflake",
        objectType: "table",
        objectPath: "ANALYTICS.SURVEY.RESPONSES",
        label: "Snowflake responses",
        syncMode: "live_query",
        status: "available",
        statusLabel: "Mapped source",
        fieldCount: 24,
        sourceRef: {
          id: "live:snowflake:responses",
          kind: "live_connection",
          provider: "snowflake",
          label: "Snowflake responses",
          datasetId: "responses",
          connectionId: "connection_snowflake",
          objectPath: "ANALYTICS.SURVEY.RESPONSES"
        },
        inspection: {
          status: "inspected",
          statusLabel: "Fields inspected",
          inspectedAt: "2026-08-03T00:00:00.000Z",
          fields: [
            { id: "gender", label: "Gender", rawName: "GENDER", type: "text" },
            { id: "age", label: "Age", rawName: "AGE", type: "number" }
          ],
          diagnostics: ["2 fields inspected."],
          nextStep: "Map analytical roles."
        }
      }],
      importedDatasets: [],
      reports: [],
      publishedSnapshots: []
    };

    expect(buildWorkspaceDatasetSourceRegistry(workspace).at(-1)).toMatchObject({
      statusLabel: "Fields inspected",
      fieldCount: 2,
      detail: "table · Live query · ANALYTICS.SURVEY.RESPONSES · Fields inspected"
    });
  });
});
