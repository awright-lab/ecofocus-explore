import { afterEach, describe, expect, it, vi } from "vitest";
import { handler } from "../live-dataset-query";
import type { LiveDatasetQueryDefinition, LiveDatasetSourceDescriptor } from "../../../shared/types/dataSource";

function event(body: unknown, method = "POST") {
  return {
    httpMethod: method,
    body: body === null ? null : JSON.stringify(body)
  };
}

const source: LiveDatasetSourceDescriptor = {
  sourceRef: {
    id: "live:snowflake:connection_snowflake:default",
    kind: "live_connection",
    provider: "snowflake",
    label: "Snowflake responses",
    datasetId: "live_snowflake",
    connectionId: "connection_snowflake",
    objectPath: "SURVEY.PUBLIC.RESPONSES"
  },
  connectionId: "connection_snowflake",
  objectType: "table",
  objectPath: "SURVEY.PUBLIC.RESPONSES",
  label: "Snowflake responses",
  syncMode: "live_query",
  status: "available",
  statusLabel: "Available",
  inspection: {
    status: "inspected",
    statusLabel: "Fields inspected",
    inspectedAt: "2026-08-12T00:00:00.000Z",
    fields: [{
      id: "gender",
      label: "Gender",
      rawName: "GENDER",
      type: "text",
      modelingRole: "dimension"
    }],
    diagnostics: [],
    nextStep: "Model fields."
  }
};

const definition: LiveDatasetQueryDefinition = {
  id: "definition_gender",
  label: "Responses by Gender",
  sourceRefId: source.sourceRef.id,
  kind: "categorical",
  primaryFieldId: "gender",
  primaryFieldLabel: "Gender",
  metric: "count",
  outputMode: "table",
  status: "execution_pending",
  statusLabel: "Execution pending",
  notes: [],
  createdAt: "2026-08-12T00:00:00.000Z",
  updatedAt: "2026-08-12T00:00:00.000Z"
};

describe("live dataset query function", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects non-POST requests", async () => {
    const response = await handler(event(null, "GET") as never, {} as never, undefined as never);

    expect(response?.statusCode).toBe(405);
  });

  it("rejects missing execution fields", async () => {
    const response = await handler(event({ source }) as never, {} as never, undefined as never);
    const body = JSON.parse(response?.body ?? "{}") as { error: string; details: string[] };

    expect(response?.statusCode).toBe(400);
    expect(body.error).toBe("Missing live query execution fields.");
    expect(body.details[0]).toContain("source and definition are required");
  });

  it("reports unsupported providers honestly", async () => {
    const response = await handler(
      event({
        source: {
          ...source,
          connectionId: "connection_supabase",
          sourceRef: { ...source.sourceRef, provider: "supabase", connectionId: "connection_supabase" }
        },
        definition
      }) as never,
      {} as never,
      undefined as never
    );
    const body = JSON.parse(response?.body ?? "{}") as { status: string; statusLabel: string; diagnostics: string[] };

    expect(response?.statusCode).toBe(200);
    expect(body.status).toBe("unsupported");
    expect(body.statusLabel).toBe("Provider execution pending");
    expect(body.diagnostics[0]).toContain("supabase live query execution is not implemented yet");
  });

  it("reports missing Snowflake server environment without executing live SQL", async () => {
    [
      "SNOWFLAKE_ACCOUNT",
      "SNOWFLAKE_USERNAME",
      "SNOWFLAKE_PASSWORD",
      "SNOWFLAKE_WAREHOUSE",
      "SNOWFLAKE_DATABASE",
      "SNOWFLAKE_SCHEMA",
      "SNOWFLAKE_ROLE"
    ].forEach((name) => vi.stubEnv(name, ""));

    const response = await handler(event({ source, definition }) as never, {} as never, undefined as never);
    const body = JSON.parse(response?.body ?? "{}") as { status: string; statusLabel: string; diagnostics: string[] };

    expect(response?.statusCode).toBe(200);
    expect(body.status).toBe("failed");
    expect(body.statusLabel).toBe("Missing server environment");
    expect(body.diagnostics[0]).toContain("Missing Snowflake environment variables");
  });

  it("reports measure definitions as unsupported", async () => {
    const response = await handler(
      event({
        source,
        definition: {
          ...definition,
          kind: "measure",
          measureFieldId: "age",
          measureFieldLabel: "Age",
          metric: "average"
        }
      }) as never,
      {} as never,
      undefined as never
    );
    const body = JSON.parse(response?.body ?? "{}") as { status: string; diagnostics: string[] };

    expect(response?.statusCode).toBe(200);
    expect(body.status).toBe("unsupported");
    expect(body.diagnostics[0]).toContain("Measure definitions are still saved metadata only");
  });
});
