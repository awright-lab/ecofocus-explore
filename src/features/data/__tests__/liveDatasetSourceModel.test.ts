import { describe, expect, it } from "vitest";
import type { LiveDatasetSourceDescriptor } from "../../../../shared/types/dataSource";
import { buildLiveDatasetSourceReadinessView } from "../liveDatasetSourceModel";

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
      statusLabel: "Ready",
      structureLabel: "4,000 est. rows · 3,160 fields",
      canCreateQuery: false,
      actionLabel: "Query soon"
    });
  });

  it("explains verification requirements for unverified live sources", () => {
    expect(buildLiveDatasetSourceReadinessView(source({ status: "needs_verification" }))).toMatchObject({
      statusLabel: "Verify",
      readinessNote: "Server verification needed before live query setup."
    });
  });

  it("falls back to mapping saved when estimates are unavailable", () => {
    expect(buildLiveDatasetSourceReadinessView(source({ rowCountEstimate: undefined, fieldCount: undefined })).structureLabel).toBe("Mapping saved");
  });
});
