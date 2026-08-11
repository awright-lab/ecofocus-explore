import { describe, expect, it } from "vitest";
import type { LiveDatasetFieldDescriptor, LiveDatasetSourceDescriptor } from "../../../../shared/types/dataSource";
import {
  applySuggestedLiveDatasetFieldModeling,
  buildLiveDatasetFieldModelingView,
  buildLiveDatasetSourceFieldModelingSummary,
  suggestedLiveDatasetFieldRole,
  updateLiveDatasetFieldModeling
} from "../liveDatasetFieldModel";

function field(overrides: Partial<LiveDatasetFieldDescriptor> = {}): LiveDatasetFieldDescriptor {
  return {
    id: "gender",
    label: "Gender",
    rawName: "GENDER",
    type: "text",
    ...overrides
  };
}

function source(fields: LiveDatasetFieldDescriptor[]): LiveDatasetSourceDescriptor {
  return {
    connectionId: "connection_snowflake",
    objectType: "table",
    objectPath: "SURVEY.PUBLIC.RESPONSES",
    label: "Snowflake source",
    syncMode: "live_query",
    status: "available",
    statusLabel: "Fields inspected",
    sourceRef: {
      id: "live:snowflake:connection_snowflake:default",
      kind: "live_connection",
      provider: "snowflake",
      label: "Snowflake source",
      datasetId: "responses",
      connectionId: "connection_snowflake"
    },
    inspection: {
      status: "inspected",
      statusLabel: "Fields inspected",
      inspectedAt: "2026-08-03T00:00:00.000Z",
      fields,
      diagnostics: ["Fields inspected."],
      nextStep: "Map roles."
    }
  };
}

describe("live dataset field model", () => {
  it("suggests lightweight roles from inspected field type and name", () => {
    expect(suggestedLiveDatasetFieldRole(field({ rawName: "RESPONDENT_ID", type: "number" }))).toBe("identifier");
    expect(suggestedLiveDatasetFieldRole(field({ rawName: "AGE", type: "number" }))).toBe("measure");
    expect(suggestedLiveDatasetFieldRole(field({ rawName: "COMPLETED_AT", type: "date" }))).toBe("date");
    expect(suggestedLiveDatasetFieldRole(field({ rawName: "GENDER", type: "text" }))).toBe("dimension");
  });

  it("builds plain-language field modeling views", () => {
    expect(buildLiveDatasetFieldModelingView(field({
      modelingRole: "dimension",
      eligibleForFilter: true,
      eligibleForBanner: true
    }))).toMatchObject({
      roleLabel: "Group",
      readinessLabel: "Modeled for grouping",
      readinessTone: "ready",
      chips: ["Text", "Group", "Filter", "Breakout"]
    });
  });

  it("summarizes inspected source field modeling progress", () => {
    expect(buildLiveDatasetSourceFieldModelingSummary(source([
      field({ id: "gender", modelingRole: "dimension", eligibleForFilter: true, eligibleForBanner: true }),
      field({ id: "age", rawName: "AGE", type: "number", modelingRole: "measure" }),
      field({ id: "uuid", rawName: "UUID", type: "text", modelingRole: "identifier" }),
      field({ id: "raw", rawName: "RAW_TEXT", type: "unknown" })
    ]))).toMatchObject({
      inspectedFields: 4,
      modeledFields: 3,
      dimensions: 1,
      measures: 1,
      identifiers: 1,
      filterReadyFields: 1,
      bannerReadyFields: 1,
      statusLabel: "Partially modeled"
    });
  });

  it("applies suggested roles without enabling unsupported query creation", () => {
    expect(applySuggestedLiveDatasetFieldModeling([
      field({ id: "gender", rawName: "GENDER", type: "text" }),
      field({ id: "age", rawName: "AGE", type: "number" }),
      field({ id: "record", rawName: "RECORD", type: "number" })
    ])).toMatchObject([
      { id: "gender", modelingRole: "dimension", eligibleForFilter: true, eligibleForBanner: true },
      { id: "age", modelingRole: "measure", eligibleForFilter: false, eligibleForBanner: false },
      { id: "record", modelingRole: "identifier", eligibleForFilter: false, eligibleForBanner: false }
    ]);
  });

  it("updates one field role and clears grouping eligibility for non-dimensions", () => {
    expect(updateLiveDatasetFieldModeling([
      field({ id: "gender", modelingRole: "dimension", eligibleForFilter: true, eligibleForBanner: true }),
      field({ id: "age", rawName: "AGE", type: "number" })
    ], "gender", { modelingRole: "identifier" })).toMatchObject([
      { id: "gender", modelingRole: "identifier", eligibleForFilter: false, eligibleForSegment: false, eligibleForBanner: false },
      { id: "age" }
    ]);
  });
});
