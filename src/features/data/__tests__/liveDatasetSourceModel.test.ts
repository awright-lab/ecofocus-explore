import { describe, expect, it } from "vitest";
import type { LiveDatasetSourceDescriptor } from "../../../../shared/types/dataSource";
import { buildLiveDatasetQueryDraft, buildLiveDatasetSourceReadinessView, liveSourceIdentity } from "../liveDatasetSourceModel";

function source(overrides: Partial<LiveDatasetSourceDescriptor> = {}): LiveDatasetSourceDescriptor {
  return {
    connectionId: "connection_snowflake",
    objectType: "table",
    objectPath: "SURVEY.PUBLIC.RESPONSES",
    label: "Snowflake source",
    rowCountEstimate: 4000,
    fieldCount: 3160,
    syncMode: "live_query",
    status: "available",
    statusLabel: "Ready for live source setup",
    sourceRef: {
      id: "live:snowflake:connection_snowflake:default",
      kind: "live_connection",
      provider: "snowflake",
      label: "Snowflake source",
      datasetId: "live_snowflake_default",
      connectionId: "connection_snowflake",
      objectPath: "SURVEY.PUBLIC.RESPONSES"
    },
    ...overrides
  };
}

describe("live dataset source model", () => {
  it("summarizes mapped but not-yet-queryable live sources honestly", () => {
    expect(buildLiveDatasetSourceReadinessView(source())).toMatchObject({
      statusLabel: "Mapped source",
      modeLabel: "Live source",
      structureLabel: "4,000 est. rows · 3,160 fields",
      readinessNote: "Source mapping is saved. Query creation is pending provider-specific dataset support.",
      canCreateQuery: false,
      actionLabel: "Manage setup"
    });
  });

  it("explains verification requirements for unverified live sources", () => {
    expect(buildLiveDatasetSourceReadinessView(source({ status: "needs_verification" }))).toMatchObject({
      statusLabel: "Needs server check",
      stageLabels: ["Server readiness needed", "Source mapping saved", "Query support pending"],
      readinessNote: "Run server verification before enabling live query setup."
    });
  });

  it("falls back to mapping saved when estimates are unavailable", () => {
    expect(buildLiveDatasetSourceReadinessView(source({ rowCountEstimate: undefined, fieldCount: undefined })).structureLabel).toBe("Mapping saved");
  });

  it("distinguishes inspected fields from mapped-only live sources", () => {
    expect(buildLiveDatasetSourceReadinessView(source({
      rowCountEstimate: undefined,
      fieldCount: undefined,
      inspection: {
        status: "inspected",
        statusLabel: "Fields inspected",
        inspectedAt: "2026-08-03T00:00:00.000Z",
        fields: [
          { id: "gender", label: "Gender", rawName: "GENDER", type: "text" },
          { id: "age", label: "Age", rawName: "AGE", type: "number" }
        ],
        diagnostics: ["2 fields were read."],
        nextStep: "Map analytical roles for these fields before enabling live query creation."
      }
    }))).toMatchObject({
      statusLabel: "Fields inspected",
      structureLabel: "2 inspected fields",
      stageLabels: ["Server readiness", "Source mapping", "Fields inspected", "Query support pending"],
      readinessNote: "Field metadata is inspected. Map analytical roles before live query creation is enabled.",
      canCreateQuery: false
    });
  });

  it("builds a provider-neutral live source identity", () => {
    expect(liveSourceIdentity(source())).toMatchObject({
      kind: "live",
      connectionId: "connection_snowflake",
      provider: "snowflake",
      datasetLabel: "Snowflake source",
      objectPath: "SURVEY.PUBLIC.RESPONSES",
      objectType: "table",
      syncMode: "live_query",
      rowCountEstimate: 4000,
      fieldCount: 3160
    });
  });

  it("keeps live query drafts disabled until query support exists", () => {
    expect(buildLiveDatasetQueryDraft(source())).toMatchObject({
      canCreateQuery: false,
      reason: "Source mapping is saved. Query creation is pending provider-specific dataset support.",
      sourceIdentity: {
        kind: "live",
        sourceRef: {
          id: "live:snowflake:connection_snowflake:default"
        }
      }
    });
  });
});
