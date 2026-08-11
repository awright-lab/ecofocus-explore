import { describe, expect, it } from "vitest";
import type { DashboardWorkspace } from "../../../../shared/types/dashboard";
import type { DatasetConnectionProfile } from "../../../../shared/types/dataSource";
import {
  removeWorkspaceDatasetConnection,
  updateWorkspaceDatasetConnectionVerification,
  upsertWorkspaceDatasetConnection
} from "../workspacePersistence";

function connection(overrides: Partial<DatasetConnectionProfile> = {}): DatasetConnectionProfile {
  return {
    id: "connection_snowflake",
    provider: "snowflake",
    label: "Snowflake",
    description: "Warehouse connection",
    status: "setup_scaffold",
    statusLabel: "Provider foundation ready",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides
  };
}

function workspace(overrides: Partial<DashboardWorkspace> = {}): DashboardWorkspace {
  return {
    id: "workspace",
    label: "Workspace",
    activeReportId: "report",
    datasetConnections: [],
    liveDatasetSources: [],
    importedDatasets: [],
    reports: [],
    publishedSnapshots: [],
    ...overrides
  };
}

describe("workspace dataset connection persistence", () => {
  it("upserts planned connections by provider", () => {
    const initial = workspace({
      datasetConnections: [connection({ statusLabel: "Old label" })]
    });
    const updated = upsertWorkspaceDatasetConnection(initial, connection({ statusLabel: "Updated label" }));

    expect(updated.datasetConnections).toHaveLength(1);
    expect(updated.datasetConnections[0]).toMatchObject({
      provider: "snowflake",
      statusLabel: "Updated label"
    });
  });

  it("removes connection plans and dependent live source descriptors", () => {
    const initial = workspace({
      datasetConnections: [connection()],
      liveDatasetSources: [{
        connectionId: "connection_snowflake",
        objectType: "table",
        objectPath: "SURVEY.RESPONSES",
        label: "Responses",
        syncMode: "live_query",
        status: "needs_verification",
        statusLabel: "Needs verification",
        sourceRef: {
          id: "live:snowflake:responses",
          kind: "live_connection",
          provider: "snowflake",
          label: "Responses",
          datasetId: "responses",
          connectionId: "connection_snowflake"
        }
      }]
    });

    const updated = removeWorkspaceDatasetConnection(initial, "connection_snowflake");

    expect(updated.datasetConnections).toEqual([]);
    expect(updated.liveDatasetSources).toEqual([]);
  });

  it("persists verification readiness on planned connections", () => {
    const updated = updateWorkspaceDatasetConnectionVerification(
      workspace({ datasetConnections: [connection()] }),
      {
        provider: "snowflake",
        connectionId: "connection_snowflake",
        status: "ready_to_verify",
        statusLabel: "Ready for server verification",
        checkedAt: "2026-08-02T00:00:00.000Z",
        diagnostics: ["Environment variables are present."],
        nextStep: "Run full non-production verification."
      }
    );

    expect(updated.datasetConnections[0]).toMatchObject({
      status: "configured",
      statusLabel: "Ready for server verification",
      updatedAt: "2026-08-02T00:00:00.000Z",
      verification: {
        status: "ready_to_verify",
        diagnostics: ["Environment variables are present."]
      }
    });
  });
});
