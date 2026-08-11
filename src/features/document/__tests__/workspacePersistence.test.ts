import { describe, expect, it } from "vitest";
import type { DashboardWorkspace } from "../../../../shared/types/dashboard";
import type { DatasetConnectionProfile } from "../../../../shared/types/dataSource";
import {
  removeWorkspaceDatasetConnection,
  removeWorkspaceLiveDatasetSource,
  updateWorkspaceDatasetConnectionVerification,
  updateWorkspaceLiveDatasetSourceInspection,
  upsertWorkspaceLiveDatasetSource,
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

  it("upserts live dataset source descriptors", () => {
    const updated = upsertWorkspaceLiveDatasetSource(
      workspace({
        liveDatasetSources: [{
          connectionId: "connection_snowflake",
          objectType: "table",
          objectPath: "OLD.RESPONSES",
          label: "Old source",
          syncMode: "live_query",
          status: "needs_verification",
          statusLabel: "Needs verification",
          sourceRef: {
            id: "live:snowflake:connection_snowflake:default",
            kind: "live_connection",
            provider: "snowflake",
            label: "Old source",
            datasetId: "old",
            connectionId: "connection_snowflake"
          }
        }]
      }),
      {
        connectionId: "connection_snowflake",
        objectType: "table",
        objectPath: "SURVEY.PUBLIC.RESPONSES",
        label: "Snowflake source",
        syncMode: "live_query",
        status: "available",
        statusLabel: "Ready for live source setup",
        sourceRef: {
          id: "live:snowflake:connection_snowflake:default",
          kind: "live_connection",
          provider: "snowflake",
          label: "Snowflake source",
          datasetId: "responses",
          connectionId: "connection_snowflake"
        }
      }
    );

    expect(updated.liveDatasetSources).toHaveLength(1);
    expect(updated.liveDatasetSources[0]).toMatchObject({
      label: "Snowflake source",
      objectPath: "SURVEY.PUBLIC.RESPONSES",
      status: "available"
    });
  });

  it("preserves editable live source mapping metadata", () => {
    const updated = upsertWorkspaceLiveDatasetSource(
      workspace(),
      {
        connectionId: "connection_snowflake",
        objectType: "view",
        objectPath: "SURVEY.PUBLIC.CLEAN_RESPONSES",
        label: "Clean survey responses",
        syncMode: "live_query",
        status: "available",
        statusLabel: "Ready",
        rowCountEstimate: 4000,
        fieldCount: 3160,
        sourceRef: {
          id: "live:snowflake:connection_snowflake:default",
          kind: "live_connection",
          provider: "snowflake",
          label: "Clean survey responses",
          datasetId: "responses",
          connectionId: "connection_snowflake",
          objectPath: "SURVEY.PUBLIC.CLEAN_RESPONSES"
        }
      }
    );

    expect(updated.liveDatasetSources[0]).toMatchObject({
      label: "Clean survey responses",
      objectType: "view",
      rowCountEstimate: 4000,
      fieldCount: 3160,
      sourceRef: {
        label: "Clean survey responses",
        objectPath: "SURVEY.PUBLIC.CLEAN_RESPONSES"
      }
    });
  });

  it("removes a single live dataset source descriptor", () => {
    const initial = workspace({
      liveDatasetSources: [
        {
          connectionId: "connection_snowflake",
          objectType: "table",
          objectPath: "SURVEY.PUBLIC.RESPONSES",
          label: "Snowflake source",
          syncMode: "live_query",
          status: "available",
          statusLabel: "Ready",
          sourceRef: {
            id: "live:snowflake:connection_snowflake:default",
            kind: "live_connection",
            provider: "snowflake",
            label: "Snowflake source",
            datasetId: "responses",
            connectionId: "connection_snowflake"
          }
        },
        {
          connectionId: "connection_supabase",
          objectType: "table",
          objectPath: "public.imported_datasets",
          label: "Supabase source",
          syncMode: "live_query",
          status: "needs_verification",
          statusLabel: "Needs verification",
          sourceRef: {
            id: "live:supabase:connection_supabase:default",
            kind: "live_connection",
            provider: "supabase",
            label: "Supabase source",
            datasetId: "supabase",
            connectionId: "connection_supabase"
          }
        }
      ]
    });

    const updated = removeWorkspaceLiveDatasetSource(initial, "live:snowflake:connection_snowflake:default");

    expect(updated.liveDatasetSources).toHaveLength(1);
    expect(updated.liveDatasetSources[0].sourceRef.id).toBe("live:supabase:connection_supabase:default");
  });

  it("persists live source inspection metadata", () => {
    const updated = updateWorkspaceLiveDatasetSourceInspection(
      workspace({
        liveDatasetSources: [{
          connectionId: "connection_snowflake",
          objectType: "table",
          objectPath: "SURVEY.PUBLIC.RESPONSES",
          label: "Snowflake source",
          syncMode: "live_query",
          status: "available",
          statusLabel: "Mapped",
          sourceRef: {
            id: "live:snowflake:connection_snowflake:default",
            kind: "live_connection",
            provider: "snowflake",
            label: "Snowflake source",
            datasetId: "responses",
            connectionId: "connection_snowflake"
          }
        }]
      }),
      {
        provider: "snowflake",
        connectionId: "connection_snowflake",
        sourceRefId: "live:snowflake:connection_snowflake:default",
        objectPath: "SURVEY.PUBLIC.RESPONSES",
        objectType: "table",
        status: "inspected",
        statusLabel: "Fields inspected",
        inspectedAt: "2026-08-03T00:00:00.000Z",
        fields: [
          { id: "gender", label: "Gender", rawName: "GENDER", type: "text", sourceType: "VARCHAR" },
          { id: "age", label: "Age", rawName: "AGE", type: "number", sourceType: "NUMBER" }
        ],
        diagnostics: ["2 fields returned."],
        nextStep: "Map fields before enabling query creation."
      }
    );

    expect(updated.liveDatasetSources[0]).toMatchObject({
      fieldCount: 2,
      statusLabel: "Fields inspected",
      inspection: {
        status: "inspected",
        fields: [
          { rawName: "GENDER", type: "text" },
          { rawName: "AGE", type: "number" }
        ],
        nextStep: "Map fields before enabling query creation."
      }
    });
  });
});
