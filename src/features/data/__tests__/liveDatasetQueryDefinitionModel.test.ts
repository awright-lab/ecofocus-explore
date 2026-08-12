import { describe, expect, it } from "vitest";
import type { LiveDatasetFieldDescriptor, LiveDatasetSourceDescriptor } from "../../../../shared/types/dataSource";
import {
  buildLiveDatasetQueryDefinitionDraft,
  buildLiveDatasetQueryDefinitionReadiness,
  buildLiveDatasetSourceQueryDefinitionSummary,
  createLiveDatasetQueryDefinition,
  liveDatasetQueryDefinitionSummary
} from "../liveDatasetQueryDefinitionModel";

function field(overrides: Partial<LiveDatasetFieldDescriptor> = {}): LiveDatasetFieldDescriptor {
  return {
    id: "gender",
    label: "Gender",
    rawName: "GENDER",
    type: "text",
    ...overrides
  };
}

function source(fields: LiveDatasetFieldDescriptor[], overrides: Partial<LiveDatasetSourceDescriptor> = {}): LiveDatasetSourceDescriptor {
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
    },
    ...overrides
  };
}

describe("live dataset query definition model", () => {
  it("requires an inspected available source", () => {
    expect(buildLiveDatasetQueryDefinitionDraft(source([], { status: "needs_verification" }))).toMatchObject({
      canSave: false,
      label: "Live query definition unavailable"
    });
    expect(buildLiveDatasetQueryDefinitionDraft(source([], { inspection: undefined }))).toMatchObject({
      canSave: false,
      label: "Inspect fields first"
    });
  });

  it("requires at least one modeled group field", () => {
    expect(buildLiveDatasetQueryDefinitionDraft(source([
      field({ id: "age", label: "Age", rawName: "AGE", type: "number", modelingRole: "measure" })
    ]))).toMatchObject({
      canSave: false,
      label: "Model a group field"
    });
  });

  it("builds a categorical count definition draft from a modeled group field", () => {
    expect(buildLiveDatasetQueryDefinitionDraft(source([
      field({ modelingRole: "dimension", eligibleForFilter: true })
    ]))).toMatchObject({
      canSave: true,
      kind: "categorical",
      label: "Responses by Gender",
      metric: "count",
      primaryField: {
        id: "gender"
      }
    });
  });

  it("prefers a measure definition when a measure and group field exist", () => {
    expect(buildLiveDatasetQueryDefinitionDraft(source([
      field({ modelingRole: "dimension" }),
      field({ id: "age", label: "Age", rawName: "AGE", type: "number", modelingRole: "measure" })
    ]))).toMatchObject({
      canSave: true,
      kind: "measure",
      label: "Average Age by Gender",
      metric: "average",
      measureField: {
        id: "age"
      }
    });
  });

  it("creates an execution-pending saved definition", () => {
    const definition = createLiveDatasetQueryDefinition(source([
      field({ modelingRole: "dimension" })
    ]));

    expect(definition).toMatchObject({
      label: "Responses by Gender",
      sourceRefId: "live:snowflake:connection_snowflake:default",
      kind: "categorical",
      primaryFieldId: "gender",
      metric: "count",
      status: "execution_pending",
      statusLabel: "Execution pending"
    });
    expect(definition?.notes[1]).toContain("Provider execution is intentionally not enabled");
  });

  it("summarizes saved definitions plainly", () => {
    const definition = createLiveDatasetQueryDefinition(source([
      field({ modelingRole: "dimension" })
    ]));

    expect(definition ? liveDatasetQueryDefinitionSummary(definition) : "").toBe("Count Gender · Grouped by Gender · Execution pending");
  });

  it("keeps matching definitions execution-pending rather than executable", () => {
    const liveSource = source([field({ modelingRole: "dimension" })]);
    const definition = createLiveDatasetQueryDefinition(liveSource);

    expect(definition ? buildLiveDatasetQueryDefinitionReadiness(liveSource, definition) : null).toMatchObject({
      statusLabel: "Execution pending",
      canExecute: false,
      tone: "pending",
      nextStep: "Add the provider query runner before creating live tables or charts from this definition."
    });
  });

  it("marks saved definitions stale when field roles change", () => {
    const definition = createLiveDatasetQueryDefinition(source([field({ modelingRole: "dimension" })]));
    const changedSource = source([field({ modelingRole: "measure" })]);

    expect(definition ? buildLiveDatasetQueryDefinitionReadiness(changedSource, definition) : null).toMatchObject({
      statusLabel: "Role changed",
      tone: "stale",
      canExecute: false
    });
  });

  it("summarizes source query-definition readiness", () => {
    const definition = createLiveDatasetQueryDefinition(source([field({ modelingRole: "dimension" })]));
    const liveSource = source([field({ modelingRole: "dimension" })], {
      queryDefinitions: definition ? [definition] : []
    });

    expect(buildLiveDatasetSourceQueryDefinitionSummary(liveSource)).toMatchObject({
      savedCount: 1,
      staleCount: 0,
      statusLabel: "Definitions saved",
      canExecute: false
    });
  });
});
